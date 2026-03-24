from rest_framework import views, permissions, generics, status
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
from django.db import transaction  # Added
import uuid
import logging  # Added
from ..models import (
    Repayments, 
    Loans, 
    SystemCapital, 
    LedgerEntry, 
    RepaymentSchedule, 
    Transactions,
    AuditLogs,
    PaybillTransaction, # Added
    Users, # Added
    UserProfiles # Added
)
from ..serializers import RepaymentSerializer
from ..utils.security import log_action, get_client_ip, get_filtered_queryset
from ..permissions import IsAdminUser
from ..utils.mpesa import MpesaHandler
import json

logger = logging.getLogger(__name__)  # Added


class RepaymentListCreateView(generics.ListCreateAPIView):
    serializer_class = RepaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return get_filtered_queryset(self.request.user, Repayments.objects.all(), 'loan__user__profile__branch_fk').order_by("-payment_date")

    def perform_create(self, serializer):
        from django.db import transaction
        with transaction.atomic():
            repayment = serializer.save(id=uuid.uuid4())
            loan = repayment.loan
            capital = SystemCapital.objects.select_for_update().filter(name="Simulation Capital").first()
            if capital:
                capital.balance += repayment.amount_paid
                capital.save()
                LedgerEntry.objects.create(capital_account=capital, amount=repayment.amount_paid, entry_type="REPAYMENT", loan=loan, reference_id=repayment.reference_code, note=f"Repayment of KES {repayment.amount_paid} for Loan {loan.id.hex[:8]}")
            amount_remaining = float(repayment.amount_paid)
            for installment in RepaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'):
                if amount_remaining <= 0: break
                if amount_remaining >= float(installment.amount_due):
                    installment.is_paid = True
                    installment.save()
                    amount_remaining -= float(installment.amount_due)
                else: break
            admin = self.request.user if hasattr(self.request.user, "role") else None
            from ..loans.views import create_loan_activity, create_notification
            create_loan_activity(loan, admin, "REPAYMENT", f"Repayment of KES {repayment.amount_paid} recorded.")
            Transactions.objects.create(id=uuid.uuid4(), user=loan.user, type="REPAYMENT", amount=repayment.amount_paid)
            s_schedules = RepaymentSchedule.objects.filter(loan=loan, status='PENDING').order_by('due_date')
            am_to_apply = repayment.amount_paid
            for schedule in s_schedules:
                if am_to_apply <= 0: break
                if am_to_apply >= schedule.amount_due:
                    am_to_apply -= schedule.amount_due
                    schedule.status = 'PAID'
                    schedule.save()
                else: break
            if loan.remaining_balance <= 0:
                old_status = loan.status
                loan.status = "CLOSED"
                loan.save()
                create_notification(loan.user, f"Congratulations! Your loan of KES {loan.principal_amount} has been fully repaid.")
                create_loan_activity(loan, admin, "STATUS_CHANGE", "Loan closed - fully repaid.")
                AuditLogs.objects.create(admin=admin, action=f"Loan {loan.id} fully repaid and closed.", log_type="STATUS", table_name="loans", record_id=loan.id, old_data={"status": old_status}, new_data={"status": "CLOSED"})
            else: loan.update_status_and_rates()

class MpesaRepaymentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        role = getattr(user, "role", None)
        if role not in ["FIELD_OFFICER", "MANAGER", "ADMIN"]: return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        loan_id = request.data.get("loan_id")
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")
        if not all([loan_id, amount, phone_number]): return Response({"error": "loan_id, amount, and phone_number are required"}, status=400)
        try:
            loan = Loans.objects.get(id=loan_id)
            if loan.status not in ["ACTIVE", "OVERDUE"]: return Response({"error": f"Loan is in status {loan.status}."}, status=400)
            if loan.remaining_balance <= 0: return Response({"error": "Loan is already fully paid"}, status=400)
            handler = MpesaHandler()
            if not handler.consumer_key: result = handler.mock_stk_push(phone_number, amount, str(loan.id)[:20])
            else: result = handler.stk_push(phone_number, amount, str(loan.id)[:20], f"Repayment {str(loan.id)[:10]}")
            return Response(result)
        except Loans.DoesNotExist: return Response({"error": "Loan not found"}, status=404)

class MpesaCallbackView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        logger.info(f"[M-Pesa Callback] Received: {json.dumps(data)}")

        # ── B2C CALLBACK (Disbursement result from Safaricom) ──
        if 'Result' in data:
            return self._handle_b2c_callback(data)

        # ── C2B CALLBACK (Customer paying to Paybill) ──
        if 'TransID' in data or 'Body' in data:
            return self._handle_c2b_callback(data)

        logger.warning(f"[M-Pesa Callback] Unrecognised payload structure: {list(data.keys())}")
        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

    def _handle_b2c_callback(self, data):
        from ..models import Loans, LoanActivity, RepaymentSchedule, AuditLogs
        result = data.get('Result', {})
        result_code = result.get('ResultCode')
        originator_id = result.get('OriginatorConversationID', '')
        conversation_id = result.get('ConversationID', '')
        trans_id = result.get('TransactionID', '')

        receipt_number = trans_id
        amount_disbursed = None
        receiver_phone = None

        params = result.get('ResultParameters', {}).get('ResultParameter', [])
        for p in params:
            key = p.get('Key', '')
            val = p.get('Value')
            if key == 'ReceiptNo': receipt_number = val
            if key == 'TransactionAmount': amount_disbursed = val
            if key == 'ReceiverPartyPublicName': receiver_phone = val

        logger.info(f"[B2C] ResultCode={result_code}, OriginatorID={originator_id}, Receipt={receipt_number}")

        # Find the loan by originator ID
        loan = Loans.objects.filter(
            mpesa_originator_id__in=[originator_id, conversation_id]
        ).first()

        if not loan:
            logger.error(f"[B2C] No loan found for OriginatorID: {originator_id}")
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        if result_code == 0:
            # SUCCESS — activate loan, generate schedule
            with transaction.atomic():
                loan.status = 'ACTIVE'
                loan.mpesa_disbursement_status = 'SUCCESS'
                loan.mpesa_receipt_number = receipt_number
                loan.save()

                # Generate repayment schedule if not already generated
                if not RepaymentSchedule.objects.filter(loan=loan).exists():
                    total_repayable = float(loan.total_repayable_amount)
                    disbursed_date = loan.disbursed_at.date() if loan.disbursed_at else timezone.now().date()
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
                            loan=loan, installment_number=i,
                            due_date=due_date, amount_due=amt, is_paid=False
                        )

                LoanActivity.objects.create(
                    loan=loan,
                    action='DISBURSEMENT_CONFIRMED',
                    note=f'M-Pesa B2C confirmed. Receipt: {receipt_number}. Loan is now ACTIVE.'
                )

                AuditLogs.objects.create(
                    action=f'Loan {loan.id.hex[:8]} disbursement confirmed by M-Pesa. Receipt: {receipt_number}',
                    log_type='STATUS',
                    table_name='loans',
                    record_id=loan.id,
                    old_data={'status': 'DISBURSED'},
                    new_data={'status': 'ACTIVE', 'receipt': receipt_number}
                )

                # Send SMS to customer
                try:
                    from ..utils.sms import send_sms
                    msg = (
                        f"Dear {loan.user.full_name}, your loan of KES {int(loan.principal_amount):,} "
                        f"has been disbursed to your M-Pesa. Receipt: {receipt_number}. "
                        f"Total repayable: KES {int(loan.total_repayable_amount):,}. "
                        f"Repay via Paybill using your National ID as account number. - Azariah Credit"
                    )
                    send_sms(loan.user.phone, msg)
                except Exception as sms_err:
                    logger.warning(f"[B2C] SMS send failed after disbursement: {sms_err}")

            logger.info(f"[B2C] Loan {loan.id.hex[:8]} successfully activated. Receipt: {receipt_number}")

        else:
            # FAILED — revert loan to APPROVED so Finance Officer can retry
            error_desc = result.get('ResultDesc', 'Unknown M-Pesa error')
            with transaction.atomic():
                loan.status = 'APPROVED'
                loan.mpesa_disbursement_status = 'FAILED'
                loan.mpesa_originator_id = None
                loan.save()

                # Reverse the capital deduction
                from ..models import SystemCapital, LedgerEntry
                capital = SystemCapital.objects.select_for_update().first()
                if capital:
                    capital.balance += loan.principal_amount
                    capital.save()
                    LedgerEntry.objects.create(
                        capital_account=capital,
                        amount=loan.principal_amount,
                        entry_type='CAPITAL_INJECTION',
                        loan=loan,
                        note=f'Capital reversed — B2C disbursement failed. Reason: {error_desc}'
                    )

                LoanActivity.objects.create(
                    loan=loan,
                    action='DISBURSEMENT_FAILED',
                    note=f'M-Pesa B2C FAILED. Reason: {error_desc}. Loan reverted to APPROVED for retry.'
                )

            logger.error(f"[B2C] Disbursement FAILED for loan {loan.id.hex[:8]}: {error_desc}")

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

    def _handle_c2b_callback(self, data):
        """Handle real-time C2B payment notification from Safaricom."""
        from ..models import PaybillTransaction, Users, UserProfiles

        # Support both direct C2B and wrapped Body format
        body = data.get('Body', data)
        stkCallback = body.get('stkCallback', {})
        if stkCallback:
            # STK Push callback — not used for repayments in this system
            logger.info(f"[C2B] STK Push callback received — ignored (repayments via CSV)")
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        trans_id = data.get('TransID', '')
        bill_ref = str(data.get('BillRefNumber', '')).strip()
        amount_str = str(data.get('TransAmount', '0')).replace(',', '')
        msisdn = str(data.get('MSISDN', ''))
        first_name = data.get('FirstName', '')
        last_name = data.get('LastName', '')
        sender_name = f"{first_name} {last_name}".strip()
        trans_time = data.get('TransTime', '')

        if not trans_id:
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        # Avoid duplicates
        if PaybillTransaction.objects.filter(receipt_number=trans_id).exists():
            logger.info(f"[C2B] Duplicate callback ignored: {trans_id}")
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

        try:
            amount = float(amount_str)
        except ValueError:
            amount = 0

        # Normalise phone
        search_phone = msisdn
        if msisdn.startswith('254') and len(msisdn) > 3:
            search_phone = '0' + msisdn[3:]
        elif not msisdn.startswith('0') and len(msisdn) == 9:
            search_phone = '0' + msisdn

        try:
            from datetime import datetime
            try:
                transaction_date = timezone.make_aware(datetime.strptime(trans_time, '%Y%m%d%H%M%S'))
            except Exception:
                transaction_date = timezone.now()

            # Create PaybillTransaction so it appears in Finance Officer unmatched queue
            txn = PaybillTransaction.objects.create(
                receipt_number=trans_id,
                sender_phone=search_phone,
                sender_name=sender_name,
                account_ref=bill_ref,
                amount=amount,
                transaction_date=transaction_date,
                status='UNMATCHED'
            )

            # Attempt auto-matching: National ID first, then phone
            matched = False
            try:
                profile = UserProfiles.objects.get(national_id=bill_ref)
                loan = Loans.objects.filter(
                    user=profile.user, status__in=['ACTIVE', 'OVERDUE']
                ).order_by('created_at').first()
                if loan:
                    _record_repayment(txn, loan, profile.user, 'NATIONAL_ID', None)
                    matched = True
                    logger.info(f"[C2B] Matched by National ID: {bill_ref} → Loan {loan.id.hex[:8]}")
            except Exception:
                pass

            if not matched:
                try:
                    customer = Users.objects.get(phone=search_phone)
                    loan = Loans.objects.filter(
                        user=customer, status__in=['ACTIVE', 'OVERDUE']
                    ).order_by('created_at').first()
                    if loan:
                        _record_repayment(txn, loan, customer, 'PHONE', None)
                        matched = True
                        logger.info(f"[C2B] Matched by phone: {search_phone} → Loan {loan.id.hex[:8]}")
                except Exception:
                    pass

            if not matched:
                logger.info(f"[C2B] Unmatched transaction {trans_id} — added to queue for Finance Officer review")

        except Exception as e:
            logger.error(f"[C2B] Error processing callback: {e}")

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

def _record_repayment(txn, loan, customer, match_method, processed_by):
    from django.db import transaction as db_transaction
    from django.utils import timezone
    from ..models import Repayments, SystemCapital, LedgerEntry, RepaymentSchedule, Transactions
    from ..loans.views import create_loan_activity, create_notification

    with db_transaction.atomic():
        txn.status = 'MATCHED'
        txn.matched_loan = loan
        txn.matched_user = customer
        txn.match_method = match_method
        txn.assigned_by = processed_by
        txn.assigned_at = timezone.now()
        txn.save()

        # Create the actual Repayment record
        repayment = Repayments.objects.create(
            loan=loan,
            amount_paid=txn.amount,
            payment_date=timezone.now(),
            payment_method='MPESA_PAYBILL',
            reference_code=txn.receipt_number,
            notes=f"Auto-matched via {match_method}"
        )
        
        # Credit System Capital
        capital = SystemCapital.objects.select_for_update().filter(name="Simulation Capital").first()
        if capital:
            capital.balance += txn.amount
            capital.save()
            LedgerEntry.objects.create(
                capital_account=capital, 
                amount=txn.amount, 
                entry_type="REPAYMENT", 
                loan=loan, 
                reference_id=txn.receipt_number, 
                note=f"Repayment of KES {txn.amount} for Loan {loan.id.hex[:8]}"
            )

        # Distribute to Installments
        amount_remaining = float(txn.amount)
        for installment in RepaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'):
            if amount_remaining <= 0: break
            if amount_remaining >= float(installment.amount_due):
                installment.is_paid = True
                installment.status = 'PAID'
                installment.save()
                amount_remaining -= float(installment.amount_due)
            else:
                 # Logic for partial payment on installment could be complex, assuming simplified logic
                 break
        
        create_loan_activity(loan, processed_by, "REPAYMENT", f"Repayment of KES {txn.amount} recorded via {match_method}.")
        Transactions.objects.create(id=uuid.uuid4(), user=loan.user, type="REPAYMENT", amount=txn.amount)

        if loan.remaining_balance <= 0:
            loan.status = "CLOSED"
            loan.save()
            create_loan_activity(loan, processed_by, "STATUS_CHANGE", "Loan closed - fully repaid.")
            create_notification(loan.user, f"Congratulations! Your loan of KES {loan.principal_amount} has been fully repaid.")
        else:
            loan.update_status_and_rates()
            create_notification(loan.user, f"We received your payment of KES {txn.amount}. Thank you!")


        repayment = Repayments.objects.create(
            loan=loan, amount_paid=txn.amount, payment_method='PAYBILL',
            reference_code=txn.receipt_number, payment_date=txn.transaction_date
        )

        capital = SystemCapital.objects.select_for_update().filter(name="Simulation Capital").first()
        if capital:
            capital.balance += txn.amount
            capital.save()
            LedgerEntry.objects.create(
                capital_account=capital, amount=txn.amount, entry_type="REPAYMENT",
                loan=loan, reference_id=txn.receipt_number, note=f"Paybill repayment matched by {match_method}"
            )

        amount_remaining = float(txn.amount)
        for installment in RepaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'):
            if amount_remaining <= 0: break
            if amount_remaining >= float(installment.amount_due):
                installment.is_paid = True
                installment.save()
                amount_remaining -= float(installment.amount_due)
            else: break

        loan.refresh_from_db()
        if loan.remaining_balance <= 0:
            loan.status = 'CLOSED'
            loan.save()

class StatementUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if getattr(user, 'role', None) not in ['FINANCIAL_OFFICER', 'ADMIN'] and not getattr(user, 'is_owner', False) and not getattr(user, 'is_super_admin', False):
            return Response({"error": "Unauthorized"}, status=403)
        file = request.FILES.get('statement')
        if not file: return Response({"error": "No file uploaded"}, status=400)
        import csv, io
        from datetime import datetime
        from ..models import PaybillTransaction, UserProfiles, Users
        decoded = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        results = {'matched_national_id': 0, 'matched_phone': 0, 'unmatched': 0, 'duplicates': 0, 'errors': []}
        for row in reader:
            try:
                receipt = (row.get('Receipt No') or row.get('TransID') or row.get('receipt_number') or '').strip()
                sender_phone = (row.get('Sender Phone') or row.get('MSISDN') or row.get('sender_phone') or '').strip()
                account_ref = (row.get('Account Number') or row.get('BillRefNumber') or row.get('account_ref') or '').strip()
                amount = float((row.get('Amount') or row.get('TransAmount') or '0').strip().replace(',', ''))
                sender_name = (row.get('Sender Name') or row.get('FirstName') or '').strip()
                date_str = (row.get('Date') or row.get('TransTime') or '').strip()
                if not receipt or PaybillTransaction.objects.filter(receipt_number=receipt).exists():
                    if receipt: results['duplicates'] += 1
                    continue
                try: transaction_date = datetime.strptime(date_str, '%Y%m%d%H%M%S')
                except:
                    try: transaction_date = datetime.strptime(date_str, '%d/%m/%Y %H:%M:%S')
                    except: transaction_date = timezone.now()
                txn = PaybillTransaction.objects.create(
                    receipt_number=receipt, sender_phone=sender_phone, sender_name=sender_name,
                    account_ref=account_ref, amount=amount,
                    transaction_date=timezone.make_aware(transaction_date) if transaction_date.tzinfo is None else transaction_date,
                    status='UNMATCHED'
                )
                matched = False
                try:
                    profile = UserProfiles.objects.get(national_id=account_ref)
                    loan = Loans.objects.filter(user=profile.user, status__in=['ACTIVE', 'OVERDUE']).order_by('created_at').first()
                    if loan:
                        _record_repayment(txn, loan, profile.user, 'NATIONAL_ID', user)
                        results['matched_national_id'] += 1
                        matched = True
                except: pass
                if not matched and sender_phone:
                    norm = sender_phone.replace('+', '').strip()
                    if norm.startswith('254'): norm = '0' + norm[3:]
                    try:
                        customer = Users.objects.get(phone=norm)
                        loan = Loans.objects.filter(user=customer, status__in=['ACTIVE', 'OVERDUE']).order_by('created_at').first()
                        if loan:
                            _record_repayment(txn, loan, customer, 'PHONE', user)
                            results['matched_phone'] += 1
                            matched = True
                    except: pass
                if not matched: results['unmatched'] += 1
            except Exception as e: results['errors'].append(str(e))
        return Response({"message": "Statement processed", "results": results})

class AssignTransactionView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        txn_id, loan_id = request.data.get('transaction_id'), request.data.get('loan_id')
        if not txn_id or not loan_id: return Response({"error": "transaction_id and loan_id required"}, status=400)
        from ..models import PaybillTransaction
        try:
            txn = PaybillTransaction.objects.get(id=txn_id, status='UNMATCHED')
            loan = Loans.objects.get(id=loan_id, status__in=['ACTIVE', 'OVERDUE'])
        except: return Response({"error": "Transaction or Loan not found/active"}, status=404)
        _record_repayment(txn, loan, loan.user, 'MANUAL', request.user)
        return Response({"message": "Transaction assigned successfully"})

class UnmatchedTransactionsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        is_owner = getattr(user, 'is_owner', False)
        is_super = getattr(user, 'is_super_admin', False)
        role = getattr(user, 'role', '')
        
        # Check if user has permission to see unmatched transactions
        if role not in ['ADMIN', 'FINANCIAL_OFFICER'] and not is_owner and not is_super:
             return Response({"error": "Unauthorized"}, status=403)

        from ..models import PaybillTransaction
        from ..serializers import PaybillTransactionSerializer
        since = request.query_params.get('since')
        if since:
            return Response({"new_count": PaybillTransaction.objects.filter(status='UNMATCHED', created_at__gt=since).count()})
        txns = PaybillTransaction.objects.filter(status='UNMATCHED').order_by('transaction_date')
        return Response(PaybillTransactionSerializer(txns, many=True).data)
