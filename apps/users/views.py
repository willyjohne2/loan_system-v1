from rest_framework import views, permissions, generics, status
from rest_framework.response import Response
from django.db import models
from django.utils import timezone
from ..models import (
    Users, 
    UserProfiles, 
    Loans, 
    AuditLogs
)
from ..serializers import (
    UserSerializer, 
    UserProfileSerializer,
    LoanSerializer,
    CustomerDraftSerializer
)
from ..utils.security import log_action, get_client_ip, get_filtered_queryset

class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    from rest_framework import parsers
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        return get_filtered_queryset(self.request.user, Users.objects.select_related("profile", "created_by"), 'profile__branch_fk').order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        user_role = getattr(user, "role", "STAFF")
        if user_role not in ["FIELD_OFFICER", "MANAGER"] and not getattr(user, "god_mode_enabled", False):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Field Officers and Managers can register new customers. High-level accounts must use God Mode.")
            
        created_by = user if (user and user.is_authenticated) else None
        serializer.save(created_by=created_by)

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    from rest_framework import parsers
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Users.objects.none()
            
        # Super Admins and Owners can see everyone
        if getattr(user, "is_super_admin", False) or getattr(user, "is_owner", False) or user.role == "OWNER":
            return Users.objects.all()

        if hasattr(user, "role") and user.role == "MANAGER":
            # Managers can see users in their branch
            if user.branch_fk:
                return Users.objects.filter(profile__branch_fk=user.branch_fk)
            elif user.branch:
                return Users.objects.filter(profile__branch=user.branch)
            return Users.objects.none()
        elif hasattr(user, "role") and user.role == "FIELD_OFFICER":
            return Users.objects.filter(created_by=user)
            
        return Users.objects.all()

    def perform_destroy(self, instance):
        has_outstanding = Loans.objects.filter(
            user=instance,
            status__in=["VERIFIED", "APPROVED", "DISBURSED", "ACTIVE", "OVERDUE", "DEFAULTED"],
        ).exists()
        if has_outstanding:
            from rest_framework import serializers
            raise serializers.ValidationError({"error": "Cannot lock/delete a customer with an active or outstanding loan portfolio."})
        instance.is_locked = True
        instance.save()
        if self.request.user and self.request.user.is_authenticated:
            ip = get_client_ip(self.request)
            AuditLogs.objects.create(admin=self.request.user, action="LOCKED_CUSTOMER", log_type="MANAGEMENT", table_name="users", record_id=instance.id, new_data={"is_locked": True}, ip_address=ip)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        ip = get_client_ip(self.request)
        if "phone" in serializer.validated_data and serializer.validated_data["phone"] != instance.phone:
            has_verified_loans = Loans.objects.filter(user=instance, status__in=["VERIFIED", "APPROVED", "DISBURSED", "ACTIVE", "OVERDUE", "DEFAULTED", "REPAID"]).exists()
            if has_verified_loans:
                from rest_framework import serializers
                raise serializers.ValidationError({"phone": "Phone number cannot be changed once a customer has a verified or active loan for security reasons."})
        old_data = {field: str(getattr(instance, field)) for field in serializer.validated_data}
        updated_instance = serializer.save()
        AuditLogs.objects.create(admin=user, action="UPDATE_CUSTOMER", log_type="MANAGEMENT", table_name="users", record_id=instance.id, old_data=old_data, new_data={k: str(v) for k, v in serializer.validated_data.items()}, ip_address=ip)

class CheckUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q")
        if not query:
            return Response({"error": "Query parameter 'q' (ID or Phone) is required"}, status=400)
        import re
        user = None
        clean_q = re.sub(r"\D", "", query)
        if clean_q:
            variants = [clean_q]
            if clean_q.startswith("254") and len(clean_q) > 10:
                variants.append("0" + clean_q[3:])
            elif clean_q.startswith("0") and len(clean_q) == 10:
                variants.append("254" + clean_q[1:])
            elif (clean_q.startswith("7") or clean_q.startswith("1")) and len(clean_q) == 9:
                variants.append("0" + clean_q)
                variants.append("254" + clean_q)
            user = Users.objects.filter(phone__in=variants).first() or Users.objects.filter(profile__national_id=query).first()
        else:
            user = Users.objects.filter(profile__national_id=query).first()
        if not user:
            return Response({"found": False})
        outstanding_loan = Loans.objects.filter(user=user, status__in=["UNVERIFIED", "VERIFIED", "PENDING", "AWARDED", "ACTIVE", "OVERDUE"]).last()
        return Response({"found": True, "user": UserSerializer(user).data, "has_outstanding_loan": outstanding_loan is not None, "outstanding_loan": (LoanSerializer(outstanding_loan).data if outstanding_loan else None)})

class UserProfileListCreateView(generics.ListCreateAPIView):
    queryset = UserProfiles.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]

class CustomerDraftListCreateView(generics.ListCreateAPIView):
    serializer_class = CustomerDraftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from ..models import CustomerDraft
        return CustomerDraft.objects.filter(created_by=self.request.user, is_completed=False).order_by("-updated_at")

    def perform_create(self, serializer):
        draft = serializer.save(created_by=self.request.user)
        log_action(self.request.user, f"Saved customer draft: {draft.incomplete_reason}", "customer_drafts", draft.id, log_type="DRAFT", new_data=serializer.data)

class CustomerDraftDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerDraftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from ..models import CustomerDraft
        return CustomerDraft.objects.filter(created_by=self.request.user)

    def perform_update(self, serializer):
        draft = serializer.save()
        log_action(self.request.user, f"Updated customer draft: {draft.incomplete_reason}", "customer_drafts", draft.id, log_type="DRAFT", new_data=serializer.data)
