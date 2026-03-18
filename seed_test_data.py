"""
Run with: python seed_test_data.py
Creates test accounts for simulation testing
"""
import os, django, uuid, bcrypt
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'loan_system_project.settings')
django.setup()

from apps.models import Admins, Branch, SystemCapital
from django.utils import timezone

def hash_password(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

# Ensure capital exists
cap, _ = SystemCapital.objects.get_or_create(
    name="Simulation Capital",
    defaults={"id": uuid.uuid4(), "balance": 500000.00}
)
if cap.balance < 10000:
    cap.balance = 500000.00
    cap.save()
print(f"✅ Capital: KES {cap.balance:,.2f}")

# Ensure branch exists
branch, _ = Branch.objects.get_or_create(
    name="Kagio",
    defaults={"is_active": True}
)
print(f"✅ Branch: {branch.name}")

# Create test accounts
test_accounts = [
    {"full_name": "Test Manager", "email": "manager@test.com", "role": "MANAGER", "branch_fk": branch},
    {"full_name": "Test Finance", "email": "finance@test.com", "role": "FINANCIAL_OFFICER"},
    {"full_name": "Test Field Officer", "email": "field@test.com", "role": "FIELD_OFFICER", "branch_fk": branch},
    {"full_name": "Test Admin", "email": "admin@test.com", "role": "ADMIN"},
]

for acc in test_accounts:
    obj, created = Admins.objects.get_or_create(
        email=acc["email"],
        defaults={
            "id": uuid.uuid4(),
            "full_name": acc["full_name"],
            "role": acc["role"],
            "password_hash": hash_password("Test1234!"),
            "is_verified": True,
            "branch_fk": acc.get("branch_fk"),
            "branch": branch.name if acc.get("branch_fk") else None,
        }
    )
    status = "created" if created else "already exists"
    print(f"{'✅' if created else '⚠️'} {acc['role']} ({acc['email']}) — {status}")

print("\n📋 Test Credentials (password for all: Test1234!)")
print("Manager:        manager@test.com")
print("Finance:        finance@test.com")
print("Field Officer:  field@test.com")
print("Admin:          admin@test.com")
