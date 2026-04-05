import argparse
import asyncio
from datetime import date, timedelta
from typing import Iterable

import httpx


def build_entry_payload(index: int) -> dict:
    entry_date = date.today() - timedelta(days=index % 60)
    return {
        "date": entry_date.isoformat(),
        "shift": "morning",
        "units_target": 100 + index,
        "units_produced": 90 + index,
        "manpower_present": 20,
        "manpower_absent": 2,
        "downtime_minutes": 5,
        "downtime_reason": "Stress test",
        "department": "Admin",
        "materials_used": "Steel",
        "quality_issues": False,
        "quality_details": None,
        "notes": "Stress test entry",
    }


async def login(client: httpx.AsyncClient, email: str, password: str) -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    resp.raise_for_status()
    data = resp.json()
    return data["access_token"]


async def create_entries(
    client: httpx.AsyncClient,
    token: str,
    count: int,
) -> list[int]:
    headers = {"Authorization": f"Bearer {token}"}
    entry_ids: list[int] = []
    for idx in range(count):
        resp = await client.post("/entries/", json=build_entry_payload(idx), headers=headers)
        resp.raise_for_status()
        entry_ids.append(resp.json()["id"])
    return entry_ids


async def fetch_report(
    client: httpx.AsyncClient,
    token: str,
    entry_id: int,
    kind: str,
) -> int:
    headers = {"Authorization": f"Bearer {token}"}
    if kind == "excel":
        url = f"/reports/excel/{entry_id}"
    else:
        url = f"/reports/pdf/{entry_id}"
    resp = await client.get(url, headers=headers)
    return resp.status_code


async def run_stress(
    base_url: str,
    email: str,
    password: str,
    count: int,
    concurrency: int,
    kind: str,
) -> None:
    async with httpx.AsyncClient(base_url=base_url, timeout=60.0) as client:
        token = await login(client, email, password)
        entry_ids = await create_entries(client, token, count)

        sem = asyncio.Semaphore(concurrency)
        results: list[int] = []

        async def _task(entry_id: int):
            async with sem:
                status_code = await fetch_report(client, token, entry_id, kind)
                results.append(status_code)

        await asyncio.gather(*[_task(entry_id) for entry_id in entry_ids])

        success = sum(1 for code in results if 200 <= code < 300)
        blocked = sum(1 for code in results if code == 402)
        failed = len(results) - success - blocked

        print(f"Stress test complete: total={len(results)} success={success} blocked={blocked} failed={failed}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stress test DPR report exports.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8787")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=25)
    parser.add_argument("--kind", choices=["pdf", "excel"], default="pdf")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(
        run_stress(
            base_url=args.base_url,
            email=args.email,
            password=args.password,
            count=args.count,
            concurrency=args.concurrency,
            kind=args.kind,
        )
    )


if __name__ == "__main__":
    main()
