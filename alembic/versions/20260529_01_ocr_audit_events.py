"""add OCR audit events and lifecycle fields

IMPORTANT: This migration was ALREADY APPLIED to production but its file was
deleted from the codebase in commit e1bfa19. Upgrade/downgrade are empty
because the schema changes are already in place.

Revision ID: 20260529_01
Revises: e9d27018633b
Create Date: 2026-05-29 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


revision = "20260529_01"
down_revision = "e9d27018633b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Already applied to production — no-op.
    pass


def downgrade() -> None:
    # Would need the original downgrade logic if reversing, but this is a
    # restoration stub for an already-applied migration.
    pass
