"""Run one autonomous UI analysis and recommendation cycle for active users."""

from __future__ import annotations

import json
import sys
from datetime import timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def main() -> int:
    try:
        from backend.database import SessionLocal, init_db
        from backend.models.ui_autonomy import UiBehaviorSignal
        from backend.models.user import User
        from backend.services.ui_autonomy_service import build_overview, refresh_recommendations_for_user, _now
    except Exception as error:  # pylint: disable=broad-except
        print(
            json.dumps(
                {
                    "status": "blocked",
                    "reason": str(error),
                    "hint": "Load the same backend environment variables used by run.py before scheduling this script.",
                },
                indent=2,
            )
        )
        return 1

    init_db()
    db = SessionLocal()
    try:
        window_start = _now() - timedelta(days=14)
        user_ids = [
            row[0]
            for row in (
                db.query(UiBehaviorSignal.user_id)
                .filter(UiBehaviorSignal.created_at >= window_start)
                .distinct()
                .all()
            )
        ]
        decisions: list[dict] = []
        for user_id in user_ids:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                continue
            cycle = refresh_recommendations_for_user(db, current_user=user)
            overview = build_overview(db, current_user=user)
            decisions.append(
                {
                    "user_id": user.id,
                    "email": user.email,
                    "top_routes": overview["summary"]["top_routes"][:3],
                    "created": cycle["created"],
                    "updated": cycle["updated"],
                    "resolved": cycle["resolved"],
                    "preference_changed": cycle["preference_changed"],
                    "open_recommendations": overview["summary"]["open_recommendations"],
                }
            )

        print(
            json.dumps(
                {
                    "status": "completed",
                    "users_processed": len(decisions),
                    "window_days": 14,
                    "decisions": decisions,
                },
                indent=2,
                default=str,
            )
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
