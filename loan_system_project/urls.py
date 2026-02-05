from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


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


urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),  # Keep django admin if needed
    path("api/", include("apps.urls")),
]
