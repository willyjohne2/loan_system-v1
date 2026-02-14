from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static


def home(request):
    return JsonResponse(
        {
            "message": "Loan System API is running",
            "endpoints": {
                "auth": "/api/auth/login/",
                "admins": "/api/admins/",
                "users": "/api/users/",
            },
        }
    )


from django.views.static import serve
from django.urls import re_path

urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),
    path("api/", include("apps.urls")),
    # Serve media files in production (temporary fix for Render)
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
]
