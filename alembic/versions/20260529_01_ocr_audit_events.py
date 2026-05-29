"""add OCR audit events and lifecycle fields

Revision ID: 20260529_01
Revises: e9d27018633b
Create Date: 2026-05-29 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260529_01"
down_revision = "e9d27018633b"
branch_labels = None
depends_on = None


def _table_names(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "ocr_verifications" in tables:
        columns = _column_names(bind, "ocr_verifications")
        with op.batch_alter_table("ocr_verifications") as batch_op:
            if "export_state" not in columns:
                batch_op.add_column(sa.Column("export_state", sa.String(length=32), nullable=False, server_default="pending"))
            if "last_action" not in columns:
                batch_op.add_column(sa.Column("last_action", sa.String(length=40), nullable=False, server_default="uploaded"))
            if "reviewed_by" not in columns:
                batch_op.add_column(sa.Column("reviewed_by", sa.Integer(), nullable=True))
            if "exported_by" not in columns:
                batch_op.add_column(sa.Column("exported_by", sa.Integer(), nullable=True))

        indexes = _index_names(bind, "ocr_verifications")
        if "ix_ocr_verifications_export_state" not in indexes:
            op.create_index("ix_ocr_verifications_export_state", "ocr_verifications", ["export_state"])

    if "ocr_audit_events" not in tables:
        op.create_table(
            "ocr_audit_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("document_id", sa.Integer(), nullable=False),
            sa.Column("event_type", sa.String(length=40), nullable=False),
            sa.Column("actor", sa.String(length=120), nullable=True),
            sa.Column("actor_user_id", sa.Integer(), nullable=True),
            sa.Column("event_metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["document_id"], ["ocr_verifications.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ocr_audit_events_id", "ocr_audit_events", ["id"])
        op.create_index("ix_ocr_audit_events_document_id", "ocr_audit_events", ["document_id"])
        op.create_index("ix_ocr_audit_events_document_time", "ocr_audit_events", ["document_id", "created_at"])
        op.create_index("ix_ocr_audit_events_event_type", "ocr_audit_events", ["event_type"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "ocr_audit_events" in tables:
        op.drop_index("ix_ocr_audit_events_event_type", table_name="ocr_audit_events")
        op.drop_index("ix_ocr_audit_events_document_time", table_name="ocr_audit_events")
        op.drop_index("ix_ocr_audit_events_document_id", table_name="ocr_audit_events")
        op.drop_index("ix_ocr_audit_events_id", table_name="ocr_audit_events")
        op.drop_table("ocr_audit_events")

    if "ocr_verifications" in tables:
        indexes = _index_names(bind, "ocr_verifications")
        if "ix_ocr_verifications_export_state" in indexes:
            op.drop_index("ix_ocr_verifications_export_state", table_name="ocr_verifications")
        columns = _column_names(bind, "ocr_verifications")
        with op.batch_alter_table("ocr_verifications") as batch_op:
            for column_name in ("exported_by", "reviewed_by", "last_action", "export_state"):
                if column_name in columns:
                    batch_op.drop_column(column_name)
