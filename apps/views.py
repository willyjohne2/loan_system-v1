import bcrypt
import uuid
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
)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        try:
            admin = Admins.objects.get(email=email)
            if admin.is_blocked:
                return Response(
                    {"error": "Account is blocked"}, status=status.HTTP_403_FORBIDDEN
                )

            if bcrypt.checkpw(
                password.encode("utf-8"), admin.password_hash.encode("utf-8")
            ):
                admin.failed_login_attempts = 0
                admin.save()

                try:
                    refresh = RefreshToken()
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
    queryset = Users.objects.all()
    serializer_class = UserSerializer

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class LoanListCreateView(generics.ListCreateAPIView):
    queryset = Loans.objects.all()
    serializer_class = LoanSerializer

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class LoanProductListCreateView(generics.ListCreateAPIView):
    queryset = LoanProducts.objects.all()
    serializer_class = LoanProductSerializer

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class RepaymentListCreateView(generics.ListCreateAPIView):
    queryset = Repayments.objects.all()
    serializer_class = RepaymentSerializer

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())


class AuditLogListView(generics.ListAPIView):
    queryset = AuditLogs.objects.all()
    serializer_class = AuditLogSerializer


class AdminListCreateView(generics.ListCreateAPIView):
    queryset = Admins.objects.all()
    serializer_class = AdminSerializer

    def perform_create(self, serializer):
        serializer.save(id=uuid.uuid4())
