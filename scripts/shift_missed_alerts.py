"""Send WhatsApp alerts if a factory missed a shift submission."""

from __future__ import annotations

import os
from datetime import date, datetime, timezone

from dotenv import load_dotenv

from backend.database import SessionLocal
from backend.models.entry import Entry
from backend.models.factory import Factory
from backend.services.whatsapp import notify_shift_missed
from backend.utils import PROJECT_ROOT


def _cutoff_hour() -> int:
    raw = os.getenv("SHIFT_MISSED_ALERT_HOUR", "18")
    try:
        return int(raw)
    except ValueError:
        return 18


def main() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    now = datetime.now(timezone.utc)
    if now.hour < _cutoff_hour():
        print("Shift missed check skipped: before cutoff hour.")
        return
    today = date.today()
    with SessionLocal() as db:
        factories = db.query(Factory).filter(Factory.is_active.is_(True)).all()
        for factory in factories:
            has_entry = (
                db.query(Entry)
                .filter(
                    Entry.factory_id == factory.factory_id,
                    Entry.date == today,
                    Entry.is_active.is_(True),
                )
                .first()
                is not None
            )
            if not has_entry:
                notify_shift_missed(factory.name, day=today)
    print("Shift missed check complete.")


if __name__ == "__main__":
    main()
