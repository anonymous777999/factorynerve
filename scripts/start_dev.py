#!/usr/bin/env python3
"""
start_dev.py — Unified local development startup.

Starts the backend and optionally the frontend, validates the environment,
and provides a clean startup experience.

Usage:
    python scripts/start_dev.py                  # Backend only
    python scripts/start_dev.py --with-frontend  # Backend + Next.js frontend
    python scripts/start_dev.py --seed           # Seed DB + start backend
    python scripts/start_dev.py --no-validate    # Skip env validation
    python scripts/start_dev.py --frontend-only  # Start only the frontend
    python scripts/start_dev.py --help           # Show full help
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# ── Colors ────────────────────────────────────────────────────────────────────
try:
    _RED = "\033[91m"
    _GREEN = "\033[92m"
    _YELLOW = "\033[93m"
    _CYAN = "\033[96m"
    _BOLD = "\033[1m"
    _RESET = "\033[0m"
except Exception:
    _RED = _GREEN = _YELLOW = _CYAN = _BOLD = _RESET = ""


def _info(msg: str) -> None:
    print(f"{_CYAN}[INFO]{_RESET} {msg}")


def _ok(msg: str) -> None:
    print(f"{_GREEN}[OK]{_RESET}   {msg}")


def _warn(msg: str) -> None:
    print(f"{_YELLOW}[WARN]{_RESET} {msg}")


def _error(msg: str) -> None:
    print(f"{_RED}[ERROR]{_RESET} {msg}")


def _env(key: str, default: str = "") -> str:
    return (os.environ.get(key) or "").strip()


def _ensure_env_file() -> Path | None:
    """Ensure .env exists (copy from .env.local if not)."""
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        return env_path

    candidates = [
        PROJECT_ROOT / ".env.local",
        PROJECT_ROOT / ".env.example",
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                import shutil
                shutil.copy2(str(candidate), str(env_path))
                _ok(f"Created .env from {candidate.name}")
                return env_path
            except OSError as e:
                _error(f"Could not create .env: {e}")
                return None
    _warn("No .env, .env.local, or .env.example found")
    return None


def _run_validation() -> bool:
    """Run environment validation script."""
    validate_script = PROJECT_ROOT / "scripts" / "validate_env.py"
    if not validate_script.exists():
        _warn("validate_env.py not found, skipping validation")
        return True

    _info("Running environment validation...")
    result = subprocess.run(
        [sys.executable, str(validate_script)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )
    # Print validation output
    for line in result.stdout.split("\n"):
        print(f"  {line}")
    if result.stderr.strip():
        for line in result.stderr.split("\n"):
            if line.strip():
                print(f"  {_RED}{line}{_RESET}")

    return result.returncode == 0


def _run_seed() -> None:
    """Run the seed script."""
    seed_script = PROJECT_ROOT / "scripts" / "seed_dev.py"
    if not seed_script.exists():
        _error("seed_dev.py not found")
        return

    _info("Seeding database with development data...")
    result = subprocess.run(
        [sys.executable, str(seed_script)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.stderr.strip():
        for line in result.stderr.split("\n"):
            if line.strip():
                print(f"  {_RED}{line}{_RESET}")
    if result.returncode == 0:
        _ok("Database seeded successfully")
    else:
        _error(f"Seed failed with exit code {result.returncode}")


def _start_backend() -> subprocess.Popen:
    """Start the backend server."""
    port = _env("FASTAPI_PORT", "8765")
    host = _env("FASTAPI_HOST", "127.0.0.1")
    log_level = _env("LOG_LEVEL", "INFO")

    _info(f"Starting backend at http://{host}:{port}")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT)

    return subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "backend.main:app",
            "--host", host,
            "--port", port,
            "--log-level", log_level.lower(),
            "--reload",
        ],
        cwd=str(PROJECT_ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def _start_frontend() -> subprocess.Popen | None:
    """Start the Next.js frontend."""
    frontend_dir = PROJECT_ROOT / "web"
    if not frontend_dir.exists():
        _warn("Frontend directory (web/) not found")
        return None

    # Check if node_modules exists
    if not (frontend_dir / "node_modules").exists():
        _warn("node_modules not found in web/. Run: cd web && npm install")

    _info("Starting frontend at http://127.0.0.1:3000")

    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=str(frontend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def _stream_output(process: subprocess.Popen, prefix: str = "") -> None:
    """Read and print output from a subprocess."""
    try:
        for line in iter(process.stdout.readline, b""):
            text = line.decode("utf-8", errors="replace").rstrip()
            if text:
                print(f"  [{prefix}] {text}")
    except Exception:
        pass


def _print_startup_banner(backend_port: str) -> None:
    """Print the startup banner with URLs."""
    print()
    print("=" * 60)
    print(f"  {_BOLD}DPR.ai — Local Development Environment{_RESET}")
    print("=" * 60)
    print()
    print(f"  {_CYAN}Backend API:{_RESET}    http://127.0.0.1:{backend_port}")
    print(f"  {_CYAN}API Docs:{_RESET}       http://127.0.0.1:{backend_port}/docs")
    print(f"  {_CYAN}Health Check:{_RESET}   http://127.0.0.1:{backend_port}/health")
    print(f"  {_CYAN}Observability:{_RESET}  http://127.0.0.1:{backend_port}/observability")
    print()
    print(f"  {_YELLOW}Logs:{_RESET}          Run with --verbose or check logs/ directory")
    print(f"  {_YELLOW}Seed:{_RESET}           python scripts/seed_dev.py")
    print(f"  {_YELLOW}Validate:{_RESET}       python scripts/validate_env.py")
    print()
    print(f"  {_BOLD}Press Ctrl+C to stop all services{_RESET}")
    print("=" * 60)
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="DPR.ai Local Development Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/start_dev.py                  # Backend only
  python scripts/start_dev.py --with-frontend  # Backend + frontend
  python scripts/start_dev.py --seed           # Seed DB first, then start
  python scripts/start_dev.py --no-validate    # Skip startup validation
  python scripts/start_dev.py --frontend-only  # Frontend only (Next.js dev)
        """,
    )
    parser.add_argument("--with-frontend", "-f", action="store_true",
                        help="Also start the Next.js frontend")
    parser.add_argument("--frontend-only", action="store_true",
                        help="Start only the frontend")
    parser.add_argument("--seed", "-s", action="store_true",
                        help="Run seed_dev.py before starting")
    parser.add_argument("--no-validate", action="store_true",
                        help="Skip environment validation")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print detailed startup output")

    args = parser.parse_args()

    # Ensure .env file exists
    _ensure_env_file()

    # Load .env into environment
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")

    backend_port = _env("FASTAPI_PORT", "8765")

    if args.frontend_only:
        _info("Starting frontend only...")
        frontend = _start_frontend()
        if frontend:
            try:
                _print_startup_banner(backend_port)
                _stream_output(frontend, "frontend")
                frontend.wait()
            except KeyboardInterrupt:
                _info("Shutting down...")
                frontend.terminate()
        return 0

    # Validate environment
    if not args.no_validate:
        if not _run_validation():
            _warn("Environment validation found issues. Starting anyway...")
            print()
    else:
        _info("Skipping environment validation")

    # Seed database
    if args.seed:
        _run_seed()

    # Start backend
    backend = _start_backend()

    # Start frontend if requested
    frontend = None
    if args.with_frontend:
        frontend = _start_frontend()

    # Print banner
    _print_startup_banner(backend_port)

    # Wait for backend to be ready
    _info("Waiting for backend to be ready...")
    import httpx
    for _ in range(30):
        try:
            resp = httpx.get(f"http://127.0.0.1:{backend_port}/health", timeout=2)
            if resp.status_code == 200:
                _ok("Backend is ready!")
                break
        except Exception:
            pass
        time.sleep(0.5)

    try:
        # Stream output
        import threading
        backend_thread = threading.Thread(
            target=_stream_output, args=(backend, "backend"), daemon=True
        )
        backend_thread.start()

        if frontend:
            frontend_thread = threading.Thread(
                target=_stream_output, args=(frontend, "frontend"), daemon=True
            )
            frontend_thread.start()

        backend.wait()
    except KeyboardInterrupt:
        _info("\nShutting down...")
        if frontend:
            frontend.terminate()
        backend.terminate()
        _ok("All services stopped")

    return 0


if __name__ == "__main__":
    sys.exit(main())
