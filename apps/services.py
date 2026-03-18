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
        """
        Handles the logic for disbursing a loan based on the system mode.
        """
        mode = getattr(settings, "DISBURSEMENT_MODE", "SIMULATION")

        if mode == "SIMULATION":
            return DisbursementService._simulate_disbursement(loan, admin)
        else:
            # Placeholder for live Daraja API integration
            logger.info(f"Live disbursement initiated for loan {loan.id}")
            # return DarajaService.disburse(loan)
            pass

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
