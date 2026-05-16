"""Remove standalone WhatsApp recipient pipeline and migrate verified rows.

Revision ID: 20260516_01
Revises: 20260513_01
Create Date: 2026-05-16
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from alembic import context, op
import sqlalchemy as sa


revision = "20260516_01"
down_revision = "20260513_01"
branch_labels = None
depends_on = None

VERIFIED_STATUS = "verified"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    return _utcnow()


def _normalize_phone(value: Any) -> str:
    return str(value or "").strip()


def _table_names(bind: sa.engine.Connection) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def _read_legacy_rows(bind: sa.engine.Connection) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in bind.execute(
            sa.text(
                """
                SELECT id, name, phone_e164, is_active, created_at
                FROM alert_recipients
                ORDER BY id ASC
                """
            )
        ).mappings()
    ]


def _read_verified_users(bind: sa.engine.Connection) -> dict[str, list[dict[str, Any]]]:
    rows = bind.execute(
        sa.text(
            """
            SELECT id, org_id, phone_e164, phone_verified_at
            FROM users
            WHERE phone_e164 IS NOT NULL
              AND TRIM(phone_e164) != ''
              AND phone_verification_status = :verified_status
            """
        ),
        {"verified_status": VERIFIED_STATUS},
    ).mappings()
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        phone = _normalize_phone(row["phone_e164"])
        if phone:
            grouped[phone].append(dict(row))
    return grouped


def _resolve_verified_recipients(bind: sa.engine.Connection) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    legacy_rows = _read_legacy_rows(bind)
    verified_users_by_phone = _read_verified_users(bind)
    resolved: list[dict[str, Any]] = []
    unresolved_messages: list[str] = []
    ambiguous_messages: list[str] = []

    for row in legacy_rows:
        phone = _normalize_phone(row["phone_e164"])
        matches = verified_users_by_phone.get(phone, [])
        if not matches:
            unresolved_messages.append(
                f"legacy recipient id={row['id']} phone={phone or '<blank>'} has no verified user/org match"
            )
            continue

        org_ids = {str(match["org_id"]) for match in matches if str(match.get("org_id") or "").strip()}
        if len(org_ids) != 1:
            ambiguous_messages.append(
                f"legacy recipient id={row['id']} phone={phone} maps to multiple orgs={sorted(org_ids)}"
            )
            continue

        match = matches[0]
        resolved.append(
            {
                "recipient_id": int(row["id"]),
                "phone_e164": phone,
                "name": str(row.get("name") or phone),
                "is_active": bool(row.get("is_active")),
                "created_at": _coerce_datetime(row.get("created_at")),
                "org_id": str(match["org_id"]),
                "user_id": int(match["id"]) if match.get("id") is not None else None,
                "verified_at": _coerce_datetime(match.get("phone_verified_at")) if match.get("phone_verified_at") else None,
            }
        )

    return resolved, unresolved_messages, ambiguous_messages


def _existing_admin_pairs(bind: sa.engine.Connection) -> set[tuple[str, str]]:
    table_names = _table_names(bind)
    if "admin_alert_recipients" not in table_names:
        return set()
    rows = bind.execute(
        sa.text(
            """
            SELECT org_id, phone_number
            FROM admin_alert_recipients
            """
        )
    ).mappings()
    return {
        (str(row["org_id"]), _normalize_phone(row["phone_number"]))
        for row in rows
        if str(row.get("org_id") or "").strip() and _normalize_phone(row.get("phone_number"))
    }


def _insert_admin_recipients(bind: sa.engine.Connection, rows: list[dict[str, Any]]) -> int:
    existing = _existing_admin_pairs(bind)
    inserted = 0
    for row in rows:
        key = (str(row["org_id"]), str(row["phone_e164"]))
        if key in existing:
            continue
        bind.execute(
            sa.text(
                """
                INSERT INTO admin_alert_recipients (
                    org_id,
                    user_id,
                    phone_number,
                    phone_e164,
                    verification_status,
                    verified_at,
                    verified_by_user_id,
                    otp_attempts,
                    last_otp_sent_at,
                    event_types,
                    severity_levels,
                    receive_daily_summary,
                    is_active,
                    created_at
                ) VALUES (
                    :org_id,
                    :user_id,
                    :phone_number,
                    :phone_e164,
                    :verification_status,
                    :verified_at,
                    NULL,
                    0,
                    NULL,
                    NULL,
                    NULL,
                    TRUE,
                    :is_active,
                    :created_at
                )
                """
            ),
            {
                "org_id": row["org_id"],
                "user_id": row["user_id"],
                "phone_number": row["phone_e164"],
                "phone_e164": row["phone_e164"],
                "verification_status": VERIFIED_STATUS,
                "verified_at": row["verified_at"],
                "is_active": row["is_active"],
                "created_at": row["created_at"],
            },
        )
        existing.add(key)
        inserted += 1
    return inserted


def _count_rows(bind: sa.engine.Connection, table_name: str) -> int:
    return int(bind.execute(sa.text(f"SELECT COUNT(*) FROM {table_name}")).scalar_one())


def _drop_table_if_exists(table_name: str) -> None:
    bind = op.get_bind()
    if table_name in _table_names(bind):
        op.drop_table(table_name)


def _emit_warning(message: str) -> None:
    migration_context = context.get_context()
    output_buffer = getattr(migration_context, "output_buffer", None)
    if output_buffer is not None:
        output_buffer.write(f"WARNING: {message}\n")
        return
    print(f"WARNING: {message}")


def upgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)
    if "alert_recipients" in table_names:
        resolved_rows, unresolved_messages, ambiguous_messages = _resolve_verified_recipients(bind)
        if unresolved_messages or ambiguous_messages:
            problems = unresolved_messages + ambiguous_messages
            message = (
                "Standalone WhatsApp recipient migration aborted. "
                "The following rows cannot be migrated cleanly to admin_alert_recipients:\n- "
                + "\n- ".join(problems[:20])
            )
            if len(problems) > 20:
                message += f"\n- ... {len(problems) - 20} additional rows omitted"
            raise RuntimeError(message)
        _insert_admin_recipients(bind, resolved_rows)

    standalone_counts: dict[str, int] = {}
    for table_name in ("alert_logs", "alert_preferences", "alert_recipients"):
        if table_name in table_names:
            standalone_counts[table_name] = _count_rows(bind, table_name)
            if standalone_counts[table_name] > 0:
                _emit_warning(
                    f"dropping standalone table {table_name} with {standalone_counts[table_name]} row(s)"
                )

    _drop_table_if_exists("alert_logs")
    _drop_table_if_exists("alert_preferences")
    _drop_table_if_exists("alert_recipients")


def downgrade() -> None:
    bind = op.get_bind()
    table_names = _table_names(bind)
    if "alert_recipients" not in table_names:
        op.create_table(
            "alert_recipients",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("phone_e164", sa.String(length=20), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("phone_e164", name="uq_alert_recipients_phone_e164"),
        )
        op.create_index("ix_alert_recipients_phone_e164", "alert_recipients", ["phone_e164"], unique=False)
        op.create_index("ix_alert_recipients_is_active", "alert_recipients", ["is_active"], unique=False)
        op.create_index("ix_alert_recipients_created_at", "alert_recipients", ["created_at"], unique=False)

    if "alert_preferences" not in table_names:
        op.create_table(
            "alert_preferences",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("recipient_id", sa.Integer(), nullable=False),
            sa.Column("alert_type", sa.String(length=80), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.ForeignKeyConstraint(["recipient_id"], ["alert_recipients.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("recipient_id", "alert_type", name="uq_alert_preferences_recipient_alert_type"),
        )
        op.create_index("ix_alert_preferences_recipient_id", "alert_preferences", ["recipient_id"], unique=False)
        op.create_index("ix_alert_preferences_alert_type", "alert_preferences", ["alert_type"], unique=False)

    if "alert_logs" not in table_names:
        op.create_table(
            "alert_logs",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
            sa.Column("recipient_id", sa.Integer(), nullable=False),
            sa.Column("alert_type", sa.String(length=80), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("provider", sa.String(length=32), nullable=True),
            sa.Column("provider_message_id", sa.String(length=255), nullable=True),
            sa.Column("provider_response", sa.JSON(), nullable=True),
            sa.Column("failure_reason", sa.Text(), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["alert_recipients.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_alert_logs_recipient_id", "alert_logs", ["recipient_id"], unique=False)
        op.create_index("ix_alert_logs_status", "alert_logs", ["status"], unique=False)
        op.create_index("ix_alert_logs_created_at", "alert_logs", ["created_at"], unique=False)
