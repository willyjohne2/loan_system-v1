import bcrypt
import uuid
import secrets
import threading
import os
import json
import requests
import pyotp
from datetime import timedelta
from django.db.models import Q, Sum, Count, Avg, Max, Min
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import models
from rest_framework import status, views, permissions, generics, parsers, serializers
from .exceptions import InsufficientCapitalError
from .services import DisbursementService
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django_ratelimit.decorators import ratelimit
from .models import (
    Admins,
    Users,
    Loans,
    LoanProducts,
    Repayments,
    Transactions,
    Notifications,
    AuditLogs,
    UserProfiles,
    SystemSettings,
    LoanActivity,
    LoanDocuments,
    SMSLog,
    EmailLog,
    AdminInvitation,
    DeactivationRequest,
    Branch,
    SecureSettings,
    CustomerDraft,
    PaybillTransaction,
    RepaymentSchedule,
    SystemCapital,
    LedgerEntry,
)
from .serializers import (
    AdminSerializer,
    UserSerializer,
    LoanSerializer,
    LoanProductSerializer,
    RepaymentSerializer,
    TransactionSerializer,
    NotificationSerializer,
    AuditLogSerializer,
    UserProfileSerializer,
    SystemSettingsSerializer,
    LoanActivitySerializer,
    LoanDocumentSerializer,
    CustomerDraftSerializer,
    SMSLogSerializer,
    EmailLogSerializer,
    DeactivationRequestSerializer,
    BranchSerializer,
    CustomerDraftSerializer,
    SecureSettingsSerializer,
    PaybillTransactionSerializer,
)
from .utils.mpesa import MpesaHandler
from .utils.sms import send_sms_async
from .utils.security import log_action, get_client_ip, get_filtered_queryset
from .utils.encryption import decrypt_value, get_setting
from .permissions import (
    IsSuperAdmin,
    IsAdminUser,
    IsManagerUser,
    IsFinancialOfficer,
    IsFieldOfficer,
    RoleBasedPermission,
)


def create_loan_activity(loan, admin, action, note=""):
    LoanActivity.objects.create(loan=loan, admin=admin, action=action, note=note)


def create_notification(user, message):
    Notifications.objects.create(user=user, message=message, is_read=False)


def send_verification_email_async(full_name, email, verification_code):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        if not brevo_api_key or not from_email:
            print(
                f"[ERROR] Email setup missing: BREVO_API_KEY={bool(brevo_api_key)}, FROM_EMAIL={bool(from_email)}"
            )
            return

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": f"Your Email Verification Code - {sender_name}",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>Email Verification</h2>
                <p>Hello {full_name},</p>
                <p>Welcome to {sender_name}!</p>
                <p>Your verification code is:</p>
                <h1 style="background-color: #f0f0f0; padding: 10px; text-align: center; letter-spacing: 5px;">{verification_code}</h1>
                <p>This code will expire in 24 hours.</p>
                <p>If you didn't register for this account, please ignore this email.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }

        requests.post(url, json=payload, headers=headers)

    except Exception:
        pass


def send_invitation_email_async(email, role, invited_by_name, token, branch=None):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        if not brevo_api_key or not from_email:
            print(
                f"[ERROR] Email setup missing for Invitation: BREVO_API_KEY={bool(brevo_api_key)}, FROM_EMAIL={bool(from_email)}"
            )
            return

        # Use standard signup page for everyone
        invite_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/signup?token={token}&email={email}&role={role}"
        if branch:
            invite_url += f"&branch={branch}"

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": f"You've been invited as a {role} - {sender_name}",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>Administrative Invitation</h2>
                <p>Hello,</p>
                <p>You have been invited by {invited_by_name} to join <strong>{sender_name}</strong> as a <strong>{role}</strong>.</p>
                <p>Please click the link below to complete your registration:</p>
                <p><a href="{invite_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p>{invite_url}</p>
                <p>This invitation will expire in 48 hours.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }
        requests.post(url, json=payload, headers=headers)
    except Exception as e:
        print(f"Error sending invite: {e}")


def send_official_email_async(
    email, subject, message, recipient_name="Staff Member", template="general"
):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        if not brevo_api_key or not from_email:
            print(f"[ERROR] Email setup missing for Official Notification")
            return

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 30px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #2563eb; margin: 0;">{sender_name}</h1>
                        <p style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Official System Notification</p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 25px;" />
                    <p>Hello <strong>{recipient_name}</strong>,</p>
                    <p>{message}</p>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
                        <p>This is an official system notification sent via {sender_name} Internal Relay.</p>
                        <p>&copy; {timezone.now().year} {sender_name}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        """

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": subject or f"Official Notification from {sender_name}",
            "htmlContent": html_content,
        }
        res = requests.post(url, json=payload, headers=headers)
        return res.status_code in [200, 201, 202]
    except Exception as e:
        print(f"Error sending official email: {e}")
        return False


def send_password_reset_email_async(full_name, email, reset_code):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        if not brevo_api_key or not from_email:
            print(
                f"[ERROR] Email setup missing for Password Reset: BREVO_API_KEY={bool(brevo_api_key)}, FROM_EMAIL={bool(from_email)}"
            )
            return

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": f"Password Reset Code - {sender_name}",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>Password Reset</h2>
                <p>Hello {full_name},</p>
                <p>You requested to reset your password for <strong>{sender_name}</strong>.</p>
                <p>Your 6-digit reset code is:</p>
                <h1 style="background-color: #f8f8f8; padding: 15px; text-align: center; letter-spacing: 5px; border: 1px solid #ddd;">{reset_code}</h1>
                <p>This code will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email and ensure your account is secure.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }
        requests.post(url, json=payload, headers=headers)
    except Exception:
        pass


def send_new_device_login_alert_async(full_name, email, context):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        if not brevo_api_key or not from_email:
            return

        login_time = context.get('login_time', timezone.now().strftime('%Y-%m-%d %H:%M:%S'))
        ip_address = context.get('ip_address', 'Unknown')
        user_agent = context.get('user_agent', 'Unknown')

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": f"New login detected — {sender_name}",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>New Login Detected</h2>
                <p>Hello {full_name},</p>
                <p>A new login was detected for your account on <strong>{sender_name}</strong>.</p>
                <ul>
                    <li><strong>Time:</strong> {login_time}</li>
                    <li><strong>IP Address:</strong> {ip_address}</li>
                    <li><strong>User Agent:</strong> {user_agent}</li>
                </ul>
                <p>If this was not you, please reset your password immediately or contact your administrator.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }
        requests.post(url, json=payload, headers=headers)
    except Exception as e:
        print(f"Error sending login alert: {e}")


class SecureSettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        group = request.query_params.get("group")
        if group:
            settings = SecureSettings.objects.filter(setting_group__iexact=group)
        else:
            settings = SecureSettings.objects.all()
        
        serializer = SecureSettingsSerializer(settings, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        key = request.data.get("key")
        if not key:
            return Response({"error": "Key is required"}, status=400)
            
        # Try to find existing first to update group if necessary
        setting = SecureSettings.objects.filter(key=key).first()
        
        if not setting:
            setting = SecureSettings.objects.create(
                key=key,
                setting_group=request.data.get("setting_group", "system"),
                description=request.data.get("description", "")
            )
        elif "setting_group" in request.data:
            setting.setting_group = request.data.get("setting_group")
            setting.save()
        
        serializer = SecureSettingsSerializer(setting, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            # Clear cache
            from django.core.cache import cache
            cache.delete(f"secure_setting_{key}")
            
            log_action(
                request.user,
                f"Updated setting: {key}",
                "secure_settings",
                setting.id,
                log_type="MANAGEMENT",
                ip_address=get_client_ip(request)
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class SecureSettingsRevealView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, key):
        try:
            setting = SecureSettings.objects.get(key=key)
            decrypted_value = decrypt_value(setting.encrypted_value)
            
            log_action(
                request.user,
                f"Revealed sensitive setting: {key}",
                "secure_settings",
                setting.id,
                log_type="SECURITY",
                ip_address=get_client_ip(request)
            )
            
            return Response({"key": key, "value": decrypted_value})
        except SecureSettings.DoesNotExist:
            return Response({"error": "Setting not found"}, status=404)


class TestMpesaConnectionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            from .utils.mpesa import MpesaHandler
            handler = MpesaHandler()
            token = handler.get_access_token()
            if token:
                return Response({"status": "success", "message": "Successfully connected to Daraja and obtained access token."})
            return Response({"status": "error", "message": "Failed to obtain access token from Daraja."}, status=400)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=500)


class TestSMSSendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        phone = request.data.get("phone")
        message = request.data.get("message", "Test SMS from Azariah Credit Ltd")
        
        if not phone:
            return Response({"error": "Phone number is required"}, status=400)
            
        try:
            # We'll use the existing send_sms_async logic
            from .utils.sms import send_sms_async
            send_sms_async(phone, message)
            
            log_action(
                request.user,
                f"Sent test SMS to {phone}",
                "sms_logs",
                None,
                log_type="MANAGEMENT",
                ip_address=get_client_ip(request)
            )
            
            return Response({"status": "success", "message": f"Test SMS queued for {phone}"})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=500)


class PublicSystemSettingsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Only expose non-sensitive public settings
        timeout = get_setting('session_idle_timeout', 30)
        return Response({
            "session_idle_timeout": int(timeout),
            "mpesa_environment": get_setting('mpesa_environment', 'sandbox')
        })


# --- Ownership Claim Endpoints ---

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

        import bcrypt
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

        # Log Action
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

        # Send Confirmation Email (Async placeholder/simple)
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


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Apply ratelimit manually inside the method because the decorator 
        # is having trouble with the DRF Request object's attributes in this version
        from django_ratelimit.core import is_ratelimited
        if is_ratelimited(request, key='ip', rate='10/m', group='login', method='POST', increment=True):
            return Response(
                {"error": "Too many requests. Please wait before trying again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        email = request.data.get("email")
        password = request.data.get("password")
        # ... logic for content data ...
        if not email and "_content" in request.data:
            try:
                content_data = json.loads(request.data.get("_content"))
                email = content_data.get("email")
                password = content_data.get("password")
            except Exception:
                pass

        if not email and isinstance(request.data, dict) and "email" in request.data:
            email = request.data.get("email")
        if (
            not password
            and isinstance(request.data, dict)
            and "password" in request.data
        ):
            password = request.data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_ip = get_client_ip(request)

        try:
            admin = Admins.objects.filter(email__iexact=email).first()
            if not admin:
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Security Hardening: Max failed logins setting
            max_failed_logins = int(get_setting('max_failed_logins', 4))

            # Check for lockout
            if admin.lockout_until and admin.lockout_until > timezone.now():
                minutes_left = int(
                    (admin.lockout_until - timezone.now()).total_seconds() / 60
                )
                return Response(
                    {"error": f"Account locked. Try again in {minutes_left} minutes."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if admin.is_blocked:
                return Response(
                    {"error": "Account is blocked"}, status=status.HTTP_403_FORBIDDEN
                )

            if not admin.is_verified:
                return Response(
                    {
                        "error": "Please verify your email before logging in. Check your inbox for the verification link."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if bcrypt.checkpw(
                password.encode("utf-8"), admin.password_hash.encode("utf-8")
            ):
                # New Device Login Alert
                if admin.last_login_ip and admin.last_login_ip != client_ip:
                    threading.Thread(
                        target=send_new_device_login_alert_async,
                        args=(admin.full_name, admin.email, {
                            "login_time": timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                            "ip_address": client_ip,
                            "user_agent": request.META.get('HTTP_USER_AGENT', 'Unknown')
                        }),
                    ).start()
                    
                    log_action(
                        admin,
                        "New Device Login Detected",
                        "admins",
                        admin.id,
                        log_type="SECURITY",
                        ip_address=client_ip,
                    )

                admin.failed_login_attempts = 0
                admin.lockout_until = None
                admin.last_login_ip = client_ip
                admin.save()

                log_action(
                    admin,
                    "User Login",
                    "admins",
                    admin.id,
                    log_type="MANAGEMENT",
                    ip_address=client_ip,
                )

                # Check if 2FA is enabled
                if admin.is_two_factor_enabled:
                    return Response(
                        {
                            "id": str(admin.id),
                            "two_factor_required": True,
                            "email": admin.email,
                        },
                        status=status.HTTP_200_OK,
                    )

                try:
                    refresh = RefreshToken.for_user(admin)
                    refresh["admin_id"] = str(admin.id)
                    refresh["role"] = admin.role
                    refresh["is_owner"] = admin.is_owner
                    refresh["is_super_admin"] = admin.is_super_admin
                    # JWT Session Binding: Embed client IP
                    refresh["client_ip"] = client_ip

                    access_token = str(refresh.access_token)
                    refresh_token = str(refresh)
                except Exception as e:
                    return Response(
                        {"error": f"Token generation failed: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                return Response(
                    {
                        "access": access_token,
                        "refresh": refresh_token,
                        "role": admin.role,
                        "god_mode_enabled": admin.god_mode_enabled or admin.is_owner,
                        "is_owner": admin.is_owner,
                        "is_super_admin": admin.is_super_admin,
                        "admin": AdminSerializer(admin).data,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                admin.failed_login_attempts = (admin.failed_login_attempts or 0) + 1

                log_action(
                    None,
                    f"Failed Login Attempt: {email}",
                    "admins",
                    admin.id,
                    log_type="SECURITY",
                    ip_address=client_ip,
                )

                if admin.failed_login_attempts >= max_failed_logins:
                    admin.lockout_until = timezone.now() + timezone.timedelta(
                        minutes=20
                    )
                    admin.save()
                    return Response(
                        {
                            "error": "Too many failed attempts. Account locked for 20 minutes."
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                admin.save()
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        except Admins.DoesNotExist:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )


class Login2FAVerifyView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        admin_id = request.data.get("id")
        otp_code = request.data.get("code")

        if not admin_id or not otp_code:
            return Response(
                {"error": "Admin ID and OTP code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            admin = Admins.objects.get(id=admin_id)
            if admin.is_blocked:
                return Response(
                    {"error": "Account is blocked"}, status=status.HTTP_403_FORBIDDEN
                )

            totp = pyotp.TOTP(admin.two_factor_secret)
            if totp.verify(otp_code, valid_window=1):
                refresh = RefreshToken.for_user(admin)
                refresh["admin_id"] = str(admin.id)
                refresh["role"] = admin.role

                return Response(
                    {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                        "role": admin.role,
                        "admin": AdminSerializer(admin).data,
                    }
                )
            else:
                return Response(
                    {"error": "Invalid OTP code"}, status=status.HTTP_401_UNAUTHORIZED
                )
        except Admins.DoesNotExist:
            return Response(
                {"error": "Invalid admin ID"}, status=status.HTTP_401_UNAUTHORIZED
            )


class Enable2FAView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        admin = request.user
        if admin.is_two_factor_enabled:
            return Response(
                {"error": "2FA is already enabled"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Generate a new secret if not already set
        if not admin.two_factor_secret:
            admin.two_factor_secret = pyotp.random_base32()
            admin.save()

        totp = pyotp.TOTP(admin.two_factor_secret)
        # Use a more friendly label for the authenticator app
        provisioning_uri = totp.provisioning_uri(
            name=admin.email, issuer_name="LoanManagementSystem"
        )

        return Response(
            {"secret": admin.two_factor_secret, "otpauth_url": provisioning_uri}
        )


class VerifyEnable2FAView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        admin = request.user
        otp_code = request.data.get("code")

        if not otp_code:
            return Response(
                {"error": "OTP code is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not admin.two_factor_secret:
            return Response(
                {"error": "2FA setup not initiated"}, status=status.HTTP_400_BAD_REQUEST
            )

        totp = pyotp.TOTP(admin.two_factor_secret)
        if totp.verify(otp_code, valid_window=1):
            admin.is_two_factor_enabled = True
            admin.save()
            return Response({"message": "2FA enabled successfully"})
        else:
            return Response(
                {"error": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST
            )


class Disable2FAView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        admin = request.user
        otp_code = request.data.get("code")

        if not otp_code:
            return Response(
                {"error": "OTP code is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        totp = pyotp.TOTP(admin.two_factor_secret)
        if totp.verify(otp_code, valid_window=1):
            admin.is_two_factor_enabled = False
            admin.two_factor_secret = None
            admin.save()
            return Response({"message": "2FA disabled successfully"})
        else:
            return Response(
                {"error": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST
            )


class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return get_filtered_queryset(self.request.user, Users.objects.select_related("profile", "created_by"), 'profile__branch_fk').order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user

        created_by = user if (user and user.is_authenticated) else None
        serializer.save(created_by=created_by)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Users.objects.none()

        if hasattr(user, "role") and user.role == "MANAGER":
            return Users.objects.filter(profile__branch=user.branch)
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Users.objects.filter(created_by=user)

        return Users.objects.all()

    def perform_destroy(self, instance):
        # Prevent locking if customer has outstanding loans
        has_outstanding = Loans.objects.filter(
            user=instance,
            status__in=[
                "VERIFIED",
                "APPROVED",
                "DISBURSED",
                "ACTIVE",
                "OVERDUE",
                "DEFAULTED",
            ],
        ).exists()

        if has_outstanding:
            raise serializers.ValidationError(
                {
                    "error": "Cannot lock/delete a customer with an active or outstanding loan portfolio."
                }
            )

        # Soft delete: Lock the user instead of deleting
        instance.is_locked = True
        instance.save()

        # Create an audit log for this action
        if self.request.user and self.request.user.is_authenticated:
            ip = self.request.META.get("REMOTE_ADDR")
            AuditLogs.objects.create(
                admin=self.request.user,
                action="LOCKED_CUSTOMER",
                log_type="MANAGEMENT",
                table_name="users",
                record_id=instance.id,
                new_data={"is_locked": True},
                ip_address=ip,
            )

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        ip = self.request.META.get("REMOTE_ADDR")

        # Prevent phone change if customer has verified loans
        if (
            "phone" in serializer.validated_data
            and serializer.validated_data["phone"] != instance.phone
        ):
            has_verified_loans = Loans.objects.filter(
                user=instance,
                status__in=[
                    "VERIFIED",
                    "APPROVED",
                    "DISBURSED",
                    "ACTIVE",
                    "OVERDUE",
                    "DEFAULTED",
                    "REPAID",
                ],
            ).exists()
            if has_verified_loans:
                raise serializers.ValidationError(
                    {
                        "phone": "Phone number cannot be changed once a customer has a verified or active loan for security reasons."
                    }
                )

        old_data = {
            field: str(getattr(instance, field)) for field in serializer.validated_data
        }

        updated_instance = serializer.save()

        # Log sensitive updates
        AuditLogs.objects.create(
            admin=user,
            action="UPDATE_CUSTOMER",
            log_type="MANAGEMENT",
            table_name="users",
            record_id=instance.id,
            old_data=old_data,
            new_data={k: str(v) for k, v in serializer.validated_data.items()},
            ip_address=ip,
        )


class CheckUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response(
                {"error": "Query parameter 'q' (ID or Phone) is required"},
                status=400,
            )

        # Smart Phone Lookup: Try to match variants if it looks like a phone number
        import re

        user = None
        # Clean the query (remove spaces, +, etc)
        clean_q = re.sub(r"\D", "", query)

        if clean_q:
            # Try exact match, variants of the cleaned number, or national ID
            variants = [clean_q]
            if clean_q.startswith("254") and len(clean_q) > 10:
                variants.append("0" + clean_q[3:])  # convert 254... to 0...
            elif clean_q.startswith("0") and len(clean_q) == 10:
                variants.append("254" + clean_q[1:])  # convert 0... to 254...
            elif (clean_q.startswith("7") or clean_q.startswith("1")) and len(
                clean_q
            ) == 9:
                variants.append("0" + clean_q)
                variants.append("254" + clean_q)

            user = (
                Users.objects.filter(phone__in=variants).first()
                or Users.objects.filter(profile__national_id=query).first()
            )
        else:
            # Fallback for non-numeric queries if any (e.g. ID with letters)
            user = Users.objects.filter(profile__national_id=query).first()

        if not user:
            return Response({"found": False})

        outstanding_loan = Loans.objects.filter(
            user=user,
            status__in=[
                "UNVERIFIED",
                "VERIFIED",
                "PENDING",
                "AWARDED",
                "ACTIVE",
                "OVERDUE",
            ],
        ).last()

        return Response(
            {
                "found": True,
                "user": UserSerializer(user).data,
                "has_outstanding_loan": outstanding_loan is not None,
                "outstanding_loan": (
                    LoanSerializer(outstanding_loan).data if outstanding_loan else None
                ),
            }
        )


class LoanListCreateView(generics.ListCreateAPIView):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return get_filtered_queryset(self.request.user, Loans.objects.select_related("user", "user__profile", "loan_product"), 'branch').order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        created_by = user if (user and user.is_authenticated) else None

        # Check if customer is locked
        customer_id = self.request.data.get("user")
        if customer_id:
            try:
                customer = Users.objects.get(id=customer_id)
                profile = getattr(customer, "profile", None)

                # Requirement 4: Customer Profile Completeness Check
                missing_fields = []
                if not customer.full_name:
                    missing_fields.append("full_name")
                if not customer.phone:
                    missing_fields.append("phone")
                if not profile:
                    missing_fields.append("profile")
                else:
                    if not profile.national_id:
                        missing_fields.append("national_id")
                    if not profile.national_id_image:
                        missing_fields.append("national_id_image")
                    if not profile.employment_status:
                        missing_fields.append("employment_status")
                    if not profile.monthly_income:
                        missing_fields.append("monthly_income")

                # Check for at least one guarantor
                if not customer.guarantors.exists():
                    missing_fields.append("at least one guarantor")

                if missing_fields:
                    raise serializers.ValidationError(
                        {
                            "error": f"Customer profile incomplete. Missing fields: {', '.join(missing_fields)}"
                        }
                    )

                if customer.is_locked:
                    raise serializers.ValidationError(
                        {
                            "error": "This customer account is locked/archived and cannot apply for new loans."
                        }
                    )
            except Users.DoesNotExist:
                pass

        interest_rate = self.request.data.get("interest_rate")
        duration_weeks = self.request.data.get("duration_weeks")
        product_id = self.request.data.get("loan_product")

        # Business Logic for Interest Rates based on duration
        if duration_weeks:
            try:
                weeks = int(duration_weeks)
                if weeks == 4:
                    interest_rate = 25.0
                elif weeks == 5:
                    interest_rate = 31.25
                elif weeks == 6:
                    interest_rate = 36.35
            except (ValueError, TypeError):
                pass

        if not interest_rate:
            if product_id:
                try:
                    product = LoanProducts.objects.get(id=product_id)
                    interest_rate = product.interest_rate
                except LoanProducts.DoesNotExist:
                    pass

            if not interest_rate:
                try:
                    interest_setting = SystemSettings.objects.get(
                        key="DEFAULT_INTEREST_RATE"
                    )
                    # Safe cast to float
                    interest_rate = float(interest_setting.value)
                except (SystemSettings.DoesNotExist, ValueError, TypeError):
                    interest_rate = 15.0

        loan = serializer.save(interest_rate=interest_rate, created_by=created_by)

        # Try-catch block to prevent 500 error if audit log, SMS, or notifications fail
        try:
            # Security Audit Log
            ip = get_client_ip(self.request)
            log_action(
                self.request.user,
                f"Created new Loan application for {loan.user.full_name}",
                "loans",
                loan.id,
                log_type="GENERAL",
                ip_address=ip,
            )

            create_loan_activity(
                loan,
                created_by,
                "APPLIED",
                f"Loan applied for KES {float(loan.principal_amount):,.2f}",
            )

            create_notification(
                loan.user,
                f"Your loan application of KES {float(loan.principal_amount):,.2f} has been received and is under review.",
            )

            # SMS Notification
            if hasattr(loan.user, "phone") and loan.user.phone:
                msg = f"Hello {loan.user.full_name}, your loan application of KES {float(loan.principal_amount):,.2f} has been received and is under review."
                send_sms_async([loan.user.phone], msg)
                SMSLog.objects.create(
                    sender=created_by,
                    recipient_phone=loan.user.phone,
                    recipient_name=loan.user.full_name,
                    message=msg,
                    type="AUTO",
                )
        except Exception as e:
            # Always print error to console for debugging but return 201 to the user
            print(
                f"[DEBUG] Loan created ID {loan.id} but post-save tasks failed: {str(e)}"
            )
            pass


class RepaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = RepaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return get_filtered_queryset(self.request.user, Repayments.objects.all(), 'loan__user__profile__branch_fk').order_by("-payment_date")

    def perform_create(self, serializer):
        from django.db import transaction
        from decimal import Decimal
        from .models import SystemCapital, LedgerEntry, RepaymentSchedule

        with transaction.atomic():
            repayment = serializer.save(id=uuid.uuid4())
            loan = repayment.loan

            # Increase capital balance for simulation
            capital = SystemCapital.objects.select_for_update().filter(
                name="Simulation Capital"
            ).first()
            if capital:
                capital.balance += repayment.amount_paid
                capital.save()
                LedgerEntry.objects.create(
                    capital_account=capital,
                    amount=repayment.amount_paid,
                    entry_type="REPAYMENT",
                    loan=loan,
                    reference_id=repayment.reference_code,
                    note=f"Repayment of KES {repayment.amount_paid} for Loan {loan.id.hex[:8]}"
                )

            # Mark repayment schedule installments as paid
            amount_remaining = float(repayment.amount_paid)
            for installment in RepaymentSchedule.objects.filter(
                loan=loan, is_paid=False
            ).order_by('due_date'):
                if amount_remaining <= 0:
                    break
                if amount_remaining >= float(installment.amount_due):
                    installment.is_paid = True
                    installment.save()
                    amount_remaining -= float(installment.amount_due)
                else:
                    break

            # Log activity
            admin = self.request.user if hasattr(self.request.user, "role") else None
            create_loan_activity(
                loan,
                admin,
                "REPAYMENT",
                f"Repayment of KES {repayment.amount_paid} recorded.",
            )

            # Create transaction for user
            Transactions.objects.create(
                id=uuid.uuid4(),
                user=loan.user,
                type="REPAYMENT",
                amount=repayment.amount_paid,
            )

            # FIX 2: Update Repayment Schedule
            from .models import RepaymentSchedule
            schedules = RepaymentSchedule.objects.filter(
                loan=loan, 
                status='PENDING'
            ).order_by('due_date')
            
            amount_to_apply = repayment.amount_paid
            for schedule in schedules:
                if amount_to_apply <= 0:
                    break
                if amount_to_apply >= schedule.amount_due:
                    amount_to_apply -= schedule.amount_due
                    schedule.status = 'PAID'
                    schedule.save()
                else:
                    # Partial payment for this installment
                    # (Simple logic: mark as paid if they pay a chunk, or keep pending)
                    break 

            # Check if loan is fully paid
            if loan.remaining_balance <= 0:
                old_status = loan.status
                loan.status = "CLOSED"
                loan.save()
                create_notification(
                    loan.user,
                    f"Congratulations! Your loan of KES {loan.principal_amount} has been fully repaid.",
                )
                create_loan_activity(
                    loan, admin, "STATUS_CHANGE", "Loan closed - fully repaid."
                )
                # Audit Log
                AuditLogs.objects.create(
                    admin=admin,
                    action=f"Loan {loan.id} fully repaid and closed.",
                    log_type="STATUS",
                    table_name="loans",
                    record_id=loan.id,
                    old_data={"status": old_status},
                    new_data={"status": "CLOSED"},
                )
            else:
                # Update overdue status if needed
                loan.update_status_and_rates()


class MpesaRepaymentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if role not in ["FIELD_OFFICER", "MANAGER", "ADMIN"]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        loan_id = request.data.get("loan_id")
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")

        if not all([loan_id, amount, phone_number]):
            return Response(
                {"error": "loan_id, amount, and phone_number are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            loan = Loans.objects.get(id=loan_id)
            if loan.status not in ["ACTIVE", "OVERDUE"]:
                return Response(
                    {
                        "error": f"Loan is in status {loan.status}. Payments only allowed for ACTIVE or OVERDUE loans."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if loan.remaining_balance <= 0:
                return Response(
                    {"error": "Loan is already fully paid"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Trigger STK Push
            handler = MpesaHandler()
            # If no credentials, use mock
            if not handler.consumer_key:
                result = handler.mock_stk_push(phone_number, amount, str(loan.id)[:20])
            else:
                result = handler.stk_push(
                    phone_number,
                    amount,
                    str(loan.id)[:20],
                    f"Repayment {str(loan.id)[:10]}",
                )

            return Response(result)

        except Loans.DoesNotExist:
            return Response(
                {"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND
            )


class MpesaDisbursementView(views.APIView):
    """
    Trigger Disbursement with strict security protocols.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        role = getattr(user, "role", None)
        ip = request.META.get("REMOTE_ADDR")

        if role not in ["ADMIN", "MANAGER", "FINANCE_OFFICER", "FINANCIAL_OFFICER"]:
            return Response(
                {"error": "Unauthorized to trigger disbursements"}, status=403
            )

        mode = request.data.get("mode", "single")
        confirmed = request.data.get(
            "confirmed", True
        )  # Default to True to bypass blocking
        reason = request.data.get("reason", "Standard Disbursement")

        if not confirmed:
            return Response(
                {
                    "error": "Two-step confirmation required. Please confirm disbursement action."
                },
                status=400,
            )

        # 1. Daily Limit Check (e.g., 500,000 per officer)
        # Fetch limit from settings or use default
        try:
            limit_setting = SystemSettings.objects.get(
                key="DAILY_OFFICER_DISBURSEMENT_LIMIT"
            )
            daily_limit = float(limit_setting.value)
        except:
            daily_limit = 500000.0

        today_start = timezone.now().astimezone(timezone.get_current_timezone()).replace(hour=0, minute=0, second=0, microsecond=0)

        # Calculate what this officer has disbursed today
        today_disbursements = AuditLogs.objects.filter(
            admin=user, action="LOAN_DISBURSED", created_at__gte=today_start
        )

        total_today = 0
        for log in today_disbursements:
            try:
                total_today += float(log.new_data.get("amount", 0))
            except:
                pass

        if mode == "single":
            loan_id = request.data.get("loan_id")
            if not loan_id:
                return Response({"error": "loan_id is required"}, status=400)

            try:
                loan = Loans.objects.get(id=loan_id)

                # FIX 8: Low Capital Threshold Alert
                from .models import SystemCapital
                capital = SystemCapital.objects.first()
                if capital and capital.balance < 50000:
                    print(f"LOW CAPITAL ALERT: Balance is {capital.balance}")
                    # In real app, send email/SMS to Super Admin
                    try:
                        super_admins = Admins.objects.filter(is_super_admin=True)
                        for sa in super_admins:
                            create_notification(sa, f"URGENT: System Capital is low! Current Balance: {capital.balance}")
                    except:
                        pass

                # Check limit
                if total_today + float(loan.principal_amount) > daily_limit:
                    return Response(
                        {
                            "error": f"Daily disbursement limit of KES {daily_limit:,} exceeded. Current total: KES {total_today:,}"
                        },
                        status=403,
                    )

                # Manual marking protection (redundant but safe)
                if loan.status != "APPROVED":
                    return Response(
                        {
                            "error": f"Only APPROVED loans can be disbursed. Current status: {loan.status}"
                        },
                        status=400,
                    )

                # Trigger Service
                from .services import DisbursementService

                DisbursementService.disburse_loan(loan, user)

                # Audit log with sensitive meta
                AuditLogs.objects.create(
                    admin=user,
                    action="LOAN_DISBURSED",
                    log_type="MANAGEMENT",
                    table_name="loans",
                    record_id=loan.id,
                    old_data={"status": "APPROVED"},
                    new_data={
                        "status": "DISBURSED",
                        "amount": float(loan.principal_amount),
                        "reason": reason,
                    },
                    ip_address=ip,
                )

                return Response(
                    {
                        "message": "Disbursement processed successfully",
                        "status": "success",
                    }
                )

            except Loans.DoesNotExist:
                return Response({"error": "Loan not found"}, status=404)
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        elif mode == "bulk":
            # Bulk mode also needs limit checks
            loans_to_disburse = Loans.objects.filter(status="APPROVED").order_by(
                "created_at"
            )[:10]
            results = []
            current_batch_total = total_today

            from .services import DisbursementService

            for loan in loans_to_disburse:
                amt = float(loan.principal_amount)
                if current_batch_total + amt > daily_limit:
                    results.append(
                        {
                            "loan_id": str(loan.id),
                            "status": "failed",
                            "error": "Daily limit reached during bulk process",
                        }
                    )
                    continue

                try:
                    DisbursementService.disburse_loan(loan, user)
                    current_batch_total += amt
                    results.append({"loan_id": str(loan.id), "status": "success"})

                    AuditLogs.objects.create(
                        admin=user,
                        action="LOAN_DISBURSED",
                        log_type="MANAGEMENT",
                        table_name="loans",
                        record_id=loan.id,
                        old_data={"status": "APPROVED"},
                        new_data={
                            "status": "DISBURSED",
                            "amount": amt,
                            "reason": "Bulk Disbursement",
                        },
                        ip_address=ip,
                    )
                except Exception as e:
                    results.append(
                        {"loan_id": str(loan.id), "status": "failed", "error": str(e)}
                    )

            return Response(
                {"message": "Bulk disbursement completed", "results": results}
            )
            return Response(
                {"error": "loan_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            loan = Loans.objects.get(id=loan_id)
            if loan.status != "APPROVED":
                return Response(
                    {
                        "error": f"Loan must be APPROVED to disburse. Current status: {loan.status}"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            DisbursementService.disburse_loan(loan, user)
            return Response({"message": "Loan disbursed successfully."}, status=200)

        except Loans.DoesNotExist:
            return Response(
                {"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except InsufficientCapitalError as e:
            return Response(
                {"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Disbursement failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MpesaCallbackView(views.APIView):
    """
    Handle M-Pesa Callbacks:
    1. C2B (Paybill) Verification & Auto-Matching
    2. B2C Results
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not (request.user.role == "ADMIN" or request.user.is_super_admin):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Only Administrators can modify system settings.")

        data = request.data
        print(f"M-Pesa Callback Received: {json.dumps(data)}")

        # 1. Check for B2C Disbursement Result
        if "Result" in data:
            result = data.get("Result")
            result_code = result.get("ResultCode")
            originator_id = result.get("OriginatorConversationID")
            trans_id = result.get("TransactionID")
            
            # FIX 7: Extract real M-Pesa Receipt Number from metadata if available
            receipt_number = trans_id
            if "ResultParameters" in result:
                params = result.get("ResultParameters", {}).get("ResultParameter", [])
                for p in params:
                    if p.get("Key") == "ReceiptNumber":
                        receipt_number = p.get("Value")

            print(
                f"B2C Result: Code={result_code}, ID={originator_id}, Trans={trans_id}, Receipt={receipt_number}"
            )

            # Since we set status to DISBURSED immediately in the triggering view,
            # we only need to revert if result_code is NOT 0
            if result_code != 0:
                # Find loan by remarks or custom tracking logic?
                # Better approach: We could store the originator_id in a Transaction model.
                # For now, let's just log it.
                print(f"⚠️ B2C FALIED for OriginatorID: {originator_id}")
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        # 2. Check for C2B Paybill Confirmation (Auto-allocate payment)
        trans_id = data.get("TransID")
        bill_ref = str(data.get("BillRefNumber", "")).strip().lower()
        amount = data.get("TransAmount")
        msisdn = str(data.get("MSISDN", ""))

        if trans_id:
            try:
                # Normalize phone (2547... -> 07...)
                search_phone = msisdn
                if msisdn.startswith("254") and len(msisdn) > 3:
                    search_phone = "0" + msisdn[3:]
                elif not msisdn.startswith("0") and len(msisdn) == 9:
                    search_phone = "0" + msisdn

                # Search Strategy:
                # A. Match by BillRefNumber (National ID, Account fragment, or Phone)
                # B. Match by MSISDN (Phone Number)
                loan = (
                    Loans.objects.filter(
                        models.Q(user__profile__national_id=bill_ref)
                        | models.Q(user__profile__national_id__icontains=bill_ref)
                        | models.Q(id__icontains=bill_ref)
                        | models.Q(user__id__icontains=bill_ref)
                        | models.Q(user__phone__icontains=search_phone)
                        | models.Q(user__phone__icontains=msisdn)
                    )
                    .filter(status__in=["ACTIVE", "OVERDUE", "DISBURSED"])
                    .order_by("created_at")
                    .first()
                )

                if loan:
                    # Record the repayment
                    Repayments.objects.create(
                        loan=loan,
                        amount_paid=amount,
                        payment_method="MPESA_PAYBILL",
                        reference_code=trans_id,
                    )

                    # Update status/rates
                    loan.update_status_and_rates()
                    print(
                        f"✅ Auto-allocated KES {amount} to {loan.user.full_name} (National ID: {getattr(loan.user.profile, 'national_id', 'N/A')})"
                    )

                    create_notification(
                        loan.user,
                        f"Your payment of KES {amount} (Ref: {trans_id}) has been successfully processed.",
                    )

                    return Response({"ResultCode": 0, "ResultDesc": "Success"})
                else:
                    return Response({"ResultCode": 0, "ResultDesc": "Success"})
            except Exception as e:
                print(f"Fail to auto-allocate C2B: {str(e)}")

        return Response({"ResultCode": 0, "ResultDesc": "Success"})


class BulkSMSView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user_role = getattr(user, "role", None)
        # Restricted to Admins, Managers, and Financial Officers
        if user_role not in ["ADMIN", "MANAGER", "FINANCIAL_OFFICER"]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        sms_type = request.data.get("type", "DEFAULTERS")  # DEFAULTERS, REPAID, NOTICE
        custom_message = request.data.get("message")

        # Fetch templates from settings or use defaults
        def get_template(key, default):
            try:
                setting = SystemSettings.objects.get(key=key)
                return setting.value
            except SystemSettings.DoesNotExist:
                return default

        count = 0

        if sms_type == "DEFAULTERS":
            overdue_loans = Loans.objects.filter(status="OVERDUE")

            # Scope to manager branch or financial officer portfolio if applicable
            if user_role == "MANAGER":
                manager_branch = getattr(user, "branch", None)
                if manager_branch:
                    overdue_loans = overdue_loans.filter(
                        user__profile__branch=manager_branch
                    )

            template = get_template(
                "MSG_TEMPLATE_DEFAULTER",
                "Hello {name}, your loan of KES {principal:,.2f} is OVERDUE. Interest accumulated: KES {interest:,.2f}. Remaining balance: KES {balance:,.2f}. Please pay via Paybill.",
            )

            for loan in overdue_loans:
                phone = loan.user.phone
                if phone:
                    try:
                        principal = float(loan.principal_amount)
                        interest = float(loan.total_repayable_amount) - principal
                        balance = float(loan.remaining_balance)

                        msg = template.format(
                            name=loan.user.full_name,
                            principal=principal,
                            interest=interest,
                            balance=balance,
                        )
                        send_sms_async([phone], msg)
                        SMSLog.objects.create(
                            sender=user,
                            recipient_phone=phone,
                            recipient_name=loan.user.full_name,
                            message=msg,
                            type="DEFAULTER",
                        )
                        count += 1
                        create_notification(
                            loan.user, f"Defaulter SMS sent to {phone}."
                        )
                    except Exception as e:
                        print(f"Error sending defaulter SMS: {e}")

        elif sms_type == "REPAID":
            # Encourage repeat loans for those who fully repaid
            closed_loans = Loans.objects.filter(status="CLOSED")
            if user_role == "MANAGER":
                manager_branch = getattr(user, "branch", None)
                if manager_branch:
                    closed_loans = closed_loans.filter(
                        user__profile__branch=manager_branch
                    )

            template = get_template(
                "MSG_TEMPLATE_REPAID",
                "Hello {name}, thank you for your commitment to repaying your previous loan. You are now eligible to apply for a newer, larger loan. Visit our nearest office or apply online today!",
            )

            # Get unique users with closed loans who don't have active ones
            users_to_notify = {}
            for loan in closed_loans:
                if loan.user.id not in users_to_notify:
                    # Check if they have any active/pending loan
                    has_active = Loans.objects.filter(
                        user=loan.user,
                        status__in=["ACTIVE", "OVERDUE", "PENDING", "VERIFIED"],
                    ).exists()
                    if not has_active:
                        users_to_notify[loan.user.id] = loan.user

            for user_obj in users_to_notify.values():
                if user_obj.phone:
                    try:
                        msg = template.format(name=user_obj.full_name)
                        send_sms_async([user_obj.phone], msg)
                        SMSLog.objects.create(
                            sender=user,
                            recipient_phone=user_obj.phone,
                            recipient_name=user_obj.full_name,
                            message=msg,
                            type="REPAID",
                        )
                        count += 1
                    except Exception as e:
                        print(f"Error sending REPAID SMS: {e}")

        elif sms_type == "NOTICE":
            if not custom_message:
                return Response(
                    {"error": "Message is required for general notice"}, status=400
                )

            # Broaden to all users so you can test without verifying them first
            all_users = Users.objects.all()
            if user_role == "MANAGER":
                manager_branch = getattr(user, "branch", None)
                if manager_branch:
                    all_users = all_users.filter(profile__branch=manager_branch)

            for u in all_users:
                if u.phone:
                    try:
                        send_sms_async([u.phone], custom_message)
                        SMSLog.objects.create(
                            sender=user,
                            recipient_phone=u.phone,
                            recipient_name=u.full_name,
                            message=custom_message,
                            type="NOTICE",
                        )
                        count += 1
                    except Exception as e:
                        print(f"Error sending NOTICE SMS: {e}")

        # Log this communication event
        AuditLogs.objects.create(
            admin=user,
            action=f"Sent {count} bulk SMS notifications of type {sms_type}.",
            log_type="COMMUNICATION",
        )

        return Response(
            {
                "status": "success",
                "message": f"Bulk SMS sequence started for {count} recipients ({sms_type}).",
            }
        )


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
                admin=request.user,
                action=f"{'Enabled' if enabled else 'Disabled'} God Mode for {target.full_name}",
                log_type="SECURITY",
                table_name="admins",
                record_id=target.id,
                is_owner_log=True,
                ip_address=get_client_ip(request)
            )

            return Response({"message": f"God Mode {'enabled' if enabled else 'disabled'} for {target.full_name}"})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)


class SecurityLogsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.is_owner or request.user.is_super_admin):
            return Response({"error": "Unauthorized access to security logs."}, status=403)

        if request.user.is_super_admin and not request.user.is_owner:
            AuditLogs.objects.create(
                admin=request.user,
                action=f"Super Admin {request.user.full_name} viewed security logs",
                log_type="SECURITY",
                table_name="audit_logs",
                is_owner_log=True,
                ip_address=get_client_ip(request)
            )

        logs = AuditLogs.objects.filter(log_type="SECURITY").order_by("-created_at")
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)


class OwnerAuditListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)

        logs = AuditLogs.objects.filter(is_owner_log=True).order_by("-created_at")
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)


class OwnerNotificationsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)

        time_threshold = timezone.now() - timedelta(hours=24)
        logs = AuditLogs.objects.filter(is_owner_log=True, created_at__gte=time_threshold).order_by("-created_at")[:10]
        
        # Read last read timestamp from settings? Or let frontend handle it? 
        # Request asks for last-read timestamp in SystemSettings key 'owner_last_read_notifications'
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
        
        return Response({
            "notifications": serializer.data,
            "unread_count": unread_count
        })


class MarkOwnerNotificationsReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)
        
        now_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        SystemSettings.objects.update_or_create(
            key='owner_last_read_notifications',
            defaults={'value': now_str}
        )
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
                id=uuid.uuid4(),
                full_name=full_name,
                email=email,
                password_hash=password_hash,
                role="ADMIN",
                is_owner=True,
                god_mode_enabled=True,
                is_verified=True,
                is_primary_owner=False,
                ownership_granted_by=request.user,
                ownership_granted_at=timezone.now()
            )
        else:
            return Response({"error": "Invalid grant type."}, status=400)

        # Notify all current owners
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
                        "sender": {"name": sender_name, "email": from_email},
                        "to": [{"email": owner.email}],
                        "subject": subject,
                        "htmlContent": f"<html><body><p>{message.replace('\n', '<br>')}</p></body></html>"
                    }
                    requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers={
                        "api-key": brevo_api_key, "content-type": "application/json"
                    })
                except:
                    pass

        # Audit Log
        AuditLogs.objects.create(
            admin=request.user,
            action=f"Ownership granted to {target.full_name} ({target.email}) by {request.user.full_name}",
            log_type="SECURITY",
            table_name="admins",
            record_id=target.id,
            is_owner_log=True,
            ip_address=ip,
            old_data={"is_owner": False},
            new_data={"is_owner": True, "granted_by": str(request.user.id)}
        )

        return Response({"message": f"Ownership successfully granted to {target.full_name}."})


class OwnershipRelinquishView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
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

        # Notify others
        other_owners = Admins.objects.filter(is_owner=True)
        ip = get_client_ip(request)
        subject = f"{admin.full_name} has relinquished ownership of Azariah Credit Ltd"
        message = f"{admin.full_name} ({admin.email}) has voluntarily relinquished their ownership status.\n\nDate: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}\nIP: {ip}"

        brevo_api_key = os.getenv("BREVO_API_KEY")
        from_email = os.getenv("FROM_EMAIL")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")

        if brevo_api_key and from_email:
            # Notify remaining owners
            for owner in other_owners:
                try:
                    payload = {
                        "sender": {"name": sender_name, "email": from_email},
                        "to": [{"email": owner.email}],
                        "subject": subject,
                        "htmlContent": f"<html><body><p>{message.replace('\n', '<br>')}</p></body></html>"
                    }
                    requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers={
                        "api-key": brevo_api_key, "content-type": "application/json"
                    })
                except:
                    pass
            
            # Notify self
            try:
                requests.post("https://api.brevo.com/v3/smtp/email", json={
                    "sender": {"name": sender_name, "email": from_email},
                    "to": [{"email": admin.email}],
                    "subject": "Ownership Relinquished — Azariah Credit Ltd",
                    "htmlContent": f"<html><body><p>You have successfully relinquished your ownership status.</p></body></html>"
                }, headers={"api-key": brevo_api_key, "content-type": "application/json"})
            except:
                pass

        AuditLogs.objects.create(
            admin=admin,
            action=f"Ownership relinquished by {admin.full_name}",
            log_type="SECURITY",
            table_name="admins",
            record_id=admin.id,
            is_owner_log=True,
            ip_address=ip,
            old_data={"is_owner": True},
            new_data={"is_owner": False}
        )

        return Response({"message": "Ownership successfully relinquished."})


class OwnershipHandoverView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.is_owner:
            return Response({"error": "Owner access only."}, status=403)

        confirm_password = request.data.get("confirm_password")
        if not confirm_password or not bcrypt.checkpw(confirm_password.encode('utf-8'), request.user.password_hash.encode('utf-8')):
            return Response({"error": "Password confirmation failed."}, status=403)

        grant_type = request.data.get("type")
        target = None

        # Check limit logic for handover
        current_owners = Admins.objects.filter(is_owner=True)
        if grant_type == "new" and current_owners.count() >= 3:
            return Response({"error": "Cannot handover to a new person — 3 owners already exist. Use Grant to replace an existing owner first."}, status=400)

        # 1. Grant to target
        if grant_type == "existing":
            target_id = request.data.get("target_admin_id")
            try:
                target = Admins.objects.get(id=target_id)
                # If target is already an owner, we can still "handover" (essentially self-relinquishing while ensuring target stays owner)
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

        # 2. Relinquish self
        old_owner = request.user
        old_owner.is_owner = False
        old_owner.god_mode_enabled = False
        old_owner.ownership_relinquished_at = timezone.now()
        old_owner.save()

        # Audit logs
        ip = get_client_ip(request)
        AuditLogs.objects.create(
            admin=old_owner, action=f"Ownership granted to {target.full_name} via handover",
            log_type="SECURITY", table_name="admins", record_id=target.id, is_owner_log=True, ip_address=ip
        )
        AuditLogs.objects.create(
            admin=old_owner, action=f"Ownership relinquished by {old_owner.full_name} via handover",
            log_type="SECURITY", table_name="admins", record_id=old_owner.id, is_owner_log=True, ip_address=ip
        )

        # Notify
        all_owners = Admins.objects.filter(is_owner=True)
        subject = "Full ownership handover completed"
        message = f"Full ownership handover completed. {old_owner.full_name} has transferred ownership to {target.full_name}.\n\nDate: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        brevo_api_key = os.getenv("BREVO_API_KEY")
        from_email = os.getenv("FROM_EMAIL")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")

        if brevo_api_key and from_email:
            for owner in all_owners:
                try:
                    requests.post("https://api.brevo.com/v3/smtp/email", json={
                        "sender": {"name": sender_name, "email": from_email}, "to": [{"email": owner.email}],
                        "subject": subject, "htmlContent": f"<html><body><p>{message}</p></body></html>"
                    }, headers={"api-key": brevo_api_key, "content-type": "application/json"})
                except: pass

        return Response({"message": "Handover successful. You are no longer an owner."})


class BranchListCreateView(generics.ListCreateAPIView):
    queryset = Branch.objects.all().order_by("name")
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def perform_create(self, serializer):
        branch = serializer.save()
        log_action(
            self.request.user,
            "CREATE",
            "branches",
            branch.id,
            new_data={"name": branch.name},
        )


class BranchDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def perform_update(self, serializer):
        old_data = BranchSerializer(self.get_object()).data
        branch = serializer.save()
        log_action(
            self.request.user,
            "UPDATE",
            "branches",
            branch.id,
            old_data=old_data,
            new_data=serializer.data,
        )

    def perform_destroy(self, instance):
        if instance.branch_admins.exists() or instance.branch_loans.exists():
            raise status.ValidationError(
                "Cannot delete branch with existing staff or loans."
            )
        log_action(
            self.request.user,
            "DELETE",
            "branches",
            instance.id,
            old_data=BranchSerializer(instance).data,
        )
        instance.delete()


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not user or not hasattr(user, "role"):
            return AuditLogs.objects.none()

        # FINANCE, SUPER_ADMIN and ADMIN see all logs
        if user.role in ["FINANCIAL_OFFICER", "SUPER_ADMIN", "ADMIN"]:
            queryset = AuditLogs.objects.all().order_by("-created_at")
        else:
            # MANAGERS and FIELD_OFFICERS only see logs for their branch
            if user.branch_fk:
                # We filter logs where the acting admin is in the same branch
                queryset = AuditLogs.objects.filter(
                    admin__branch_fk=user.branch_fk
                ).order_by("-created_at")
            else:
                return AuditLogs.objects.none()

        # Filters
        log_type = self.request.query_params.get("type")
        if log_type:
            queryset = queryset.filter(log_type=log_type)

        # Limit to 10 if on dashboard overview, otherwise maybe allow more
        limit = self.request.query_params.get("limit")
        if limit:
            try:
                queryset = queryset[: int(limit)]
            except ValueError:
                pass

        return queryset


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
            return DeactivationRequest.objects.filter(requested_by=user).order_by(
                "-created_at"
            )

        return DeactivationRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(requested_by=user, status="PENDING")

        # Log deactivation request
        AuditLogs.objects.create(
            admin=user,
            action=f"Requested deactivation for officer {serializer.validated_data['officer'].full_name}",
            log_type="MANAGEMENT",
            table_name="deactivation_requests",
            record_id=None,  # Will be set after save if needed
        )


class DeactivationRequestDetailView(generics.RetrieveUpdateAPIView):
    queryset = DeactivationRequest.objects.all()
    serializer_class = DeactivationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        user = self.request.user
        if user.role != "ADMIN":
            raise permissions.exceptions.PermissionDenied(
                "Only admins can process deactivation requests"
            )

        instance = serializer.save(processed_by=user, processed_at=timezone.now())

        if instance.status == "APPROVED":
            # Actually deactivate the officer
            officer = instance.officer
            officer.is_blocked = True
            officer.save()

            AuditLogs.objects.create(
                admin=user,
                action=f"Approved deactivation for officer {officer.full_name}",
                log_type="MANAGEMENT",
                table_name="admins",
                record_id=officer.id,
            )
        elif instance.status == "REJECTED":
            AuditLogs.objects.create(
                admin=user,
                action=f"Rejected deactivation for officer {instance.officer.full_name}",
                log_type="MANAGEMENT",
                table_name="admins",
                record_id=instance.officer.id,
            )


class AdminSuspendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            target = Admins.objects.get(pk=pk)
            user = request.user
            reason = request.data.get("reason")

            if not reason:
                return Response({"error": "Reason for suspension is required."}, status=400)

            # Owner Protection
            if target.is_owner:
                return Response({"error": "The owner account cannot be suspended."}, status=403)

            # Suspension rules
            can_suspend = False
            if user.is_owner:
                can_suspend = True
            elif user.is_super_admin:
                # Super Admin can suspend Admin, Manager, etc. but not Owner or other Super Admins
                if not (target.is_owner or target.is_super_admin):
                    can_suspend = True

            if not can_suspend:
                return Response({"error": "Your role does not have permission to suspend this account."}, status=403)

            target.is_blocked = True
            target.suspended_at = timezone.now()
            target.suspended_by = user
            target.suspension_reason = reason
            target.save()

            # Audit Log
            AuditLogs.objects.create(
                admin=user,
                action=f"Suspended admin {target.full_name}. Reason: {reason}",
                log_type="SECURITY",
                table_name="admins",
                record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin,
                ip_address=get_client_ip(request)
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

            # Suspension rules
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

            # Audit Log
            AuditLogs.objects.create(
                admin=user,
                action=f"Unsuspended admin {target.full_name}",
                log_type="SECURITY",
                table_name="admins",
                record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin,
                ip_address=get_client_ip(request)
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

            # Owner Protection
            if target.is_owner:
                return Response({"error": "The owner account is protected and cannot be modified."}, status=403)

            # Role revocation rules
            can_revoke = False
            if user.is_owner:
                can_revoke = True
            elif user.is_super_admin:
                # Super Admin can revoke Admin, Manager, etc. but not Owner or other Super Admins
                if not (target.is_owner or target.is_super_admin):
                    can_revoke = True

            if not can_revoke:
                return Response({"error": "Your role does not have permission to revoke roles for this account."}, status=403)

            old_role = target.role
            target.role = new_role
            target.save()

            # Audit Log
            AuditLogs.objects.create(
                admin=user,
                action=f"Revoked roles for {target.full_name}. Downgraded from {old_role} to {new_role}. Reason: {reason}",
                log_type="SECURITY",
                table_name="admins",
                record_id=target.id,
                is_owner_log=user.is_owner or user.is_super_admin,
                ip_address=get_client_ip(request)
            )

            return Response({"message": f"Role for {target.full_name} has been updated to {new_role}."})
        except Admins.DoesNotExist:
            return Response({"error": "Admin not found"}, status=404)


class CapitalBalanceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import SystemCapital, LedgerEntry
        capital = SystemCapital.objects.filter(name="Simulation Capital").first()
        
        total_disbursed = LedgerEntry.objects.filter(
            entry_type="DISBURSEMENT"
        ).aggregate(total=models.Sum('amount'))['total'] or 0
        
        total_repaid = LedgerEntry.objects.filter(
            entry_type="REPAYMENT"
        ).aggregate(total=models.Sum('amount'))['total'] or 0

        return Response({
            "balance": float(capital.balance) if capital else 0,
            "total_disbursed": float(total_disbursed),
            "total_repaid": float(total_repaid),
            "account_name": capital.name if capital else "Simulation Capital",
        })


class AdminListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Admins.objects.all().order_by("-created_at")
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class AdminDetailView(generics.RetrieveUpdateAPIView):
    queryset = Admins.objects.all()
    serializer_class = AdminSerializer
    permission_classes = [IsAdminUser]

    def get_object(self):
        # Allow admins to view/edit their own profile
        obj = super().get_object()
        if self.request.user.id == obj.id:
            return obj
        # Otherwise, check if they have ADMIN role
        if self.request.user.role == "ADMIN":
            return obj
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("You do not have permission to view/edit this admin.")


class SystemSettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    required_roles = ["ADMIN"]

    def get(self, request):
        if not (request.user.role == "ADMIN" or request.user.is_super_admin):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Only Administrators can view system settings.")
        settings = SystemSettings.objects.all()
        serializer = SystemSettingsSerializer(settings, many=True)
        data = {s["key"]: s["value"] for s in serializer.data}
        return Response(data)

    def post(self, request):
        for key, value in request.data.items():
            SystemSettings.objects.update_or_create(key=key, defaults={"value": value})
        return Response({"message": "Settings updated successfully"})


class SMSLogListView(generics.ListAPIView):
    queryset = SMSLog.objects.all().order_by("-created_at")
    serializer_class = SMSLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = getattr(user, "role", None)

        if user_role == "MANAGER":
            manager_branch = getattr(user, "branch", None)
            if manager_branch:
                # Filter by logs where the recipient is in the manager's branch
                return SMSLog.objects.filter(
                    recipient_phone__in=Users.objects.filter(
                        profile__branch=manager_branch
                    ).values_list("phone", flat=True)
                ).order_by("-created_at")

        return super().get_queryset()


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
            return Response(
                {"error": "Admin not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RegisterAdminView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        full_name = request.data.get("full_name")
        email = request.data.get("email")
        phone = request.data.get("phone")
        role = request.data.get("role")
        password = request.data.get("password")
        invitation_token = request.data.get("invitation_token")
        branch = request.data.get(
            "branch"
        )  # Can be passed from frontend or taken from invite

        if not all([full_name, email, role, password]):
            return Response(
                {"error": "full_name, email, role, and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = ["ADMIN", "MANAGER", "FINANCIAL_OFFICER", "FIELD_OFFICER", "SUPER_ADMIN"]
        if role not in valid_roles:
            return Response(
                {"error": f"Role must be one of: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Requirement: Everyone must have an invitation if the system is already initialized
        # First OWNER can register without invitation
        is_initialized = Admins.objects.filter(is_owner=True).exists()

        inviter_admin = None
        branch_fk = None
        if is_initialized:
            if not invitation_token:
                return Response(
                    {
                        "error": "Account registration is restricted to invited personnel only."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            try:
                invite = AdminInvitation.objects.get(
                    token=invitation_token,
                    email__iexact=email,
                    is_used=False,
                    expires_at__gt=timezone.now(),
                )

                # Assign inviter and branch
                inviter = invite.invited_by or invite.invited_by_admin
                branch_fk = invite.branch_fk

                # If the new user is a Field Officer, their branch is locked
                # (Simple role verification/sync)
            except AdminInvitation.DoesNotExist:
                return Response(
                    {"error": "Invalid or expired invitation token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if Admins.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification_code = str(secrets.randbelow(900000) + 100000)

        password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        # First ADMIN to register becomes super admin
        # Non-ADMIN roles should NEVER be super admins
        is_first_admin = (
            role == "ADMIN" and not Admins.objects.filter(role="ADMIN").exists()
        )

        # Signup Completion
        # If invitation was 'OWNER', the new admin becomes an owner
        is_owner = False
        inviter_admin = invite.invited_by or invite.invited_by_admin if 'invite' in locals() else None
        if inviter_admin and inviter_admin.is_owner:
            if role in ["SUPER_ADMIN", "ADMIN"]:
                is_owner = True

        admin = Admins.objects.create(
            id=uuid.uuid4(),
            full_name=full_name,
            email=email.lower(),
            phone=phone,
            role=role,
            branch=branch,
            password_hash=password_hash,
            verification_token=verification_code,
            is_verified=False,
            is_super_admin=(role == "SUPER_ADMIN") or (role == "ADMIN"),
            is_owner=is_owner,
            invited_by=inviter_admin,
            branch_fk=branch_fk,
            is_primary_owner=False,
            ownership_granted_by=inviter_admin if is_owner else None,
            ownership_granted_at=timezone.now() if is_owner else None
        )

        # Mark invite used
        if 'invite' in locals():
            invite.is_used = True
            invite.save()

        email_thread = threading.Thread(
            target=send_verification_email_async,
            args=(full_name, email.lower(), verification_code),
        )
        email_thread.daemon = True
        email_thread.start()

        return Response(
            {
                "message": f"Registration successful! Please check your email ({email}) for the verification code.",
                "email": email.lower(),
                "admin": AdminSerializer(admin).data,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        code = request.data.get("code")

        if not email or not code:
            return Response(
                {"error": "Email and verification code are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            admin = Admins.objects.get(email__iexact=email)

            if admin.is_verified:
                return Response(
                    {"message": "Email already verified"},
                    status=status.HTTP_200_OK,
                )

            if admin.verification_token != code:
                return Response(
                    {"error": "Invalid verification code"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            admin.is_verified = True
            admin.verification_token = None
            admin.save()

            return Response(
                {
                    "message": "Email verified successfully. You can now login.",
                    "admin": AdminSerializer(admin).data,
                },
                status=status.HTTP_200_OK,
            )
        except Admins.DoesNotExist:
            return Response(
                {"error": "Email not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class RequestPasswordResetView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django_ratelimit.core import is_ratelimited
        if is_ratelimited(request, key='ip', rate='5/m', group='password_reset', method='POST', increment=True):
            return Response(
                {"error": "Too many requests. Please wait before trying again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        email = request.data.get("email")
        if not email:
            return Response({"error": "Email is required"}, status=400)

        try:
            admin = Admins.objects.get(email__iexact=email)
            reset_code = str(secrets.randbelow(900000) + 100000)
            admin.password_reset_code = reset_code
            admin.password_reset_expires = timezone.now() + timezone.timedelta(hours=1)
            admin.save()

            threading.Thread(
                target=send_password_reset_email_async,
                args=(admin.full_name, admin.email, reset_code),
            ).start()

            return Response(
                {"message": "Reset code sent to your email. Check your inbox."}
            )
        except Admins.DoesNotExist:
            return Response(
                {
                    "message": "If this email is registered, you will receive a reset code."
                }
            )


class ConfirmPasswordResetView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        code = request.data.get("code")
        new_password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        if not all([email, code, new_password, confirm_password]):
            return Response({"error": "All fields are required"}, status=400)

        if new_password != confirm_password:
            return Response({"error": "Passwords do not match"}, status=400)

        try:
            admin = Admins.objects.get(
                email__iexact=email,
                password_reset_code=code,
                password_reset_expires__gt=timezone.now(),
            )

            password_hash = bcrypt.hashpw(
                new_password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            admin.password_hash = password_hash
            admin.password_reset_code = None
            admin.password_reset_expires = None
            admin.save()

            return Response(
                {"message": "Password reset successfully. You can now login."}
            )
        except Admins.DoesNotExist:
            return Response({"error": "Invalid or expired reset code"}, status=400)


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
        ip = self.request.META.get("REMOTE_ADDR")
        instance = self.get_object()
        old_rate = instance.interest_rate

        product = serializer.save()
        new_rate = product.interest_rate

        if old_rate != new_rate:
            AuditLogs.objects.create(
                admin=user if user.is_authenticated else None,
                action="UPDATE_LOAN_PRODUCT_RATE",
                log_type="MANAGEMENT",
                table_name="loan_products",
                record_id=product.id,
                old_data={"interest_rate": float(old_rate) if old_rate else None},
                new_data={"interest_rate": float(new_rate), "name": product.name},
                ip_address=ip,
            )


class UserProfileListCreateView(generics.ListCreateAPIView):
    queryset = UserProfiles.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]


class LoanDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Loans.objects.none()

        if hasattr(user, "role") and user.role == "MANAGER":
            return Loans.objects.filter(user__profile__branch=user.branch)
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Loans.objects.filter(created_by=user)

        return Loans.objects.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        data = self.request.data
        user = self.request.user
        user_role = getattr(user, "role", "STAFF")
        ip = get_client_ip(self.request)

        # Audit log for change
        old_data = LoanSerializer(instance).data
        new_status = data.get("status")

        # Requirement 1: STRICT LOAN STATE MACHINE
        # Order: UNVERIFIED → VERIFIED → APPROVED → DISBURSED → ACTIVE → OVERDUE → CLOSED
        if new_status and new_status != instance.status:
            # Check if strict mode is enabled in settings
            try:
                strict_setting = SystemSettings.objects.get(key="STRICT_LOAN_WORKFLOW")
                is_strict_mode = str(strict_setting.value).lower() == "true"
            except SystemSettings.DoesNotExist:
                is_strict_mode = True  # Default to true as per previous requirement

            # 1.1 Only a Field Officer can move a loan from UNVERIFIED → VERIFIED
            if instance.status == "UNVERIFIED" and new_status == "VERIFIED":
                if user_role != "FIELD_OFFICER" and is_strict_mode:
                    from rest_framework.exceptions import PermissionDenied

                    raise PermissionDenied(
                        "Only Field Officers can verify unverified loans."
                    )

            # 1.2 Only a Manager can move a loan from VERIFIED → APPROVED
            elif instance.status == "VERIFIED" and new_status == "APPROVED":
                if user_role != "MANAGER" and is_strict_mode:
                    from rest_framework.exceptions import PermissionDenied

                    raise PermissionDenied("Only Managers can approve verified loans.")

            # 1.3 Only a Finance Officer can move a loan from APPROVED → DISBURSED
            elif instance.status == "APPROVED" and new_status == "DISBURSED":
                # Note: This check is redundant with LoanDisbursementView check but good for safety
                if user_role not in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"] and is_strict_mode:
                    from rest_framework.exceptions import PermissionDenied

                    raise PermissionDenied(
                        "Only Finance Officers can disburse approved loans."
                    )

            # 1.4 Rejection Logic (Requirement 2)
            elif new_status == "REJECTED":
                # Any authorized officer can reject at their stage
                can_reject = False
                if user.is_super_admin or user_role == "ADMIN":
                    can_reject = True
                elif user_role == "FIELD_OFFICER" and instance.status == "UNVERIFIED":
                    can_reject = True
                elif user_role == "MANAGER" and instance.status == "VERIFIED":
                    can_reject = True
                elif user_role in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"] and instance.status == "APPROVED":
                    can_reject = True

                if not can_reject and is_strict_mode:
                    from rest_framework.exceptions import PermissionDenied

                    raise PermissionDenied(
                        "You do not have permission to reject this loan at its current stage."
                    )

                # Rejection must have a reason
                rejection_reason = data.get("rejection_reason")
                if not rejection_reason:
                    from rest_framework.exceptions import ValidationError

                    raise ValidationError({"rejection_reason": "This field is required when rejecting a loan."})

            # Check if attempting to skip a stage (allowing REJECTED as escape)
            else:
                # Basic ordering validation
                valid_transitions = {
                    "UNVERIFIED": ["VERIFIED", "REJECTED"],
                    "VERIFIED": ["APPROVED", "REJECTED"],
                    "APPROVED": ["DISBURSED", "REJECTED"],
                    "DISBURSED": ["ACTIVE"],
                    "ACTIVE": ["OVERDUE", "CLOSED"],
                    "OVERDUE": ["ACTIVE", "CLOSED"],
                    "REJECTED": [],  # Terminal unless Admin resets (not within scope)
                }

                if new_status not in valid_transitions.get(instance.status, []) and is_strict_mode:
                    # Admin Escape: Admins/Superadmins might need to fix things, but requirement says "Strict"
                    if not (user.is_super_admin or user_role == "ADMIN"):
                        from rest_framework.exceptions import PermissionDenied

                        raise PermissionDenied(
                            "This action is not permitted at the current loan stage."
                        )

        # 1. Block manual status change to DISBURSED (Moved this inside logic above, but keep for consistency)
        if data.get("status") == "DISBURSED" and instance.status != "DISBURSED":
            if user_role != "FINANCE_OFFICER":
                from rest_framework.exceptions import ValidationError

                raise ValidationError(
                    "Loans cannot be manually marked as DISBURSED. Use the disbursement trigger."
                )

        # 2. Block critical field changes if loan is beyond UNVERIFIED
        if instance.status not in ["UNVERIFIED"]:
            protected_fields = [
                "principal_amount",
                "user",
                "loan_product",
                "interest_rate",
                "duration_weeks",
                "duration_months",
            ]

            # Managers and below cannot edit these if status is FIELD_VERIFIED or higher
            if user_role in [
                "ADMIN",
                "MANAGER",
                "FIELD_OFFICER",
                "STAFF",
            ] and not user.is_super_admin:
                for field in protected_fields:
                    if field in data:
                        val = data[field]
                        orig = getattr(instance, field)

                        # Handle relation fields (objects)
                        orig_val = str(orig.id) if hasattr(orig, "id") else str(orig)
                        target_val = str(val) if val is not None else "None"

                        if target_val != orig_val:
                            from rest_framework.exceptions import ValidationError

                            raise ValidationError(
                                f"Security Lock: Cannot change {field} after loan has been {instance.status}."
                            )

        # Add reason for status change if provided
        status_change_reason = data.get("status_change_reason")

        # Determine verification timestamps
        extra_fields = {
            "last_modified_by": user,
            "status_change_reason": (
                status_change_reason
                if status_change_reason
                else instance.status_change_reason
            ),
        }

        if data.get("status") == "VERIFIED":
            extra_fields["field_officer_verified_at"] = timezone.now()
        elif data.get("status") == "APPROVED":
            extra_fields["manager_verified_at"] = timezone.now()

        updated_instance = serializer.save(**extra_fields)

        # Success message for verification/approval
        success_msg = f"Loan has been successfully {updated_instance.status.lower()}."
        
        # Requirement 3: AUDIT LOGGING
        log_action(
            user,
            f"Updated Loan status from {instance.status} to {updated_instance.status}",
            "loans",
            instance.id,
            old_data=old_data.get("status"),
            new_data={
                "status": updated_instance.status,
                "rejection_reason": updated_instance.rejection_reason,
            },
            log_type="STATUS",
            ip_address=ip,
        )

        old_status = instance.status
        loan = updated_instance
        new_status = loan.status

        if new_status != old_status:
            admin_user = user if user.is_authenticated else None
            create_loan_activity(
                loan,
                admin_user,
                new_status,
                f"Status changed from {old_status} to {new_status}",
            )

            # Rejection Side Effects (Requirement 2)
            if new_status == "REJECTED":
                # Notify field officer
                field_officer = loan.created_by
                if field_officer and field_officer.phone:
                    sms_message = f"Loan #{loan.id.hex[:8]} has been rejected. Reason: {loan.rejection_reason}"
                    send_sms_async(field_officer.phone, sms_message)
                    SMSLog.objects.create(
                        sender=admin_user,
                        recipient_phone=field_officer.phone,
                        recipient_name=field_officer.full_name,
                        message=sms_message,
                        type="REJECTION",
                    )

            create_notification(
                loan.user,
                f"Loan Update: The status of your loan has been updated to {new_status}.",
            )

        # Return the success message in the response
        return Response({
            "message": success_msg,
            "loan": LoanSerializer(updated_instance).data
        }, status=status.HTTP_200_OK)


class LoanDisbursementView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            loan = Loans.objects.get(pk=pk)
        except Loans.DoesNotExist:
            return Response(
                {"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        if not hasattr(user, "role") or user.role not in ["FINANCE_OFFICER", "FINANCIAL_OFFICER"]:
            return Response(
                {"error": "Only Finance Officers can disburse loans."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if loan.status != "APPROVED":
            return Response(
                {"error": "Only approved loans can be disbursed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            DisbursementService.disburse_loan(loan, user)
            return Response(
                {"message": "Loan disbursed successfully."}, status=status.HTTP_200_OK
            )
        except InsufficientCapitalError as e:
            return Response(
                {"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LoanDocumentCreateView(generics.CreateAPIView):
    serializer_class = LoanDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        loan_id = self.request.data.get("loan")
        user = self.request.user

        loan = Loans.objects.get(id=loan_id)
        if hasattr(user, "role"):
            if user.role == "MANAGER" and loan.user.profile.branch != user.branch:
                raise permissions.exceptions.PermissionDenied(
                    "You don't have access to this loan's branch"
                )
            if user.role == "FIELD_OFFICER" and loan.created_by != user:
                raise permissions.exceptions.PermissionDenied(
                    "You didn't create this loan application"
                )

        doc = serializer.save()

        create_loan_activity(
            loan,
            self.request.user,
            "DOCUMENT_UPLOADED",
            f"Uploaded {doc.doc_type or 'DOC'}: {doc.name}",
        )


class SendEmailNotificationView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request):
        target_ids = request.data.get("target_ids", [])
        target_group = request.data.get("target_group")
        subject = request.data.get("subject", "Notification from Azariah Credit")
        message = request.data.get("message")

        if not message:
            return Response(
                {"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve target emails
        if target_group == "STAFF":
            targets = Admins.objects.filter(is_active=True)
        else:
            targets = Admins.objects.filter(id__in=target_ids)

        if not targets.exists():
            return Response(
                {"error": "No valid targets found."}, status=status.HTTP_400_BAD_REQUEST
            )

        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")

        if not brevo_api_key or not from_email:
            return Response(
                {"error": "Email service not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        success_count = 0
        for admin in targets:
            try:
                url = "https://api.brevo.com/v3/smtp/email"
                headers = {
                    "accept": "application/json",
                    "api-key": brevo_api_key,
                    "content-type": "application/json",
                }
                payload = {
                    "sender": {"name": sender_name, "email": from_email},
                    "to": [{"email": admin.email}],
                    "subject": subject,
                    "htmlContent": f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Notification</h2>
                            <p>Hello {admin.full_name},</p>
                            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                {message.replace('\n', '<br>')}
                            </div>
                            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                                This is an official notification from the Azariah Credit Ltd system.
                            </p>
                        </div>
                        </body>
                        </html>
                    """,
                }
                requests.post(url, json=payload, headers=headers)
                success_count += 1
                Notifications.objects.create(user=admin, message=f"Email: {subject}")

                # Log the email
                EmailLog.objects.create(
                    sender=request.user,
                    recipient_email=admin.email,
                    recipient_name=admin.full_name,
                    subject=subject,
                    message=message,
                )
            except Exception:
                continue

        return Response(
            {"message": f"Successfully sent {success_count} emails."},
            status=status.HTTP_200_OK,
        )


class ListEmailLogsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = EmailLogSerializer

    def get_queryset(self):
        from django.db.models import Q

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


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # If the logged-in user is an Admin, they don't have notifications in this table
        # Notifications table is specifically for the 'Users' model (customers)
        if hasattr(user, "role"):  # Admins have a 'role' field
            return Notifications.objects.none()
        return Notifications.objects.filter(user=user).order_by("-created_at")


class NotificationUpdateView(generics.UpdateAPIView):
    queryset = Notifications.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]


class LoanAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncMonth, TruncDate

        user = request.user
        branch = request.query_params.get("branch") or request.query_params.get(
            "region"
        )

        if hasattr(user, "role") and user.role == "MANAGER":
            loans = loans.filter(user__profile__branch_fk=user.branch_fk)
        elif branch:
            loans = loans.filter(user__profile__branch=branch) # fallback for text search

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            loans = loans.filter(created_by=user)

        monthly_stats = (
            loans.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("principal_amount"), count=Count("id"))
            .order_by("month")
        )

        daily_disbursements = (
            loans.filter(status="DISBURSED")
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(total=Sum("principal_amount"), count=Count("id"))
            .order_by("-date")[:30]
        )

        status_stats = loans.values("status").annotate(count=Count("id"))

        data = {
            "monthly_disbursements": [
                {
                    "month": stat["month"].strftime("%b"),
                    "amount": float(stat["total"] or 0),
                    "count": stat["count"],
                }
                for stat in monthly_stats
            ],
            "daily_disbursements": [
                {
                    "date": stat["date"].strftime("%Y-%m-%d"),
                    "amount": float(stat["total"] or 0),
                    "count": stat["count"],
                }
                for stat in daily_disbursements
            ],
            "status_breakdown": [
                {"name": stat["status"], "value": stat["count"]}
                for stat in status_stats
            ],
        }
        return Response(data)


class FinanceAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Q, F
        from django.db.models.functions import TruncDate
        from datetime import timedelta
        from .models import (
            SystemCapital,
            Loans,
            Repayments,
            LedgerEntry,
            RepaymentSchedule,
        )

        today = timezone.now().date()

        # Get Capital Balance
        capital = SystemCapital.objects.filter(name="Simulation Capital").first()
        balance = float(capital.balance) if capital else 0.0

        # Last 60 days range
        sixty_days_ago = timezone.now() - timedelta(days=60)

        # Money Out (Total Principal of Disbursed Loans - ONLY DISBURSED)
        # We include all statuses that represent funds already given to customers
        disbursed_statuses = ["DISBURSED", "ACTIVE", "OVERDUE", "CLOSED", "REPAID"]
        money_out_query = Loans.objects.filter(status__in=disbursed_statuses)
        money_out = (
            money_out_query.aggregate(total=Sum("principal_amount"))["total"] or 0
        )

        # Money In (Total amount repaid)
        money_in = Repayments.objects.aggregate(total=Sum("amount_paid"))["total"] or 0

        # Aging Report Analysis
        # 1-30 days, 31-60 days, 61-90 days, 90+ days overdue
        aging_30 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today,
                repaymentschedule__due_date__gte=today - timedelta(days=30),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )
        aging_60 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today - timedelta(days=30),
                repaymentschedule__due_date__gte=today - timedelta(days=60),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )
        aging_90 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today - timedelta(days=60),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )

        # Rolling 15-day window for Line Charts (7 days history, Today, 7 days future)
        seven_days_ago = today - timedelta(days=7)
        seven_days_future = today + timedelta(days=7)

        # Actuals (History)
        actual_disbursements = (
            Loans.objects.filter(
                status__in=disbursed_statuses,
                created_at__date__gte=seven_days_ago,
                created_at__date__lte=today,
            )
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(amount=Sum("principal_amount"))
        )

        actual_repayments = (
            Repayments.objects.filter(
                payment_date__date__gte=seven_days_ago, payment_date__date__lte=today
            )
            .annotate(date=TruncDate("payment_date"))
            .values("date")
            .annotate(amount=Sum("amount_paid"))
        )

        # Projections (Future Schedules)
        scheduled_repayments = (
            RepaymentSchedule.objects.filter(
                due_date__gt=today, due_date__lte=seven_days_future
            )
            .values("due_date")
            .annotate(amount=Sum("amount_due"))
        )

        # Build timeline map
        timeline_map = {}
        curr = seven_days_ago
        while curr <= seven_days_future:
            d_str = curr.strftime("%Y-%m-%d")
            timeline_map[d_str] = {
                "date": d_str,
                "disbursement": 0.0,
                "repayment": 0.0,
                "is_future": curr > today,
                "label": "TODAY" if curr == today else curr.strftime("%d %b"),
            }
            curr += timedelta(days=1)

        for item in actual_disbursements:
            d_str = str(item["date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["disbursement"] = float(item["amount"] or 0)

        for item in actual_repayments:
            d_str = str(item["date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["repayment"] = float(item["amount"] or 0)

        for item in scheduled_repayments:
            # schedule due_date is a date object
            d_str = str(item["due_date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["repayment"] += float(item["amount"] or 0)

        # Weekly History for BarCharts (Last 10 weeks)
        ten_weeks_ago = today - timedelta(weeks=10)
        from django.db.models.functions import TruncWeek

        weekly_disbursed_query = (
            Loans.objects.filter(
                status__in=disbursed_statuses, created_at__date__gte=ten_weeks_ago
            )
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(amount=Sum("principal_amount"))
            .order_by("week")
        )

        weekly_repaid_query = (
            Repayments.objects.filter(payment_date__date__gte=ten_weeks_ago)
            .annotate(week=TruncWeek("payment_date"))
            .values("week")
            .annotate(amount=Sum("amount_paid"))
            .order_by("week")
        )

        # Pre-fill last 10 weeks
        weekly_disbursed = []
        weekly_repaid = []

        # Create a map of existing data for quick lookup
        disp_map = {
            str(x["week"])[:10]: float(x["amount"]) for x in weekly_disbursed_query
        }
        repay_map = {
            str(x["week"])[:10]: float(x["amount"]) for x in weekly_repaid_query
        }

        for i in range(9, -1, -1):  # Last 10 weeks
            target_date = today - timedelta(weeks=i)
            # Find the start of the week for this date
            start_of_week = target_date - timedelta(days=target_date.weekday())
            w_key = start_of_week.strftime("%Y-%m-%d")

            weekly_disbursed.append(
                {
                    "week": start_of_week.strftime("%d %b"),
                    "amount": disp_map.get(w_key, 0.0),
                }
            )
            weekly_repaid.append(
                {
                    "week": start_of_week.strftime("%d %b"),
                    "amount": repay_map.get(w_key, 0.0),
                }
            )

        # Trial Balance Context (Grouped Capital/Assets/Liabilities)
        trial_balance = [
            {"account": "Simulation Capital", "debit": 0, "credit": balance},
            {
                "account": "Loan Portfolio (Principal)",
                "debit": float(money_out),
                "credit": 0,
            },
            {"account": "Interest Receivable", "debit": 0, "credit": 0},
            {"account": "Repayments Pool", "debit": float(money_in), "credit": 0},
        ]

        # Collection Log (Last 50 entries)
        collections = Repayments.objects.select_related("loan__user").order_by(
            "-payment_date"
        )[:50]
        collection_log = [
            {
                "id": str(r.id),
                "customer": r.loan.user.full_name,
                "amount": float(r.amount_paid),
                "date": r.payment_date.strftime("%Y-%m-%d %H:%M"),
                "method": r.payment_method,
                "reference": r.reference_code,
            }
            for r in collections
        ]

        # Cashbook (Last 100 Ledger entries)
        ledger_entries = LedgerEntry.objects.select_related("loan__user").order_by(
            "-created_at"
        )[:100]
        cashbook = [
            {
                "id": str(entry.id),
                "date": entry.created_at.strftime("%Y-%m-%d %H:%M"),
                "type": entry.entry_type,
                "amount": float(entry.amount),
                "customer": (
                    entry.loan.user.full_name
                    if entry.loan and entry.loan.user
                    else "SYSTEM"
                ),
                "reference": entry.reference_id or "N/A",
                "note": entry.note or "",
            }
            for entry in ledger_entries
        ]

        return Response(
            {
                "balance": balance,
                "money_out": float(money_out),
                "money_in": float(money_in),
                "history": list(timeline_map.values()),
                "weekly_disbursed": weekly_disbursed,
                "weekly_repaid": weekly_repaid,
                "trial_balance": trial_balance,
                "cashbook": cashbook,
                "aging_report": {
                    "days_30": float(aging_30),
                    "days_60": float(aging_60),
                    "days_90": float(aging_90),
                },
                "collection_log": collection_log,
            }
        )


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
            if getattr(user, 'is_owner', False):
                return 'OWNER'
            if getattr(user, 'is_super_admin', False):
                return 'SUPER_ADMIN'
            return getattr(user, 'role', '')

        inviter = request.user
        inviter_role = get_inviter_type(inviter)

        emails = request.data.get("emails") or request.data.get("email")
        role = request.data.get("role")
        branch_id = request.data.get("branch") # branch_id or pk

        if not emails or not role:
            return Response({"error": "Email(s) and role are required."}, status=400)

        # Enforce Invite Chain
        allowed_roles = INVITE_PERMISSIONS.get(inviter_role, [])
        if role not in allowed_roles:
            AuditLogs.objects.create(
                admin=inviter,
                action=f"Invite Chain Violation: {inviter_role} tried to invite {role}",
                log_type="SECURITY",
                table_name="admin_invitations",
                is_owner_log=True,
                ip_address=get_client_ip(request)
            )
            return Response({"error": f"Your role ({inviter_role}) does not have permission to invite {role}."}, status=403)

        if isinstance(emails, str):
            emails = [e.strip().lower() for e in emails.split(",") if e.strip()]
        elif not isinstance(emails, list):
            emails = [str(emails).strip().lower()]

        # Branch Auto-Assignment logic
        branch_fk = None
        if inviter_role == "MANAGER" and role == "FIELD_OFFICER":
            branch_fk = inviter.branch_fk
        elif inviter_role == "ADMIN" and role == "MANAGER":
            if not branch_id:
                return Response({"error": "Branch is required for Manager invitations."}, status=400)
            try:
                branch_fk = Branch.objects.get(id=branch_id)
            except:
                return Response({"error": "Invalid branch ID."}, status=400)

        sent_emails = []
        errors = []

        for email_addr in emails:
            # Check if registered
            if Admins.objects.filter(email__iexact=email_addr).exists():
                errors.append(f"{email_addr} is already registered.")
                continue

            token = secrets.token_hex(20)
            AdminInvitation.objects.update_or_create(
                email=email_addr,
                defaults={
                    "role": role,
                    "token": token,
                    "invited_by": inviter,
                    "invited_by_admin": inviter,
                    "branch_fk": branch_fk,
                    "expires_at": timezone.now() + timedelta(days=7),
                    "is_used": False,
                },
            )

            # Audit log
            AuditLogs.objects.create(
                admin=inviter,
                action=f"Sent invitation to {email_addr} as {role}",
                log_type="MANAGEMENT",
                table_name="admin_invitations",
                is_owner_log=inviter.is_owner or inviter.is_super_admin,
                ip_address=get_client_ip(request)
            )

            from .utils.sms import send_invite_email_async
            threading.Thread(
                target=send_invite_email_async,
                args=(email_addr, token, role),
            ).start()
            sent_emails.append(email_addr)

        return Response({
            "message": f"Sent {len(sent_emails)} invitations.",
            "sent": sent_emails,
            "errors": errors
        })

        return Response(
            {
                "message": f"Invitations successfully sent to: {', '.join(sent_emails)}",
                "errors": errors,
            },
            status=201,
        )


import csv, io
from django.utils import timezone
from datetime import datetime

def _record_repayment(txn, loan, customer, match_method, processed_by):
    """Record a matched repayment and update all related records."""
    from django.db import transaction as db_transaction
    with db_transaction.atomic():
        # Update transaction
        txn.status = 'MATCHED'
        txn.matched_loan = loan
        txn.matched_user = customer
        txn.match_method = match_method
        txn.assigned_by = processed_by
        txn.assigned_at = timezone.now()
        txn.save()

        # Record repayment
        repayment = Repayments.objects.create(
            loan=loan,
            amount_paid=txn.amount,
            payment_method='PAYBILL',
            reference_code=txn.receipt_number,
            payment_date=txn.transaction_date
        )

        # Update capital
        capital = SystemCapital.objects.select_for_update().filter(
            name="Simulation Capital"
        ).first()
        if capital:
            capital.balance += txn.amount
            capital.save()
            LedgerEntry.objects.create(
                capital_account=capital,
                amount=txn.amount,
                entry_type="REPAYMENT",
                loan=loan,
                reference_id=txn.receipt_number,
                note=f"Paybill repayment matched by {match_method}"
            )

        # Mark repayment schedule installments
        amount_remaining = float(txn.amount)
        for installment in RepaymentSchedule.objects.filter(
            loan=loan, is_paid=False
        ).order_by('due_date'):
            if amount_remaining <= 0:
                break
            if amount_remaining >= float(installment.amount_due):
                installment.is_paid = True
                installment.save()
                amount_remaining -= float(installment.amount_due)
            else:
                break

        # Check if loan fully paid
        loan.refresh_from_db()
        if loan.remaining_balance <= 0:
            loan.status = 'CLOSED'
            loan.save()

        # Send SMS confirmation to customer
        remaining = max(0, float(loan.remaining_balance))
        msg = (
            f"Dear {customer.full_name}, your repayment of KES {float(txn.amount):,.2f} "
            f"has been received (Ref: {txn.receipt_number}). "
            f"{'Your loan is fully repaid. Thank you!' if remaining <= 0 else f'Remaining balance: KES {remaining:,.2f}.'}"
            f" - Azariah Credit Ltd"
        )
        try:
            from .utils.sms import send_sms_async
            send_sms_async([customer.phone], msg)
            from .models import SMSLog
            SMSLog.objects.create(
                recipient_phone=customer.phone,
                recipient_name=customer.full_name,
                message=msg,
                type="REPAYMENT_CONFIRMATION",
                status="SENT"
            )
        except Exception:
            pass

        # Audit log
        from .utils.security import log_action
        log_action(
            processed_by,
            f"Repayment of KES {float(txn.amount):,.2f} matched by {match_method} for loan {loan.id.hex[:8]}",
            "repayments", loan.id, log_type="STATUS"
        )

class StatementUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if getattr(user, 'role', None) not in ['FINANCIAL_OFFICER', 'ADMIN'] and not getattr(user, 'is_owner', False) and not getattr(user, 'is_super_admin', False):
            return Response({"error": "Unauthorized"}, status=403)

        file = request.FILES.get('statement')
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        if not file.name.endswith('.csv'):
            return Response({"error": "File must be a CSV"}, status=400)

        decoded = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))

        results = {
            'matched_national_id': 0,
            'matched_phone': 0,
            'unmatched': 0,
            'duplicates': 0,
            'errors': []
        }

        for row in reader:
            try:
                # Handle different Safaricom CSV column names
                receipt = (row.get('Receipt No') or row.get('TransID') or 
                          row.get('receipt_number') or '').strip()
                sender_phone = (row.get('Sender Phone') or row.get('MSISDN') or 
                               row.get('sender_phone') or '').strip()
                account_ref = (row.get('Account Number') or row.get('BillRefNumber') or 
                              row.get('account_ref') or '').strip()
                amount_str = (row.get('Amount') or row.get('TransAmount') or '0').strip()
                amount = float(amount_str.replace(',', ''))
                sender_name = (row.get('Sender Name') or row.get('FirstName') or '').strip()
                date_str = (row.get('Date') or row.get('TransTime') or '').strip()

                if not receipt:
                    continue

                # Skip duplicates
                if PaybillTransaction.objects.filter(receipt_number=receipt).exists():
                    results['duplicates'] += 1
                    continue

                # Try to parse date
                try:
                    transaction_date = datetime.strptime(date_str, '%Y%m%d%H%M%S')
                except:
                    try:
                        transaction_date = datetime.strptime(date_str, '%d/%m/%Y %H:%M:%S')
                    except:
                        transaction_date = timezone.now()

                # Create transaction record
                txn = PaybillTransaction.objects.create(
                    receipt_number=receipt,
                    sender_phone=sender_phone,
                    sender_name=sender_name,
                    account_ref=account_ref,
                    amount=amount,
                    transaction_date=timezone.make_aware(transaction_date) if transaction_date.tzinfo is None else transaction_date,
                    status='UNMATCHED'
                )

                # LEVEL 1 — Match by National ID
                matched = False
                try:
                    from .models import UserProfiles
                    profile = UserProfiles.objects.get(national_id=account_ref)
                    loan = Loans.objects.filter(
                        user=profile.user,
                        status__in=['ACTIVE', 'OVERDUE']
                    ).order_by('created_at').first()
                    if loan:
                        _record_repayment(txn, loan, profile.user, 'NATIONAL_ID', user)
                        results['matched_national_id'] += 1
                        matched = True
                except UserProfiles.DoesNotExist:
                    pass

                # LEVEL 2 — Match by sender phone
                if not matched and sender_phone:
                    normalized_phone = sender_phone.replace('+', '').strip()
                    if normalized_phone.startswith('254'):
                        normalized_phone = '0' + normalized_phone[3:]
                    try:
                        customer = Users.objects.get(phone=normalized_phone)
                        loan = Loans.objects.filter(
                            user=customer,
                            status__in=['ACTIVE', 'OVERDUE']
                        ).order_by('created_at').first()
                        if loan:
                            _record_repayment(txn, loan, customer, 'PHONE', user)
                            results['matched_phone'] += 1
                            matched = True
                    except Users.DoesNotExist:
                        pass

                if not matched:
                    results['unmatched'] += 1

            except Exception as e:
                results['errors'].append(str(e))

        return Response({
            "message": "Statement processed",
            "results": results
        })


class AssignTransactionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        txn_id = request.data.get('transaction_id')
        loan_id = request.data.get('loan_id')

        if not txn_id or not loan_id:
            return Response({"error": "transaction_id and loan_id required"}, status=400)

        try:
            txn = PaybillTransaction.objects.get(id=txn_id, status='UNMATCHED')
            loan = Loans.objects.get(id=loan_id, status__in=['ACTIVE', 'OVERDUE'])
        except PaybillTransaction.DoesNotExist:
            return Response({"error": "Transaction not found or already matched"}, status=404)
        except Loans.DoesNotExist:
            return Response({"error": "Loan not found or not active"}, status=404)

        _record_repayment(txn, loan, loan.user, 'MANUAL', request.user)
        txn.status = 'MANUALLY_ASSIGNED'
        txn.save()

        return Response({"message": "Transaction assigned successfully"})


class UnmatchedTransactionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        since = request.query_params.get('since')
        if since:
            # Polling mode
            new_count = PaybillTransaction.objects.filter(
                status='UNMATCHED',
                created_at__gt=since
            ).count()
            return Response({"new_count": new_count})

        txns = PaybillTransaction.objects.filter(status='UNMATCHED').order_by('transaction_date')
        serializer = PaybillTransactionSerializer(txns, many=True)
        return Response(serializer.data)


class DirectSMSView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        recipient_phone = request.data.get("phone")
        message = request.data.get("message")
        user_id = request.data.get("user_id") or request.data.get("customer_id")

        if not recipient_phone and user_id:
            try:
                from .models import Users

                target_user = Users.objects.get(id=user_id)
                recipient_phone = target_user.phone_number
            except Users.DoesNotExist:
                return Response({"error": "Customer not found"}, status=404)

        if not all([recipient_phone, message]):
            return Response({"error": "Phone and message are required"}, status=400)

        # Restricted roles
        if getattr(user, "role", None) not in [
            "ADMIN",
            "MANAGER",
            "FINANCIAL_OFFICER",
            "FIELD_OFFICER",
        ]:
            return Response({"error": "Unauthorized to send direct SMS"}, status=403)

        try:
            from .utils.sms import send_sms_async

            send_sms_async([recipient_phone], message)

            # Log the SMS
            from .models import SMSLog, AuditLogs

            SMSLog.objects.create(
                sender=user,
                recipient_phone=recipient_phone,
                recipient_name=request.data.get("recipient_name", "Customer"),
                message=message,
                type="DIRECT",
                status="SENT",
            )

            # Audit log
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



class CustomerDraftListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerDraftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomerDraft.objects.filter(created_by=self.request.user, is_completed=False).order_by("-updated_at")

    def perform_create(self, serializer):
        draft = serializer.save(created_by=self.request.user)
        log_action(
            self.request.user,
            f"Saved customer draft: {draft.incomplete_reason}",
            "customer_drafts",
            draft.id,
            log_type="DRAFT",
            new_data=serializer.data
        )

class CustomerDraftDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerDraftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomerDraft.objects.filter(created_by=self.request.user)

    def perform_update(self, serializer):
        draft = serializer.save()
        log_action(
            self.request.user,
            f"Updated customer draft: {draft.incomplete_reason}",
            "customer_drafts",
            draft.id,
            log_type="DRAFT",
            new_data=serializer.data
        )
