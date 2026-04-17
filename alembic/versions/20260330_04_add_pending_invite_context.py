"""Add organization and inviter context to pending registrations.

Revision ID: 20260330_04
Revises: 20260330_03
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260330_04"
down_revision = "20260330_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("pending_registrations") as batch:
        batch.add_column(sa.Column("org_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("invited_by_user_id", sa.Integer(), nullable=True))
        batch.create_index("ix_pending_registrations_org_id", ["org_id"], unique=False)
        batch.create_index("ix_pending_registrations_invited_by_user_id", ["invited_by_user_id"], unique=False)
        batch.create_foreign_key("fk_pending_registrations_org_id", "organizations", ["org_id"], ["org_id"])
        batch.create_foreign_key("fk_pending_registrations_invited_by_user_id", "users", ["invited_by_user_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("pending_registrations") as batch:
        batch.drop_constraint("fk_pending_registrations_invited_by_user_id", type_="foreignkey")
        batch.drop_constraint("fk_pending_registrations_org_id", type_="foreignkey")
        batch.drop_index("ix_pending_registrations_invited_by_user_id")
        batch.drop_index("ix_pending_registrations_org_id")
        batch.drop_column("invited_by_user_id")
        batch.drop_column("org_id")
