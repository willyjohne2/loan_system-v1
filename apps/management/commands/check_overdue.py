from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.models import Loans, AuditLogs

class Command(BaseCommand):
    help = 'Mark overdue loans automatically'

    def handle(self, *args, **kwargs):
        active_loans = Loans.objects.filter(status__in=['ACTIVE', 'DISBURSED'])
        count = 0
        for loan in active_loans:
            if loan.is_overdue:
                old_status = loan.status
                loan.status = 'OVERDUE'
                loan.save()
                AuditLogs.objects.create(
                    action=f"Loan {loan.id.hex[:8]} automatically marked OVERDUE",
                    log_type="STATUS",
                    table_name="loans",
                    record_id=loan.id,
                    old_data={"status": old_status},
                    new_data={"status": "OVERDUE"}
                )
                count += 1
        self.stdout.write(self.style.SUCCESS(f'{count} loans marked overdue'))
