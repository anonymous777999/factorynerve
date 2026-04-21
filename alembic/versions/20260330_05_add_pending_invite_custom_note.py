"""add pending invite custom note

Revision ID: 20260330_05_add_pending_invite_custom_note
Revises: 20260330_04
Create Date: 2026-03-30 18:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_05_add_pending_invite_custom_note"
down_revision = "20260330_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pending_registrations", sa.Column("custom_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pending_registrations", "custom_note")
