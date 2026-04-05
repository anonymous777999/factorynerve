"""Restore DPR.ai database from a backup."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


def _resolve_db_path(db_url: str) -> Path:
    path = db_url.replace("sqlite:///", "", 1)
    db_path = Path(path)
    if not db_path.is_absolute():
        db_path = (PROJECT_ROOT / db_path).resolve()
    return db_path


def _restore_sqlite(db_url: str, backup_path: Path) -> None:
    target = _resolve_db_path(db_url)
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup not found: {backup_path}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup_path, target)


def _restore_postgres(db_url: str, backup_path: Path) -> None:
    if not backup_path.exists():
        raise FileNotFoundError(f"Backup not found: {backup_path}")
    cmd = ["pg_restore", "--clean", "--if-exists", "-d", db_url, str(backup_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "pg_restore failed.")


def main() -> None:
    db_url = os.getenv("DATABASE_URL") or ""
    if not db_url:
        raise RuntimeError("DATABASE_URL not set.")
    if len(sys.argv) < 2:
        raise RuntimeError("Usage: python scripts/restore.py <backup_file>")
    backup_path = Path(sys.argv[1]).expanduser().resolve()
    if db_url.startswith("sqlite:///"):
        _restore_sqlite(db_url, backup_path)
    elif db_url.startswith("postgresql"):
        _restore_postgres(db_url, backup_path)
    else:
        raise RuntimeError(f"Unsupported DATABASE_URL: {db_url}")
    print(f"Restore completed: {backup_path}")


if __name__ == "__main__":
    main()
