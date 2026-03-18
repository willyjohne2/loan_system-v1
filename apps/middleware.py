from django.http import HttpResponseForbidden
from .utils.encryption import get_setting

class IPWhitelistMiddleware:
    """
    Middleware to restrict access to the loan system by IP address.
    Checks if the visitor IP is in the whitelist stored in SecureSettings.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # FIX 4: Only enforce whitelist for Admin paths
        path = request.path
        if not path.startswith('/api/admins/'):
             return self.get_response(request)

        whitelist_raw = get_setting('ip_whitelist', '')
        
        # If whitelist is empty, we allow everyone (default)
        if not whitelist_raw:
            return self.get_response(request)
            
        # Parse IPs (comma-separated)
        whitelist = [ip.strip() for ip in whitelist_raw.split(',') if ip.strip()]
        
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
            
        # Check against whitelist
        if ip not in whitelist:
            # Allow 'localhost' and '127.0.0.1' for development if requested
            if ip in ['127.0.0.1', 'localhost']:
                 return self.get_response(request)

            return HttpResponseForbidden(f"Access Denied: IP {ip} is not whitelisted.")

        return self.get_response(request)
