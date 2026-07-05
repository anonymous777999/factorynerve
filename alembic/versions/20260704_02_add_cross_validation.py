"""Add cross_validation column to ocr_verifications table.

Revision ID: 20260704_02
Revises: e9d27018633b
Create Date: 2026-07-04 14:00:00.000000
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260704_02"
down_revision: str | None = "e9d27018633b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ocr_verifications",
        sa.Column("cross_validation", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ocr_verifications", "cross_validation")
