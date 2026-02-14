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

    def prepare_json_data(data):
        if data is None:
            return None
        import json
        from django.core.serializers.json import DjangoJSONEncoder

        # Use Django's encoder to handle UUIDs, Decimals, etc.
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder))

    AuditLogs.objects.create(
        admin=admin,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_data=prepare_json_data(old_data),
        new_data=prepare_json_data(new_data),
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
