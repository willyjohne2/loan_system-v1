from django.db import transaction
from django.conf import settings
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
            # 1. Lock the simulation capital account
            try:
                capital = SystemCapital.objects.select_for_update().get(
                    name="Simulation Capital"
                )
            except SystemCapital.DoesNotExist:
                raise InsufficientCapitalError("Simulation Capital account not found.")

            # 2. Check balance
            if capital.balance < loan.principal_amount:
                raise InsufficientCapitalError(
                    f"Insufficient balance. Available: {capital.balance}, Required: {loan.principal_amount}"
                )

            # 3. Deduct amount
            capital.balance -= loan.principal_amount
            capital.save()

            # 4. Create Ledger Entry
            LedgerEntry.objects.create(
                capital_account=capital,
                amount=-loan.principal_amount,
                entry_type="DISBURSEMENT",
                loan=loan,
                note=f"Simulation disbursement for Loan ID: {loan.id}",
            )

            # 5. Update Loan Status
            loan.status = "DISBURSED"
            loan.disbursed_at = timezone.now()
            loan.save()

            # 6. Log Activity
            LoanActivity.objects.create(
                loan=loan,
                admin=admin,
                action="DISBURSEMENT",
                note="Loan disbursed via Simulation Mode.",
            )

            logger.info(f"Successfully disbursed loan {loan.id} via simulation.")
            return True
