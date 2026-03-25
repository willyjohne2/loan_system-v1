from rest_framework import views, permissions, generics, status, serializers
from rest_framework.response import Response
from django.utils import timezone
from django.db import models
import uuid
import logging
from ..models import (
    Loans, 
    LoanProducts, 
    Users, 
    SystemSettings, 
    AuditLogs, 
    LoanActivity, 
    Notifications, 
    SMSLog,
    SystemCapital,
    Admins
)

logger = logging.getLogger(__name__)

from ..serializers import (
    LoanSerializer, 
    LoanProductSerializer,
    LoanActivitySerializer,
    LoanDocumentSerializer
)
from ..utils.security import log_action, get_client_ip, get_filtered_queryset
from ..utils.sms import send_sms_async

def create_loan_activity(loan, admin, action, note=""):
    LoanActivity.objects.create(loan=loan, admin=admin, action=action, note=note)

def create_notification(user, message):
    Notifications.objects.create(user=user, message=message, is_read=False)

class LoanListCreateView(generics.ListCreateAPIView):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = get_filtered_queryset(self.request.user, Loans.objects.select_related("user", "user__profile", "loan_product"), 'user__profile__branch_fk', request=self.request)
        
        # Additional Filters
        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            from django.db.models import Q
            qs = qs.filter(
                Q(user__full_name__icontains=search) | 
                Q(user__phone__icontains=search) | 
                Q(user__profile__national_id__icontains=search) | 
                Q(id__icontains=search)
            )

        status = self.request.query_params.get('status')
        if status:
            statuses = [s.strip() for s in status.split(',') if s.strip()]
            qs = qs.filter(status__in=statuses)
            
        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering in ['created_at', '-created_at', 'status', '-status', 'updated_at', '-updated_at']:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")
            
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        user_role = getattr(user, "role", "STAFF")
        if user_role not in ["FIELD_OFFICER", "MANAGER"] and not getattr(user, "god_mode_enabled", False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Field Officers and Managers can apply for loans on behalf of customers. High-level accounts must use God Mode.")

        created_by = user if (user and user.is_authenticated) else None
        customer_id = self.request.data.get("user")
        if customer_id:
            try:
                customer = Users.objects.get(id=customer_id)
                profile = getattr(customer, "profile", None)
                missing_fields = []
                if not customer.full_name: missing_fields.append("full_name")
                if not customer.phone: missing_fields.append("phone")
                if not profile: missing_fields.append("profile")
                else:
                    if not profile.national_id: missing_fields.append("national_id")
                    if not profile.national_id_image: missing_fields.append("national_id_image")
                    if not profile.employment_status: missing_fields.append("employment_status")
                    if not profile.monthly_income: missing_fields.append("monthly_income")
                if not customer.guarantors.exists(): missing_fields.append("at least one guarantor")
                if missing_fields: raise serializers.ValidationError({"error": f"Customer profile incomplete. Missing fields: {', '.join(missing_fields)}"})
                if customer.is_locked: raise serializers.ValidationError({"error": "This customer account is locked/archived and cannot apply for new loans."})
            except Users.DoesNotExist: pass
        interest_rate = self.request.data.get("interest_rate")
        duration_weeks = self.request.data.get("duration_weeks")
        product_id = self.request.data.get("loan_product")
        if duration_weeks:
            try:
                weeks = int(duration_weeks)
                if weeks == 4: interest_rate = 25.0
                elif weeks == 5: interest_rate = 31.25
                elif weeks == 6: interest_rate = 36.35
            except (ValueError, TypeError): pass
        if not interest_rate:
            if product_id:
                try:
                    product = LoanProducts.objects.get(id=product_id)
                    interest_rate = product.interest_rate
                except LoanProducts.DoesNotExist: pass
            if not interest_rate:
                try:
                    interest_setting = SystemSettings.objects.get(key="DEFAULT_INTEREST_RATE")
                    interest_rate = float(interest_setting.value)
                except (SystemSettings.DoesNotExist, ValueError, TypeError): interest_rate = 15.0
        loan = serializer.save(interest_rate=interest_rate, created_by=created_by)
        try:
            ip = get_client_ip(self.request)
            log_action(self.request.user, f"Created new Loan application for {loan.user.full_name}", "loans", loan.id, log_type="GENERAL", ip_address=ip)
            create_loan_activity(loan, created_by, "APPLIED", f"Loan applied for KES {float(loan.principal_amount):,.2f}")
            create_notification(loan.user, f"Your loan application of KES {float(loan.principal_amount):,.2f} has been received and is under review.")
            if hasattr(loan.user, "phone") and loan.user.phone:
                msg = f"Hello {loan.user.full_name}, your loan application of KES {float(loan.principal_amount):,.2f} has been received and is under review."
                send_sms_async([loan.user.phone], msg)
                SMSLog.objects.create(sender=created_by, recipient_phone=loan.user.phone, recipient_name=loan.user.full_name, message=msg, type="AUTO")
        except Exception as e:
            print(f"[DEBUG] Loan created ID {loan.id} but post-save tasks failed: {str(e)}")
            pass

class LoanDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated: return Loans.objects.none()
        
        # Super Admins and Owners can see everything
        if getattr(user, "is_super_admin", False) or getattr(user, "is_owner", False) or user.role == "OWNER":
            return Loans.objects.all()
            
        if hasattr(user, "role") and user.role == "MANAGER":
            # Managers can see loans in their branch
            if user.branch_fk:
                return Loans.objects.filter(user__profile__branch_fk=user.branch_fk)
            elif user.branch:
                return Loans.objects.filter(user__profile__branch=user.branch)
            return Loans.objects.none()
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Loans.objects.filter(created_by=user)
            
        return Loans.objects.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        data = self.request.data
        user = self.request.user
        user_role = getattr(user, "role", "STAFF")
        ip = get_client_ip(self.request)
        new_status = data.get("status")
        
        if new_status and new_status != instance.status:
            # 1. Block Owners and Super Admins from changing status unless God Mode is on
            # Actually, per user request: "super admins, owners and admins should be discouraged 
            # from reggistering and verifying anyloan leave those for managers and filed officers"
            # "even an owner should not be able to disbusrse funds ok because if he disbusres from his dahsbord might bring confusion"
            
            is_god_mode = getattr(user, "god_mode_enabled", False)
            
            # Disbursement blocking
            if new_status == "DISBURSED" and user_role not in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"]:
                if not is_god_mode:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only Finance Officers can disburse funds. High-level accounts must use God Mode to bypass.")

            try:
                strict_setting = SystemSettings.objects.get(key="STRICT_LOAN_WORKFLOW")
                is_strict_mode = str(strict_setting.value).lower() == "true"
            except SystemSettings.DoesNotExist: is_strict_mode = True

            # Manager Bypassing Logic
            is_manager_bypass = False
            if user_role == "MANAGER" and not is_god_mode:
                # Check if this manager is doing multiple steps themselves
                # Steps: Registered Customer -> Applied Loan -> Verified -> Approved
                customer = instance.user
                was_registered_by_user = (customer.created_by == user)
                was_applied_by_user = (instance.created_by == user)
                
                # If they are performing VERIFIED -> APPROVED and they also did the previous steps
                if new_status == "APPROVED" and was_registered_by_user and was_applied_by_user:
                    is_manager_bypass = True
                    # Log to security logs as requested
                    AuditLogs.objects.create(
                        admin=user, 
                        action=f"MANAGER BYPASS: {user.full_name} completed full loan cycle (Register -> Apply -> Verify -> Approve) for customer {customer.full_name}", 
                        log_type="SECURITY", 
                        table_name="loans", 
                        record_id=instance.id,
                        is_owner_log=True,
                        ip_address=ip,
                        new_data={
                            "reason": "Manager performed more than two steps of loan application",
                            "customer_id": str(customer.id),
                            "loan_id": str(instance.id)
                        }
                    )

            if instance.status == "UNVERIFIED" and new_status == "VERIFIED":
                if user_role != "FIELD_OFFICER" and user_role != "MANAGER" and is_strict_mode and not is_god_mode:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only Field Officers or Managers can verify unverified loans.")
                
                if is_god_mode:
                    log_action(user, f"Verified loan via God Mode",
                               "loans", instance.id,
                               log_type="GENERAL",
                               god_mode_active=True)
            elif instance.status == "VERIFIED" and new_status == "APPROVED":
                if user_role != "MANAGER" and is_strict_mode and not is_god_mode:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only Managers can approve verified loans.")
                
                # Manager audit/tracking for the approval step
                instance.manager_verified_at = timezone.now()
                
                if is_god_mode:
                    log_action(user, f"Approved loan via God Mode",
                               "loans", instance.id,
                               log_type="GENERAL",
                               god_mode_active=True)
            elif instance.status == "APPROVED" and new_status == "DISBURSED":
                if user_role not in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"] and is_strict_mode and not is_god_mode:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Only Finance Officers can disburse approved loans.")
                if is_god_mode:
                    log_action(user, f"Disbursed loan via God Mode",
                               "loans", instance.id,
                               log_type="GENERAL",
                               god_mode_active=True)
            elif new_status == "REJECTED":
                can_reject = False
                if is_god_mode: can_reject = True
                elif user_role == "FIELD_OFFICER" and instance.status == "UNVERIFIED":
                    # Field Officer rejection: Actual rejection
                    can_reject = True
                elif user_role == "MANAGER" and instance.status == "VERIFIED":
                    # Manager rejection: Send back to Field Officer (UNVERIFIED)
                    can_reject = True
                    new_status = "UNVERIFIED"
                    serializer.validated_data['status'] = "UNVERIFIED"
                    instance.status_change_reason = f"Rejected by Manager: {data.get('status_change_reason', 'No reason provided')}"
                elif user_role in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"] and instance.status == "APPROVED":
                    # Finance rejection: Send back to Manager (VERIFIED)
                    can_reject = True
                    new_status = "VERIFIED"
                    serializer.validated_data['status'] = "VERIFIED"
                    instance.status_change_reason = f"Rejected by Finance: {data.get('status_change_reason', 'No reason provided')}"
                
                if not can_reject and is_strict_mode:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You do not have permission to reject this loan at its current stage.")

        serializer.save()
        if new_status and new_status != instance.status:
            # Refresh instance from DB to ensure we have the saved status
            instance.refresh_from_db()
            create_loan_activity(instance, user, "STATUS_CHANGE", f"Status updated to {instance.status}")
            create_notification(instance.user, f"Your loan {instance.id.hex[:8]} is now {instance.status}.")
            if instance.status == "REJECTED":
                from apps.services import notify_loan_rejected
                notify_loan_rejected(instance)
            AuditLogs.objects.create(
                admin=user, 
                action=f"LOAN_{instance.status}", 
                log_type="STATUS", 
                table_name="loans", 
                record_id=instance.id, 
                old_data={"status": data.get('status', instance.status)}, 
                new_data={
                    "status": instance.status,
                    "customer": instance.user.full_name if instance.user else "N/A",
                    "amount": str(instance.principal_amount)
                }, 
                ip_address=ip
            )

class LoanProductListCreateView(generics.ListCreateAPIView):
    queryset = LoanProducts.objects.all().order_by("-created_at")
    serializer_class = LoanProductSerializer
    permission_classes = [permissions.AllowAny]

class LoanProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LoanProducts.objects.all()
    serializer_class = LoanProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        user = self.request.user
        ip = get_client_ip(self.request)
        instance = self.get_object()
        old_rate = instance.interest_rate
        product = serializer.save()
        new_rate = product.interest_rate
        if old_rate != new_rate:
            AuditLogs.objects.create(admin=user if user.is_authenticated else None, action="UPDATE_LOAN_PRODUCT_RATE", log_type="MANAGEMENT", table_name="loan_products", record_id=product.id, old_data={"interest_rate": float(old_rate) if old_rate else None}, new_data={"interest_rate": float(new_rate), "name": product.name}, ip_address=ip)

class LoanStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        base_qs = get_filtered_queryset(user, Loans.objects.all(), 'user__profile__branch_fk', request=request)
        
        counts = {
            'all_disbursed': base_qs.filter(status__in=['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID']).count(),
            'active': base_qs.filter(status='ACTIVE').count(),
            'overdue': base_qs.filter(status='OVERDUE').count(),
            'approved': base_qs.filter(status='APPROVED').count(),
            'pending': base_qs.filter(status__in=['UNVERIFIED', 'VERIFIED', 'PENDING']).count(),
            'rejected': base_qs.filter(status='REJECTED').count()
        }
        return Response(counts)

class MpesaDisbursementView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        role = getattr(user, "role", None)
        ip = get_client_ip(request)
        if role not in ["ADMIN", "MANAGER", "FINANCE_OFFICER", "FINANCIAL_OFFICER"]:
            return Response({"error": "Unauthorized to trigger disbursements"}, status=403)
        mode = request.data.get("mode", "single")
        confirmed = request.data.get("confirmed", True)
        reason = request.data.get("reason", "Standard Disbursement")
        if not confirmed: return Response({"error": "Two-step confirmation required."}, status=400)
        try:
            limit_setting = SystemSettings.objects.get(key="DAILY_OFFICER_DISBURSEMENT_LIMIT")
            daily_limit = float(limit_setting.value)
        except: daily_limit = 500000.0
        today_start = timezone.now().astimezone(timezone.get_current_timezone()).replace(hour=0, minute=0, second=0, microsecond=0)
        today_disbursements = AuditLogs.objects.filter(admin=user, action="LOAN_DISBURSED", created_at__gte=today_start)
        total_today = sum([float(log.new_data.get("amount", 0)) for log in today_disbursements if log.new_data])
        if mode == "single":
            loan_id = request.data.get("loan_id")
            mpesa_phone = request.data.get("mpesa_phone")
            if not loan_id: return Response({"error": "loan_id is required"}, status=400)
            try:
                loan = Loans.objects.get(id=loan_id)
                
                # If mpesa_phone is provided in request, update the user record before disbursement
                if mpesa_phone and mpesa_phone != loan.user.phone:
                    user_to_update = loan.user
                    user_to_update.phone = mpesa_phone
                    user_to_update.save()

                capital = SystemCapital.objects.first()
                if capital and capital.balance < 50000:
                    super_admins = Admins.objects.filter(is_super_admin=True)
                    for sa in super_admins: create_notification(sa, f"URGENT: System Capital is low! Current Balance: {capital.balance}")
                if total_today + float(loan.principal_amount) > daily_limit:
                    return Response({"error": f"Daily disbursement limit exceeded. Current total: KES {total_today:,}"}, status=403)
                if loan.status != "APPROVED": return Response({"error": f"Only APPROVED loans can be disbursed. Current status: {loan.status}"}, status=400)
                
                from ..services import DisbursementService
                from ..exceptions import InsufficientCapitalError

                try:
                    DisbursementService.disburse_loan(loan, user)
                    AuditLogs.objects.create(
                        admin=user, 
                        action="LOAN_DISBURSED", 
                        log_type="MANAGEMENT", 
                        table_name="loans", 
                        record_id=loan.id, 
                        old_data={"status": "APPROVED"}, 
                        new_data={"status": "DISBURSED", "amount": float(loan.principal_amount), "reason": reason}, 
                        ip_address=ip
                    )
                    return Response({'message': 'Disbursement initiated successfully. Awaiting M-Pesa confirmation.'})
                except InsufficientCapitalError as e:
                    return Response({'error': str(e)}, status=400)
                except Exception as e:
                    logger.error(f"Disbursement error for loan {loan.id}: {e}")
                    return Response({'error': f'Disbursement failed: {str(e)}'}, status=500)

            except Loans.DoesNotExist: return Response({"error": "Loan not found"}, status=404)
            except Exception as e: return Response({"error": str(e)}, status=500)
        elif mode == "bulk":
            loans_to_disburse = Loans.objects.filter(status="APPROVED").order_by("created_at")[:10]
            results = []
            current_batch_total = total_today
            from ..services import DisbursementService
            for loan in loans_to_disburse:
                amt = float(loan.principal_amount)
                if current_batch_total + amt > daily_limit:
                    results.append({"loan_id": str(loan.id), "status": "failed", "error": "Daily limit reached during bulk process"})
                    continue
                try:
                    DisbursementService.disburse_loan(loan, user)
                    current_batch_total += amt
                    results.append({"loan_id": str(loan.id), "status": "success"})
                    AuditLogs.objects.create(admin=user, action="LOAN_DISBURSED", log_type="MANAGEMENT", table_name="loans", record_id=loan.id, old_data={"status": "APPROVED"}, new_data={"status": "DISBURSED", "amount": amt, "reason": "Bulk Disbursement"}, ip_address=ip)
                except Exception as e: results.append({"loan_id": str(loan.id), "status": "failed", "error": str(e)})
            return Response({"message": "Bulk disbursement completed", "results": results})
        return Response({"error": "Invalid mode or missing loan_id"}, status=400)

class LoanDocumentCreateView(generics.CreateAPIView):
    serializer_class = LoanDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        loan_id = self.request.data.get("loan")
        user = self.request.user

        try:
            loan = Loans.objects.get(id=loan_id)
        except Loans.DoesNotExist:
            raise serializers.ValidationError({"error": "Loan not found"})

        if hasattr(user, "role"):
            if user.role == "MANAGER" and loan.user.profile.branch != user.branch:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have access to this loan's branch")
            if user.role == "FIELD_OFFICER" and loan.created_by != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You didn't create this loan application")

        doc = serializer.save()

        create_loan_activity(
            loan,
            self.request.user,
            "DOCUMENT_UPLOADED",
            f"Uploaded {doc.doc_type or 'DOC'}: {doc.name}",
        )
