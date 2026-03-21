from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Sum, Q, F
from django.db.models.functions import TruncMonth, TruncDate, TruncWeek
from datetime import timedelta
from ..models import (
    Loans,
    SystemCapital,
    Repayments,
    LedgerEntry,
    RepaymentSchedule,
    Branch,
)

class LoanAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        branch = request.query_params.get("branch") or request.query_params.get(
            "region"
        )
        
        loans = Loans.objects.all()

        if hasattr(user, "role") and user.role == "MANAGER":
            loans = loans.filter(user__profile__branch_fk=user.branch_fk)
        elif branch:
            loans = loans.filter(user__profile__branch=branch) # fallback for text search

        if hasattr(user, "role") and user.role == "FIELD_OFFICER":
            loans = loans.filter(created_by=user)

        monthly_stats = (
            loans.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("principal_amount"), count=Count("id"))
            .order_by("month")
        )

        daily_disbursements = (
            loans.filter(status="DISBURSED")
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(total=Sum("principal_amount"), count=Count("id"))
            .order_by("-date")[:30]
        )

        status_stats = loans.values("status").annotate(count=Count("id"))

        data = {
            "monthly_disbursements": [
                {
                    "month": stat["month"].strftime("%b"),
                    "amount": float(stat["total"] or 0),
                    "count": stat["count"],
                }
                for stat in monthly_stats
            ],
            "daily_disbursements": [
                {
                    "date": stat["date"].strftime("%Y-%m-%d"),
                    "amount": float(stat["total"] or 0),
                    "count": stat["count"],
                }
                for stat in daily_disbursements
            ],
            "status_breakdown": [
                {"name": stat["status"], "value": stat["count"]}
                for stat in status_stats
            ],
        }
        return Response(data)


class FinanceAnalyticsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()

        # Get Capital Balance
        capital = SystemCapital.objects.filter(name="Simulation Capital").first()
        balance = float(capital.balance) if capital else 0.0

        # Last 60 days range
        sixty_days_ago = timezone.now() - timedelta(days=60)

        # Money Out (Total Principal of Disbursed Loans - ONLY DISBURSED)
        # We include all statuses that represent funds already given to customers
        disbursed_statuses = ["DISBURSED", "ACTIVE", "OVERDUE", "CLOSED", "REPAID"]
        money_out_query = Loans.objects.filter(status__in=disbursed_statuses)
        money_out = (
            money_out_query.aggregate(total=Sum("principal_amount"))["total"] or 0
        )

        # Money In (Total amount repaid)
        money_in = Repayments.objects.aggregate(total=Sum("amount_paid"))["total"] or 0

        # Aging Report Analysis
        # 1-30 days, 31-60 days, 61-90 days, 90+ days overdue
        aging_30 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today,
                repaymentschedule__due_date__gte=today - timedelta(days=30),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )
        aging_60 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today - timedelta(days=30),
                repaymentschedule__due_date__gte=today - timedelta(days=60),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )
        aging_90 = (
            Loans.objects.filter(
                status="OVERDUE",
                repaymentschedule__due_date__lt=today - timedelta(days=60),
            )
            .distinct()
            .aggregate(total=Sum("principal_amount"))["total"]
            or 0
        )

        # Rolling 15-day window for Line Charts (7 days history, Today, 7 days future)
        seven_days_ago = today - timedelta(days=7)
        seven_days_future = today + timedelta(days=7)

        # Actuals (History)
        actual_disbursements = (
            Loans.objects.filter(
                status__in=disbursed_statuses,
                created_at__date__gte=seven_days_ago,
                created_at__date__lte=today,
            )
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(amount=Sum("principal_amount"))
        )

        actual_repayments = (
            Repayments.objects.filter(
                payment_date__date__gte=seven_days_ago, payment_date__date__lte=today
            )
            .annotate(date=TruncDate("payment_date"))
            .values("date")
            .annotate(amount=Sum("amount_paid"))
        )

        # Projections (Future Schedules)
        scheduled_repayments = (
            RepaymentSchedule.objects.filter(
                due_date__gt=today, due_date__lte=seven_days_future
            )
            .values("due_date")
            .annotate(amount=Sum("amount_due"))
        )

        # Build timeline map
        timeline_map = {}
        curr = seven_days_ago
        while curr <= seven_days_future:
            d_str = curr.strftime("%Y-%m-%d")
            timeline_map[d_str] = {
                "date": d_str,
                "disbursement": 0.0,
                "repayment": 0.0,
                "is_future": curr > today,
                "label": "TODAY" if curr == today else curr.strftime("%d %b"),
            }
            curr += timedelta(days=1)

        for item in actual_disbursements:
            d_str = str(item["date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["disbursement"] = float(item["amount"] or 0)

        for item in actual_repayments:
            d_str = str(item["date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["repayment"] = float(item["amount"] or 0)

        for item in scheduled_repayments:
            # schedule due_date is a date object
            d_str = str(item["due_date"])[:10]
            if d_str in timeline_map:
                timeline_map[d_str]["repayment"] += float(item["amount"] or 0)

        # Weekly History for BarCharts (Last 10 weeks)
        ten_weeks_ago = today - timedelta(weeks=10)

        weekly_disbursed_query = (
            Loans.objects.filter(
                status__in=disbursed_statuses, created_at__date__gte=ten_weeks_ago
            )
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(amount=Sum("principal_amount"))
            .order_by("week")
        )

        weekly_repaid_query = (
            Repayments.objects.filter(payment_date__date__gte=ten_weeks_ago)
            .annotate(week=TruncWeek("payment_date"))
            .values("week")
            .annotate(amount=Sum("amount_paid"))
            .order_by("week")
        )

        # Pre-fill last 10 weeks
        weekly_disbursed = []
        weekly_repaid = []

        # Create a map of existing data for quick lookup
        disp_map = {
            str(x["week"])[:10]: float(x["amount"]) for x in weekly_disbursed_query
        }
        repay_map = {
            str(x["week"])[:10]: float(x["amount"]) for x in weekly_repaid_query
        }

        for i in range(9, -1, -1):  # Last 10 weeks
            target_date = today - timedelta(weeks=i)
            # Find the start of the week for this date
            start_of_week = target_date - timedelta(days=target_date.weekday())
            w_key = start_of_week.strftime("%Y-%m-%d")

            weekly_disbursed.append(
                {
                    "week": start_of_week.strftime("%d %b"),
                    "amount": disp_map.get(w_key, 0.0),
                }
            )
            weekly_repaid.append(
                {
                    "week": start_of_week.strftime("%d %b"),
                    "amount": repay_map.get(w_key, 0.0),
                }
            )

        # Trial Balance Context (Grouped Capital/Assets/Liabilities)
        trial_balance = [
            {"account": "Simulation Capital", "debit": 0, "credit": balance},
            {
                "account": "Loan Portfolio (Principal)",
                "debit": float(money_out),
                "credit": 0,
            },
            {"account": "Interest Receivable", "debit": 0, "credit": 0},
            {"account": "Repayments Pool", "debit": float(money_in), "credit": 0},
        ]

        # Collection Log (Last 50 entries)
        collections = Repayments.objects.select_related("loan__user").order_by(
            "-payment_date"
        )[:50]
        collection_log = [
            {
                "id": str(r.id),
                "customer": r.loan.user.full_name,
                "amount": float(r.amount_paid),
                "date": r.payment_date.strftime("%Y-%m-%d %H:%M"),
                "method": r.payment_method,
                "reference": r.reference_code,
            }
            for r in collections
        ]

        # Cashbook (Last 100 Ledger entries)
        ledger_entries = LedgerEntry.objects.select_related("loan__user").order_by(
            "-created_at"
        )[:100]
        cashbook = [
            {
                "id": str(entry.id),
                "date": entry.created_at.strftime("%Y-%m-%d %H:%M"),
                "type": entry.entry_type,
                "amount": float(entry.amount),
                "customer": (
                    entry.loan.user.full_name
                    if entry.loan and entry.loan.user
                    else "SYSTEM"
                ),
                "reference": entry.reference_id or "N/A",
                "note": entry.note or "",
            }
            for entry in ledger_entries
        ]

        return Response(
            {
                "balance": balance,
                "money_out": float(money_out),
                "money_in": float(money_in),
                "history": list(timeline_map.values()),
                "weekly_disbursed": weekly_disbursed,
                "weekly_repaid": weekly_repaid,
                "trial_balance": trial_balance,
                "cashbook": cashbook,
                "aging_report": {
                    "days_30": float(aging_30),
                    "days_60": float(aging_60),
                    "days_90": float(aging_90),
                },
                "collection_log": collection_log,
            }
        )
