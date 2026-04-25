"""Add in-app feedback table.

Revision ID: 20260425_02
Revises: 20260425_01
Create Date: 2026-04-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_02"
down_revision = "20260425_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "feedback" not in table_names:
        op.create_table(
            "feedback",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("org_id", sa.String(length=36), nullable=False),
            sa.Column("factory_id", sa.String(length=36), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("type", sa.String(length=32), nullable=False),
            sa.Column("source", sa.String(length=32), nullable=False, server_default="floating"),
            sa.Column("channel", sa.String(length=16), nullable=False, server_default="text"),
            sa.Column("mood", sa.String(length=16), nullable=True),
            sa.Column("message_original", sa.Text(), nullable=False),
            sa.Column("message_translated", sa.Text(), nullable=True),
            sa.Column("detected_language", sa.String(length=24), nullable=True),
            sa.Column("translation_status", sa.String(length=24), nullable=False, server_default="not_requested"),
            sa.Column("context", sa.JSON(), nullable=True),
            sa.Column("dedupe_hash", sa.String(length=64), nullable=False),
            sa.Column("client_request_id", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=24), nullable=False, server_default="open"),
            sa.Column("resolution_note", sa.Text(), nullable=True),
            sa.Column("resolved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("org_id", "user_id", "client_request_id", name="uq_feedback_org_user_client_request"),
        )

    indexes = {index["name"] for index in inspector.get_indexes("feedback")}
    if "ix_feedback_org_id" not in indexes:
        op.create_index("ix_feedback_org_id", "feedback", ["org_id"], unique=False)
    if "ix_feedback_factory_id" not in indexes:
        op.create_index("ix_feedback_factory_id", "feedback", ["factory_id"], unique=False)
    if "ix_feedback_user_id" not in indexes:
        op.create_index("ix_feedback_user_id", "feedback", ["user_id"], unique=False)
    if "ix_feedback_type" not in indexes:
        op.create_index("ix_feedback_type", "feedback", ["type"], unique=False)
    if "ix_feedback_status" not in indexes:
        op.create_index("ix_feedback_status", "feedback", ["status"], unique=False)
    if "ix_feedback_created_at" not in indexes:
        op.create_index("ix_feedback_created_at", "feedback", ["created_at"], unique=False)
    if "ix_feedback_org_status_created_at" not in indexes:
        op.create_index(
            "ix_feedback_org_status_created_at",
            "feedback",
            ["org_id", "status", "created_at"],
            unique=False,
        )
    if "ix_feedback_dedupe_hash" not in indexes:
        op.create_index("ix_feedback_dedupe_hash", "feedback", ["dedupe_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_feedback_dedupe_hash", table_name="feedback")
    op.drop_index("ix_feedback_org_status_created_at", table_name="feedback")
    op.drop_index("ix_feedback_created_at", table_name="feedback")
    op.drop_index("ix_feedback_status", table_name="feedback")
    op.drop_index("ix_feedback_type", table_name="feedback")
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_index("ix_feedback_factory_id", table_name="feedback")
    op.drop_index("ix_feedback_org_id", table_name="feedback")
    op.drop_table("feedback")
