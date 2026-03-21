import bcrypt
import uuid
from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from django.db import models
from ..models import Admins, AuditLogs, SystemSettings
from ..serializers import AdminSerializer, AuditLogSerializer
from ..utils.security import log_action, get_client_ip

class OwnerExistsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        exists = Admins.objects.filter(is_owner=True).exists()
        return Response({"exists": exists})

class ClaimOwnershipView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if Admins.objects.filter(is_owner=True).exists():
            return Response(
                {"error": "Ownership has already been claimed. This endpoint is permanently disabled."},
                status=403
            )

        full_name = request.data.get("full_name")
        email = request.data.get("email")
        password = request.data.get("password")

        if not all([full_name, email, password]):
            return Response({"error": "Missing required fields"}, status=400)

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        owner = Admins.objects.create(
            id=uuid.uuid4(),
            full_name=full_name,
            email=email,
            password_hash=hashed_password,
            is_owner=True,
            is_super_admin=True,
            god_mode_enabled=True,
            role="ADMIN",
            is_verified=True
        )

        client_ip = get_client_ip(request)
        AuditLogs.objects.create(
            admin=owner,
            action=f"System ownership claimed from IP {client_ip}",
            log_type="SECURITY",
            table_name="admins",
            record_id=owner.id,
            is_owner_log=True,
            ip_address=client_ip
        )

        try:
            from django.core.mail import send_mail
            subject = "System Ownership Claimed — Azariah Credit Ltd"
            message = f"Hello {full_name},\n\nSystem ownership has been claimed for this account on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} from IP address {client_ip}.\n\nIf you did not perform this action, contact your system administrator immediately."
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True
            )
        except:
            pass

        return Response({"message": "Ownership claimed successfully."}, status=201)

class GodModeToggleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_owner:
            return Response({"error": "Only the Owner can toggle God Mode."}, status=403)
        target_id = request.data.get("target_admin_id")
        enabled = request.data.get("enabled")
        if not target_id:
            return Response({"error": "target_admin_id is required."}, status=400)
        try:
            target = Admins.objects.get(id=target_id)
            if target.is_owner and not enabled:
                return Response({"error": "Cannot disable God Mode for the Owner account."}, status=403)
            target.god_mode_enabled = enabled
            target.save()
            AuditLogs.objects.create(
                admin=request.user, action=f"{'Enabled' if enabled else 'Disabled'} God Mode for {target.full_name}",
                log_type="SECURITY", table_name="admins", record_id=target.id,
                is_owner_log=True, ip_address=get_client_ip(request)
            )
            return Response({"message": f"God Mode {'enabled' if enabled else 'disabled'} for {target.full_name}"})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)
from ..permissions import IsAdminUser, IsOwnerOrCoOwner

class OwnerAuditListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        logs = AuditLogs.objects.order_by("-created_at")
        
        log_type = request.query_params.get('log_type')
        search = request.query_params.get('search')
        
        if log_type:
            logs = logs.filter(log_type=log_type)
        if search:
            logs = logs.filter(
                models.Q(action__icontains=search) | 
                models.Q(admin_name__icontains=search) |
                models.Q(ip_address__icontains=search)
            )

        from ..pagination import StandardResultsSetPagination
        paginator = StandardResultsSetPagination()
        result_page = paginator.paginate_queryset(logs, request)
        serializer = AuditLogSerializer(result_page, many=True)
        return paginator.get_paginated_response(serializer.data)

class OwnerNotificationsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        time_threshold = timezone.now() - timedelta(hours=24)
        logs = AuditLogs.objects.filter(is_owner_log=True, created_at__gte=time_threshold).order_by("-created_at")[:10]
        try:
            setting_obj = SystemSettings.objects.get(key='owner_last_read_notifications')
            last_read_str = setting_obj.value
        except SystemSettings.DoesNotExist:
            last_read_str = '2000-01-01 00:00:00'
        from datetime import datetime
        try:
            last_read = datetime.strptime(last_read_str, '%Y-%m-%d %H:%M:%S')
            last_read = timezone.make_aware(last_read)
        except:
            last_read = time_threshold
        unread_count = AuditLogs.objects.filter(is_owner_log=True, created_at__gt=last_read).count()
        serializer = AuditLogSerializer(logs, many=True)
        return Response({"notifications": serializer.data, "unread_count": unread_count})

class MarkOwnerNotificationsReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        now_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        SystemSettings.objects.update_or_create(key='owner_last_read_notifications', defaults={'value': now_str})
        return Response({"message": "Notifications marked as read."})

class OwnershipListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        owners = Admins.objects.filter(is_owner=True).order_by('ownership_granted_at')
        serializer = AdminSerializer(owners, many=True)
        return Response(serializer.data)

class OwnershipGrantView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import os
        import requests
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        confirm_password = request.data.get("confirm_password")
        if not confirm_password or not bcrypt.checkpw(confirm_password.encode('utf-8'), request.user.password_hash.encode('utf-8')):
            return Response({"error": "Password confirmation failed."}, status=403)
        if Admins.objects.filter(is_owner=True).count() >= 3:
            return Response({"error": "Maximum of 3 owners allowed. Relinquish an existing ownership before granting a new one."}, status=400)
        grant_type = request.data.get("type")
        target = None
        if grant_type == "existing":
            target_id = request.data.get("target_admin_id")
            try:
                target = Admins.objects.get(id=target_id)
                if target.is_owner:
                    return Response({"error": "Target is already an owner."}, status=400)
                target.is_owner = True
                target.god_mode_enabled = True
                target.ownership_granted_by = request.user
                target.ownership_granted_at = timezone.now()
                target.save()
            except Admins.DoesNotExist:
                return Response({"error": "Staff member not found."}, status=404)
        elif grant_type == "new":
            full_name = request.data.get("full_name")
            email = request.data.get("email")
            password = request.data.get("password")
            if not all([full_name, email, password]):
                return Response({"error": "Missing required fields for new account."}, status=400)
            if Admins.objects.filter(email=email).exists():
                return Response({"error": "An account with this email already exists."}, status=400)
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            target = Admins.objects.create(
                id=uuid.uuid4(), full_name=full_name, email=email, password_hash=password_hash,
                role="ADMIN", is_owner=True, god_mode_enabled=True, is_verified=True,
                is_primary_owner=False, ownership_granted_by=request.user, ownership_granted_at=timezone.now()
            )
        else:
            return Response({"error": "Invalid grant type."}, status=400)
        all_owners = Admins.objects.filter(is_owner=True)
        subject = "Ownership Granted — Azariah Credit Ltd"
        ip = get_client_ip(request)
        message = f"Ownership has been granted to {target.full_name} ({target.email}) by {request.user.full_name}.\n\nDate: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}\nIP Address: {ip}"
        brevo_api_key = os.getenv("BREVO_API_KEY")
        from_email = os.getenv("FROM_EMAIL")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        if brevo_api_key and from_email:
            for owner in all_owners:
                try:
                    payload = {
                        "sender": {"name": sender_name, "email": from_email}, "to": [{"email": owner.email}],
                        "subject": subject, "htmlContent": f"<html><body><p>{message.replace('\n', '<br>')}</p></body></html>"
                    }
                    requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers={"api-key": brevo_api_key, "content-type": "application/json"})
                except: pass
        AuditLogs.objects.create(
            admin=request.user, action=f"Ownership granted to {target.full_name} ({target.email}) by {request.user.full_name}",
            log_type="SECURITY", table_name="admins", record_id=target.id, is_owner_log=True, ip_address=ip,
            old_data={"is_owner": False}, new_data={"is_owner": True, "granted_by": str(request.user.id)}
        )
        return Response({"message": f"Ownership successfully granted to {target.full_name}."})

class OwnershipRelinquishView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import os
        import requests
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        confirm_password = request.data.get("confirm_password")
        if not confirm_password or not bcrypt.checkpw(confirm_password.encode('utf-8'), request.user.password_hash.encode('utf-8')):
            return Response({"error": "Password confirmation failed."}, status=403)
        if Admins.objects.filter(is_owner=True).count() <= 1:
            return Response({"error": "You are the only owner. You cannot relinquish ownership until at least one other owner exists. Use Full Handover instead."}, status=400)
        admin = request.user
        admin.is_owner = False
        admin.god_mode_enabled = False
        admin.ownership_relinquished_at = timezone.now()
        admin.save()
        other_owners = Admins.objects.filter(is_owner=True)
        ip = get_client_ip(request)
        subject = f"{admin.full_name} has relinquished ownership of Azariah Credit Ltd"
        message = f"{admin.full_name} ({admin.email}) has voluntarily relinquished their ownership status.\n\nDate: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}\nIP: {ip}"
        brevo_api_key = os.getenv("BREVO_API_KEY")
        from_email = os.getenv("FROM_EMAIL")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        if brevo_api_key and from_email:
            for owner in other_owners:
                try:
                    payload = {
                        "sender": {"name": sender_name, "email": from_email}, "to": [{"email": owner.email}],
                        "subject": subject, "htmlContent": f"<html><body><p>{message.replace('\n', '<br>')}</p></body></html>"
                    }
                    requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers={"api-key": brevo_api_key, "content-type": "application/json"})
                except: pass
            try:
                requests.post("https://api.brevo.com/v3/smtp/email", json={
                    "sender": {"name": sender_name, "email": from_email}, "to": [{"email": admin.email}],
                    "subject": "Ownership Relinquished — Azariah Credit Ltd",
                    "htmlContent": f"<html><body><p>You have successfully relinquished your ownership status.</p></body></html>"
                }, headers={"api-key": brevo_api_key, "content-type": "application/json"})
            except: pass
        AuditLogs.objects.create(admin=admin, action=f"Ownership relinquished by {admin.full_name}", log_type="SECURITY", table_name="admins", record_id=admin.id, is_owner_log=True, ip_address=ip, old_data={"is_owner": True}, new_data={"is_owner": False})
        return Response({"message": "Ownership successfully relinquished."})

class OwnershipHandoverView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import os
        import requests
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        confirm_password = request.data.get("confirm_password")
        if not confirm_password or not bcrypt.checkpw(confirm_password.encode('utf-8'), request.user.password_hash.encode('utf-8')):
            return Response({"error": "Password confirmation failed."}, status=403)
        grant_type = request.data.get("type")
        target = None
        current_owners = Admins.objects.filter(is_owner=True)
        if grant_type == "new" and current_owners.count() >= 3:
            return Response({"error": "Cannot handover to a new person — 3 owners already exist. Use Grant to replace an existing owner first."}, status=400)
        if grant_type == "existing":
            target_id = request.data.get("target_admin_id")
            try:
                target = Admins.objects.get(id=target_id)
                target.is_owner = True
                target.god_mode_enabled = True
                target.ownership_granted_by = request.user
                target.ownership_granted_at = timezone.now()
                target.save()
            except Admins.DoesNotExist:
                return Response({"error": "Staff member not found."}, status=404)
        elif grant_type == "new":
            full_name = request.data.get("full_name")
            email = request.data.get("email")
            password = request.data.get("password")
            if not all([full_name, email, password]):
                return Response({"error": "Missing fields."}, status=400)
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            target = Admins.objects.create(
                id=uuid.uuid4(), full_name=full_name, email=email, password_hash=password_hash,
                role="ADMIN", is_owner=True, god_mode_enabled=True, is_verified=True,
                ownership_granted_by=request.user, ownership_granted_at=timezone.now()
            )
        old_owner = request.user
        old_owner.is_owner = False
        old_owner.god_mode_enabled = False
        old_owner.ownership_relinquished_at = timezone.now()
        old_owner.save()
        ip = get_client_ip(request)
        AuditLogs.objects.create(admin=old_owner, action=f"Ownership granted to {target.full_name} via handover", log_type="SECURITY", table_name="admins", record_id=target.id, is_owner_log=True, ip_address=ip)
        AuditLogs.objects.create(admin=old_owner, action=f"Ownership relinquished by {old_owner.full_name} via handover", log_type="SECURITY", table_name="admins", record_id=old_owner.id, is_owner_log=True, ip_address=ip)
        all_owners = Admins.objects.filter(is_owner=True)
        subject = "Full ownership handover completed"
        message = f"Full ownership handover completed. {old_owner.full_name} has transferred ownership to {target.full_name}.\n\nDate: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
        brevo_api_key = os.getenv("BREVO_API_KEY")
        from_email = os.getenv("FROM_EMAIL")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        if brevo_api_key and from_email:
            for owner in all_owners:
                try:
                    requests.post("https://api.brevo.com/v3/smtp/email", json={"sender": {"name": sender_name, "email": from_email}, "to": [{"email": owner.email}], "subject": subject, "htmlContent": f"<html><body><p>{message}</p></body></html>"}, headers={"api-key": brevo_api_key, "content-type": "application/json"})
                except: pass
        return Response({"message": "Handover successful. You are no longer an owner."})
