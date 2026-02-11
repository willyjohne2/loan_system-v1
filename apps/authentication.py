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
                return user
            except (Admins.DoesNotExist, ValueError):
                # ValueError handles cases where id is not a valid UUID string
                return None
        except Exception:
            return None
