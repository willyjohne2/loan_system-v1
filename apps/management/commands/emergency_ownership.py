"""
EMERGENCY OWNERSHIP MANAGEMENT COMMAND
Used when no owners exist or all owners are locked out.
Usage:
  python manage.py emergency_ownership --email admin@example.com
  python manage.py emergency_ownership --email newowner@example.com --create --password yourpassword
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
import bcrypt
import uuid
import os

class Command(BaseCommand):
    help = 'Emergency: Grant ownership to an account when no owners exist or all are locked out'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='Email of account to grant ownership')
        parser.add_argument('--create', action='store_true', help='Create new account if email does not exist')
        parser.add_argument('--password', type=str, help='Password for new account (required with --create)')

    def handle(self, *args, **options):
        from apps.models import Admins, AuditLogs

        email = options['email']
        
        try:
            admin = Admins.objects.get(email=email)
            admin.is_owner = True
            admin.god_mode_enabled = True
            admin.ownership_granted_at = timezone.now()
            admin.save()
            self.stdout.write(self.style.SUCCESS(f'Emergency ownership granted to existing account: {email}'))
        except Admins.DoesNotExist:
            if options['create']:
                if not options['password']:
                    self.stderr.write('--password is required when using --create')
                    return
                password_hash = bcrypt.hashpw(options['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                admin = Admins.objects.create(
                    id=uuid.uuid4(),
                    full_name='Emergency Owner',
                    email=email,
                    role='ADMIN',
                    password_hash=password_hash,
                    is_owner=True,
                    is_verified=True,
                    god_mode_enabled=True,
                    ownership_granted_at=timezone.now(),
                )
                self.stdout.write(self.style.SUCCESS(f'Emergency owner account created: {email}'))
            else:
                self.stderr.write(f'No account found with email {email}. Use --create to create one.')
                return

        # Always log the emergency access
        AuditLogs.objects.create(
            admin=admin,
            action=f"EMERGENCY OWNERSHIP GRANTED to {email} via management command",
            log_type="SECURITY",
            table_name="admins",
            record_id=admin.id,
            is_owner_log=True,
            new_data={"emergency": True, "email": email, "timestamp": str(timezone.now())}
        )
        self.stdout.write(self.style.WARNING('Emergency access has been logged in audit trail.'))
