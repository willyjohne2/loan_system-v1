from rest_framework import views, permissions, generics, status
from rest_framework.response import Response
from django.utils import timezone
from django.db import models
from ..models import (
    SecureSettings, 
    SystemSettings, 
    SMSLog, 
    AuditLogs, 
    Loans, 
    Users,
    Admins
)
from ..serializers import (
    SecureSettingsSerializer, 
    SystemSettingsSerializer, 
    SMSLogSerializer, 
    AuditLogSerializer,
    EmailLogSerializer
)
from ..utils.security import log_action, get_client_ip
from ..utils.encryption import decrypt_value, get_setting
from ..utils.sms import send_sms_async
from ..permissions import IsAdminUser, IsOwnerOrCoOwner
import threading

class SecurityThreatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        is_owner = getattr(user, 'is_owner', False)
        is_super = getattr(user, 'is_super_admin', False)
        
        # Only Owner and Super Admins should access detailed security threats
        if not is_owner and not is_super:
            return Response({"error": "Unauthorized"}, status=403)

        threat_keywords = [
            'failed login', 'new device', 'lockout', 'ip mismatch', 'blocked user',
            'invalid credentials', 'password reset', 'security threat', '2fa', 'otp'
        ]
        
        q_objects = models.Q()
        for kw in threat_keywords:
            q_objects |= models.Q(action__icontains=kw)
            
        threat_events = AuditLogs.objects.filter(
            q_objects,
            log_type='SECURITY'
        ).order_by('-created_at')

        locked_accounts = Admins.objects.filter(
            lockout_until__gt=timezone.now()
        )

        # Summary stats
        failed_logins = AuditLogs.objects.filter(
            models.Q(action__icontains='failed login') | models.Q(action__icontains='invalid credentials'),
            log_type='SECURITY'
        ).count()
        
        new_device_logins = AuditLogs.objects.filter(
            action__icontains='new device',
            log_type='SECURITY'
        ).count()

        ip_mismatches = AuditLogs.objects.filter(
            action__icontains='ip mismatch',
            log_type='SECURITY'
        ).count()

        data = {
            "threat_events": AuditLogSerializer(threat_events, many=True).data,
            "locked_accounts": [
                {
                    "id": a.id,
                    "full_name": a.full_name,
                    "email": a.email,
                    "role": a.role,
                    "failed_login_attempts": a.failed_login_attempts,
                    "lockout_until": a.lockout_until
                } for a in locked_accounts
            ],
            "summary": {
                "total_threats": threat_events.count(),
                "failed_logins": failed_logins,
                "new_device_logins": new_device_logins,
                "ip_mismatches": ip_mismatches,
                "locked_accounts": locked_accounts.count()
            }
        }
        return Response(data)

    def post(self, request):
        """Handle account unlocking for security threats"""
        admin_id = request.data.get("admin_id")
        action = request.data.get("action")

        if not admin_id or action != "unlock":
            return Response({"error": "Invalid request parameters."}, status=400)

        try:
            admin = Admins.objects.get(id=admin_id)
            admin.lockout_until = None
            admin.failed_login_attempts = 0
            admin.save()

            log_action(
                request.user,
                f"Unlocked account for {admin.email}",
                "admins",
                admin.id,
                log_type="SECURITY",
                ip_address=get_client_ip(request)
            )

            return Response({"message": f"Successfully unlocked account for {admin.full_name}"})
        except Admins.DoesNotExist:
            return Response({"error": "Admin account not found."}, status=404)

class SecureSettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        settings = SecureSettings.objects.all()
        serializer = SecureSettingsSerializer(settings, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        key = request.data.get("key")
        if not key: return Response({"error": "Key is required"}, status=400)
        setting = SecureSettings.objects.filter(key=key).first()
        if not setting:
            setting = SecureSettings.objects.create(key=key, setting_group=request.data.get("setting_group", "system").upper(), description=request.data.get("description", ""))
        elif "setting_group" in request.data:
            setting.setting_group = request.data.get("setting_group", "system").upper()
            setting.save()
        serializer = SecureSettingsSerializer(setting, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            from django.core.cache import cache
            cache.delete(f"secure_setting_{key}")
            log_action(request.user, f"Updated setting: {key}", "secure_settings", setting.id, log_type="MANAGEMENT", ip_address=get_client_ip(request))
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class SecureSettingsRevealView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, key):
        try:
            setting = SecureSettings.objects.get(key=key)
            decrypted_value = decrypt_value(setting.encrypted_value)
            log_action(request.user, f"Revealed sensitive setting: {key}", "secure_settings", setting.id, log_type="SECURITY", ip_address=get_client_ip(request))
            return Response({"key": key, "value": decrypted_value})
        except SecureSettings.DoesNotExist: return Response({"error": "Setting not found"}, status=404)

class TestMpesaConnectionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            from ..utils.mpesa import MpesaHandler
            handler = MpesaHandler()
            token = handler.get_access_token()
            if token: return Response({"status": "success", "message": "Connected to Daraja successfully."})
            return Response({"status": "error", "message": "Failed access token."}, status=400)
        except Exception as e: return Response({"status": "error", "message": str(e)}, status=500)

class TestSMSSendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        phone = request.data.get("phone")
        message = request.data.get("message", "Test SMS from Azariah Credit Ltd")
        if not phone: return Response({"error": "Phone number is required"}, status=400)
        try:
            send_sms_async(phone, message)
            log_action(request.user, f"Sent test SMS to {phone}", "sms_logs", None, log_type="MANAGEMENT", ip_address=get_client_ip(request))
            return Response({"status": "success", "message": f"Test SMS queued for {phone}"})
        except Exception as e: return Response({"status": "error", "message": str(e)}, status=500)

class PublicSystemSettingsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        timeout = get_setting('session_idle_timeout', 30)
        return Response({"session_idle_timeout": int(timeout), "mpesa_environment": get_setting('mpesa_environment', 'sandbox')})

class SystemSettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    required_roles = ["ADMIN"]

    def get(self, request):
        if not (request.user.role == "ADMIN" or request.user.is_super_admin):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Administrators can view system settings.")
        settings_qs = SystemSettings.objects.all()
        serializer = SystemSettingsSerializer(settings_qs, many=True)
        data = {s["key"]: s["value"] for s in serializer.data}
        return Response(data)

    def post(self, request):
        for key, value in request.data.items(): SystemSettings.objects.update_or_create(key=key, defaults={"value": value})
        return Response({"message": "Settings updated successfully"})

class BulkSMSView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user_role = getattr(user, "role", None)
        if user_role not in ["ADMIN", "MANAGER", "FINANCIAL_OFFICER"]: return Response({"error": "Unauthorized"}, status=403)
        sms_type = request.data.get("type", "DEFAULTERS")
        custom_message = request.data.get("message")
        def get_t(key, default):
            try: return SystemSettings.objects.get(key=key).value
            except: return default
        count = 0
        if sms_type == "DEFAULTERS":
            overdue_loans = Loans.objects.filter(status="OVERDUE")
            template = get_t("MSG_TEMPLATE_DEFAULTER", "Hello {name}, your loan of KES {principal:,.2f} is OVERDUE.")
            for loan in overdue_loans:
                phone = loan.user.phone
                if phone:
                    try:
                        msg = template.format(name=loan.user.full_name, principal=float(loan.principal_amount), interest=float(loan.total_repayable_amount) - float(loan.principal_amount), balance=float(loan.remaining_balance))
                        send_sms_async([phone], msg)
                        SMSLog.objects.create(sender=user, recipient_phone=phone, recipient_name=loan.user.full_name, message=msg, type="DEFAULTER")
                        count += 1
                        from ..loans.views import create_notification
                        create_notification(loan.user, f"Defaulter SMS sent to {phone}.")
                    except: pass
        elif sms_type == "NOTICE":
            if not custom_message: return Response({"error": "Message is required"}, status=400)
            all_users = Users.objects.all()
            for u in all_users:
                if u.phone:
                    try:
                        send_sms_async([u.phone], custom_message)
                        SMSLog.objects.create(sender=user, recipient_phone=u.phone, recipient_name=u.full_name, message=custom_message, type="NOTICE")
                        count += 1
                    except: pass
        AuditLogs.objects.create(admin=user, action=f"Sent {count} bulk SMS notifications of type {sms_type}.", log_type="COMMUNICATION")
        return Response({"status": "success", "message": f"Bulk SMS sequence started for {count} recipients."})

class SystemCapitalBalanceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        allowed = (
            getattr(user, 'is_owner', False) or
            getattr(user, 'is_super_admin', False) or
            getattr(user, 'role', '') == 'FINANCIAL_OFFICER'
        )
        if not allowed:
            return Response(
                {"error": "You do not have permission to view the capital balance."},
                status=403
            )
        from ..models import SystemCapital, LedgerEntry
        capital = SystemCapital.objects.filter(name="Simulation Capital").first()
        total_disbursed = LedgerEntry.objects.filter(
            entry_type="DISBURSEMENT"
        ).aggregate(total=models.Sum('amount'))['total'] or 0
        total_repaid = LedgerEntry.objects.filter(
            entry_type="REPAYMENT"
        ).aggregate(total=models.Sum('amount'))['total'] or 0

        # Finance Officer gets available balance only
        if getattr(user, 'role', '') == 'FINANCIAL_OFFICER':
            return Response({
                "balance": float(capital.balance) if capital else 0,
            })

        # Owner and Super Admin get the full breakdown
        return Response({
            "balance": float(capital.balance) if capital else 0,
            "total_disbursed": float(total_disbursed),
            "total_repaid": float(total_repaid),
            "account_name": capital.name if capital else "Simulation Capital"
        })

class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not hasattr(user, "role"): return AuditLogs.objects.none()
        if user.role in ["FINANCIAL_OFFICER", "SUPER_ADMIN", "ADMIN"]: queryset = AuditLogs.objects.all().order_by("-created_at")
        else:
            if user.branch_fk: queryset = AuditLogs.objects.filter(admin__branch_fk=user.branch_fk).order_by("-created_at")
            else: return AuditLogs.objects.none()
        log_type = self.request.query_params.get("type")
        if log_type: queryset = queryset.filter(log_type=log_type)
        limit = self.request.query_params.get("limit")
        if limit:
            try: queryset = queryset[: int(limit)]
            except: pass
        return queryset

class SecurityLogsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.is_owner or request.user.is_super_admin): return Response({"error": "Unauthorized access to security logs."}, status=403)
        if request.user.is_super_admin and not request.user.is_owner:
            AuditLogs.objects.create(admin=request.user, action=f"Super Admin {request.user.full_name} viewed security logs", log_type="SECURITY", table_name="audit_logs", is_owner_log=True, ip_address=get_client_ip(request))
        logs = AuditLogs.objects.filter(log_type="SECURITY").order_by("-created_at")
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

class SMSLogListView(generics.ListAPIView):
    queryset = SMSLog.objects.all().order_by("-created_at")
    serializer_class = SMSLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, "role", None)
        if user_role == "MANAGER":
            manager_branch = getattr(user, "branch", None)
            if manager_branch: return SMSLog.objects.filter(recipient_phone__in=Users.objects.filter(profile__branch=manager_branch).values_list("phone", flat=True)).order_by("-created_at")
        return super().get_queryset()

class DirectSMSView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        recipient_phone = request.data.get("phone")
        message = request.data.get("message")
        user_id = request.data.get("user_id") or request.data.get("customer_id")

        if not recipient_phone and user_id:
            try:
                from ..models import Users
                target_user = Users.objects.get(id=user_id)
                recipient_phone = target_user.phone
            except Users.DoesNotExist:
                return Response({"error": "Customer not found"}, status=404)

        if not all([recipient_phone, message]):
            return Response({"error": "Phone and message are required"}, status=400)

        if getattr(user, "role", None) not in ["ADMIN", "MANAGER", "FINANCIAL_OFFICER", "FIELD_OFFICER"]:
            return Response({"error": "Unauthorized to send direct SMS"}, status=403)

        try:
            from ..utils.sms import send_sms_async
            send_sms_async([recipient_phone], message)

            from ..models import SMSLog, AuditLogs
            SMSLog.objects.create(
                sender=user,
                recipient_phone=recipient_phone,
                recipient_name=request.data.get("recipient_name", "Customer"),
                message=message,
                type="DIRECT",
                status="SENT",
            )

            AuditLogs.objects.create(
                admin=user,
                action="SENT_DIRECT_SMS",
                log_type="COMMUNICATION",
                table_name="sms_logs",
                record_id=user_id,
                new_data={"phone": recipient_phone, "message": message},
                ip_address=request.META.get("REMOTE_ADDR"),
            )
            return Response({"message": "Message sent successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class ListEmailLogsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EmailLogSerializer

    def get_queryset(self):
        from django.db.models import Q
        from ..models import EmailLog
        queryset = EmailLog.objects.all().order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(recipient_email__icontains=search)
                | Q(recipient_name__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
            )
        return queryset

class SendEmailNotificationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target_ids = request.data.get("target_ids", [])
        target_group = request.data.get("target_group")
        subject = request.data.get("subject", "Notification from Azariah Credit")
        message = request.data.get("message")

        if not message:
            return Response({"error": "Message is required."}, status=400)

        from ..models import Admins, Notifications, EmailLog
        if target_group == "STAFF":
            targets = Admins.objects.filter(is_active=True)
        else:
            targets = Admins.objects.filter(id__in=target_ids)

        if not targets.exists():
            return Response({"error": "No valid targets found."}, status=400)

        import os, requests, threading
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")

        if not brevo_api_key or not from_email:
            return Response({"error": "Email service not configured."}, status=500)

        def send_email_async(admin, subject, message, from_email, sender_name, brevo_api_key, sender_user):
            try:
                url = "https://api.brevo.com/v3/smtp/email"
                headers = {"accept": "application/json", "api-key": brevo_api_key, "content-type": "application/json"}
                payload = {
                    "sender": {"name": sender_name, "email": from_email},
                    "to": [{"email": admin.email}],
                    "subject": subject,
                    "htmlContent": f"<html><body>{message.replace('\n', '<br>')}</body></html>"
                }
                requests.post(url, json=payload, headers=headers)
                Notifications.objects.create(user=admin, message=f"Email: {subject}")
                EmailLog.objects.create(sender=sender_user, recipient_email=admin.email, recipient_name=admin.full_name, subject=subject, message=message)
            except: pass

        for admin in targets:
            threading.Thread(target=send_email_async, args=(admin, subject, message, from_email, sender_name, brevo_api_key, request.user)).start()

        return Response({"message": f"Successfully queued {targets.count()} emails."})
