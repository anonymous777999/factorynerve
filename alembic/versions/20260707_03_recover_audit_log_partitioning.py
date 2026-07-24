"""Recover audit_logs partitioning after failed migration 20260707_02.

Migration 20260707_02 failed on production because it referenced the
PK constraint as ``audit_logs_pkey`` (PostgreSQL default) while the
project's naming convention uses ``pk_audit_logs``.

The migration was stamped as applied but only partially ran (Step 1
dropped some indexes, Step 2 failed). This recovery migration:

1. Checks if ``audit_logs`` already has a composite PK ``(id, timestamp)``
   — if so, partitioning is already complete, skip.
2. Otherwise, drops the old PK, creates the composite PK, and
   converts ``audit_logs`` to a monthly-range partitioned table.

This recovery deliberately references ``audit_logs_pkey`` (the real, applied
PostgreSQL-default name) with ``IF EXISTS`` guards, precisely to undo the naming
mismatch that broke 20260707_02. It therefore opts out of the naming linter:
# migration-lint: ignore-file

Revision ID: 20260707_03
Revises: 20260707_02
Create Date: 2026-07-07
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260707_03"
down_revision: ClassVar[str] = "20260707_02"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _dialect_is_postgresql(bind: sa.engine.Connection) -> bool:
    return bind.dialect.name == "postgresql"


def _partition_name(year: int, month: int) -> str:
    return f"audit_logs_{year}_{month:02d}"


def _partition_boundary(year: int, month: int) -> str:
    if month == 12:
        return f"{year + 1}-01-01"
    return f"{year}-{month + 1:02d}-01"


def _create_monthly_partition_sql(year: int, month: int) -> str:
    name = _partition_name(year, month)
    bound = _partition_boundary(year, month)
    return f"""
        CREATE TABLE IF NOT EXISTS {name}
        PARTITION OF audit_logs
        FOR VALUES FROM ('{year}-{month:02d}-01') TO ('{bound}');
    """


def _pk_columns(bind: sa.engine.Connection, table: str) -> set[str]:
    """Return the set of column names in the primary key for *table*."""
    inspector = sa.inspect(bind)
    pk = inspector.get_pk_constraint(table)
    return set(pk.get("constrained_columns", []))


def upgrade() -> None:
    bind = op.get_bind()
    if not _dialect_is_postgresql(bind):
        print("  ⚠ Skipping audit_logs partitioning recovery — not PostgreSQL.")
        return

    # ── Check if already partitioned ──────────────────────────────────
    existing_pk = _pk_columns(bind, "audit_logs")
    if "timestamp" in existing_pk and "id" in existing_pk:
        print(
            "  ✓ audit_logs PK is already (id, timestamp) — "
            "partitioning appears complete. Skipping."
        )
        return

    print(
        "  ⚠ audit_logs PK is %s — recovery needed."
        % (str(existing_pk) if existing_pk else "missing")
    )
    print("  ✓ PostgreSQL detected — recovering audit_logs partitioning.")

    now = datetime.now(timezone.utc)

    # ── Step 1: Drop the old PK ──────────────────────────────────────
    # The project naming convention uses pk_{table_name} for PK constraints.
    op.execute("ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS pk_audit_logs;")
    op.execute("ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;")

    # ── Step 2: Drop existing indexes (recreated later) ──────────────
    indexes_to_drop = [
        "ix_audit_logs_user_id",
        "ix_audit_logs_org_id",
        "ix_audit_logs_factory_id",
        "ix_audit_logs_timestamp",
        "ix_audit_logs_factory_action",
    ]
    for idx in indexes_to_drop:
        op.execute(f"DROP INDEX IF EXISTS {idx};")

    # ── Step 3: Add composite PK ──────────────────────────────────────
    op.execute(
        "ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey "
        "PRIMARY KEY (id, timestamp);"
    )
    print("  ✓ Updated primary key to (id, timestamp).")

    # ── Step 4: Convert to partitioned table ─────────────────────────
    op.execute("ALTER TABLE audit_logs SET WITHOUT CLUSTER;")
    op.execute("ALTER TABLE audit_logs SET (fillfactor = 100);")

    op.execute(
        "CREATE TABLE audit_logs_new ("
        "  LIKE audit_logs INCLUDING DEFAULTS INCLUDING CONSTRAINTS,"
        "  CONSTRAINT audit_logs_pkey PRIMARY KEY (id, timestamp)"
        ") PARTITION BY RANGE (timestamp);"
    )

    op.execute("""
        CREATE TABLE audit_logs_default PARTITION OF audit_logs_new DEFAULT;
    """)

    op.execute("""
        INSERT INTO audit_logs_new
        SELECT * FROM audit_logs;
    """)

    op.execute("DROP TABLE audit_logs CASCADE;")
    op.execute("ALTER TABLE audit_logs_new RENAME TO audit_logs;")

    # ── Step 5: Recreate RLS policies ─────────────────────────────────
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY rls_org_isolation ON audit_logs
        FOR ALL USING (
            _rls_tenant_id() IS NULL
            OR org_id = _rls_tenant_id()
        );
    """)
    op.execute("""
        CREATE POLICY rls_factory_isolation ON audit_logs
        FOR ALL USING (
            _rls_tenant_id() IS NULL
            OR (
                org_id = _rls_tenant_id()
                AND factory_id = current_setting('app.current_factory_id')::text
            )
        );
    """)
    print("  ✓ Recreated RLS policies on audit_logs.")

    # ── Step 6: Create monthly partitions ────────────────────────────
    current_year = now.year
    current_month = now.month
    for offset in range(7):
        m = current_month + offset
        y = current_year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        op.execute(_create_monthly_partition_sql(y, m))

    print("  ✓ Created monthly partitions for current + 6 months.")

    # ── Step 7: Create partition manager function ────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_partition_manager(target_date date DEFAULT CURRENT_DATE)
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
            year int;
            month int;
            part_name text;
            bound text;
        BEGIN
            year := EXTRACT(YEAR FROM target_date);
            month := EXTRACT(MONTH FROM target_date);
            part_name := 'audit_logs_' || year || '_' || LPAD(month::text, 2, '0');
            bound := CASE
                WHEN month = 12 THEN (year + 1) || '-01-01'
                ELSE year || '-' || LPAD((month + 1)::text, 2, '0') || '-01'
            END;
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs '
                'FOR VALUES FROM (%L) TO (%L)',
                part_name,
                year || '-' || LPAD(month::text, 2, '0') || '-01',
                bound
            );
        END;
        $$;
    """)
    print("  ✓ Created audit_partition_manager() helper function.")

    # ── Step 8: Recreate indexes ─────────────────────────────────────
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_org_id", "audit_logs", ["org_id"])
    op.create_index("ix_audit_logs_factory_id", "audit_logs", ["factory_id"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index(
        "ix_audit_logs_factory_action", "audit_logs", ["factory_id", "action"]
    )

    print("  ✓ Recreated indexes on partitioned audit_logs.")
    print("  ✓ Partitioning recovery complete.")


def downgrade() -> None:
    bind = op.get_bind()
    if not _dialect_is_postgresql(bind):
        print("  ⚠ Skipping audit_logs partitioning downgrade — not PostgreSQL.")
        return

    print("  ✓ Reverting audit_logs partitioning.")

    op.execute("""
        DO $$
        DECLARE
            part_record RECORD;
        BEGIN
            FOR part_record IN
                SELECT inhrelid::regclass::text AS partition_name
                FROM pg_catalog.pg_inherits
                WHERE inhparent = 'audit_logs'::regclass
            LOOP
                EXECUTE format('ALTER TABLE %s NO INHERIT audit_logs;', part_record.partition_name);
            END LOOP;
        END;
        $$;
    """)

    op.execute("""
        CREATE TABLE audit_logs_old (LIKE audit_logs INCLUDING ALL);
    """)

    op.execute("""
        INSERT INTO audit_logs_old SELECT * FROM audit_logs;
    """)

    op.execute("DROP TABLE audit_logs CASCADE;")
    op.execute("ALTER TABLE audit_logs_old RENAME TO audit_logs;")

    op.execute("ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_pkey;")
    op.execute("ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);")

    op.execute("DROP FUNCTION IF EXISTS audit_partition_manager();")
    print("  ✓ Partitioning reverted. audit_logs is a regular table again.")
