from django.db import migrations
import uuid

def seed_capital(apps, schema_editor):
    SystemCapital = apps.get_model('apps', 'SystemCapital')
    cap, created = SystemCapital.objects.get_or_create(
        name="Simulation Capital",
        defaults={"id": uuid.uuid4(), "balance": 500000.00}
    )
    if not created and cap.balance == 0:
        cap.balance = 500000.00
        cap.save()

class Migration(migrations.Migration):

    dependencies = [
        ('apps', '0038_admins_is_primary_owner_admins_ownership_granted_at_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_capital),
    ]
