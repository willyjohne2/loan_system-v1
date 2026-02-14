from rest_framework import serializers
import json
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
    DeactivationRequest,
    Guarantors,
    EmailLog,
)


class SMSLogSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source="sender.full_name")

    class Meta:
        model = SMSLog
        fields = "__all__"


class EmailLogSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source="sender.full_name")

    class Meta:
        model = EmailLog
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
            "branch",
            "is_verified",
            "is_blocked",
            "is_super_admin",
            "is_two_factor_enabled",
            "created_at",
        ]

    def validate_phone(self, value):
        import re

        normalized = re.sub(r"\D", "", value)
        if normalized.startswith("0") and len(normalized) == 10:
            normalized = "254" + normalized[1:]
        elif (normalized.startswith("7") or normalized.startswith("1")) and len(
            normalized
        ) == 9:
            normalized = "254" + normalized

        if (
            Admins.objects.filter(phone=normalized)
            .exclude(id=getattr(self.instance, "id", None))
            .exists()
        ):
            raise serializers.ValidationError(
                "This phone number is already registered to another staff member."
            )

        if Users.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError(
                "This phone number is already registered to a customer."
            )

        return normalized


class GuarantorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guarantors
        fields = ["id", "full_name", "national_id", "phone"]


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
    guarantors = GuarantorSerializer(many=True, read_only=True)
    national_id = serializers.CharField(write_only=True, required=False)
    has_active_loan = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = "__all__"

    def get_has_active_loan(self, obj):
        return Loans.objects.filter(
            user=obj,
            status__in=[
                "UNVERIFIED",
                "VERIFIED",
                "APPROVED",
                "DISBURSED",
                "ACTIVE",
                "OVERDUE",
                "DEFAULTED",
            ],
        ).exists()

    def validate_phone(self, value):
        # Normalize phone: remove spaces, dashes, etc.
        import re

        normalized = re.sub(r"\D", "", value)
        # If starts with 07 or 01 (Kenyan mobile), convert to 254
        if normalized.startswith("0") and len(normalized) == 10:
            normalized = "254" + normalized[1:]
        # If starts with 7 or 1...
        elif (normalized.startswith("7") or normalized.startswith("1")) and len(
            normalized
        ) == 9:
            normalized = "254" + normalized

        # Check uniqueness across both Users and Admins
        if (
            Users.objects.filter(phone=normalized)
            .exclude(id=getattr(self.instance, "id", None))
            .exists()
        ):
            raise serializers.ValidationError(
                "This phone number is already registered to a customer."
            )

        if Admins.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError(
                "This phone number is already registered to a staff member."
            )

        return normalized

    def validate_national_id(self, value):
        if not value:
            return value
        # Check if another user has this national ID
        existing = UserProfiles.objects.filter(national_id=value)
        if self.instance:
            existing = existing.exclude(user=self.instance)
        if existing.exists():
            raise serializers.ValidationError(
                "A user with this National ID already exists."
            )
        return value

    def create(self, validated_data):
        national_id = validated_data.pop("national_id", None)
        request = self.context.get("request")
        profile_data = request.data
        files = request.FILES

        # Ensure email is None if empty string
        if "email" in validated_data and not validated_data["email"]:
            validated_data["email"] = None

        user = Users.objects.create(**validated_data)

        # Handle Guarantors
        guarantors_data = profile_data.get("guarantors")
        if isinstance(guarantors_data, str):
            try:
                guarantors_data = json.loads(guarantors_data)
            except:
                guarantors_data = []

        if guarantors_data and isinstance(guarantors_data, list):
            for g in guarantors_data:
                # Basic validation for guarantor fields
                if g.get("full_name") and g.get("phone"):
                    Guarantors.objects.create(
                        user=user,
                        full_name=g.get("full_name"),
                        national_id=g.get("national_id", ""),
                        phone=g.get("phone"),
                    )

        # Build profile defaults
        profile_defaults = {
            "national_id": national_id or profile_data.get("national_id"),
            "date_of_birth": profile_data.get("date_of_birth") or None,
            "branch": profile_data.get("branch"),
            "town": profile_data.get("town"),
            "village": profile_data.get("village"),
            "address": profile_data.get("address"),
            "employment_status": profile_data.get("employment_status"),
            "monthly_income": profile_data.get("monthly_income") or None,
        }

        # Extract images primarily from FILES
        if files.get("profile_image"):
            profile_defaults["profile_image"] = files.get("profile_image")

        if files.get("national_id_image"):
            profile_defaults["national_id_image"] = files.get("national_id_image")

        # Use update_or_create to populate the fields correctly
        UserProfiles.objects.update_or_create(
            user=user,
            defaults=profile_defaults,
        )
        return user

    def update(self, instance, validated_data):
        national_id = validated_data.pop("national_id", None)
        request = self.context.get("request")
        profile_data = request.data
        files = request.FILES

        # Update the basic User fields
        for attr, value in validated_data.items():
            if attr == "email" and value == "":
                value = None
            setattr(instance, attr, value)
        instance.save()

        # Handle Guarantors (Replace existing if provided)
        guarantors_data = profile_data.get("guarantors")
        if isinstance(guarantors_data, str):
            try:
                guarantors_data = json.loads(guarantors_data)
            except:
                guarantors_data = None

        if guarantors_data is not None and isinstance(guarantors_data, list):
            # Clear existing and re-add
            instance.guarantors.all().delete()
            for g in guarantors_data:
                if g.get("full_name") and g.get("phone"):
                    Guarantors.objects.create(
                        user=instance,
                        full_name=g.get("full_name"),
                        national_id=g.get("national_id", ""),
                        phone=g.get("phone"),
                    )

        # Handle updating or creating the related profile
        profile_defaults = {
            "national_id": national_id or profile_data.get("national_id"),
            "date_of_birth": profile_data.get("date_of_birth") or None,
            "branch": profile_data.get("branch"),
            "town": profile_data.get("town"),
            "village": profile_data.get("village"),
            "address": profile_data.get("address"),
            "employment_status": profile_data.get("employment_status"),
            "monthly_income": profile_data.get("monthly_income") or None,
        }

        # Only update images if they are provided in files
        if files.get("profile_image"):
            profile_defaults["profile_image"] = files.get("profile_image")
        elif (
            "profile_image" in profile_data and profile_data["profile_image"] == "null"
        ):
            profile_defaults["profile_image"] = None

        if files.get("national_id_image"):
            profile_defaults["national_id_image"] = files.get("national_id_image")
        elif (
            "national_id_image" in profile_data
            and profile_data["national_id_image"] == "null"
        ):
            profile_defaults["national_id_image"] = None

        UserProfiles.objects.update_or_create(
            user=instance,
            defaults=profile_defaults,
        )

        return instance


class LoanProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanProducts
        fields = "__all__"


class LoanSerializer(serializers.ModelSerializer):
    documents = LoanDocumentSerializer(many=True, read_only=True)
    activities = LoanActivitySerializer(many=True, read_only=True)
    customer_name = serializers.ReadOnlyField(source="user.full_name")
    customer_phone = serializers.ReadOnlyField(source="user.phone")
    product_name = serializers.ReadOnlyField(source="loan_product.name")
    guarantor_phone = serializers.SerializerMethodField()

    remaining_balance = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_repayable_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    amount_paid = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    overdue_duration = serializers.ReadOnlyField()

    class Meta:
        model = Loans
        fields = "__all__"

    def get_guarantor_phone(self, obj):
        guarantor = obj.user.guarantors.first()
        return guarantor.phone if guarantor else "No Guarantor"

    def validate(self, data):
        user = data.get("user")
        if user:
            from .models import Loans

            active_loan = (
                Loans.objects.filter(
                    user=user,
                    status__in=[
                        "UNVERIFIED",
                        "VERIFIED",
                        "APPROVED",
                        "DISBURSED",
                        "ACTIVE",
                        "OVERDUE",
                        "DEFAULTED",
                    ],
                )
                .order_by("-created_at")
                .first()
            )

            if active_loan:
                balance = active_loan.remaining_balance
                if balance > 0:
                    raise serializers.ValidationError(
                        f"Customer already has an active loan. They must first pay the outstanding loan of KES {float(balance):,.2f} before applying for another one."
                    )
        return data


class RepaymentSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source="loan.user.full_name")
    loan_id = serializers.ReadOnlyField(source="loan.id")
    national_id = serializers.ReadOnlyField(source="loan.user.profile.national_id")
    mpesa_receipt = serializers.ReadOnlyField(source="reference_code")

    class Meta:
        model = Repayments
        fields = [
            "id",
            "loan",
            "loan_id",
            "customer_name",
            "national_id",
            "amount_paid",
            "payment_method",
            "payment_date",
            "reference_code",
            "mpesa_receipt",
        ]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transactions
        fields = "__all__"


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notifications
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.ReadOnlyField(source="admin.full_name")
    admin_role = serializers.ReadOnlyField(source="admin.role")

    class Meta:
        model = AuditLogs
        fields = [
            "id",
            "admin",
            "admin_name",
            "admin_role",
            "action",
            "log_type",
            "table_name",
            "record_id",
            "old_data",
            "new_data",
            "created_at",
        ]


class DeactivationRequestSerializer(serializers.ModelSerializer):
    officer_name = serializers.ReadOnlyField(source="officer.full_name")
    officer_email = serializers.ReadOnlyField(source="officer.email")
    requested_by_name = serializers.ReadOnlyField(source="requested_by.full_name")
    processed_by_name = serializers.ReadOnlyField(source="processed_by.full_name")

    class Meta:
        model = DeactivationRequest
        fields = "__all__"
        read_only_fields = ["requested_by", "processed_by", "processed_at"]


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = "__all__"
