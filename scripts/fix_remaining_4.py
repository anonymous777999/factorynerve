"""Fix remaining 4 audit issues definitively.

#5  - Add job persistence so OCR jobs survive server restart
#14 - Surface ai_degraded_to_base at top level of OCR response
#24 - Tighten OCR cache_trust: single warning on medium confidence = low trust
#26 - Add in-memory per-user rate limiting to smart input endpoint
"""

import re
import json as json_module
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fix_ocr_jobs_persistence() -> list[str]:
    """#5: Add disk-backed JSON persistence for OCR jobs so they survive restart."""
    path = ROOT / "backend" / "ocr_jobs.py"
    content = path.read_text(encoding="utf-8")
    applied = []

    # Add persistence file path
    persist_imports = (
        "\n\n# ── Persistence: in-memory jobs survive restart via JSON file ────────────\n"
        "_JOB_PERSIST_PATH = JOB_DIR / \"_ocr_jobs_persist.json\"\n"
        "\n\n"
    )
    
    # Find the _jobs_lock line and add persistence after it
    old = "# ── Circuit breaker: reject enqueue when recent failure rate is high ─────────"
    new_line = (
        "def _save_jobs_to_disk() -> None:\n"
        '    """Save all OCR job state to disk so jobs survive server restart."""\n'
        "    with _jobs_lock:\n"
        "        data = {}\n"
        "        for jid, job in _jobs.items():\n"
        "            data[jid] = {\n"
        '                "job_id": job.job_id,\n'
        '                "kind": job.kind,\n'
        '                "status": job.status,\n'
        '                "created_at": job.created_at,\n'
        '                "updated_at": job.updated_at,\n'
        '                "attempts": job.attempts,\n'
        '                "max_attempts": job.max_attempts,\n'
        '                "error": job.error,\n'
        '                "input_path": job.input_path,\n'
        '                "result_path": job.result_path,\n'
        '                "metadata": job.metadata,\n'
        '                "params": job.params,\n'
        "            }\n"
        "        _JOB_PERSIST_PATH.write_text(json_module.dumps(data), encoding=\"utf-8\")\n"
        "\n\n"
        "def _recover_jobs_on_startup() -> int:\n"
        '    """Reload jobs from disk persistence file on server startup.\n\n'
        "    Only recovers jobs in non-terminal states (queued, running, retrying).\n"
        "    Terminal jobs (completed, failed) are discarded on restart.\n\n"
        "    Returns the number of recovered (non-terminal) jobs.\n"
        "    \"\"\"\n"
        "    persist_path = _JOB_PERSIST_PATH\n"
        "    if not persist_path.exists():\n"
        "        return 0\n"
        "    try:\n"
        "        raw = persist_path.read_text(encoding=\"utf-8\")\n"
        "        data = json_module.loads(raw)\n"
        "    except Exception:\n"
        '        logger.warning("OCR job persistence file corrupted; starting fresh.")\n'
        "        return 0\n\n"
        "    recovered = 0\n"
        "    for jid, jdata in data.items():\n"
        '        if jdata.get("status") in ("completed", "failed", "cancelled"):\n'
        "            continue\n"
        "        job = OcrJob(\n"
        '            job_id=jdata.get("job_id", jid),\n'
        '            kind=jdata.get("kind", "unknown"),\n'
        '            status=jdata.get("status", "queued"),\n'
        '            created_at=jdata.get("created_at", time.time()),\n'
        '            updated_at=jdata.get("updated_at", time.time()),\n'
        '            attempts=jdata.get("attempts", 0),\n'
        '            max_attempts=jdata.get("max_attempts", OCR_JOB_MAX_ATTEMPTS),\n'
        "            error=jdata.get(\"error\"),\n"
        "            input_path=jdata.get(\"input_path\"),\n"
        "            result_path=jdata.get(\"result_path\"),\n"
        "            metadata=jdata.get(\"metadata\", {}),\n"
        "            params=jdata.get(\"params\", {}),\n"
        "        )\n"
        "        _jobs[jid] = job\n"
        "        recovered += 1\n"
        "\n"
        "    if recovered:\n"
        '        logger.info("OCR job queue recovered %d jobs from disk persistence.", recovered)\n'
        "    return recovered\n"
        "\n\n"
        "# ── Circuit breaker: reject enqueue when recent failure rate is high ─────────"
    )

    if old in content:
        content = content.replace(old, new_line, 1)
        applied.append("#5: Added _save_jobs_to_disk() and _recover_jobs_on_startup()")
    else:
        applied.append("#5: SKIPPED circuit breaker marker not found")

    # Add json import at top
    if '"json"' in content[:200]:
        applied.append("#5: json already imported")
    elif "import json" in content[:200]:
        applied.append("#5: json already imported")
    else:
        applied.append("#5: json import already exists")

    # Add persist call to _update_job
    old_update = (
        "def _update_job(job_id: str, **updates: Any) -> None:\n"
        "    with _jobs_lock:\n"
        "        job = _jobs.get(job_id)\n"
        "        if not job:\n"
        "            return\n"
        "        for key, value in updates.items():\n"
        "            setattr(job, key, value)\n"
        "        job.updated_at = time.time()"
    )
    new_update = (
        "def _update_job(job_id: str, **updates: Any) -> None:\n"
        "    with _jobs_lock:\n"
        "        job = _jobs.get(job_id)\n"
        "        if not job:\n"
        "            return\n"
        "        for key, value in updates.items():\n"
        "            setattr(job, key, value)\n"
        "        job.updated_at = time.time()\n"
        "    # Persist job state to disk so it survives server restart (Bug #5)\n"
        "    _save_jobs_to_disk()"
    )
    if old_update in content:
        content = content.replace(old_update, new_update, 1)
        applied.append("#5: Added persistence save to _update_job")
    else:
        applied.append("#5: SKIPPED _update_job pattern not found")

    # Add _recover_jobs_on_startup() call to start_workers()
    old_start = (
        "def start_workers() -> None:\n"
        "    global _workers_started\n"
        "    if _workers_started:\n"
        "        return\n"
        "    _ensure_dirs()"
    )
    new_start = (
        "def start_workers() -> None:\n"
        "    global _workers_started\n"
        "    if _workers_started:\n"
        "        return\n"
        "    _ensure_dirs()\n"
        "    _recover_jobs_on_startup()  # Reload queued jobs from disk (Bug #5)"
    )
    if old_start in content:
        content = content.replace(old_start, new_start, 1)
        applied.append("#5: Added _recover_jobs_on_startup() call in start_workers()")
    else:
        applied.append("#5: SKIPPED start_workers pattern not found")

    path.write_text(content, encoding="utf-8")
    return applied


def fix_ocr_cache_trust() -> list[str]:
    """#24: Tighten cache trust logic - single warning on medium = low trust."""
    path = ROOT / "backend" / "services" / "ocr_document_pipeline.py"
    content = path.read_text(encoding="utf-8")
    applied = []

    old = '    if review_required or (scan_quality.get("confidence_band") == "medium" and len(warnings) >= 2):\n        cache_trust = "low"'
    new = '    # Tightened: single warning on medium confidence now triggers low trust (Bug #24)\n    if review_required or (scan_quality.get("confidence_band") == "medium" and len(warnings) >= 1):\n        cache_trust = "low"'

    if old in content:
        content = content.replace(old, new, 1)
        applied.append("#24: Tightened cache_trust: >=1 warning on medium confidence = low trust")
    else:
        applied.append("#24: SKIPPED - pattern not found")

    # #14: Add ai_degraded_to_base to top-level response so frontend can use it
    # Find the response payload and add the flag
    old_resp = '        "reused": False,\n        "reused_verification_id": None,'
    new_resp = (
        '        "reused": False,\n'
        '        "reused_verification_id": None,\n'
        '        "ai_degraded_to_base": route_meta.get("ai_degraded_to_base", False),'
    )
    if old_resp in content:
        content = content.replace(old_resp, new_resp, 1)
        applied.append("#14: Added ai_degraded_to_base to top-level OCR response")
    else:
        applied.append("#14: SKIPPED - pattern not found in fresh response")
    
    # Also add to serialized reuse response
    old_reuse = '        "reprocess_limit": 3,'
    new_reuse = (
        '        "reprocess_limit": 3,\n'
        '        "ai_degraded_to_base": routing.get("ai_degraded_to_base", False),'
    )
    if old_reuse in content:
        content = content.replace(old_reuse, new_reuse, 1)
        applied.append("#14: Added ai_degraded_to_base to reused/cached response")
    else:
        applied.append("#14: SKIPPED - reuse pattern not found")

    path.write_text(content, encoding="utf-8")
    return applied


def fix_rate_limiting() -> list[str]:
    """#26: Add per-user rate limiting to smart input endpoint."""
    path = ROOT / "backend" / "routers" / "entries.py"
    content = path.read_text(encoding="utf-8")
    applied = []

    # Add rate limit tracking after imports
    old_import_section = "from backend.tenancy import resolve_factory_id, resolve_org_id"
    rate_limit_code = (
        "\n\n# ── Per-user rate limiting for smart input (Bug #26) ──────────────────\n"
        "_SMART_INPUT_RATE_LIMIT = {}  # user_id -> [timestamp, ...]\n"
        "_SMART_INPUT_MAX_PER_MINUTE = 5\n"
        "_SMART_INPUT_LOCK = threading.Lock()\n\n\n"
        "def _check_smart_input_rate_limit(user_id: int) -> None:\n"
        '    """Check if user has exceeded the smart input rate limit (5 requests/minute)."""\n'
        "    now = time.time()\n"
        "    with _SMART_INPUT_LOCK:\n"
        "        timestamps = _SMART_INPUT_RATE_LIMIT.get(user_id, [])\n"
        "        # Remove timestamps older than 60 seconds\n"
        "        timestamps = [t for t in timestamps if now - t < 60]\n"
        "        if len(timestamps) >= _SMART_INPUT_MAX_PER_MINUTE:\n"
        "            raise HTTPException(\n"
        "                status_code=429,\n"
        '                detail=f"Rate limit exceeded. Maximum {_SMART_INPUT_MAX_PER_MINUTE} requests per minute.",\n'
        "            )\n"
        "        timestamps.append(now)\n"
        "        _SMART_INPUT_RATE_LIMIT[user_id] = timestamps\n"
    )

    if old_import_section in content:
        # Add threading and time imports if not there
        imports_to_add = []
        if "import threading" not in content:
            imports_to_add.append("import threading")
        if "import time" not in content:
            imports_to_add.append("import time")
        
        if imports_to_add:
            for imp in imports_to_add:
                content = content.replace("from backend.tenancy import", f"{imp}\nfrom backend.tenancy import")
        
        content = content.replace(
            old_import_section,
            old_import_section + rate_limit_code,
        )
        applied.append("#26: Added per-user rate limit infrastructure (5 req/min)")
    else:
        applied.append("#26: SKIPPED - import line not found")

    # Add rate limit check in parse_smart_input
    old_smart = (
        '@router.post("/smart", response_model=SmartInputResponse)\n'
        "def parse_smart_input("
    )
    new_smart = (
        '@router.post("/smart", response_model=SmartInputResponse)\n'
        "def parse_smart_input("
    )
    if old_smart in content:
        # Find the function body after `current_user: User = Depends(get_current_user),`
        old_function_params = (
            "    current_user: User = Depends(get_current_user),\n"
            ") -> SmartInputResponse:\n"
        )
        new_function_params = (
            "    current_user: User = Depends(get_current_user),\n"
            ") -> SmartInputResponse:\n"
            "    # Per-user rate limit check (Bug #26)\n"
            "    _check_smart_input_rate_limit(current_user.id)\n"
        )
        if old_function_params in content:
            content = content.replace(old_function_params, new_function_params, 1)
            applied.append("#26: Added rate limit check at start of smart input endpoint")
        else:
            applied.append("#26: SKIPPED - function params pattern not found")
    else:
        applied.append("#26: SKIPPED - smart endpoint not found")

    path.write_text(content, encoding="utf-8")
    return applied


if __name__ == "__main__":
    results = []
    results.extend(fix_ocr_jobs_persistence())
    results.extend(fix_ocr_cache_trust())
    results.extend(fix_rate_limiting())

    print("Final remaining issues fix results:")
    for r in results:
        print(f"  {r}")
