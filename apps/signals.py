from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Loans, Repayments, AuditLogs, Users, Admins, UserProfiles
import uuid


@receiver(post_save, sender=Admins)
def log_admin_activity(sender, instance, created, **kwargs):
    if created:
        AuditLogs.objects.create(
            action="ADMIN_ACCOUNT_CREATED",
            table_name="admins",
            record_id=instance.id,
            new_data={"email": instance.email, "role": instance.role},
        )


@receiver(post_save, sender=Users)
def handle_user_post_save(sender, instance, created, **kwargs):
    if created:
        # Create profile automatically
        UserProfiles.objects.get_or_create(user=instance)
        
        # Log registration
        AuditLogs.objects.create(
            action="USER_REGISTERED",
            table_name="users",
            record_id=instance.id,
            new_data={"full_name": instance.full_name},
            admin=instance.created_by,
        )


@receiver(post_save, sender=Loans)
def log_loan_activity(sender, instance, created, **kwargs):
    action = "LOAN_CREATED" if created else f"LOAN_STATUS_UPDATED_{instance.status}"
    AuditLogs.objects.create(
        action=action,
        table_name="loans",
        record_id=instance.id,
        new_data={"status": instance.status, "amount": str(instance.principal_amount)},
        admin=instance.created_by,
    )


@receiver(post_save, sender=Repayments)
def log_repayment_activity(sender, instance, created, **kwargs):
    if created:
        AuditLogs.objects.create(
            action="REPAYMENT_RECORDED",
            table_name="repayments",
            record_id=instance.id,
            new_data={"amount": str(instance.amount_paid)},
        )
