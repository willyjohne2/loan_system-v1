import bcrypt
import uuid
import secrets
import threading
import os
import json
import requests
import pyotp
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework import status, views, permissions, generics, parsers
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
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
    AdminInvitation,
    DeactivationRequest,
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
    SMSLogSerializer,
    DeactivationRequestSerializer,
)
from .utils.mpesa import MpesaHandler
from .utils.sms import send_sms_async
from .utils.security import log_action, get_client_ip
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

        # You would typically have a frontend URL for invitations
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


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email and "_content" in request.data:
            try:
                import json

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
                    # Return a temporary session or reference to handle 2FA verification
                    # We can use a short-lived token or just the admin ID for now
                    # For security, let's return a partial success response
                    return Response(
                        {
                            "id": str(admin.id),
                            "two_factor_required": True,
                            "email": admin.email,
                        },
                        status=status.HTTP_200_OK,
                    )

                try:
                    # Use for_user to ensure all standard claims are correctly set
                    # Even if Admins is not the default User model, simplejwt will use its pk
                    refresh = RefreshToken.for_user(admin)
                    refresh["admin_id"] = str(admin.id)
                    refresh["role"] = admin.role

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
                        "admin": AdminSerializer(admin).data,
                    }
                )
            else:
                admin.failed_login_attempts = (admin.failed_login_attempts or 0) + 1

                # Audit log for failed attempt
                log_action(
                    None,
                    f"Failed Login Attempt: {email}",
                    "admins",
                    admin.id,
                    log_type="SECURITY",
                    ip_address=client_ip,
                )

                if admin.failed_login_attempts >= 4:
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
        user = self.request.user
        if not user or not user.is_authenticated:
            return Users.objects.none()

        # Optimization: prefetch profile to avoid N+1
        users = Users.objects.select_related("profile", "created_by")

        # Admin, Financial Officer, and Managers (if simplified) see all
        # unless we explicitly want to filter
        user_role = getattr(user, "role", "ADMIN")

        if user_role == "FIELD_OFFICER":
            return users.filter(created_by=user).order_by("-created_at")

        if user_role == "MANAGER":
            manager_branch = getattr(user, "branch", None)
            if manager_branch:
                return users.filter(profile__branch=manager_branch).order_by(
                    "-created_at"
                )
            return users.order_by("-created_at")

        return users.order_by("-created_at")

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
        user = self.request.user
        if not user or not user.is_authenticated:
            return Loans.objects.none()

        # Optimization: Select related user and profile to prevent N+1 queries
        loans = Loans.objects.select_related("user", "user__profile", "loan_product")

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            loans = loans.filter(created_by=user)

        elif hasattr(user, "role") and user.role == "MANAGER":
            loans = loans.filter(user__profile__branch=user.branch)

        # Optimization: Only update status if it's been more than a day
        # or if the loan is currently in a state that could change
        # Instead of doing it here for every request, we can wrap this
        # in a faster check or do it during specific triggers.
        # For now, let's just make it faster by removing the inner loop
        # from the critical path of a GET list.
        return loans.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        created_by = user if (user and user.is_authenticated) else None

        # Check if customer is locked
        customer_id = self.request.data.get("user")
        if customer_id:
            try:
                customer = Users.objects.get(id=customer_id)
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

        # Security Audit Log
        ip = get_client_ip(self.request)
        log_action(
            self.request.user,
            f"Created new Loan application for {loan.user.full_name}",
            "loans",
            loan.id,
            new_data=LoanSerializer(loan).data,
            log_type="GENERAL",
            ip_address=ip,
        )

        create_loan_activity(
            loan,
            created_by,
            "APPLIED",
            f"Loan applied for KES {loan.principal_amount}",
        )

        create_notification(
            loan.user,
            f"Your loan application of KES {loan.principal_amount} has been received and is under review.",
        )

        # SMS Notification
        if loan.user.phone:
            msg = f"Hello {loan.user.full_name}, your loan application of KES {loan.principal_amount} has been received and is under review."
            send_sms_async([loan.user.phone], msg)
            SMSLog.objects.create(
                sender=created_by,
                recipient_phone=loan.user.phone,
                recipient_name=loan.user.full_name,
                message=msg,
                type="AUTO",
            )


class RepaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = RepaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Repayments.objects.none()

        repayments = Repayments.objects.all()

        if hasattr(user, "role") and user.role == "MANAGER":
            repayments = repayments.filter(loan__user__profile__branch=user.branch)

        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            repayments = repayments.filter(loan__created_by=user)

        return repayments.order_by("-payment_date")

    def perform_create(self, serializer):
        repayment = serializer.save(id=uuid.uuid4())
        loan = repayment.loan

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
        confirmed = request.data.get("confirmed", False)
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

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

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

            print(
                f"B2C Result: Code={result_code}, ID={originator_id}, Trans={trans_id}"
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


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not user or not hasattr(user, "role"):
            return AuditLogs.objects.none()

        queryset = AuditLogs.objects.all().order_by("-created_at")

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
    permission_classes = [IsSuperAdmin]

    def get_object(self):
        # Allow admins to view/edit their own profile
        obj = super().get_object()
        if self.request.user.id == obj.id:
            return obj
        # Otherwise, check if superadmin
        if self.request.user.is_super_admin:
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

        valid_roles = ["ADMIN", "MANAGER", "FINANCIAL_OFFICER", "FIELD_OFFICER"]
        if role not in valid_roles:
            return Response(
                {"error": f"Role must be one of: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Requirement: Everyone must have an invitation if the system is already initialized
        # First ADMIN can register without invitation
        is_initialized = Admins.objects.filter(role="ADMIN").exists()

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
                # Ensure the invite role matches requested role
                if invite.role != role:
                    return Response(
                        {
                            "error": f"This invitation is for a {invite.role} role, not {role}."
                        },
                        status=400,
                    )

                # If branch was pre-assigned in invitation, use it
                if invite.branch:
                    branch = invite.branch

                # Mark invite as used after successful registration
                invite.is_used = True
                invite.save()
            except AdminInvitation.DoesNotExist:
                return Response(
                    {"error": "Invalid or expired invitation token."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        elif role != "ADMIN":
            return Response(
                {"error": "The first user registered must be an Administrator."},
                status=status.HTTP_403_FORBIDDEN,
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
            is_super_admin=is_first_admin,
        )

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
        ip = get_client_ip(self.request)

        # Audit log for change
        old_data = LoanSerializer(instance).data

        # 1. Block manual status change to DISBURSED
        if data.get("status") == "DISBURSED" and instance.status != "DISBURSED":
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
            ]
            if not self.request.user.is_super_admin:
                for field in protected_fields:
                    if field in data:
                        val = data[field]
                        orig = getattr(instance, field)
                        if hasattr(orig, "id"):
                            if str(val) != str(orig.id):
                                from rest_framework.exceptions import ValidationError

                                raise ValidationError(
                                    f"Security Lock: Cannot change {field} after loan has been {instance.status}."
                                )
                        else:
                            if str(val) != str(orig):
                                from rest_framework.exceptions import ValidationError

                                raise ValidationError(
                                    f"Security Lock: Cannot change {field} after loan has been {instance.status}."
                                )

        # Add reason for status change if provided
        status_change_reason = data.get("status_change_reason")

        updated_instance = serializer.save(
            last_modified_by=self.request.user,
            status_change_reason=(
                status_change_reason
                if status_change_reason
                else instance.status_change_reason
            ),
        )

        log_action(
            self.request.user,
            f"Updated Loan status from {instance.status} to {updated_instance.status}",
            "loans",
            instance.id,
            old_data=old_data,
            new_data=LoanSerializer(updated_instance).data,
            log_type="STATUS",
            ip_address=ip,
        )

        old_status = instance.status
        loan = serializer.save()
        new_status = loan.status

        if new_status != old_status:
            admin = self.request.user if self.request.user.is_authenticated else None
            create_loan_activity(
                loan,
                admin,
                new_status,
                f"Status changed from {old_status} to {new_status}",
            )

            # Audit Log
            AuditLogs.objects.create(
                admin=self.request.user if self.request.user.is_authenticated else None,
                action="LOAN_UPDATE",
                log_type="MANAGEMENT",
                table_name="loans",
                record_id=loan.id,
                old_data={"status": old_status},
                new_data={"status": new_status},
                ip_address=ip,
            )

            create_notification(
                loan.user,
                f"Loan {loan.loan_id} Update",
                f"The status of your loan has been updated to {new_status}.",
            )


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
        if not hasattr(user, "role") or user.role != "FINANCE_OFFICER":
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
            branch = user.branch

        loans = Loans.objects.all()
        if branch:
            loans = loans.filter(user__profile__branch=branch)

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
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        # request.user is an instance of Admins model via CustomJWTAuthentication
        if not request.user or request.user.role != "ADMIN":
            return Response(
                {"error": "Only administrators can invite others"}, status=403
            )

        emails = request.data.get("emails")  # Changed from 'email' to 'emails' (list)
        email = request.data.get("email")  # Fallback for single email
        role = request.data.get("role")
        branch = request.data.get("branch")

        if not emails and email:
            emails = [email]

        if not emails or not role:
            return Response(
                {"error": "Email(s) and role are required."},
                status=400,
            )

        if isinstance(emails, str):
            emails = [e.strip() for e in emails.split(",") if e.strip()]

        if len(emails) > 5:
            return Response(
                {"error": "Maximum of 5 invitations can be sent at once."},
                status=400,
            )

        valid_roles = ["ADMIN", "MANAGER", "FINANCIAL_OFFICER", "FIELD_OFFICER"]
        if role not in valid_roles:
            return Response(
                {"error": f"Invalid role: {role}. Must be one of {valid_roles}"},
                status=400,
            )

        inviter = request.user
        sent_emails = []
        errors = []

        for email_addr in emails:
            email_addr = email_addr.lower().strip()

            # Check if already registered
            if Admins.objects.filter(email__iexact=email_addr).exists():
                errors.append(f"{email_addr} is already registered.")
                continue

            # Update or create invitation
            token = secrets.token_urlsafe(32)
            expires_at = timezone.now() + timezone.timedelta(
                hours=24
            )  # Changed to 24 hours

            AdminInvitation.objects.update_or_create(
                email=email_addr,
                defaults={
                    "role": role,
                    "branch": branch,
                    "token": token,
                    "invited_by": inviter,
                    "is_used": False,
                    "expires_at": expires_at,
                },
            )

            # Send email
            threading.Thread(
                target=send_invitation_email_async,
                args=(email_addr, role, inviter.full_name, token, branch),
            ).start()

            sent_emails.append(email_addr)

        if not sent_emails:
            return Response(
                {"error": "No invitations sent.", "details": errors}, status=400
            )

        return Response(
            {
                "message": f"Invitations successfully sent to: {', '.join(sent_emails)}",
                "errors": errors,
            },
            status=201,
        )


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
