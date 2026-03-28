from ..models import AuditLogs
from django.utils import timezone


def log_action(
    admin,
    action,
    table_name,
    record_id=None,
    old_data=None,
    new_data=None,
    log_type="GENERAL",
    ip_address=None,
    god_mode_active=False,
):
    """
    Utility function to log actions in the system.
    """

    def prepare_json_data(data):
        if data is None:
            return None
        import json
        from django.core.serializers.json import DjangoJSONEncoder

        # Use Django's encoder to handle UUIDs, Decimals, etc.
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder))

    # Protect Owner identity if God Mode is active
    if god_mode_active and admin:
        user_email = admin.email
        admin = None  # Never link the log to the owner account
        action = f"[GOD MODE] {action}"
        prepared_new_data = prepare_json_data(new_data) or {}
        prepared_new_data["performed_by_email"] = user_email
        new_data = prepared_new_data
    else:
        new_data = prepare_json_data(new_data)

    AuditLogs.objects.create(
        admin=admin,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_data=prepare_json_data(old_data),
        new_data=new_data,
        log_type=log_type,
        ip_address=ip_address,
    )


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip


def get_filtered_queryset(user, queryset, branch_field='branch_fk', request=None):
    """
    Returns queryset filtered by user's role and branch.
    Supports basic date filtering via request query params: Today, Yesterday, Last 3 Days.
    """
    from rest_framework.exceptions import PermissionDenied
    from django.utils import timezone
    from datetime import timedelta
    
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    
    # 1. Base Role/Branch Filtering Logic
    is_owner = getattr(user, 'is_owner', False) or getattr(user, 'is_primary_owner', False) or user.role == 'OWNER'
    is_super = getattr(user, 'is_super_admin', False)

    if is_owner or is_super:
        filtered_qs = queryset
    elif user.role == 'ADMIN':
        filtered_qs = queryset
    elif user.role == 'MANAGER':
        if not user.branch_fk:
            raise PermissionDenied("No branch assigned.")
        filtered_qs = queryset.filter(**{branch_field: user.branch_fk})
    elif user.role == 'FIELD_OFFICER':
        if not user.branch_fk:
            raise PermissionDenied("No branch assigned.")
        filtered_qs = queryset.filter(**{branch_field: user.branch_fk})
    elif user.role == 'FINANCIAL_OFFICER' or user.role == 'FINANCE_OFFICER':
        filtered_qs = queryset  # Finance sees all branches
    else:
        # No valid role — log and deny
        from ..models import AuditLogs
        AuditLogs.objects.create(
            admin=user,
            action=f"SECURITY: User {user.email} attempted data access with no valid role",
            log_type="SECURITY",
            table_name="system",
            is_owner_log=True,
        )
        raise PermissionDenied("No valid role. Access denied.")

    # 2. Add Date Filtering if 'date_range' is in query params
    if request:
        if 'date_range' in request.query_params:
            dr = request.query_params.get('date_range')
            now = timezone.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if dr == 'today':
                filtered_qs = filtered_qs.filter(created_at__gte=today_start)
            elif dr == 'yesterday':
                yesterday_start = today_start - timedelta(days=1)
                filtered_qs = filtered_qs.filter(created_at__gte=yesterday_start, created_at__lt=today_start)
            elif dr == 'last_3_days':
                three_days_ago = today_start - timedelta(days=2)
                filtered_qs = filtered_qs.filter(created_at__gte=three_days_ago)
            elif dr == 'last_7_days':
                seven_days_ago = today_start - timedelta(days=6)
                filtered_qs = filtered_qs.filter(created_at__gte=seven_days_ago)

        # 3. Add Branch Filtering if 'branch' is in query params
        if 'branch' in request.query_params:
            branch_id = request.query_params.get('branch')
            if branch_id and branch_id != 'all':
                # Determine which field to use for branching based on model context
                # users uses 'profile__branch_fk'
                # loans uses 'user__profile__branch_fk'
                # admins uses 'branch_fk'
                filtered_qs = filtered_qs.filter(**{branch_field: branch_id})
        # 4. Handle sorting if 'ordering' is in query params
        if 'ordering' in request.query_params:
            ordering = request.query_params.get('ordering')
            if ordering:
                filtered_qs = filtered_qs.order_by(ordering)
            
    return filtered_qs
