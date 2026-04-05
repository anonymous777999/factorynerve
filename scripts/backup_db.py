"""Backup database snapshots for DPR.ai."""

from __future__ import annotations

import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _backup_dir() -> Path:
    target = os.getenv("BACKUP_DIR") or str(PROJECT_ROOT / "backups")
    path = Path(target).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _backup_sqlite(db_url: str) -> Path:
    path = db_url.replace("sqlite:///", "", 1)
    db_path = Path(path)
    if not db_path.is_absolute():
        db_path = (PROJECT_ROOT / db_path).resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite file not found: {db_path}")
    dest = _backup_dir() / f"dpr_ai_sqlite_{_timestamp()}.db"
    shutil.copy2(db_path, dest)
    return dest


def _backup_postgres(db_url: str) -> Path:
    dest = _backup_dir() / f"dpr_ai_pg_{_timestamp()}.dump"
    cmd = ["pg_dump", db_url, "-Fc", "-f", str(dest)]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "pg_dump failed.")
    return dest


def main() -> None:
    db_url = os.getenv("DATABASE_URL") or ""
    if not db_url:
        raise RuntimeError("DATABASE_URL not set.")
    if db_url.startswith("sqlite:///"):
        backup_path = _backup_sqlite(db_url)
    elif db_url.startswith("postgresql"):
        backup_path = _backup_postgres(db_url)
    else:
        raise RuntimeError(f"Unsupported DATABASE_URL: {db_url}")
    print(f"Backup created: {backup_path}")


if __name__ == "__main__":
    main()
