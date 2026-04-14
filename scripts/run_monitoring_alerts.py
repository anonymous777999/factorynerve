from __future__ import annotations

import argparse
import json
from typing import Any

from backend.database import SessionLocal, init_db
from backend.services.monitoring_alerts import (
    MANAGER_SESSION_ALERT,
    MOBILE_DROPOFF_ALERT,
    run_monitoring_alert_rule,
)


def _run_rule(rule_name: str) -> dict[str, Any]:
    db = SessionLocal()
    try:
        return run_monitoring_alert_rule(db, rule_name)
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run DPR monitoring alert evaluators.")
    parser.add_argument(
        "--rule",
        choices=["all", MOBILE_DROPOFF_ALERT, MANAGER_SESSION_ALERT],
        default="all",
        help="Alert rule to evaluate.",
    )
    args = parser.parse_args()

    init_db()

    if args.rule == "all":
        results = [
            _run_rule(MOBILE_DROPOFF_ALERT),
            _run_rule(MANAGER_SESSION_ALERT),
        ]
        print(json.dumps(results, ensure_ascii=True, indent=2))
        return 0

    print(json.dumps(_run_rule(args.rule), ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
