"""Remove legacy invite/session columns no longer used by the application.

Revision ID: 20260423_01
Revises: 20260330_05_invite_note
Create Date: 2026-04-23
"""

from __future__ import annotations

from alembic import op


revision = "20260423_01"
down_revision = "20260330_05_invite_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("pending_registrations") as batch:
        batch.drop_column("custom_note")
        batch.drop_constraint("fk_pending_registrations_invited_by_user_id", type_="foreignkey")
        batch.drop_constraint("fk_pending_registrations_org_id", type_="foreignkey")
        batch.drop_index("ix_pending_registrations_invited_by_user_id")
        batch.drop_index("ix_pending_registrations_org_id")
        batch.drop_column("invited_by_user_id")
        batch.drop_column("org_id")

    with op.batch_alter_table("users") as batch:
        batch.drop_column("session_invalidated_at")


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for legacy invite/session cleanup migration.")
