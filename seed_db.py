import os
import django
import uuid
import bcrypt
from datetime import datetime, date

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "loan_system_project.settings")
django.setup()

from apps.models import Admins, Users, LoanProducts, Loans


def seed_data():
    print("Seeding database...")

    # 1. Create Admins for different roles
    pw_hash = bcrypt.hashpw("27580072@willy".encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )

    admins_data = [
        {"full_name": "Admin User", "email": "admin@loans.com", "role": "ADMIN"},
        {"full_name": "Manager Jane", "email": "manager@loans.com", "role": "MANAGER"},
        {
            "full_name": "Finance Mike",
            "email": "finance@loans.com",
            "role": "FINANCE_OFFICER",
        },
        {
            "full_name": "Field Officer Sam",
            "email": "field@loans.com",
            "role": "FIELD_OFFICER",
        },
    ]

    for data in admins_data:
        Admins.objects.get_or_create(
            email=data["email"],
            defaults={
                "id": uuid.uuid4(),
                "full_name": data["full_name"],
                "role": data["role"],
                "password_hash": pw_hash,
                "is_verified": True,
                "is_blocked": False,
                "created_at": datetime.now(),
            },
        )

    # 2. Add Loan Products (Updating for Kirinyaga 5-8 weeks cycle)
    products_data = [
        {"name": "M-Pawa Kirinyaga", "min": 2000, "max": 10000, "rate": 5, "weeks": 5},
        {
            "name": "Standard Business",
            "min": 10000,
            "max": 50000,
            "rate": 7,
            "weeks": 8,
        },
        {"name": "Emergency Relief", "min": 500, "max": 2000, "rate": 10, "weeks": 4},
    ]

    products = []
    for data in products_data:
        p, _ = LoanProducts.objects.get_or_create(
            name=data["name"],
            defaults={
                "id": uuid.uuid4(),
                "min_amount": data["min"],
                "max_amount": data["max"],
                "interest_rate": data["rate"],
                "duration_weeks": data["weeks"],
                "created_at": datetime.now(),
            },
        )
        products.append(p)

    # 3. Add Demo Customers (Users)
    users_data = [
        {"name": "John Doe", "phone": "0711111111", "email": "john@gmail.com"},
        {"name": "Alice Smith", "phone": "0722222222", "email": "alice@gmail.com"},
        {"name": "Robert Maina", "phone": "0733333333", "email": "robert@gmail.com"},
    ]

    users = []
    for data in users_data:
        u, _ = Users.objects.get_or_create(
            phone=data["phone"],
            defaults={
                "id": uuid.uuid4(),
                "full_name": data["name"],
                "email": data["email"],
                "is_verified": True,
                "created_at": datetime.now(),
            },
        )
        users.append(u)

    # 4. Add Demo Loans
    if products and users:
        loan_data = [
            {"user": users[0], "prod": products[0], "amt": 5000, "status": "APPROVED"},
            {"user": users[1], "prod": products[1], "amt": 100000, "status": "PENDING"},
            {"user": users[2], "prod": products[2], "amt": 2000, "status": "REPAID"},
        ]

        for data in loan_data:
            Loans.objects.get_or_create(
                user=data["user"],
                loan_product=data["prod"],
                principal_amount=data["amt"],
                defaults={
                    "id": uuid.uuid4(),
                    "interest_rate": data["prod"].interest_rate,
                    "duration_months": data["prod"].duration_months,
                    "status": data["status"],
                    "created_at": datetime.now(),
                },
            )

    print("Seeding complete! Logins available:")
    print("Admin: admin@loans.com / 27580072@willy")
    print("Manager: manager@loans.com / 27580072@willy")
    print("Finance: finance@loans.com / 27580072@willy")


if __name__ == "__main__":
    seed_data()
