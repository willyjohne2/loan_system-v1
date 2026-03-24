from django.core.management.base import BaseCommand
from apps.utils.mpesa import MpesaHandler
import json

class Command(BaseCommand):
    help = 'Test M-Pesa connectivity and credential loading'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Testing M-Pesa Configuration...'))
        
        try:
            handler = MpesaHandler()
            
            # 1. Print Loaded Config (Masked)
            self.stdout.write(self.style.SUCCESS('\n[1] Current Configuration (Loaded from DB/Env):'))
            self.print_masked('Consumer Key', handler.consumer_key)
            self.print_masked('Consumer Secret', handler.consumer_secret)
            self.print_masked('Shortcode', handler.shortcode)
            self.print_masked('Passkey', handler.passkey)
            self.print_masked('B2C Shortcode', handler.b2c_shortcode)
            self.print_masked('Initiator Name', handler.initiator_name)
            self.stdout.write(f"Callback URL: {handler.callback_url}")
            self.stdout.write(f"Base URL: {handler.base_url}")

            # 2. Test Connection (Auth Token)
            self.stdout.write(self.style.WARNING('\n[2] Testing Connection to Safaricom (Get Auth Token)...'))
            token = handler.get_access_token()
            
            if token:
                self.stdout.write(self.style.SUCCESS(f'✅ SUCCESS! Connection Established.'))
                self.stdout.write(f'Generated Token: {token[:10]}...{token[-10:]}')
            else:
                self.stdout.write(self.style.ERROR('❌ FAILED to get Access Token.'))
                self.stdout.write('Possible causes:')
                self.stdout.write(' - Invalid Consumer Key/Secret')
                self.stdout.write(' - DNS/Network issues on server')
                self.stdout.write(' - Safaricom Sandbox is down')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ CRITICAL ERROR: {str(e)}'))

    def print_masked(self, label, value):
        if not value:
            self.stdout.write(self.style.ERROR(f"{label}: [MISSING/EMPTY]"))
            return
            
        masked = value
        if len(value) > 8:
            masked = f"{value[:4]}...{value[-4:]}"
        elif len(value) > 4:
            masked = f"{value[:2]}...{value[-2:]}"
        else:
            masked = "****"
            
        self.stdout.write(f"{label}: {masked}")
