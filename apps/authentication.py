from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.conf import settings
from .models import Admins


class CustomJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)

        # FIX 3: Verify Client IP from JWT against Request IP
        token_ip = validated_token.get("client_ip")
        if token_ip:
            from .utils.security import get_client_ip
            current_ip = get_client_ip(request)
            if token_ip != current_ip:
                raise AuthenticationFailed(f"Session binding error: Token belongs to {token_ip}, but request from {current_ip}")

        return self.get_user(validated_token), validated_token

    def get_user(self, validated_token):
        try:
            user_id = validated_token.get("user_id") or validated_token.get("sub")
            if not user_id:
                return None

            try:
                user = Admins.objects.get(id=user_id)
                # Check if account is blocked/deactivated or locked
                from django.utils import timezone

                # Sync token flags to user object for easy permission checks
                user.is_owner = validated_token.get("is_owner", False)
                user.is_super_admin = validated_token.get("is_super_admin", False)

                if getattr(user, "is_blocked", False):
                    raise AuthenticationFailed("This account has been deactivated.")

                if user.lockout_until and user.lockout_until > timezone.now():
                    raise AuthenticationFailed(
                        "This account is currently locked due to too many failed login attempts."
                    )

                return user
            except (Admins.DoesNotExist, ValueError):
                # ValueError handles cases where id is not a valid UUID string
                return None
        except AuthenticationFailed as e:
            raise e
        except Exception:
            return None
