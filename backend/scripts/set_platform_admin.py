"""Grant platform admin access to an active user.

Run:
python -m scripts.set_platform_admin user@email.com
"""

from __future__ import annotations

import sys
from collections.abc import Sequence

from starlette.requests import Request

from backend.database import SessionLocal
from backend.models.user import User
from backend.routers.settings import _write_admin_audit


def _build_system_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/system/set-platform-admin",
            "headers": [(b"user-agent", b"system-cli:set-platform-admin")],
            "client": ("system", 0),
        }
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if len(args) != 1:
        print("Usage: python -m scripts.set_platform_admin user@email.com")
        return 1

    normalized_email = args[0].strip().lower()
    if not normalized_email:
        print("Email is required.")
        return 1

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(
                User.email == normalized_email,
                User.is_active.is_(True),
            )
            .first()
        )
        if not user:
            print(f"Active user not found for email: {normalized_email}")
            return 1

        user.is_platform_admin = True
        _write_admin_audit(
            db,
            actor_id=None,
            org_id=user.org_id,
            factory_id=None,
            action="PLATFORM_ADMIN_GRANTED",
            details=f"actor=system target={user.id} email={normalized_email}",
            request=_build_system_request(),
        )
        db.commit()
        print(f"Platform admin enabled for {normalized_email} (user_id={user.id}).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
