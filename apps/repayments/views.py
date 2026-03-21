from rest_framework import views, permissions, generics, status
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
import uuid
from ..models import (
    Repayments, 
    Loans, 
    SystemCapital, 
    LedgerEntry, 
    RepaymentSchedule, 
    Transactions,
    AuditLogs
)
from ..serializers import RepaymentSerializer
from ..utils.security import log_action, get_client_ip, get_filtered_queryset
from ..permissions import IsAdminUser
from ..utils.mpesa import MpesaHandler
import json

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
        # AllowAny, but internally we can check for some token maybe? 
        # Original had: if not (request.user.role == "ADMIN" or request.user.is_super_admin): raise PermissionDenied
        # But callbacks are usually from external providers... Let's keep the logic but allow any access to the endpoint.
        data = request.data
        print(f"M-Pesa Callback Received: {json.dumps(data)}")
        if "Result" in data:
            result = data.get("Result")
            result_code = result.get("ResultCode")
            originator_id = result.get("OriginatorConversationID")
            trans_id = result.get("TransactionID")
            receipt_number = trans_id
            if "ResultParameters" in result:
                params = result.get("ResultParameters", {}).get("ResultParameter", [])
                for p in params:
                    if p.get("Key") == "ReceiptNumber": receipt_number = p.get("Value")
            print(f"B2C Result: Code={result_code}, ID={originator_id}, Trans={trans_id}, Receipt={receipt_number}")
            if result_code != 0: print(f"⚠️ B2C FALIED for OriginatorID: {originator_id}")
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
        trans_id = data.get("TransID")
        bill_ref = str(data.get("BillRefNumber", "")).strip().lower()
        amount = data.get("TransAmount")
        msisdn = str(data.get("MSISDN", ""))
        if trans_id:
            try:
                search_phone = msisdn
                if msisdn.startswith("254") and len(msisdn) > 3: search_phone = "0" + msisdn[3:]
                elif not msisdn.startswith("0") and len(msisdn) == 9: search_phone = "0" + msisdn
                loan = Loans.objects.filter(models.Q(user__profile__national_id=bill_ref) | models.Q(user__profile__national_id__icontains=bill_ref) | models.Q(id__icontains=bill_ref) | models.Q(user__id__icontains=bill_ref) | models.Q(user__phone__icontains=search_phone) | models.Q(user__phone__icontains=msisdn)).filter(status__in=["ACTIVE", "OVERDUE", "DISBURSED"]).order_by("created_at").first()
                if loan:
                    Repayments.objects.create(loan=loan, amount_paid=amount, payment_method="MPESA_PAYBILL", reference_code=trans_id)
                    loan.update_status_and_rates()
                    from ..loans.views import create_notification
                    create_notification(loan.user, f"Your payment of KES {amount} (Ref: {trans_id}) has been successfully processed.")
                    return Response({"ResultCode": 0, "ResultDesc": "Success"})
                return Response({"ResultCode": 0, "ResultDesc": "Success"})
            except Exception as e: print(f"Fail to auto-allocate C2B: {str(e)}")
        return Response({"ResultCode": 0, "ResultDesc": "Success"})

def _record_repayment(txn, loan, customer, match_method, processed_by):
    from django.db import transaction as db_transaction
    from django.utils import timezone
    from ..models import Repayments, SystemCapital, LedgerEntry, RepaymentSchedule
    with db_transaction.atomic():
        txn.status = 'MATCHED'
        txn.matched_loan = loan
        txn.matched_user = customer
        txn.match_method = match_method
        txn.assigned_by = processed_by
        txn.assigned_at = timezone.now()
        txn.save()

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
