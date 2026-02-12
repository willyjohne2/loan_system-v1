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
    SMSLog,
)


class SMSLogSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source="sender.full_name")

    class Meta:
        model = SMSLog
        fields = "__all__"


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
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = Users
        fields = "__all__"

    def create(self, validated_data):
        profile_data = self.context.get("request").data
        user = Users.objects.create(**validated_data)

        # Extract profile fields from request.data (since they aren't in validated_data if not in Meta)
        # However, it's better to explicitly handle them
        UserProfiles.objects.create(
            user=user,
            national_id=profile_data.get("national_id"),
            date_of_birth=profile_data.get("date_of_birth") or None,
            region=profile_data.get("region"),
            county=profile_data.get("county"),
            town=profile_data.get("town"),
            village=profile_data.get("village"),
            address=profile_data.get("address"),
            employment_status=profile_data.get("employment_status"),
            monthly_income=profile_data.get("monthly_income") or None,
            profile_image=profile_data.get("profile_image"),
            national_id_image=profile_data.get("national_id_image"),
        )
        return user

    def update(self, instance, validated_data):
        profile_data = self.context.get("request").data

        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update or create profile
        profile, created = UserProfiles.objects.get_or_create(user=instance)

        # Update profile fields if provided
        for field in [
            "national_id",
            "date_of_birth",
            "region",
            "county",
            "town",
            "village",
            "address",
            "employment_status",
            "monthly_income",
        ]:
            if field in profile_data:
                val = profile_data.get(field)
                if field in ["date_of_birth", "monthly_income"] and not val:
                    val = None
                setattr(profile, field, val)

        if "profile_image" in profile_data:
            profile.profile_image = profile_data.get("profile_image")
        if "national_id_image" in profile_data:
            profile.national_id_image = profile_data.get("national_id_image")

        profile.save()
        return instance


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
