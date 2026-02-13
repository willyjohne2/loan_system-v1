from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.conf import settings
from .models import Admins


class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get("user_id") or validated_token.get("sub")
            if not user_id:
                return None

            try:
                user = Admins.objects.get(id=user_id)
                # Check if account is blocked/deactivated or locked
                from django.utils import timezone

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
