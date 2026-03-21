from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_super_admin", False)
        )


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "ADMIN" or request.user.is_owner or request.user.is_super_admin)
        )


class IsOwnerOrCoOwner(permissions.BasePermission):
    """
    Allows access only to users with role 'OWNER' or 'CO_OWNER'.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "OWNER" or request.user.role == "CO_OWNER" or getattr(request.user, "is_owner", False))
        )


class IsManagerUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "MANAGER"
        )


class IsFinancialOfficer(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "FINANCIAL_OFFICER"
        )


class IsFieldOfficer(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "FIELD_OFFICER"
        )


class RoleBasedPermission(permissions.BasePermission):
    """
    General purpose role based permission.
    Example usages:
    permission_classes = [RoleBasedPermission]
    required_roles = ['ADMIN', 'MANAGER']
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        required_roles = getattr(view, "required_roles", None)
        if not required_roles:
            return True

        return request.user.role in required_roles or request.user.is_super_admin
