from django.db import transaction
from django.conf import settings
from django.utils import timezone
from .models import SystemCapital, LedgerEntry, Loans, LoanActivity
from .exceptions import InsufficientCapitalError
import logging

logger = logging.getLogger(__name__)


class DisbursementService:
    @staticmethod
    def disburse_loan(loan, admin):
        mode = getattr(settings, 'DISBURSEMENT_MODE', 'SIMULATION')
        if mode == 'SIMULATION':
            return DisbursementService._simulate_disbursement(loan, admin)
        else:
            return DisbursementService._live_disbursement(loan, admin)

    @staticmethod
    def _live_disbursement(loan, admin):
        """
        Live B2C disbursement via Safaricom Daraja API.
        Does NOT immediately set loan to ACTIVE — waits for B2C callback confirmation.
        Sets loan to a transitional DISBURSED state and stores originator ID for matching.
        """
        from .utils.mpesa import MpesaHandler
        from .utils.security import log_action
        from .models import LoanActivity, AuditLogs, SystemCapital, LedgerEntry

        handler = MpesaHandler()

        phone = loan.user.phone
        if not phone:
            raise ValueError(f"Customer {loan.user.full_name} has no phone number for M-Pesa disbursement.")

        amount = float(loan.principal_amount)

        result = handler.b2c_disburse(
            phone_number=phone,
            amount=amount,
            CommandID='BusinessPayment',
            Remarks=f'Loan disbursement - {loan.id.hex[:8]}'
        )

        logger.info(f"[B2C] Disbursement initiated for loan {loan.id.hex[:8]}: {result}")

        response_code = str(result.get('ResponseCode', ''))

        if response_code == '0':
            # Safaricom accepted the request — store originator ID, set status to DISBURSED (pending callback)
            originator_id = result.get('OriginatorConversationID', '')
            conversation_id = result.get('ConversationID', '')

            with transaction.atomic():
                loan.status = 'DISBURSED'
                loan.disbursed_at = timezone.now()
                loan.last_modified_by = admin
                loan.mpesa_originator_id = originator_id or conversation_id
                loan.mpesa_disbursement_status = 'PENDING'
                loan.save()

                # Deduct from capital immediately — money has left the system
                capital = SystemCapital.objects.select_for_update().first()
                if capital:
                    capital.balance -= loan.principal_amount
                    capital.save()
                    LedgerEntry.objects.create(
                        capital_account=capital,
                        amount=loan.principal_amount,
                        entry_type='DISBURSEMENT',
                        loan=loan,
                        note=f'Live B2C disbursement to {loan.user.full_name} ({phone}). OriginatorID: {originator_id}'
                    )

                LoanActivity.objects.create(
                    loan=loan, admin=admin,
                    action='DISBURSEMENT',
                    note=f'Live B2C disbursement initiated. OriginatorID: {originator_id}. Awaiting Safaricom callback confirmation.'
                )

                log_action(
                    admin,
                    f'Loan {loan.id.hex[:8]} B2C disbursement initiated to {loan.user.full_name} — KES {amount:,.2f}',
                    'loans', loan.id,
                    old_data={'status': 'APPROVED'},
                    new_data={'status': 'DISBURSED', 'mpesa_originator_id': originator_id},
                    log_type='STATUS'
                )

            return {'success': True, 'originator_id': originator_id, 'message': 'Disbursement initiated. Awaiting M-Pesa confirmation.'}

        else:
            # Safaricom rejected — do not change loan status, log the failure
            error_desc = result.get('ResponseDescription', 'Unknown error')
            logger.error(f"[B2C] Disbursement FAILED for loan {loan.id.hex[:8]}: {error_desc}")

            LoanActivity.objects.create(
                loan=loan, admin=admin,
                action='DISBURSEMENT_FAILED',
                note=f'Live B2C disbursement FAILED. Safaricom response: {error_desc}. Loan remains APPROVED.'
            )

            raise Exception(f'M-Pesa disbursement failed: {error_desc}')

    @staticmethod
    def _simulate_disbursement(loan, admin):
        with transaction.atomic():
            # 1. Lock and check capital
            capital = SystemCapital.objects.select_for_update().get(name="Simulation Capital")
            if capital.balance < loan.principal_amount:
                raise InsufficientCapitalError(
                    f"Insufficient capital. Available: KES {capital.balance:,.2f}, Required: KES {loan.principal_amount:,.2f}"
                )

            # 2. Deduct capital
            capital.balance -= loan.principal_amount
            capital.save()

            # 3. Create ledger entry (DEBIT)
            LedgerEntry.objects.create(
                capital_account=capital,
                amount=loan.principal_amount,
                entry_type="DISBURSEMENT",
                loan=loan,
                note=f"Disbursement for Loan {loan.id.hex[:8]} to {loan.user.full_name}"
            )

            # 4. Update loan status in ONE save
            loan.status = "ACTIVE"
            loan.disbursed_at = timezone.now()
            loan.last_modified_by = admin
            loan.save()

            # 5. Generate repayment schedule
            from .models import RepaymentSchedule
            RepaymentSchedule.objects.filter(loan=loan).delete()
            total_repayable = float(loan.total_repayable_amount)
            disbursed_date = loan.disbursed_at.date()

            num_installments = loan.duration_weeks or (loan.duration_months * 4 if loan.duration_months else 4)
            installment_amount = round(total_repayable / num_installments, 2)

            for i in range(1, num_installments + 1):
                if loan.duration_weeks:
                    due_date = disbursed_date + timezone.timedelta(weeks=i)
                else:
                    due_date = disbursed_date + timezone.timedelta(days=i * 30)

                amt = installment_amount
                if i == num_installments:
                    amt = round(total_repayable - (installment_amount * (num_installments - 1)), 2)

                RepaymentSchedule.objects.create(
                    loan=loan,
                    installment_number=i,
                    due_date=due_date,
                    amount_due=amt,
                    is_paid=False
                )

            # 6. Log activity and audit
            LoanActivity.objects.create(
                loan=loan, admin=admin,
                action="DISBURSEMENT",
                note=f"Loan disbursed via simulation. Capital remaining: KES {float(capital.balance):,.2f}"
            )

            from .utils.security import log_action
            log_action(
                admin,
                f"Loan {loan.id.hex[:8]} disbursed to {loan.user.full_name}. Amount: KES {float(loan.principal_amount):,.2f}",
                "loans", loan.id,
                old_data={"status": "APPROVED"},
                new_data={"status": "ACTIVE", "capital_remaining": float(capital.balance)},
                log_type="STATUS"
            )

            return True
            return True

def create_staff_notification(recipient, notification_type, title, message, priority='MEDIUM', send_email=False, related_table=None, related_id=None):
    """
    Create a staff notification. If send_email=True, also send via Brevo.
    Deduplicates: does not create if an identical unread notification 
    of the same type for the same recipient was created in the last 1 hour.
    """
    from .models import StaffNotification
    from django.utils import timezone
    from datetime import timedelta

    one_hour_ago = timezone.now() - timedelta(hours=1)
    already_exists = StaffNotification.objects.filter(
        recipient=recipient,
        notification_type=notification_type,
        is_read=False,
        created_at__gte=one_hour_ago
    ).exists()
    if already_exists:
        return None

    notif = StaffNotification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        priority=priority,
        title=title,
        message=message,
        send_email=send_email,
        related_table=related_table,
        related_id=related_id,
    )

    if send_email:
        try:
            import os, requests
            brevo_api_key = os.getenv('BREVO_API_KEY')
            from_email = os.getenv('FROM_EMAIL')
            if brevo_api_key and from_email:
                payload = {
                    "sender": {"name": "Azariah Credit System", "email": from_email},
                    "to": [{"email": recipient.email, "name": recipient.full_name}],
                    "subject": f"[{priority}] {title}",
                    "htmlContent": f"""
                        <html><body>
                        <h2 style="color:#1e293b">{title}</h2>
                        <p style="color:#475569">{message}</p>
                        <p style="font-size:12px;color:#94a3b8">This is an automated alert from Azariah Credit Ltd system. Do not reply to this email.</p>
                        </body></html>
                    """
                }
                res = requests.post(
                    "https://api.brevo.com/v3/smtp/email",
                    json=payload,
                    headers={"api-key": brevo_api_key, "Content-Type": "application/json"},
                    timeout=10
                )
                if res.status_code in [200, 201, 202]:
                    notif.email_sent = True
                    notif.save(update_fields=['email_sent'])

                from .models import EmailLog
                EmailLog.objects.create(
                    recipient_email=recipient.email,
                    recipient_name=recipient.full_name,
                    subject=payload["subject"],
                    message=f"Staff alert: {notification_type} — {title}",
                    status="SENT" if res.status_code in [200, 201, 202] else "FAILED"
                )
        except Exception as e:
            print(f"[StaffNotification] Email send failed: {e}")

    return notif


def notify_capital_low(balance, threshold_low, threshold_critical):
    """Notify Owner and Finance Officers when capital is low."""
    from .models import Admins
    owners = Admins.objects.filter(is_owner=True, is_blocked=False)
    finance = Admins.objects.filter(role='FINANCIAL_OFFICER', is_blocked=False)
    recipients = list(owners) + list(finance)

    is_critical = balance <= threshold_critical
    notif_type = 'CAPITAL_CRITICAL' if is_critical else 'CAPITAL_LOW'
    priority = 'CRITICAL' if is_critical else 'HIGH'
    title = f"{'CRITICAL: ' if is_critical else ''}Capital Balance Low — KES {int(balance):,}"
    message = (
        f"System capital has dropped to KES {int(balance):,}. "
        f"{'This is critically low and disbursements may be blocked.' if is_critical else 'This is approaching the minimum threshold. Please arrange capital injection.'}"
    )
    for r in recipients:
        create_staff_notification(r, notif_type, title, message, priority=priority, send_email=True)


def notify_staff_joined(new_admin):
    """Notify the inviter and relevant managers when a new staff member accepts their invite."""
    from .models import Admins, AdminInvitation
    invite = AdminInvitation.objects.filter(email=new_admin.email, is_used=True).first()
    if not invite or not invite.invited_by:
        return
    inviter = invite.invited_by
    title = f"New {new_admin.role.replace('_', ' ').title()} Joined"
    message = f"{new_admin.full_name} has accepted your invitation and joined as {new_admin.role.replace('_', ' ')}."
    if new_admin.branch:
        message += f" Branch: {new_admin.branch}."
    create_staff_notification(inviter, 'STAFF_JOINED', title, message, priority='LOW', send_email=True)


def notify_loan_rejected(loan):
    """Notify the field officer who submitted a loan when it is rejected."""
    from .models import Admins
    if not loan.created_by:
        return
    officer = loan.created_by
    customer_name = loan.user.full_name if loan.user else 'Unknown Customer'
    title = f"Loan Rejected — {customer_name}"
    message = (
        f"The loan application for {customer_name} (KES {int(loan.principal_amount):,}) "
        f"has been rejected. Reason: {loan.rejection_reason or 'No reason provided'}."
    )
    create_staff_notification(officer, 'LOAN_REJECTED', title, message, priority='MEDIUM', send_email=False)


def notify_customer_overdue(loan):
    """Notify the field officer when their customer goes overdue."""
    from .models import Admins
    if not loan.created_by:
        return
    officer = loan.created_by
    customer_name = loan.user.full_name if loan.user else 'Unknown'
    title = f"Customer Overdue — {customer_name}"
    message = (
        f"{customer_name}'s loan of KES {int(loan.principal_amount):,} is now OVERDUE. "
        f"Please follow up with the customer."
    )
    create_staff_notification(officer, 'CUSTOMER_OVERDUE', title, message, priority='HIGH', send_email=False)


def notify_deactivation_request(request_obj):
    """Notify Admin and Super Admin when a deactivation request is submitted."""
    from .models import Admins
    admins = Admins.objects.filter(role__in=['ADMIN', 'SUPER_ADMIN'], is_blocked=False)
    owners = Admins.objects.filter(is_owner=True, is_blocked=False)
    officer_name = request_obj.officer.full_name if request_obj.officer else 'Unknown'
    title = f"Deactivation Request — {officer_name}"
    message = f"{officer_name} has submitted a deactivation request. Reason: {request_obj.reason or 'Not specified'}. Please review and action."
    for r in list(admins) + list(owners):
        create_staff_notification(r, 'DEACTIVATION_REQUEST', title, message, priority='HIGH', send_email=True)
