import os
import requests
from rest_framework import views, permissions, generics, status
from rest_framework.response import Response
from django.utils import timezone
from ..models import (
    Admins, 
    AdminInvitation, 
    AuditLogs, 
    EmailLog, 
    Branch,
    DeactivationRequest
)
from ..serializers import (
    AdminSerializer, 
    BranchSerializer,
    DeactivationRequestSerializer
)
from ..utils.security import log_action, get_client_ip
from ..permissions import IsAdminUser, IsSuperAdmin

class AdminListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # Exclude standard owners and high-privilege system accounts from general admin lists
        queryset = Admins.objects.filter(is_owner=False, is_primary_owner=False).order_by("-created_at")
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def perform_create(self, serializer):
        import uuid
        serializer.save(id=uuid.uuid4())

class AdminDetailView(generics.RetrieveUpdateAPIView):
    queryset = Admins.objects.all()
    serializer_class = AdminSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        
        # Self-edit is always allowed
        if str(user.id) == str(obj.id):
            return obj
            
        # Owner can edit everyone
        if user.is_owner or user.role == "OWNER":
            return obj
            
        # Super Admins can edit others, but not Owners
        # They need access for god mode edits if that's what's intended
        if user.is_super_admin and not obj.is_owner:
            return obj
            
        # Legacy/General Admin permission (if applicable)
        if user.role == "ADMIN" and not obj.is_owner:
            return obj
            
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You do not have permission to view/edit this admin.")

class AdminDeleteView(views.APIView):
    permission_classes = [IsSuperAdmin]

    def delete(self, request, admin_id):
        try:
            admin_to_delete = Admins.objects.get(id=admin_id)
            if str(request.user.id) == str(admin_id):
                return Response(
                    {"error": "You cannot dismiss your own administrative account"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            admin_email = admin_to_delete.email
            admin_to_delete.delete()
            return Response(
                {"message": f"Admin account ({admin_email}) deleted successfully"},
                status=status.HTTP_200_OK,
            )
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminSuspendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            target = Admins.objects.get(pk=pk)
            user = request.user
            reason = request.data.get("reason")
            if not reason:
                return Response({"error": "Reason for suspension is required."}, status=400)
            if target.is_owner:
                return Response({"error": "The owner account cannot be suspended."}, status=403)
            can_suspend = False
            if user.is_owner:
                can_suspend = True
            elif user.is_super_admin:
                if not (target.is_owner or target.is_super_admin):
                    can_suspend = True
            if not can_suspend:
                return Response({"error": "Your role does not have permission to suspend this account."}, status=403)
            target.is_blocked = True
            target.suspended_at = timezone.now()
            target.suspended_by = user
            target.suspension_reason = reason
            target.save()
            AuditLogs.objects.create(
                admin=user, action=f"Suspended admin {target.full_name}. Reason: {reason}",
                log_type="SECURITY", table_name="admins", record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin, ip_address=get_client_ip(request)
            )
            return Response({"message": f"Account {target.full_name} has been suspended."})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)

class AdminUnsuspendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            target = Admins.objects.get(pk=pk)
            user = request.user
            can_unsuspend = False
            if user.is_owner:
                can_unsuspend = True
            elif user.is_super_admin:
                if not (target.is_owner or target.is_super_admin):
                    can_unsuspend = True
            if not can_unsuspend:
                return Response({"error": "Your role does not have permission to unsuspend this account."}, status=403)
            target.is_blocked = False
            target.suspended_at = None
            target.suspended_by = None
            target.suspension_reason = None
            target.save()
            AuditLogs.objects.create(
                admin=user, action=f"Unsuspended admin {target.full_name}",
                log_type="SECURITY", table_name="admins", record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin, ip_address=get_client_ip(request)
            )
            return Response({"message": f"Account {target.full_name} has been unsuspended."})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)

class AdminRevokeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            target = Admins.objects.get(pk=pk)
            user = request.user
            new_role = request.data.get("new_role")
            reason = request.data.get("reason")
            if not all([new_role, reason]):
                return Response({"error": "New role and reason are required."}, status=400)
            if target.is_owner:
                return Response({"error": "The owner account is protected and cannot be modified."}, status=403)
            can_revoke = False
            if user.is_owner:
                can_revoke = True
            elif user.is_super_admin:
                if not (target.is_owner or target.is_super_admin):
                    can_revoke = True
            if not can_revoke:
                return Response({"error": "Your role does not have permission to revoke roles for this account."}, status=403)
            old_role = target.role
            target.role = new_role
            target.save()
            AuditLogs.objects.create(
                admin=user, action=f"Revoked roles for {target.full_name}. Downgraded from {old_role} to {new_role}. Reason: {reason}",
                log_type="SECURITY", table_name="admins", record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin, ip_address=get_client_ip(request)
            )
            return Response({"message": f"Role for {target.full_name} has been updated to {new_role}."})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)

class BranchListCreateView(generics.ListCreateAPIView):
    queryset = Branch.objects.all().order_by("name")
    serializer_class = BranchSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminUser()]

    def perform_create(self, serializer):
        branch = serializer.save()
        log_action(self.request.user, "CREATE", "branches", branch.id, new_data={"name": branch.name})

class BranchDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminUser()]

    def perform_update(self, serializer):
        instance = self.get_object()
        old_name = instance.name
        new_name = serializer.validated_data.get('name', old_name)
        
        old_data = BranchSerializer(instance).data
        branch = serializer.save()
        
        if old_name != new_name:
            log_action(self.request.user, "UPDATE", "branches", branch.id, old_data=old_data, new_data=serializer.data)

    def perform_destroy(self, instance):
        if instance.branch_admins.exists() or instance.branch_loans.exists():
            raise status.ValidationError("Cannot delete branch with existing staff or loans.")
        log_action(self.request.user, "DELETE", "branches", instance.id, old_data=BranchSerializer(instance).data)
        instance.delete()

class DeactivationRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = DeactivationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not hasattr(user, "role"):
            return DeactivationRequest.objects.none()
        if user.role == "ADMIN":
            return DeactivationRequest.objects.all().order_by("-created_at")
        if user.role == "MANAGER":
            return DeactivationRequest.objects.filter(requested_by=user).order_by("-created_at")
        return DeactivationRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        req_obj = serializer.save(requested_by=user, status="PENDING")
        from ..services import notify_deactivation_request
        notify_deactivation_request(req_obj)
        AuditLogs.objects.create(
            admin=user, action=f"Requested deactivation for officer {serializer.validated_data['officer'].full_name}",
            log_type="MANAGEMENT", table_name="deactivation_requests", record_id=None
        )

class DeactivationRequestDetailView(generics.RetrieveUpdateAPIView):
    queryset = DeactivationRequest.objects.all()
    serializer_class = DeactivationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        user = self.request.user
        if user.role != "ADMIN":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can process deactivation requests")
        instance = serializer.save(processed_by=user, processed_at=timezone.now())
        if instance.status == "APPROVED":
            officer = instance.officer
            officer.is_blocked = True
            officer.save()
            AuditLogs.objects.create(admin=user, action=f"Approved deactivation for officer {officer.full_name}", log_type="MANAGEMENT", table_name="admins", record_id=officer.id)
        elif instance.status == "REJECTED":
            AuditLogs.objects.create(admin=user, action=f"Rejected deactivation for officer {instance.officer.full_name}", log_type="MANAGEMENT", table_name="admins", record_id=instance.officer.id)

class AdminInviteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        INVITE_PERMISSIONS = {
            'OWNER': ['SUPER_ADMIN', 'ADMIN'],
            'SUPER_ADMIN': ['ADMIN', 'FINANCIAL_OFFICER'],
            'ADMIN': ['MANAGER'],
            'MANAGER': ['FIELD_OFFICER'],
            'FIELD_OFFICER': [],
        }

        def get_inviter_type(user):
            if getattr(user, 'is_owner', False): return 'OWNER'
            if getattr(user, 'is_super_admin', False): return 'SUPER_ADMIN'
            return getattr(user, 'role', '')

        inviter = request.user
        inviter_role = get_inviter_type(inviter)
        emails = request.data.get("emails") or request.data.get("email")
        role = request.data.get("role")
        branch_id = request.data.get("branch")

        if not emails or not role: return Response({"error": "Email(s) and role are required."}, status=400)

        allowed_roles = INVITE_PERMISSIONS.get(inviter_role, [])
        if role not in allowed_roles and not (inviter.is_owner or inviter.is_super_admin):
            return Response({"error": f"Your role ({inviter_role}) does not have permission to invite {role}."}, status=403)

        if isinstance(emails, str): emails = [e.strip().lower() for e in emails.split(",") if e.strip()]
        elif not isinstance(emails, list): emails = [str(emails).strip().lower()]

        branch_fk = None
        if inviter_role == "MANAGER" and role == "FIELD_OFFICER": branch_fk = inviter.branch_fk
        elif inviter_role == "ADMIN" and role == "MANAGER":
            if not branch_id: return Response({"error": "Branch is required for Manager invitations."}, status=400)
            try:
                from ..models import Branch
                branch_fk = Branch.objects.get(id=branch_id)
            except: return Response({"error": "Invalid branch ID."}, status=400)

        import secrets, threading
        from django.utils import timezone
        from datetime import timedelta
        from ..models import AdminInvitation, Admins
        from ..utils.security import log_action, get_client_ip

        sent_emails = []
        errors = []

        for email_addr in emails:
            if Admins.objects.filter(email__iexact=email_addr).exists():
                errors.append(f"{email_addr} already registered")
                continue

            token = secrets.token_hex(20)
            AdminInvitation.objects.update_or_create(email=email_addr, defaults={
                "role": role, "token": token, "invited_by": inviter, "invited_by_admin": inviter,
                "branch_fk": branch_fk, "expires_at": timezone.now() + timedelta(minutes=30), "is_used": False
            })

            from ..utils.sms import send_invite_email_sync
            success, err = send_invite_email_sync(email_addr, token, role, inviter.full_name, inviter)
            
            if success:
                sent_emails.append(email_addr)
            else:
                errors.append(f"Failed to send email to {email_addr}: {err}")
        
        status_code = 200 if sent_emails else 400
        return Response({
            "message": f"Sent {len(sent_emails)} invitations." if sent_emails else "Failed to send invitations.", 
            "sent": sent_emails, 
            "errors": errors
        }, status=status_code)
