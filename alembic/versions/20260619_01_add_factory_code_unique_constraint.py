"""Enforce unique factory_code at DB level (Bug #49).

The Factory model already declares unique=True on factory_code, but the
DB constraint was never added via migration. The existing index
ix_factories_code is non-unique, so duplicate codes can exist.

This migration:
1. Detects and resolves duplicate factory_code values by nullifying them.
2. Drops the non-unique ix_factories_code index.
3. Creates a unique ix_factories_code index.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260619_01_add_factory_code_unique_constraint"
down_revision = "20260616_01_add_approval_instances_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Resolve duplicate factory_code values before applying the unique constraint.
    # Nullify duplicates (keep the first occurrence) so the migration doesn't fail.
    if dialect == "postgresql":
        bind.execute(
            sa.text(
                """
                UPDATE factories
                SET factory_code = NULL
                WHERE factory_id IN (
                    SELECT factory_id
                    FROM (
                        SELECT factory_id,
                               ROW_NUMBER() OVER (PARTITION BY factory_code ORDER BY created_at ASC) AS rn
                        FROM factories
                        WHERE factory_code IS NOT NULL
                    ) sub
                    WHERE sub.rn > 1
                )
                """
            )
        )
    else:
        # SQLite fallback: subquery-based dedup
        bind.execute(
            sa.text(
                """
                UPDATE factories
                SET factory_code = NULL
                WHERE factory_id IN (
                    SELECT f2.factory_id
                    FROM factories f1
                    JOIN factories f2
                      ON f2.factory_code = f1.factory_code
                     AND f2.factory_id != f1.factory_id
                     AND f2.created_at > f1.created_at
                    WHERE f1.factory_code IS NOT NULL
                )
                """
            )
        )

    # Drop the existing non-unique index
    op.drop_index("ix_factories_code", table_name="factories")
    # Recreate it as a unique index
    op.create_index("ix_factories_code", "factories", ["factory_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_factories_code", table_name="factories")
    op.create_index("ix_factories_code", "factories", ["factory_code"], unique=False)
