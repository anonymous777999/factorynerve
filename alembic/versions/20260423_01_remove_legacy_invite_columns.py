"""Remove legacy invite/session columns no longer used by the application.

Revision ID: 20260423_01
Revises: 20260330_05_invite_note
Create Date: 2026-04-23
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260423_01"
down_revision = "20260330_05_invite_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "pending_registrations" in table_names:
        columns = {column["name"] for column in inspector.get_columns("pending_registrations")}
        indexes = {index["name"] for index in inspector.get_indexes("pending_registrations")}
        foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("pending_registrations") if fk.get("name")}
        with op.batch_alter_table("pending_registrations") as batch:
            if "custom_note" in columns:
                batch.drop_column("custom_note")
            if "fk_pending_registrations_invited_by_user_id" in foreign_keys:
                batch.drop_constraint("fk_pending_registrations_invited_by_user_id", type_="foreignkey")
            if "fk_pending_registrations_org_id" in foreign_keys:
                batch.drop_constraint("fk_pending_registrations_org_id", type_="foreignkey")
            if "ix_pending_registrations_invited_by_user_id" in indexes:
                batch.drop_index("ix_pending_registrations_invited_by_user_id")
            if "ix_pending_registrations_org_id" in indexes:
                batch.drop_index("ix_pending_registrations_org_id")
            if "invited_by_user_id" in columns:
                batch.drop_column("invited_by_user_id")
            if "org_id" in columns:
                batch.drop_column("org_id")

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "session_invalidated_at" in user_columns:
            with op.batch_alter_table("users") as batch:
                batch.drop_column("session_invalidated_at")


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for legacy invite/session cleanup migration.")
