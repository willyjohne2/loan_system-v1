import threading
import os
import json
import requests
import pyotp
import bcrypt
import uuid
import secrets
from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
from ..models import Admins, AdminInvitation, AuditLogs, EmailLog
from ..serializers import AdminSerializer
from ..utils.security import log_action, get_client_ip

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
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't register for this account, please ignore this email.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }

        requests.post(url, json=payload, headers=headers)

    except Exception:
        pass

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
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email and ensure your account is secure.</p>
                <p>Best regards,<br/>{sender_name} Team</p>
                </body>
                </html>
            """,
        }
        try:
            res = requests.post(url, json=payload, headers=headers)
            from ..models import EmailLog
            EmailLog.objects.create(
                recipient_email=email,
                subject=payload["subject"],
                message=payload["htmlContent"],
                status="SENT" if res.status_code in [200, 201, 202] else "FAILED",
                error_details=res.text if res.status_code not in [200, 201, 202] else None
            )
        except Exception as e:
            from ..models import EmailLog
            EmailLog.objects.create(
                recipient_email=email,
                subject=payload["subject"],
                message=payload["htmlContent"],
                status="FAILED",
                error_details=str(e)
            )
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
        try:
            res = requests.post(url, json=payload, headers=headers)
            from ..models import EmailLog
            EmailLog.objects.create(
                recipient_email=email,
                subject=payload["subject"],
                message=payload["htmlContent"],
                status="SENT" if res.status_code in [200, 201, 202] else "FAILED",
                error_details=res.text if res.status_code not in [200, 201, 202] else None
            )
        except Exception as e:
            from ..models import EmailLog
            EmailLog.objects.create(
                recipient_email=email,
                subject=payload["subject"],
                message=payload["htmlContent"],
                status="FAILED",
                error_details=str(e)
            )
    except Exception as e:
        print(f"Error sending login alert: {e}")

class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django_ratelimit.core import is_ratelimited
        if is_ratelimited(request, key='ip', rate='10/m', group='login', method='POST', increment=True):
            return Response(
                {"error": "Too many requests. Please wait before trying again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        email = request.data.get("email")
        password = request.data.get("password")
        
        if not email and "_content" in request.data:
            try:
                content_data = json.loads(request.data.get("_content"))
                email = content_data.get("email")
                password = content_data.get("password")
            except Exception:
                pass

        if not email and isinstance(request.data, dict) and "email" in request.data:
            email = request.data.get("email")
        if not password and isinstance(request.data, dict) and "password" in request.data:
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

            from ..utils.encryption import get_setting
            max_failed_logins = int(get_setting('max_failed_logins', 4))

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
                admin.last_login_at = timezone.now()
                admin.login_count = (admin.login_count or 0) + 1
                admin.save()
                # Normal login — no audit log entry needed.

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
                        "is_primary_owner": admin.is_primary_owner,
                        "god_mode_enabled": admin.god_mode_enabled and admin.is_owner,
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

                    log_action(
                        None,
                        f"Account Locked Out: {email} after {admin.failed_login_attempts} failed attempts",
                        "admins", admin.id,
                        log_type="SECURITY",
                        ip_address=client_ip,
                    )

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
                        "is_primary_owner": admin.is_primary_owner,
                        "god_mode_enabled": admin.god_mode_enabled and admin.is_owner,
                        "is_owner": admin.is_owner,
                        "is_super_admin": admin.is_super_admin,
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

        if not admin.two_factor_secret:
            admin.two_factor_secret = pyotp.random_base32()
            admin.save()

        totp = pyotp.TOTP(admin.two_factor_secret)
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

class RegisterAdminView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        full_name = request.data.get("full_name")
        email = request.data.get("email")
        phone = request.data.get("phone")
        role = request.data.get("role")
        password = request.data.get("password")
        invitation_token = request.data.get("invitation_token")
        branch = request.data.get("branch")

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

        is_initialized = Admins.objects.filter(is_owner=True).exists()

        inviter_admin = None
        branch_fk = None
        if is_initialized:
            if not invitation_token:
                return Response(
                    {"error": "Account registration is restricted to invited personnel only."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            try:
                invite = AdminInvitation.objects.get(
                    token=invitation_token,
                    email__iexact=email,
                    is_used=False,
                    expires_at__gt=timezone.now(),
                )
                inviter_admin = invite.invited_by or invite.invited_by_admin
                branch_fk = invite.branch_fk
            except AdminInvitation.DoesNotExist:
                return Response(
                    {"error": "Invalid or expired invitation token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if Admins.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "This email address is already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Admins.objects.filter(phone=phone).exists():
            return Response(
                {"error": "This phone number is already registered."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification_code = str(secrets.randbelow(900000) + 100000)
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

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
            is_super_admin=(role == "SUPER_ADMIN"),
            is_owner=False,
            invited_by=inviter_admin,
            branch_fk=branch_fk,
            is_primary_owner=False,
            ownership_granted_by=None,
            ownership_granted_at=None
        )

        if 'invite' in locals():
            invite.is_used = True
            invite.save()
            from ..services import notify_staff_joined
            notify_staff_joined(admin)

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
                return Response({"message": "Email already verified"}, status=status.HTTP_200_OK)

            if admin.verification_token != code:
                return Response({"error": "Invalid verification code"}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": "Email not found"}, status=status.HTTP_400_BAD_REQUEST)

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
            admin.password_reset_expires = timezone.now() + timezone.timedelta(minutes=15)
            admin.save()

            log_action(
                admin,
                f"Password Reset Requested for: {admin.email}",
                "admins", admin.id,
                log_type="SECURITY",
                ip_address=get_client_ip(request),
            )

            threading.Thread(
                target=send_password_reset_email_async,
                args=(admin.full_name, admin.email, reset_code),
            ).start()

            return Response({"message": "Reset code sent to your email. Check your inbox."})
        except Admins.DoesNotExist:
            return Response({"message": "If this email is registered, you will receive a reset code."})

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
            password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            admin.password_hash = password_hash
            admin.password_reset_code = None
            admin.password_reset_expires = None
            admin.save()
            return Response({"message": "Password reset successfully. You can now login."})
        except Admins.DoesNotExist:
            return Response({"error": "Invalid or expired reset code"}, status=400)

class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            user = request.user
            user.last_logout_at = timezone.now()
            user.save(update_fields=['last_logout_at'])
        except Exception:
            pass  # Never block logout even if save fails
        return Response(
            {"message": "Logged out successfully."},
            status=status.HTTP_200_OK
        )
