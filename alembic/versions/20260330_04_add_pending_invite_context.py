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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "pending_registrations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("pending_registrations")}
    indexes = {index["name"] for index in inspector.get_indexes("pending_registrations")}
    foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("pending_registrations") if fk.get("name")}
    with op.batch_alter_table("pending_registrations") as batch:
        if "org_id" not in columns:
            batch.add_column(sa.Column("org_id", sa.String(length=36), nullable=True))
        if "invited_by_user_id" not in columns:
            batch.add_column(sa.Column("invited_by_user_id", sa.Integer(), nullable=True))
        if "ix_pending_registrations_org_id" not in indexes:
            batch.create_index("ix_pending_registrations_org_id", ["org_id"], unique=False)
        if "ix_pending_registrations_invited_by_user_id" not in indexes:
            batch.create_index("ix_pending_registrations_invited_by_user_id", ["invited_by_user_id"], unique=False)
        if "fk_pending_registrations_org_id" not in foreign_keys:
            batch.create_foreign_key("fk_pending_registrations_org_id", "organizations", ["org_id"], ["org_id"])
        if "fk_pending_registrations_invited_by_user_id" not in foreign_keys:
            batch.create_foreign_key("fk_pending_registrations_invited_by_user_id", "users", ["invited_by_user_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("pending_registrations") as batch:
        batch.drop_constraint("fk_pending_registrations_invited_by_user_id", type_="foreignkey")
        batch.drop_constraint("fk_pending_registrations_org_id", type_="foreignkey")
        batch.drop_index("ix_pending_registrations_invited_by_user_id")
        batch.drop_index("ix_pending_registrations_org_id")
        batch.drop_column("invited_by_user_id")
        batch.drop_column("org_id")
