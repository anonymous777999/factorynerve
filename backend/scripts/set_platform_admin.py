"""Grant platform admin access to a user via direct SQL."""

# Run from D:\DPR APP\DPR.ai:
# python -m backend.scripts.set_platform_admin your@email.com

import sys

from sqlalchemy import text

from backend.database import SessionLocal


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m backend.scripts.set_platform_admin your@email.com")
        return 1

    email = sys.argv[1].strip().lower()
    if not email:
        print("User not found")
        return 1

    db = SessionLocal()
    try:
        result = db.execute(
            text("UPDATE users SET is_platform_admin = true WHERE email = :email"),
            {"email": email},
        )
        if result.rowcount == 0:
            print("User not found")
            db.commit()
            return 1

        db.commit()
        print(f"Done. Platform admin granted to {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
