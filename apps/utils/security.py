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
):
    """
    Utility function to log actions in the system.
    """
    AuditLogs.objects.create(
        admin=admin,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_data=old_data,
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
