"""Daily maintenance tasks: token cleanup and plan downgrades."""

from __future__ import annotations

from datetime import datetime, timezone

from backend.database import SessionLocal
from backend.models.report import TokenBlacklist
from backend.services.billing_manager import apply_due_downgrades


def run() -> dict[str, int]:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        deleted = (
            db.query(TokenBlacklist)
            .filter(TokenBlacklist.expires_at <= now)
            .delete(synchronize_session=False)
        )
        downgraded = apply_due_downgrades(db)
        db.commit()
        return {"token_blacklist_deleted": int(deleted or 0), "downgrades_applied": int(downgraded)}
    finally:
        db.close()


if __name__ == "__main__":
    result = run()
    print(result)
