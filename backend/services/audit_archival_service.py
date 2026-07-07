"""Background scheduler for audit log partition management.

Manages the lifecycle of monthly partitions on the ``audit_logs`` table
(PostgreSQL only):

- **Auto-create future partitions**: Ensures monthly partitions exist for
  at least 6 months ahead.
- **Archive old partitions** (hot → cold): Partitions older than
  ``AUDIT_RETENTION_HOT_DAYS`` (default 730 = 2 years) are exported to
  CSV files and detached.
- **Drop expired partitions** (cold → deleted): Detached partition data
  older than ``AUDIT_RETENTION_COLD_DAYS`` (default 1825 = 5 years) is
  dropped (CSV files remain for compliance).

Follows the same daemon-thread pattern as ApprovalExpiryService,
AttendanceAutoCloseService, and other scheduler services for consistency.

On SQLite/other dialects, the service is a no-op — it logs a warning
and skips partition management.
"""

from __future__ import annotations

import csv
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text

from backend.database import SessionLocal

logger = logging.getLogger(__name__)

# ── Default Configuration ────────────────────────────────────────────────
DEFAULT_POLL_SECONDS = 86_400.0  # 24 hours (run once daily)
RETENTION_HOT_DAYS = int(os.getenv("AUDIT_RETENTION_HOT_DAYS", "730"))  # 2 years
RETENTION_COLD_DAYS = int(os.getenv("AUDIT_RETENTION_COLD_DAYS", "1825"))  # 5 years
ARCHIVE_PATH = Path(
    os.getenv("AUDIT_ARCHIVE_PATH", str(Path(__file__).resolve().parents[2] / "exports" / "audit_archive"))
)

# ── Module-level singleton ────────────────────────────────────────────────
_service_lock = threading.Lock()
_service: AuditArchivalService | None = None


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _is_postgresql() -> bool:
    """Check if connected to PostgreSQL (partitioning is PG-only)."""
    try:
        with SessionLocal() as db:
            return db.bind.dialect.name == "postgresql"
    except Exception:
        return False


def _get_audit_partitions() -> list[dict[str, Any]]:
    """Query pg_inherits to discover all audit_logs partition names and bounds."""
    partitions: list[dict[str, Any]] = []
    try:
        with SessionLocal() as db:
            rows = db.execute(
                text("""
                    SELECT
                        inhrelid::regclass::text AS partition_name,
                        pg_get_expr(relpartbound, inhrelid) AS partition_bound
                    FROM pg_catalog.pg_inherits
                    JOIN pg_catalog.pg_class ON pg_class.oid = inhrelid
                    WHERE inhparent = 'audit_logs'::regclass
                      AND relkind = 'p'  -- partitioned table partitions
                    ORDER BY partition_name
                """)
            ).fetchall()
            for row in rows:
                partitions.append({
                    "name": str(row[0]),
                    "bound": str(row[1]) if row[1] else "",
                })
    except Exception:
        logger.warning("Could not query audit_logs partitions.", exc_info=True)
    return partitions


def _create_audit_partition(target_date: datetime) -> bool:
    """Call the audit_partition_manager() PG function to create a monthly partition."""
    try:
        with SessionLocal() as db:
            db.execute(
                text("SELECT audit_partition_manager(:target_date)"),
                {"target_date": target_date.date()},
            )
            db.commit()
            return True
    except Exception:
        logger.warning(
            "Failed to create audit partition for %s.",
            target_date.strftime("%Y-%m"),
            exc_info=True,
        )
        return False


def _ensure_future_partitions(months_ahead: int = 6) -> int:
    """Create monthly partitions for the next N months.

    Returns the number of partitions created.
    """
    now = datetime.now(timezone.utc)
    created = 0
    for offset in range(months_ahead):
        target = datetime(now.year + (now.month + offset - 1) // 12,
                          ((now.month + offset - 1) % 12) + 1, 1,
                          tzinfo=timezone.utc)
        if _create_audit_partition(target):
            created += 1
    return created


def _export_partition_to_csv(partition_name: str) -> Path | None:
    """Export a partition's data to a CSV file and return the file path.

    Creates the archive directory if it doesn't exist.
    Returns None if the export fails.
    """
    ARCHIVE_PATH.mkdir(parents=True, exist_ok=True)
    csv_path = ARCHIVE_PATH / f"{partition_name}.csv"

    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(f"SELECT * FROM {partition_name} ORDER BY id")
            ).fetchall()

            if not rows:
                logger.info("Partition %s is empty — skipping export.", partition_name)
                return csv_path  # Return path even for empty files

            columns = rows[0]._fields

            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                for row in rows:
                    writer.writerow(row)

        logger.info("Exported partition %s to %s (%d rows).", partition_name, csv_path, len(rows))
        return csv_path
    except Exception:
        logger.exception("Failed to export partition %s to CSV.", partition_name)
        return None


def _detach_and_drop_partition(partition_name: str) -> bool:
    """Detach a partition from the audit_logs table and drop it.

    Returns True on success.
    """
    try:
        with SessionLocal() as db:
            db.execute(text(f"ALTER TABLE audit_logs DETACH PARTITION {partition_name};"))
            db.execute(text(f"DROP TABLE IF EXISTS {partition_name};"))
            db.commit()
            logger.info("Detached and dropped partition %s.", partition_name)
            return True
    except Exception:
        logger.exception("Failed to detach/drop partition %s.", partition_name)
        return False


def _archive_old_partitions() -> list[str]:
    """Archive partitions older than RETENTION_HOT_DAYS.

    For each old partition: export to CSV, then detach and drop.
    Returns a list of archived partition names.
    """
    cutoff = datetime.now(timezone.utc).date()
    archived: list[str] = []

    partitions = _get_audit_partitions()
    for part in partitions:
        name = part["name"]

        # Skip non-monthly partitions (e.g., audit_logs_default)
        if name == "audit_logs_default":
            continue

        # Extract year and month from partition name: audit_logs_YYYY_MM
        parts = name.split("_")
        if len(parts) < 3:
            continue
        try:
            year = int(parts[-2])
            month = int(parts[-1])
        except (ValueError, IndexError):
            continue

        # Check if this partition is old enough to archive
        if year is not None and month is not None:
            try:
                partition_date = datetime(year, month, 1).date()
                days_old = (cutoff - partition_date).days
            except (ValueError, TypeError):
                continue

            if days_old > RETENTION_HOT_DAYS:
                csv_path = _export_partition_to_csv(name)
                if csv_path:
                    if _detach_and_drop_partition(name):
                        archived.append(name)

    if archived:
        logger.info("Archived %d old partition(s): %s", len(archived), ", ".join(archived))
    return archived


def _drop_expired_csv_archives() -> int:
    """Drop CSV archive files older than RETENTION_COLD_DAYS.

    Returns the number of files deleted.
    """
    cutoff = datetime.now(timezone.utc).timestamp() - RETENTION_COLD_DAYS * 86_400
    deleted = 0

    if not ARCHIVE_PATH.exists():
        return 0

    for csv_file in ARCHIVE_PATH.glob("audit_logs_*.csv"):
        try:
            if csv_file.stat().st_mtime < cutoff:
                csv_file.unlink()
                deleted += 1
                logger.info("Deleted expired archive: %s", csv_file.name)
        except Exception:
            logger.warning("Failed to delete expired archive: %s", csv_file.name)

    return deleted


# ── Service Class ──────────────────────────────────────────────────────────


class AuditArchivalService:
    """Background scheduler for audit log partition lifecycle management.

    Runs daily (configurable via poll_interval_seconds) and:
    1. Creates future monthly partitions (6 months ahead).
    2. Archives partitions older than RETENTION_HOT_DAYS to CSV.
    3. Drops CSV archive files older than RETENTION_COLD_DAYS.

    On SQLite or non-PostgreSQL databases, the service logs a warning
    and exits without scheduling.
    """

    def __init__(self, poll_interval_seconds: float = DEFAULT_POLL_SECONDS) -> None:
        self.poll_interval_seconds = max(60.0, poll_interval_seconds)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._pg_available: bool = _is_postgresql()

        if not self._pg_available:
            logger.warning(
                "Audit archival service initialized on non-PostgreSQL database. "
                "Partition management is a no-op."
            )

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="audit-archival-scheduler",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "Audit archival scheduler started (poll_interval=%.0fs, pg=%s).",
            self.poll_interval_seconds,
            self._pg_available,
        )

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=3.0)
            self._thread = None
        logger.info("Audit archival scheduler stopped.")

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._run_once()
            except Exception:
                logger.exception("Audit archival sweep failed.")
            if self._stop.wait(self.poll_interval_seconds):
                break

    def _run_once(self) -> None:
        if not self._pg_available:
            return

        logger.info("Starting audit partition management sweep.")

        # Step 1: Ensure future partitions exist
        created = _ensure_future_partitions(months_ahead=6)
        if created:
            logger.info("Created %d future audit log partition(s).", created)

        # Step 2: Archive old partitions
        archived = _archive_old_partitions()
        if archived:
            logger.info("Archived %d old audit log partition(s).", len(archived))

        # Step 3: Drop expired CSV archives
        deleted = _drop_expired_csv_archives()
        if deleted:
            logger.info("Deleted %d expired CSV archive(s).", deleted)

        logger.info("Audit partition management sweep complete.")


# ── Module-level lifecycle functions ───────────────────────────────────────


def initialize_audit_archival_service() -> None:
    """Create and start the audit archival service.

    Called during application startup (main.py lifespan). No-op if the
    AUDIT_ARCHIVAL_ENABLED env var is explicitly set to false.
    """
    global _service
    enabled = _env_bool("AUDIT_ARCHIVAL_ENABLED", default=True)
    if not enabled:
        logger.info("Audit archival service disabled via env var.")
        return

    with _service_lock:
        if _service is not None:
            return
        poll_seconds = _env_float("AUDIT_ARCHIVAL_POLL_SECONDS", DEFAULT_POLL_SECONDS)
        service = AuditArchivalService(poll_interval_seconds=poll_seconds)
        service.start()
        _service = service


def shutdown_audit_archival_service() -> None:
    """Stop the audit archival service.

    Called during application shutdown (main.py lifespan finally).
    """
    global _service
    with _service_lock:
        if _service is None:
            return
        _service.stop()
        _service = None
