"""CLI to reconcile usage counters from audit logs."""

from __future__ import annotations

import argparse
import json

from backend.database import SessionLocal
from backend.usage_reconcile import reconcile_usage


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconcile usage counters from audit logs.")
    parser.add_argument("--period", help="YYYY-MM period to reconcile. Defaults to current month.")
    parser.add_argument("--dry-run", action="store_true", help="Compute without writing changes.")
    parser.add_argument(
        "--no-decrease",
        action="store_true",
        help="Do not decrease counters if logs are lower than stored values.",
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        result = reconcile_usage(
            db,
            period=args.period,
            allow_decrease=not args.no_decrease,
            dry_run=bool(args.dry_run),
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
