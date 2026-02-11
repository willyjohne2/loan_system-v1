import bcrypt
import uuid
import secrets
import threading
import os
import requests
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status, views, permissions, generics
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
)
from .utils.mpesa import MpesaHandler
from .utils.sms import send_sms_async


def create_loan_activity(loan, admin, action, note=""):
    LoanActivity.objects.create(loan=loan, admin=admin, action=action, note=note)


def create_notification(user, message):
    Notifications.objects.create(user=user, message=message, is_read=False)


def send_verification_email_async(full_name, email, verification_code):
    try:
        sender_name = os.getenv("SENDER_NAME", "Loan System")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": "Your Email Verification Code - Loan System",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>Email Verification</h2>
                <p>Hello {full_name},</p>
                <p>Welcome to the Loan Management System!</p>
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


def send_password_reset_email_async(full_name, email, reset_code):
    try:
        sender_name = os.getenv("SENDER_NAME", "Loan System")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": "Password Reset Code - Loan System",
            "htmlContent": f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                <h2>Password Reset</h2>
                <p>Hello {full_name},</p>
                <p>You requested to reset your password.</p>
                <p>Your 6-digit reset code is:</p>
                <h1 style="background-color: #f8f8f8; padding: 15px; text-align: center; letter-spacing: 5px; border: 1px solid #ddd;">{reset_code}</h1>
                <p>This code will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email and ensure your account is secure.</p>
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

        try:
            admin = Admins.objects.filter(email__iexact=email).first()
            if not admin:
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
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
                admin.save()

                try:
                    refresh = RefreshToken()
                    refresh["user_id"] = str(admin.id)
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
                if admin.failed_login_attempts >= 5:
                    admin.is_blocked = True
                admin.save()
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        except Admins.DoesNotExist:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )


class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not user or not user.is_authenticated:
            return Users.objects.none()

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Users.objects.filter(created_by=user)

        if hasattr(user, "role") and user.role == "MANAGER":
            return Users.objects.filter(profile__region=user.region)

        return Users.objects.all()

    def perform_create(self, serializer):
        user = self.request.user

        created_by = user if (user and user.is_authenticated) else None
        serializer.save(created_by=created_by)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Users.objects.none()

        if hasattr(user, "role") and user.role == "MANAGER":
            return Users.objects.filter(profile__region=user.region)
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Users.objects.filter(created_by=user)

        return Users.objects.all()


class CheckUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response(
                {"error": "Query parameter 'q' (ID or Phone) is required"},
                status=400,
            )

        user = (
            Users.objects.filter(phone=query).first()
            or Users.objects.filter(profile__national_id=query).first()
        )

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

        loans = Loans.objects.all()

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            loans = loans.filter(created_by=user)

        elif hasattr(user, "role") and user.role == "MANAGER":
            loans = loans.filter(user__profile__region=user.region)

        for loan in loans:
            loan.update_status_and_rates()

        return loans

    def perform_create(self, serializer):
        user = self.request.user
        created_by = user if (user and user.is_authenticated) else None

        interest_rate = self.request.data.get("interest_rate")
        product_id = self.request.data.get("loan_product")

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
            repayments = repayments.filter(loan__user__profile__region=user.region)

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
            loan.status = "CLOSED"
            loan.save()
            create_notification(
                loan.user,
                f"Congratulations! Your loan of KES {loan.principal_amount} has been fully repaid.",
            )
            create_loan_activity(
                loan, admin, "STATUS_CHANGE", "Loan closed - fully repaid."
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

            # Scope to manager region or financial officer portfolio if applicable
            if user_role == "MANAGER":
                manager_region = getattr(user, "region", None)
                if manager_region:
                    overdue_loans = overdue_loans.filter(
                        user__profile__region=manager_region
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
                manager_region = getattr(user, "region", None)
                if manager_region:
                    closed_loans = closed_loans.filter(
                        user__profile__region=manager_region
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
                manager_region = getattr(user, "region", None)
                if manager_region:
                    all_users = all_users.filter(profile__region=manager_region)

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
        user_role = self.request.auth.get("role") if self.request.auth else None

        if not user_role and hasattr(self.request.user, "role"):
            user_role = self.request.user.role

        if user_role == "ADMIN":
            return AuditLogs.objects.all().order_by("-created_at")
        return AuditLogs.objects.none()


class AdminListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Admins.objects.all()
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        return queryset

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class AdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Admins.objects.all()
    serializer_class = AdminSerializer
    permission_classes = [permissions.IsAuthenticated]


class SystemSettingsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
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
            manager_region = getattr(user, "region", None)
            if manager_region:
                # Filter by logs where the recipient is in the manager's region
                return SMSLog.objects.filter(
                    recipient_phone__in=Users.objects.filter(
                        profile__region=manager_region
                    ).values_list("phone", flat=True)
                ).order_by("-created_at")

        return super().get_queryset()


class AdminDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, admin_id):
        try:
            if request.auth.get("role") != "ADMIN":
                return Response(
                    {"error": "Only admins can delete accounts"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if str(request.auth.get("admin_id")) == str(admin_id):
                return Response(
                    {"error": "Cannot delete your own account"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            admin = Admins.objects.get(id=admin_id)
            admin_email = admin.email
            admin.delete()

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

        if role == "ADMIN" and Admins.objects.filter(role="ADMIN").exists():
            return Response(
                {
                    "error": "Admin account already exists. New admins must be invited by an existing administrator."
                },
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

        admin = Admins.objects.create(
            id=uuid.uuid4(),
            full_name=full_name,
            email=email.lower(),
            phone=phone,
            role=role,
            password_hash=password_hash,
            verification_token=verification_code,
            is_verified=False,
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
    queryset = LoanProducts.objects.all()
    serializer_class = LoanProductSerializer
    permission_classes = [permissions.AllowAny]


class UserProfileListCreateView(generics.ListCreateAPIView):
    queryset = UserProfiles.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]


class LoanDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LoanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Loans.objects.none()

        if hasattr(user, "role") and user.role == "MANAGER":
            return Loans.objects.filter(user__profile__region=user.region)
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Loans.objects.filter(created_by=user)

        return Loans.objects.all()

    def perform_update(self, serializer):
        old_loan = self.get_object()
        new_status = self.request.data.get("status")

        loan = serializer.save()

        if new_status and new_status != old_loan.status:
            admin = self.request.user if self.request.user.is_authenticated else None
            create_loan_activity(
                loan,
                admin,
                new_status,
                f"Status changed from {old_loan.status} to {new_status}",
            )

            create_notification(
                loan.user,
                f"Your loan status has been updated to {new_status}.",
            )

            # SMS Notifications for specific status changes
            if new_status == "VERIFIED" and loan.user.phone:
                msg = (
                    f"Hello {loan.user.full_name}, your loan application for KES {loan.principal_amount:,.2f} "
                    "has been VERIFIED. It is now moving to the approval stage."
                )
                send_sms_async([loan.user.phone], msg)
                SMSLog.objects.create(
                    sender=getattr(self.request, "user", None),
                    recipient_phone=loan.user.phone,
                    recipient_name=loan.user.full_name,
                    message=msg,
                    type="AUTO",
                )

            elif new_status == "AWARDED" and loan.user.phone:
                msg = (
                    f"Congratulations {loan.user.full_name}! Your loan of KES {loan.principal_amount:,.2f} "
                    "has been AWARDED. The funds will be disbursed to your registered mobile number shortly."
                )
                send_sms_async([loan.user.phone], msg)
                SMSLog.objects.create(
                    sender=getattr(self.request, "user", None),
                    recipient_phone=loan.user.phone,
                    recipient_name=loan.user.full_name,
                    message=msg,
                    type="AUTO",
                )


class LoanDocumentCreateView(generics.CreateAPIView):
    serializer_class = LoanDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        loan_id = self.request.data.get("loan")
        user = self.request.user

        loan = Loans.objects.get(id=loan_id)
        if hasattr(user, "role"):
            if user.role == "MANAGER" and loan.user.profile.region != user.region:
                raise permissions.exceptions.PermissionDenied(
                    "You don't have access to this loan's region"
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
        return Notifications.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )


class NotificationUpdateView(generics.UpdateAPIView):
    queryset = Notifications.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]


class LoanAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncMonth

        user = request.user
        region = request.query_params.get("region")

        if hasattr(user, "role") and user.role == "MANAGER":
            region = user.region

        loans = Loans.objects.all()
        if region:
            loans = loans.filter(user__profile__region=region)

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            loans = loans.filter(created_by=user)

        monthly_stats = (
            loans.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("principal_amount"), count=Count("id"))
            .order_by("month")
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
            "status_breakdown": [
                {"name": stat["status"], "value": stat["count"]}
                for stat in status_stats
            ],
        }
        return Response(data)
