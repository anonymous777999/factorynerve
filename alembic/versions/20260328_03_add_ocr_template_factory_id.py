"""Add factory_id to OCR templates.

Revision ID: 20260328_03
Revises: 20260328_02
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_03"
down_revision = "20260328_02"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def _fk_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {fk["name"] for fk in inspector.get_foreign_keys(table_name) if fk.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    columns = _column_names("ocr_templates")
    if "factory_id" not in columns:
        op.add_column("ocr_templates", sa.Column("factory_id", sa.String(length=36), nullable=True))

    indexes = _index_names("ocr_templates")
    if "ix_ocr_templates_factory_id" not in indexes:
        op.create_index("ix_ocr_templates_factory_id", "ocr_templates", ["factory_id"])

    if dialect != "sqlite":
        fks = _fk_names("ocr_templates")
        if "fk_ocr_templates_factory_id_factories" not in fks:
            op.create_foreign_key(
                "fk_ocr_templates_factory_id_factories",
                "ocr_templates",
                "factories",
                ["factory_id"],
                ["factory_id"],
            )

    op.execute(
        """
        UPDATE ocr_templates
        SET factory_id = (
            SELECT factory_id FROM factories
            WHERE factories.name = ocr_templates.factory_name
            LIMIT 1
        )
        WHERE factory_id IS NULL
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect != "sqlite":
        fks = _fk_names("ocr_templates")
        if "fk_ocr_templates_factory_id_factories" in fks:
            op.drop_constraint("fk_ocr_templates_factory_id_factories", "ocr_templates", type_="foreignkey")
    indexes = _index_names("ocr_templates")
    if "ix_ocr_templates_factory_id" in indexes:
        op.drop_index("ix_ocr_templates_factory_id", table_name="ocr_templates")
    columns = _column_names("ocr_templates")
    if "factory_id" in columns:
        op.drop_column("ocr_templates", "factory_id")
