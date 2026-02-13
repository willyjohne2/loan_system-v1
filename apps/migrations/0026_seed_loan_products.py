from django.db import migrations


def seed_loan_products(apps, schema_editor):
    LoanProducts = apps.get_model("apps", "LoanProducts")
    products = [
        {
            "name": "Inuka Loan",
            "min_amount": 500.00,
            "max_amount": 5000.00,
            "interest_rate": 25.00,
            "duration_weeks": 4,
            "duration_months": 1,
        },
        {
            "name": "Jijenge Loan",
            "min_amount": 5001.00,
            "max_amount": 20000.00,
            "interest_rate": 31.25,
            "duration_weeks": 5,
            "duration_months": 1,
        },
        {
            "name": "Fadhili Loan",
            "min_amount": 20001.00,
            "max_amount": 50000.00,
            "interest_rate": 36.35,
            "duration_weeks": 6,
            "duration_months": 2,
        },
    ]

    for product in products:
        LoanProducts.objects.get_or_create(name=product["name"], defaults=product)


def remove_loan_products(apps, schema_editor):
    LoanProducts = apps.get_model("apps", "LoanProducts")
    LoanProducts.objects.filter(
        name__in=["Inuka Loan", "Jijenge Loan", "Fadhili Loan"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("apps", "0025_admins_last_login_ip_admins_lockout_until_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_loan_products, reverse_code=remove_loan_products),
    ]
