#!/usr/bin/env python3
"""
simulate_failures.py — Toggle failure simulation modes.

Usage:
    python scripts/simulate_failures.py status              # Show all modes
    python scripts/simulate_failures.py enable <mode>       # Enable a mode
    python scripts/simulate_failures.py disable <mode>      # Disable a mode
    python scripts/simulate_failures.py enable-all          # Enable ALL modes
    python scripts/simulate_failures.py disable-all         # Disable ALL modes
    python scripts/simulate_failures.py reset               # Reset all to defaults
    python scripts/simulate_failures.py list                # List available modes

Modes:
    redis_down       - Redis unavailable (falls back to in-memory cache)
    ai_timeout       - AI provider calls time out
    ai_unavailable   - AI provider returns 503
    email_fail       - Email sending raises errors
    db_lock          - Database operations slow down
    ocr_fail         - OCR endpoints return 500
    slow_network     - Adds 1-3s latency to all requests
    permission_deny  - Auth-protected routes return 403
    expired_session  - Sessions appear expired
    disk_full        - File writes raise IOError
    worker_crash     - Background jobs immediately fail
    queue_backlog    - Queue reports as backed up
    large_upload     - Request size limit lowered to 10KB

Examples:
    python scripts/simulate_failures.py enable redis_down
    python scripts/simulate_failures.py enable ai_timeout
    python scripts/simulate_failures.py enable email_fail
    python scripts/simulate_failures.py enable-all
    python scripts/simulate_failures.py status
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure backend module is importable
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# Load .env if present
dotenv_path = PROJECT_ROOT / ".env"
if dotenv_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path)
    except ImportError:
        pass


def _color(text: str, color_code: str) -> str:
    """Wrap text in ANSI color (fallback to plain text on Windows)."""
    try:
        return f"{color_code}{text}\033[0m"
    except Exception:
        return text


def _green(text: str) -> str:
    return _color(text, "\033[92m")


def _red(text: str) -> str:
    return _color(text, "\033[91m")


def _yellow(text: str) -> str:
    return _color(text, "\033[93m")


def _cyan(text: str) -> str:
    return _color(text, "\033[96m")


def _bold(text: str) -> str:
    return _color(text, "\033[1m")


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        safe = text.encode("ascii", errors="replace").decode("ascii")
        print(safe)


def _import_failure_module():
    """Import the failure simulation module, with helpful error on failure."""
    try:
        from backend import failure_simulation
        return failure_simulation
    except ImportError as e:
        _safe_print(f"Error: Could not import backend.failure_simulation: {e}")
        _safe_print("Make sure PYTHONPATH includes the project root or run from the project directory.")
        sys.exit(1)


def _status_from_api() -> dict | None:
    """Try to get status from running backend API (via httpx)."""
    try:
        import httpx
        port = os.getenv("FASTAPI_PORT", "8765")
        resp = httpx.get(f"http://127.0.0.1:{port}/dev/failures", timeout=2)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def cmd_status() -> int:
    """Show all failure modes and their current status."""
    fs = _import_failure_module()
    status = fs.get_status()
    modes = status["modes"]
    active_count = status["active_count"]
    total = status["total_modes"]

    # Try to connect to running backend for a more accurate picture
    api_status = _status_from_api()

    _safe_print("")
    _safe_print(_bold("FAILURE SIMULATION STATUS"))
    _safe_print("=" * 60)

    if api_status:
        _safe_print(f"  Source: {_cyan('Running Backend')} ({api_status.get('source', 'unknown')})")
    else:
        _safe_print(f"  Source: Local ({status.get('source', 'unknown')})")
    _safe_print(f"  Active: {_red(str(active_count)) if active_count > 0 else _green(str(active_count))} / {total}")
    _safe_print(f"  Healthy: {_green('Yes') if active_count == 0 else _red('No')}")
    _safe_print("")

    # Group by category
    categories: dict[str, list[tuple[str, dict]]] = {}
    for mode, info in sorted(modes.items()):
        cat = info.get("category", "other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append((mode, info))

    for cat, items in sorted(categories.items()):
        _safe_print(f"  [{_cyan(cat.upper())}]")
        for mode, info in items:
            active = info.get("active", False)
            status_icon = _red("ACTIVE") if active else _green("inactive")
            source = info.get("source", "")
            _safe_print(f"    {status_icon}  {mode:20s}  {info.get('label', ''):30s}")
        _safe_print("")

    return 0 if active_count == 0 else 1


def cmd_list() -> int:
    """List available failure modes with descriptions."""
    fs = _import_failure_module()

    _safe_print("")
    _safe_print(_bold("AVAILABLE FAILURE MODES"))
    _safe_print("=" * 60)
    _safe_print("")

    categories: dict[str, list[tuple[str, dict]]] = {}
    for mode, config in sorted(fs.FAILURE_MODES.items()):
        cat = config.get("category", "other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append((mode, config))

    for cat, items in sorted(categories.items()):
        _safe_print(f"  [{_cyan(cat.upper())}]")
        for mode, config in items:
            latency = config.get("latency_ms", 0)
            status = config.get("http_status")
            _safe_print(f"    {mode:20s}  {config.get('label', ''):30s}")
            _safe_print(f"    {'':20s}  {config.get('description', '')}")
            parts = []
            if latency:
                parts.append(f"{latency}ms latency")
            if status:
                parts.append(f"HTTP {status}")
            if parts:
                _safe_print(f"    {'':20s}  [{_yellow(', '.join(parts))}]")
            _safe_print("")

    _safe_print("")
    _safe_print("  Usage: python scripts/simulate_failures.py enable <mode>")
    _safe_print("")

    return 0


def cmd_enable(mode: str) -> int:
    """Enable a failure mode."""
    fs = _import_failure_module()

    if mode == "all":
        count = fs.set_all(True)
        _safe_print(f"")
        _safe_print(_red(f" ENABLED ALL {count} FAILURE MODES"))
        _safe_print(f"")
        return 0

    if mode not in fs.FAILURE_MODES:
        _safe_print(f"Error: Unknown mode '{mode}'.")
        _safe_print(f"Available: {', '.join(sorted(fs.FAILURE_MODES.keys()))}")
        return 1

    fs.set_active(mode, True)
    config = fs.FAILURE_MODES[mode]
    _safe_print("")
    _safe_print(_red(f" ENABLED: {config['label']}"))
    _safe_print(f"     {config['description']}")
    _safe_print("")
    return 0


def cmd_disable(mode: str) -> int:
    """Disable a failure mode."""
    fs = _import_failure_module()

    if mode == "all":
        count = fs.set_all(False)
        _safe_print("")
        _safe_print(_green(f" Disabled all {count} failure modes"))
        _safe_print("")
        return 0

    if mode not in fs.FAILURE_MODES:
        _safe_print(f"Error: Unknown mode '{mode}'.")
        _safe_print(f"Available: {', '.join(sorted(fs.FAILURE_MODES.keys()))}")
        return 1

    fs.set_active(mode, False)
    config = fs.FAILURE_MODES[mode]
    _safe_print("")
    _safe_print(_green(f" DISABLED: {config['label']}"))
    _safe_print("")
    return 0


def cmd_reset() -> int:
    """Reset all failure modes to inactive."""
    fs = _import_failure_module()
    count = fs.reset_all()
    _safe_print("")
    _safe_print(_green(f" Reset {count} failure modes to defaults"))
    _safe_print("")
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0

    command = sys.argv[1].strip().lower()

    if command == "status":
        return cmd_status()
    elif command == "list":
        return cmd_list()
    elif command == "enable-all":
        return cmd_enable("all")
    elif command == "disable-all":
        return cmd_disable("all")
    elif command == "reset":
        return cmd_reset()
    elif command == "enable":
        if len(sys.argv) < 3:
            _safe_print("Usage: python scripts/simulate_failures.py enable <mode>")
            _safe_print("       python scripts/simulate_failures.py enable-all")
            return 1
        return cmd_enable(sys.argv[2].strip().lower())
    elif command == "disable":
        if len(sys.argv) < 3:
            _safe_print("Usage: python scripts/simulate_failures.py disable <mode>")
            _safe_print("       python scripts/simulate_failures.py disable-all")
            return 1
        return cmd_disable(sys.argv[2].strip().lower())
    else:
        _safe_print(f"Unknown command: {command}")
        _safe_print("Run with --help for usage.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
