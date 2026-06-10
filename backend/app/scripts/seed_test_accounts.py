"""
Seed test accounts for local workflow verification.
Safe to run multiple times — skips accounts that already exist.

Accounts created:
  admin@autostudio.local   / Admin123!   (ADMIN)
  editor@autostudio.local  / Editor123!  (EDITOR)
  user@autostudio.local    / User123!    (USER / FREE)

Run with:
  docker compose exec backend python -m app.scripts.seed_test_accounts
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.models import get_db, User, Role, Subscription, PlanTier
from app.services.auth import hash_password

ACCOUNTS = [
    {"email": "admin@autostudio.local", "name": "Test Admin", "password": "Admin123!", "role": Role.ADMIN},
    {"email": "editor@autostudio.local", "name": "Test Editor", "password": "Editor123!", "role": Role.EDITOR},
    {"email": "user@autostudio.local", "name": "Test User", "password": "User123!", "role": Role.USER},
]


def seed():
    db = next(get_db())
    for acc in ACCOUNTS:
        existing = db.query(User).filter(User.email == acc["email"]).first()
        if existing:
            print(f"  SKIP  {acc['email']} — already exists (id={existing.id})")
            continue
        user = User(
            email=acc["email"],
            name=acc["name"],
            hashed_password=hash_password(acc["password"]),
            role=acc["role"],
            is_active=True,
            is_disabled=False,
            force_password_reset=False,
        )
        db.add(user)
        db.flush()
        sub = Subscription(user_id=user.id, plan_tier=PlanTier.FREE.value, status="active")
        db.add(sub)
        print(f"  CREATED {acc['email']} ({acc['role'].value})")
    db.commit()
    db.close()
    print()
    print("=== Test Credentials ===")
    for acc in ACCOUNTS:
        print(f"  {acc['role'].value:<10} {acc['email']:<30} {acc['password']}")
    print()


if __name__ == "__main__":
    seed()
