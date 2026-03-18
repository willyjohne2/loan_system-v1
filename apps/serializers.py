from rest_framework import serializers
import json
from django.utils import timezone
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
    Branch,
    CustomerDraft,
    SecureSettings,
)
from .utils.encryption import encrypt_value


class BranchSerializer(serializers.ModelSerializer):
    admin_count = serializers.SerializerMethodField()
    customer_count = serializers.SerializerMethodField()
    loan_count = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = "__all__"

    def get_admin_count(self, obj):
        return obj.branch_admins.count()

    def get_customer_count(self, obj):
        return obj.branch_profiles.count()

    def get_loan_count(self, obj):
        return obj.branch_loans.count()


class SecureSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecureSettings
        fields = ["key", "encrypted_value", "setting_group", "description", "updated_by", "updated_at"]
        read_only_fields = ["updated_by", "updated_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Never return encrypted_value raw—mask sensitive ones
        sensitive_groups = ["mpesa", "sms", "security"]
        if instance.setting_group in sensitive_groups or "key" in instance.key or "secret" in instance.key or "passkey" in instance.key:
            # Check if this specific key is sensitive (e.g. mpesa_environment is not really sensitive)
            non_sensitive_keys = ["mpesa_environment", "mpesa_shortcode_type", "sms_provider", "ip_whitelist_enabled", "force_2fa_admin", "force_2fa_finance"]
            if instance.key not in non_sensitive_keys:
                ret["encrypted_value"] = "••••••••"
            else:
                # Decrypt it for non-sensitive system settings/toggles
                from .utils.encryption import decrypt_value
                ret["encrypted_value"] = decrypt_value(instance.encrypted_value)
        else:
            # For system group or others, return decrypted if not sensitive
            from .utils.encryption import decrypt_value
            ret["encrypted_value"] = decrypt_value(instance.encrypted_value)
        return ret

    def create(self, validated_data):
        # Encrypt value before saving
        value = validated_data.get("encrypted_value")
        if value:
            validated_data["encrypted_value"] = encrypt_value(value)
        
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user
            
        # Use update_or_create logic for upsert behavior if needed, 
        # but generics handle create if not exists.
        return super().create(validated_data)

    def update(self, instance, validated_data):
        value = validated_data.get("encrypted_value")
        if value and value != "••••••••":
            validated_data["encrypted_value"] = encrypt_value(value)
        else:
            # If masked value is sent back, don't update the actual value
            validated_data.pop("encrypted_value", None)

        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user
            
        return super().update(instance, validated_data)


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
    branch_name = serializers.ReadOnlyField(source="branch_fk.name")
    ownership_granted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Admins
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "role",
            "branch",
            "branch_fk",
            "branch_name",
            "is_verified",
            "is_blocked",
            "is_super_admin",
            "is_owner",
            "is_primary_owner",
            "god_mode_enabled",
            "ownership_granted_at",
            "is_two_factor_enabled",
            "created_at",
            "ownership_granted_by_name",
        ]

    def get_ownership_granted_by_name(self, obj):
        return obj.ownership_granted_by.full_name if obj.ownership_granted_by else None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        
        # Safe access to query_params with request check
        unmasked = False
        if request and hasattr(request, 'query_params'):
            unmasked = request.query_params.get("unmasked", "false").lower() == "true"
        
        is_owner = request and request.user.is_authenticated and str(request.user.id) == str(instance.id)
        is_admin = request and request.user.is_authenticated and request.user.role in ["ADMIN"]

        if unmasked and (is_admin or is_owner):
            from .utils.security import log_action
            log_action(
                request.user, 
                f"Viewed unmasked data for admin {instance.id}", 
                "admins", 
                instance.id, 
                log_type="SECURITY"
            )
        else:
            phone = ret.get("phone")
            if phone and len(phone) >= 10:
                ret["phone"] = f"{phone[:2]}***{phone[-2:]}"
        return ret

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

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        
        # Safe access to query_params with request check
        unmasked = False
        if request and hasattr(request, 'query_params'):
            unmasked = request.query_params.get("unmasked", "false").lower() == "true"
        
        # Admin check for unmasked parameter
        is_owner = request and request.user.is_authenticated and str(request.user.id) == str(instance.id)
        is_admin = request and request.user.is_authenticated and request.user.role in ["ADMIN", "MANAGER", "FINANCIAL_OFFICER"]

        if unmasked and (is_admin or is_owner):
            # Log unmasked access
            from .utils.security import log_action
            log_action(
                request.user, 
                f"Viewed unmasked data for user {instance.id}", 
                "users", 
                instance.id, 
                log_type="SECURITY"
            )
        else:
            # Mask Phone
            phone = ret.get("phone")
            if phone and len(phone) >= 10:
                ret["phone"] = f"{phone[:2]}***{phone[-2:]}"
            
            # Mask National ID in profile
            if ret.get("profile") and ret["profile"].get("national_id"):
                nid = ret["profile"]["national_id"]
                if len(nid) >= 4:
                    ret["profile"]["national_id"] = f"{nid[:2]}xxxx{nid[-1:]}"
        return ret

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
            "branch": profile_data.get("branch") or None,
            "branch_fk_id": profile_data.get("branch_fk")
            or (request.user.branch_fk_id if request.user else None),
            "town": profile_data.get("town") or None,
            "village": profile_data.get("village") or None,
            "address": profile_data.get("address") or None,
            "employment_status": profile_data.get("employment_status"),
            "monthly_income": profile_data.get("monthly_income") or None,
        }

        # Ensure numeric fields are really None if empty string
        if profile_defaults["monthly_income"] == "":
            profile_defaults["monthly_income"] = None
        if profile_defaults["date_of_birth"] == "":
            profile_defaults["date_of_birth"] = None

        # Extract images primarily from FILES
        if files.get("profile_image"):
            profile_defaults["profile_image"] = files.get("profile_image")

        if files.get("national_id_image"):
            profile_defaults["national_id_image"] = files.get("national_id_image")

        # Use update_or_create to populate the fields correctly
        UserProfile, created = UserProfiles.objects.update_or_create(
            user=user,
            defaults=profile_defaults,
        )
        
        # Manually sync created_at for profiles if they exist but were created with naive datetime
        if not created and not timezone.is_aware(UserProfile.created_at):
             UserProfile.created_at = timezone.now()
             UserProfile.save()

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
            "branch": profile_data.get("branch") or None,
            "town": profile_data.get("town") or None,
            "village": profile_data.get("village") or None,
            "address": profile_data.get("address") or None,
            "employment_status": profile_data.get("employment_status"),
            "monthly_income": profile_data.get("monthly_income") or None,
        }

        # Clean empty strings
        for k, v in profile_defaults.items():
            if v == "":
                profile_defaults[k] = None

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

        up, created = UserProfiles.objects.update_or_create(
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
        request = self.context.get("request")
        if request and request.user:
            # Set default branch if not provided
            if not data.get("branch") and request.user.branch_fk:
                data["branch"] = request.user.branch_fk

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
    branch_name = serializers.ReadOnlyField(source="loan.user.profile.branch_fk.name")

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
            "branch_name",
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
    admin_details = serializers.SerializerMethodField()

    class Meta:
        model = AuditLogs
        fields = [
            "id",
            "admin",
            "admin_details",
            "action",
            "log_type",
            "table_name",
            "record_id",
            "old_data",
            "new_data",
            "ip_address",
            "created_at",
        ]

    def get_admin_details(self, obj):
        if obj.admin:
            return {
                "full_name": obj.admin.full_name,
                "role": obj.admin.role,
                "email": obj.admin.email
            }
        return None


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

class CustomerDraftSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')

    class Meta:
        model = CustomerDraft
        fields = '__all__'
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def validate_incomplete_reason(self, value):
        valid_reasons = [
            "Missing National ID",
            "Missing National ID Photo",
            "Missing Profile Photo",
            "Missing Guarantor Details",
            "Missing Income Information",
            "Customer to Provide Additional Documents",
            "Other"
        ]
        if value not in valid_reasons:
            raise serializers.ValidationError(f"Invalid incomplete_reason. Must be one of: {', '.join(valid_reasons)}")
        return value

    def validate(self, data):
        if data.get('incomplete_reason') == 'Other' and not data.get('notes'):
            raise serializers.ValidationError({"notes": "Notes are required when reason is 'Other'."})
        return data
