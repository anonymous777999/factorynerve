"""merge_notifications_and_cross_validation_heads

Merge the two migration branches:
  - notifications branch  (20260704_01_add_notifications_table)
  - cross-validation branch (20260704_02_add_ocr_cross_validation)

Revision ID: 20260704_03
Revises: 20260704_01_add_notifications_table, 20260704_02_add_ocr_cross_validation
Create Date: 2026-07-04
"""

from __future__ import annotations

from typing import ClassVar

from alembic import op
import sqlalchemy as sa


revision: str = "20260704_03"
down_revision: ClassVar[tuple[str, str]] = (
    "20260704_01_add_notifications_table",
    "20260704_02_add_ocr_cross_validation",
)
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
