"""Add structured OCR metadata fields.

Revision ID: 20260425_04
Revises: 20260425_03
Create Date: 2026-04-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_04"
down_revision = "20260425_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("ocr_verifications")}

    if "document_hash" not in columns:
        op.add_column("ocr_verifications", sa.Column("document_hash", sa.String(length=128), nullable=True))
    if "doc_type_hint" not in columns:
        op.add_column("ocr_verifications", sa.Column("doc_type_hint", sa.String(length=80), nullable=True))
    if "routing_meta" not in columns:
        op.add_column("ocr_verifications", sa.Column("routing_meta", sa.JSON(), nullable=True))
    if "raw_text" not in columns:
        op.add_column("ocr_verifications", sa.Column("raw_text", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("ocr_verifications")}

    if "raw_text" in columns:
        op.drop_column("ocr_verifications", "raw_text")
    if "routing_meta" in columns:
        op.drop_column("ocr_verifications", "routing_meta")
    if "doc_type_hint" in columns:
        op.drop_column("ocr_verifications", "doc_type_hint")
    if "document_hash" in columns:
        op.drop_column("ocr_verifications", "document_hash")
