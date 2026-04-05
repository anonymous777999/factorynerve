"""Async load test for DPR.ai core auth + entry flows.

Usage:
    python scripts/load_test_core_flows.py --base-url http://127.0.0.1:8765 --users 25 --concurrency 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import httpx


DEFAULT_PASSWORD = "LoadTestPassw0rd!"
ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"


@dataclass
class EndpointStats:
    durations_ms: list[float] = field(default_factory=list)
    success: int = 0
    failures: int = 0

    def add(self, duration_ms: float, ok: bool) -> None:
        self.durations_ms.append(duration_ms)
        if ok:
            self.success += 1
        else:
            self.failures += 1

    def summary(self) -> dict[str, Any]:
        if not self.durations_ms:
            return {"success": self.success, "failures": self.failures}
        sorted_values = sorted(self.durations_ms)
        return {
            "success": self.success,
            "failures": self.failures,
            "avg_ms": round(statistics.mean(sorted_values), 2),
            "p50_ms": round(sorted_values[len(sorted_values) // 2], 2),
            "p95_ms": round(sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * 0.95))], 2),
            "max_ms": round(sorted_values[-1], 2),
        }


def unique_email(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def unwrap_payload(payload: Any) -> Any:
    if isinstance(payload, dict) and "ok" in payload and "data" in payload:
        return payload["data"]
    return payload


def entry_payload(index: int) -> dict[str, Any]:
    return {
        "date": date.today().isoformat(),
        "shift": ["morning", "evening", "night"][index % 3],
        "units_target": 100 + index,
        "units_produced": 96 + index,
        "manpower_present": 22,
        "manpower_absent": 1,
        "downtime_minutes": 6,
        "downtime_reason": "Load test",
        "department": "Admin",
        "materials_used": "Steel",
        "quality_issues": False,
        "quality_details": None,
        "notes": "Synthetic load-test entry",
    }


async def timed_request(
    client: httpx.AsyncClient,
    stats: dict[str, EndpointStats],
    name: str,
    method: str,
    path: str,
    **kwargs: Any,
) -> httpx.Response:
    started = time.perf_counter()
    response = await client.request(method, path, **kwargs)
    duration_ms = (time.perf_counter() - started) * 1000
    stats[name].add(duration_ms, response.is_success)
    return response


async def run_virtual_user(
    client: httpx.AsyncClient,
    stats: dict[str, EndpointStats],
    user_index: int,
) -> None:
    email = unique_email(f"load_{user_index}")
    register_response = await timed_request(
        client,
        stats,
        "register",
        "POST",
        "/auth/register",
        json={
            "name": f"Load User {user_index}",
            "email": email,
            "password": DEFAULT_PASSWORD,
            "role": "admin",
            "factory_name": f"Load Factory {uuid.uuid4().hex[:6]}",
            "phone_number": "+910000000000",
        },
    )
    register_response.raise_for_status()
    register_payload = unwrap_payload(register_response.json())
    access_token = register_payload["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    login_response = await timed_request(
        client,
        stats,
        "login",
        "POST",
        "/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    login_response.raise_for_status()

    health_response = await timed_request(client, stats, "health", "GET", "/health")
    health_response.raise_for_status()

    create_response = await timed_request(
        client,
        stats,
        "create_entry",
        "POST",
        "/entries/",
        json=entry_payload(user_index),
        headers=headers,
    )
    create_response.raise_for_status()
    created_payload = unwrap_payload(create_response.json())
    entry_id = created_payload["id"]

    list_response = await timed_request(client, stats, "list_entries", "GET", "/entries/", headers=headers)
    list_response.raise_for_status()

    report_response = await timed_request(
        client,
        stats,
        "export_excel",
        "GET",
        f"/reports/excel/{entry_id}",
        headers=headers,
    )
    report_response.raise_for_status()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Load test DPR.ai core flows.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument(
        "--output",
        default=str(REPORTS_DIR / "load_test_core_flows.json"),
        help="Where to save the JSON report.",
    )
    args = parser.parse_args()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stats: dict[str, EndpointStats] = defaultdict(EndpointStats)
    semaphore = asyncio.Semaphore(max(1, args.concurrency))

    async with httpx.AsyncClient(base_url=args.base_url, timeout=30.0) as client:
        async def worker(index: int) -> None:
            async with semaphore:
                await run_virtual_user(client, stats, index)

        started = time.perf_counter()
        results = await asyncio.gather(*(worker(index) for index in range(args.users)), return_exceptions=True)
        total_duration_ms = (time.perf_counter() - started) * 1000

    failures = [str(item) for item in results if isinstance(item, Exception)]
    report = {
        "base_url": args.base_url,
        "virtual_users": args.users,
        "concurrency": args.concurrency,
        "duration_ms": round(total_duration_ms, 2),
        "failed_users": len(failures),
        "failures": failures[:20],
        "endpoints": {name: endpoint.summary() for name, endpoint in stats.items()},
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
