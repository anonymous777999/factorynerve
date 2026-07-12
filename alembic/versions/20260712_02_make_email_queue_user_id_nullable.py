"""Make email_queue.user_id nullable to support pre-account emails.

Registration and email-verification messages are sent via
``_send_auth_email()`` in ``backend/routers/auth_secure.py`` before any
``User`` row exists (the app uses a verify-first signup flow: a
``PendingRegistration`` row is created, and the real ``User`` is only
created after the email is verified). Those calls pass ``user_id=None``.

``email_queue.user_id`` was ``NOT NULL`` with a FK to ``users.id``, which
is structurally incompatible with this flow. The previous code worked
around this by substituting ``user_id=0`` (an invalid, non-existent user
id), which violates the FK constraint and causes every queue-table insert
for registration/verification emails to fail. The failure was silently
swallowed by a broad ``except Exception`` in
``backend.email_utils.queue_and_send_email``, so actual email delivery
(a separate code path) still worked, but the queue/audit/retry trail for
these emails was silently empty. Confirmed live: zero ``email_queue`` rows
were created across four separate test registrations, while
``pending_registrations`` rows were created correctly every time.

This migration relaxes the constraint to match the corrected model in
``backend/models/email_queue.py`` (``user_id: Mapped[int | None]``).

Revision ID: 20260712_02
Revises: 20260712_01
Create Date: 2026-07-12
"""

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from alembic import op

revision: str = "20260712_02"
down_revision: ClassVar[str] = "20260712_01"
branch_labels: ClassVar[str | None] = None
depends_on: ClassVar[str | None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return name in set(sa.inspect(bind).get_table_names())


def _is_nullable(table: str, column: str) -> bool | None:
    bind = op.get_bind()
    for col in sa.inspect(bind).get_columns(table):
        if col["name"] == column:
            return bool(col["nullable"])
    return None


def upgrade() -> None:
    if not _table_exists("email_queue"):
        print("  ⚠ email_queue table does not exist — skipping.")
        return

    if _is_nullable("email_queue", "user_id"):
        print("  ✓ email_queue.user_id is already nullable — skipped.")
        return

    with op.batch_alter_table("email_queue") as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
    print("  ✓ email_queue: user_id is now nullable.")


def downgrade() -> None:
    if not _table_exists("email_queue"):
        return

    # Guard against orphaned NULL rows before re-tightening the constraint,
    # so downgrade doesn't fail on data written while this migration was
    # applied. There is no meaningful "real" user to backfill these with —
    # deleting them (queue/audit rows only, not user data) is the safest
    # reversible choice.
    op.execute("DELETE FROM email_queue WHERE user_id IS NULL")

    with op.batch_alter_table("email_queue") as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
    print("  ✓ email_queue: user_id is NOT NULL again (NULL rows deleted).")
