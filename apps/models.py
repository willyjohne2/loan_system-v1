from django.db import models
from django.utils import timezone
import uuid


class Admins(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.TextField()
    email = models.TextField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.TextField()
    password_hash = models.TextField()
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, blank=True, null=True)
    is_blocked = models.BooleanField(default=False)
    failed_login_attempts = models.IntegerField(default=0)
    region = models.TextField(blank=True, null=True)
    password_reset_code = models.CharField(max_length=6, blank=True, null=True)
    password_reset_expires = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "admins"

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False


class AdminInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50)
    token = models.CharField(max_length=100, unique=True)
    invited_by = models.ForeignKey(Admins, on_delete=models.SET_NULL, null=True)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "admin_invitations"

    def is_anonymous(self):
        return False


class AuditLogs(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin = models.ForeignKey(Admins, models.DO_NOTHING, blank=True, null=True)
    action = models.TextField()
    table_name = models.TextField()
    record_id = models.UUIDField(blank=True, null=True)
    old_data = models.JSONField(blank=True, null=True)
    new_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "audit_logs"


class LoanProducts(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    min_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    duration_months = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "loan_products"


class Loans(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("Users", models.DO_NOTHING)
    loan_product = models.ForeignKey(LoanProducts, models.DO_NOTHING)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    base_interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    duration_months = models.IntegerField()
    loan_reason = models.TextField(blank=True, null=True)
    loan_reason_other = models.TextField(blank=True, null=True)
    status = models.TextField(default="UNVERIFIED", db_index=True)
    created_by = models.ForeignKey(
        Admins, models.SET_NULL, null=True, blank=True, related_name="processed_loans"
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, db_index=True)

    class Meta:
        managed = True
        db_table = "loans"

    def save(self, *args, **kwargs):
        if not self.base_interest_rate and self.interest_rate:
            self.base_interest_rate = self.interest_rate
        super().save(*args, **kwargs)

    @property
    def total_repayable_amount(self):
        principal = float(self.principal_amount)
        rate = float(self.interest_rate or 0)
        # Assuming simple interest for now based on duration
        return principal + (principal * (rate / 100) * (self.duration_months / 12))

    @property
    def amount_paid(self):
        return float(
            self.repayments_set.aggregate(models.Sum("amount_paid"))["amount_paid__sum"]
            or 0
        )

    @property
    def remaining_balance(self):
        return self.total_repayable_amount - self.amount_paid

    @property
    def is_overdue(self):
        today = timezone.now().date()
        return self.repaymentschedule_set.filter(
            due_date__lt=today, is_paid=False
        ).exists()

    def update_status_and_rates(self):
        if self.status in ["CLOSED", "REJECTED"]:
            return

        is_currently_overdue = self.is_overdue

        if is_currently_overdue:
            if self.status != "OVERDUE":
                self.status = "OVERDUE"
                try:
                    penalty_setting = SystemSettings.objects.get(
                        key="OVERDUE_PENALTY_RATE"
                    )
                    penalty_rate = float(penalty_setting.value)
                    self.interest_rate = (
                        self.base_interest_rate or self.interest_rate or 0
                    ) + penalty_rate
                except (SystemSettings.DoesNotExist, ValueError):
                    pass
                self.save()
        elif self.status == "OVERDUE" and not is_currently_overdue:
            self.status = "ACTIVE"
            self.interest_rate = self.base_interest_rate
            self.save()


class Notifications(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("Users", models.DO_NOTHING)
    message = models.TextField()
    is_read = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "notifications"


class RepaymentSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loans, models.DO_NOTHING)
    installment_number = models.IntegerField()
    due_date = models.DateField()
    amount_due = models.DecimalField(max_digits=12, decimal_places=2)
    is_paid = models.BooleanField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = "repayment_schedule"


class Repayments(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loans, models.DO_NOTHING)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.TextField(blank=True, null=True)
    payment_date = models.DateTimeField(auto_now_add=True, null=True)
    reference_code = models.TextField(unique=True, blank=True, null=True)

    class Meta:
        managed = True
        db_table = "repayments"


class Transactions(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("Users", models.DO_NOTHING)
    type = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "transactions"


class SMSLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(Admins, models.DO_NOTHING, null=True, blank=True)
    recipient_phone = models.CharField(max_length=20)
    recipient_name = models.TextField(blank=True, null=True)
    message = models.TextField()
    type = models.CharField(max_length=50)  # DEFAULTER, REPAID, NOTICE, etc.
    status = models.CharField(max_length=20, default="SENT")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "sms_logs"


class UserProfiles(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField("Users", models.DO_NOTHING, related_name="profile")
    national_id = models.CharField(
        unique=True, max_length=50, blank=True, null=True, db_index=True
    )
    date_of_birth = models.DateField(blank=True, null=True)
    region = models.TextField(blank=True, null=True)
    county = models.TextField(blank=True, null=True)
    town = models.TextField(blank=True, null=True)
    village = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    employment_status = models.TextField(blank=True, null=True)
    monthly_income = models.DecimalField(
        max_digits=12, decimal_places=2, blank=True, null=True
    )
    profile_image = models.ImageField(upload_to="profiles/", blank=True, null=True)
    national_id_image = models.ImageField(upload_to="ids/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def get_safe_loan_limit(self, duration_months=12, annual_interest_rate=15):
        if not self.monthly_income or self.monthly_income <= 0:
            return 0

        max_monthly_repayment = float(self.monthly_income) * 0.33

        total_repayable = max_monthly_repayment * duration_months

        monthly_rate = (annual_interest_rate / 100) / 12
        estimated_principal = total_repayable / (
            1 + (annual_interest_rate / 100 * (duration_months / 12))
        )

        return round(estimated_principal, -2)

    class Meta:
        managed = True
        db_table = "user_profiles"


class Users(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.TextField(db_index=True)
    phone = models.CharField(unique=True, max_length=20, db_index=True)
    email = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        Admins, models.SET_NULL, null=True, blank=True, related_name="registered_users"
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        managed = True
        db_table = "users"


class MpesaPayments(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkout_request_id = models.CharField(max_length=100, unique=True)
    merchant_request_id = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default="PENDING")
    mpesa_receipt_number = models.CharField(max_length=50, blank=True, null=True)
    result_desc = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "mpesa_payments"


class Reports(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.TextField()
    report_type = models.CharField(max_length=50)
    generated_by = models.ForeignKey(Admins, models.DO_NOTHING)
    file_path = models.TextField(blank=True, null=True)
    data_snapshot = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "reports"


class SystemSettings(models.Model):
    key = models.CharField(primary_key=True, max_length=100)
    value = models.JSONField()
    description = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = True
        db_table = "system_settings"


class StaffAssignments(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff = models.ForeignKey(Admins, models.DO_NOTHING, related_name="assignments")
    user = models.ForeignKey(Users, models.DO_NOTHING, related_name="assigned_staff")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "staff_assignments"
        unique_together = (("staff", "user"),)


class LoanDocuments(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loans, models.CASCADE, related_name="documents")
    name = models.TextField()
    file_path = models.TextField()
    doc_type = models.CharField(max_length=50)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "loan_documents"


class LoanActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    loan = models.ForeignKey(Loans, models.CASCADE, related_name="activities")
    admin = models.ForeignKey(Admins, models.SET_NULL, null=True)
    action = models.TextField()
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = True
        db_table = "loan_activity"
