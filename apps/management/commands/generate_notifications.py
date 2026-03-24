from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.models import (
    Admins, Loans, SystemCapital, SystemSettings, 
    StaffNotification, PaybillTransaction
)
from apps.services import create_staff_notification

class Command(BaseCommand):
    help = 'Generate periodic staff notifications for queues and thresholds'

    def handle(self, *args, **kwargs):
        self.check_capital()
        self.check_verification_backlog()
        self.check_loans_stuck()
        self.check_overdue_spike()
        self.check_unmatched_repayments()
        self.check_disbursement_queue()
        self.check_officer_inactivity()
        self.stdout.write(self.style.SUCCESS('Notification sweep complete'))

    def check_capital(self):
        capital = SystemCapital.objects.first()
        if not capital:
            return
        try:
            low_threshold = float(SystemSettings.objects.get(key='capital_low_threshold').value)
        except:
            low_threshold = 50000
        try:
            critical_threshold = float(SystemSettings.objects.get(key='capital_critical_threshold').value)
        except:
            critical_threshold = 10000

        balance = float(capital.balance)
        if balance <= low_threshold:
            from apps.services import notify_capital_low
            notify_capital_low(balance, low_threshold, critical_threshold)

    def check_verification_backlog(self):
        # Notify managers when they have >10 UNVERIFIED loans in their branch
        managers = Admins.objects.filter(role='MANAGER', is_blocked=False)
        for manager in managers:
            count = Loans.objects.filter(
                status='UNVERIFIED',
                created_by__branch_fk=manager.branch_fk
            ).count()
            if count > 10:
                create_staff_notification(
                    manager, 'VERIFICATION_BACKLOG',
                    f'Verification Queue Backlog — {count} Loans Pending',
                    f'You have {count} loans awaiting verification in your branch. Please review them to avoid delays.',
                    priority='HIGH'
                )

    def check_loans_stuck(self):
        # Notify admins when loans are stuck UNVERIFIED or VERIFIED for >48 hours
        threshold = timezone.now() - timedelta(hours=48)
        stuck = Loans.objects.filter(
            status__in=['UNVERIFIED', 'VERIFIED'],
            created_at__lte=threshold
        ).count()
        if stuck > 0:
            admins = Admins.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN'], is_blocked=False)
            owners = Admins.objects.filter(is_owner=True, is_blocked=False)
            for r in list(admins) + list(owners):
                create_staff_notification(
                    r, 'LOANS_STUCK',
                    f'{stuck} Loan(s) Stuck in Pipeline (>48hrs)',
                    f'{stuck} loan(s) have been sitting in UNVERIFIED or VERIFIED status for more than 48 hours. Investigate immediately.',
                    priority='HIGH'
                )

    def check_overdue_spike(self):
        # Notify managers and admins when overdue loans exceed 5 in their branch
        managers = Admins.objects.filter(role='MANAGER', is_blocked=False)
        for manager in managers:
            count = Loans.objects.filter(
                status='OVERDUE',
                created_by__branch_fk=manager.branch_fk
            ).count()
            if count >= 5:
                create_staff_notification(
                    manager, 'OVERDUE_SPIKE',
                    f'Overdue Alert — {count} Overdue Loans in Your Branch',
                    f'Your branch currently has {count} overdue loans. Please coordinate with your field officers to follow up with customers.',
                    priority='HIGH'
                )

    def check_unmatched_repayments(self):
        # Notify finance officers when unmatched repayments sit >24 hours
        threshold = timezone.now() - timedelta(hours=24)
        try:
            count = PaybillTransaction.objects.filter(
                is_matched=False,
                created_at__lte=threshold
            ).count()
        except:
            return
        if count > 0:
            finance = Admins.objects.filter(role='FINANCIAL_OFFICER', is_blocked=False)
            for r in finance:
                create_staff_notification(
                    r, 'UNMATCHED_REPAYMENTS',
                    f'{count} Unmatched Repayment(s) Sitting >24hrs',
                    f'{count} M-Pesa transaction(s) have not been matched to any loan for over 24 hours. Please review the unmatched queue.',
                    priority='HIGH'
                )

    def check_disbursement_queue(self):
        # Notify finance officers when approved loans are waiting disbursement
        count = Loans.objects.filter(status='APPROVED').count()
        if count > 0:
            finance = Admins.objects.filter(role='FINANCIAL_OFFICER', is_blocked=False)
            for r in finance:
                create_staff_notification(
                    r, 'DISBURSEMENT_QUEUE',
                    f'{count} Loan(s) Awaiting Disbursement',
                    f'There are {count} approved loan(s) in the disbursement queue waiting to be processed.',
                    priority='MEDIUM'
                )

    def check_officer_inactivity(self):
        # Notify managers when a field officer hasn't submitted any loan in 7 days
        threshold = timezone.now() - timedelta(days=7)
        managers = Admins.objects.filter(role='MANAGER', is_blocked=False)
        for manager in managers:
            officers = Admins.objects.filter(
                role='FIELD_OFFICER',
                branch_fk=manager.branch_fk,
                is_blocked=False
            )
            for officer in officers:
                recent_activity = Loans.objects.filter(
                    created_by=officer,
                    created_at__gte=threshold
                ).exists()
                if not recent_activity:
                    create_staff_notification(
                        manager, 'OFFICER_INACTIVE',
                        f'Field Officer Inactive — {officer.full_name}',
                        f'{officer.full_name} has not submitted any loans in the last 7 days. Please check in with them.',
                        priority='LOW'
                    )
