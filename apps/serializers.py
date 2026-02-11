from rest_framework import serializers
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
    LoanDocuments,
    LoanActivity,
)


class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admins
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "role",
            "region",
            "is_verified",
            "is_blocked",
            "created_at",
        ]


class LoanDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanDocuments
        fields = "__all__"


class LoanActivitySerializer(serializers.ModelSerializer):
    admin_name = serializers.ReadOnlyField(source="admin.full_name")

    class Meta:
        model = LoanActivity
        fields = "__all__"


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfiles
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = Users
        fields = "__all__"


class LoanProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanProducts
        fields = "__all__"


class LoanSerializer(serializers.ModelSerializer):
    documents = LoanDocumentSerializer(many=True, read_only=True)
    activities = LoanActivitySerializer(many=True, read_only=True)
    remaining_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_repayable_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    amount_paid = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Loans
        fields = "__all__"


class RepaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Repayments
        fields = "__all__"


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transactions
        fields = "__all__"


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notifications
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLogs
        fields = "__all__"


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = "__all__"
