from rest_framework import generics, permissions
from rest_framework.response import Response
from ..models import Notifications
from ..serializers import NotificationSerializer

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # If the logged-in user is an Admin, they don't have notifications in this table
        # Notifications table is specifically for the 'Users' model (customers)
        if hasattr(user, "role"):  # Admins have a 'role' field
            return Notifications.objects.none()
        return Notifications.objects.filter(user=user).order_by("-created_at")


class NotificationUpdateView(generics.UpdateAPIView):
    queryset = Notifications.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
