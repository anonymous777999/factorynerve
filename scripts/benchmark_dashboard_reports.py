"""Benchmark dashboard and reports endpoints before broader rollout.

Usage:
    python scripts/benchmark_dashboard_reports.py --base-url http://127.0.0.1:8765
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import SessionLocal, init_db
from backend.models.organization import Organization
from backend.models.user import User

REPORTS_DIR = ROOT_DIR / "reports"
PASSWORD = "BenchPassw0rd!"

init_db()


@dataclass
class SampleStats:
    durations_ms: list[float] = field(default_factory=list)
    failures: int = 0

    def add(self, duration_ms: float, ok: bool) -> None:
        self.durations_ms.append(duration_ms)
        if not ok:
            self.failures += 1

    def summary(self) -> dict[str, Any]:
        if not self.durations_ms:
            return {"samples": 0, "failures": self.failures}
        values = sorted(self.durations_ms)
        p95_index = min(len(values) - 1, int(len(values) * 0.95))
        return {
            "samples": len(values),
            "failures": self.failures,
            "avg_ms": round(statistics.mean(values), 2),
            "p50_ms": round(values[len(values) // 2], 2),
            "p95_ms": round(values[p95_index], 2),
            "max_ms": round(values[-1], 2),
        }


def unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "ok" in payload and "data" in payload:
        return payload["data"]
    return payload


def unique_email() -> str:
    return f"bench_{uuid.uuid4().hex[:10]}@example.com"


def set_org_plan(email: str, plan: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise RuntimeError(f"Benchmark user not found for plan update: {email}")
        org = db.query(Organization).filter(Organization.org_id == user.org_id).first()
        if not org:
            raise RuntimeError(f"Benchmark org not found for user: {email}")
        org.plan = plan
        db.commit()


def entry_payload(index: int) -> dict[str, Any]:
    return {
        "date": (date.today() - timedelta(days=index % 14)).isoformat(),
        "shift": ["morning", "evening", "night"][index % 3],
        "units_target": 120 + index,
        "units_produced": 112 + index,
        "manpower_present": 18 + (index % 3),
        "manpower_absent": index % 2,
        "downtime_minutes": 8 + (index % 5),
        "downtime_reason": "Benchmark run",
        "department": "Admin",
        "materials_used": "Steel",
        "quality_issues": index % 4 == 0,
        "quality_details": "Minor variance" if index % 4 == 0 else None,
        "notes": "Benchmark data row",
    }


def timed_request(
    client: httpx.Client,
    stats: dict[str, SampleStats],
    name: str,
    method: str,
    path: str,
    **kwargs: Any,
) -> httpx.Response:
    started = time.perf_counter()
    response = client.request(method, path, **kwargs)
    duration_ms = (time.perf_counter() - started) * 1000
    stats[name].add(duration_ms, response.is_success)
    return response


def wait_for_job(
    client: httpx.Client,
    stats: dict[str, SampleStats],
    path: str,
    headers: dict[str, str],
    *,
    attempts: int = 25,
    delay_seconds: float = 0.35,
) -> dict[str, Any]:
    for _ in range(attempts):
        response = timed_request(client, stats, "job_poll", "GET", path, headers=headers)
        response.raise_for_status()
        payload = unwrap(response.json())
        if payload.get("status") in {"succeeded", "failed"}:
            return payload
        time.sleep(delay_seconds)
    raise RuntimeError(f"Job did not finish in time: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark dashboard/reports flows.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--entries", type=int, default=24)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument(
        "--output",
        default=str(REPORTS_DIR / "benchmark_dashboard_reports.json"),
        help="Where to save the JSON report.",
    )
    args = parser.parse_args()

    stats: dict[str, SampleStats] = defaultdict(SampleStats)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client(base_url=args.base_url, timeout=45.0) as client:
        email = unique_email()
        factory_name = f"Benchmark Factory {uuid.uuid4().hex[:6]}"
        register = timed_request(
            client,
            stats,
            "register",
            "POST",
            "/auth/register",
            json={
                "name": "Benchmark Admin",
                "email": email,
                "password": PASSWORD,
                "role": "admin",
                "factory_name": factory_name,
                "phone_number": "+910000000000",
            },
        )
        register.raise_for_status()
        register_payload = unwrap(register.json())
        seed_access_token = register_payload["access_token"]
        company_code = register_payload.get("user", {}).get("factory_code")
        seed_headers = {"Authorization": f"Bearer {seed_access_token}"}
        set_org_plan(email, "factory")

        with httpx.Client(base_url=args.base_url, timeout=45.0) as seeded:
            for index in range(args.entries):
                created = timed_request(
                    seeded,
                    stats,
                    "seed_entry",
                    "POST",
                    "/entries/",
                    json=entry_payload(index),
                    headers=seed_headers,
                )
                if created.status_code not in {200, 201, 409}:
                    created.raise_for_status()

        runner_email = unique_email()
        runner = timed_request(
            client,
            stats,
            "register_runner",
            "POST",
            "/auth/register",
            json={
                "name": "Benchmark Runner",
                "email": runner_email,
                "password": PASSWORD,
                "role": "admin",
                "factory_name": factory_name,
                "company_code": company_code,
                "phone_number": "+910000000000",
            },
        )
        runner.raise_for_status()
        access_token = unwrap(runner.json())["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        for _ in range(args.samples):
            timed_request(client, stats, "analytics_weekly", "GET", "/analytics/weekly", headers=headers).raise_for_status()
            timed_request(client, stats, "analytics_monthly", "GET", "/analytics/monthly", headers=headers).raise_for_status()
            timed_request(client, stats, "reports_weekly", "GET", "/reports/weekly", headers=headers).raise_for_status()
            timed_request(client, stats, "reports_monthly", "GET", "/reports/monthly", headers=headers).raise_for_status()
            timed_request(client, stats, "ai_anomaly_preview", "GET", "/ai/anomalies/preview?days=14", headers=headers).raise_for_status()

        export_job_response = timed_request(
            client,
            stats,
            "report_job_create",
            "POST",
            "/reports/excel-range/jobs?start_date="
            + (date.today() - timedelta(days=6)).isoformat()
            + "&end_date="
            + date.today().isoformat(),
            headers=headers,
        )
        export_job_response.raise_for_status()
        export_job = unwrap(export_job_response.json())
        export_status = wait_for_job(client, stats, f"/reports/export-jobs/{export_job['job_id']}", headers, attempts=35)
        if export_status.get("status") != "succeeded":
            raise RuntimeError(f"Report job failed: {export_status}")
        timed_request(
            client,
            stats,
            "report_job_download",
            "GET",
            f"/reports/export-jobs/{export_job['job_id']}/download",
            headers=headers,
        ).raise_for_status()

        summary_job_response = timed_request(
            client,
            stats,
            "ai_summary_job_create",
            "POST",
            "/ai/executive-summary/jobs",
            headers=headers,
        )
        summary_job_response.raise_for_status()
        summary_job = unwrap(summary_job_response.json())
        summary_status = wait_for_job(client, stats, f"/ai/jobs/{summary_job['job_id']}", headers, attempts=35)
        if summary_status.get("status") != "succeeded":
            raise RuntimeError(f"AI job failed: {summary_status}")

    report = {
        "base_url": args.base_url,
        "seed_entries": args.entries,
        "samples_per_endpoint": args.samples,
        "results": {name: value.summary() for name, value in stats.items()},
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
