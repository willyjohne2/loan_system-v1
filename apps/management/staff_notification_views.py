from rest_framework import generics, views, permissions, status
from rest_framework.response import Response
from ..models import StaffNotification
from django.utils import timezone

class StaffNotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'role'):
            return Response([])
        notifications = StaffNotification.objects.filter(
            recipient=user
        ).order_by('-created_at')[:50]
        data = [{
            'id': str(n.id),
            'type': n.notification_type,
            'priority': n.priority,
            'title': n.title,
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat(),
        } for n in notifications]
        unread_count = StaffNotification.objects.filter(recipient=user, is_read=False).count()
        return Response({'notifications': data, 'unread_count': unread_count})

class StaffNotificationMarkReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        notif_id = request.data.get('id')
        if notif_id:
            StaffNotification.objects.filter(recipient=user, id=notif_id).update(is_read=True)
        else:
            StaffNotification.objects.filter(recipient=user, is_read=False).update(is_read=True)
        return Response({'message': 'Marked as read.'})
