import sys
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'loan_system_project.settings')
django.setup()

from django.urls import get_resolver
resolver = get_resolver()

def list_urls(urlpatterns, prefix=''):
    for entry in urlpatterns:
        if hasattr(entry, 'url_patterns'):
            list_urls(entry.url_patterns, prefix + str(entry.pattern))
        else:
            print(prefix + str(entry.pattern))

list_urls(resolver.url_patterns)
