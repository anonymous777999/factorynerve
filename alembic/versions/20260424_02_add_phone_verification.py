"""Add OTP-backed phone verification for users and alert recipients.

Revision ID: 20260424_02
Revises: 20260424_01
Create Date: 2026-04-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260424_02"
down_revision = "20260424_01"
branch_labels = None
depends_on = None


phone_verification_status = sa.Enum("pending", "verified", "failed", name="phone_verification_status")
phone_verification_channel = sa.Enum("sms", "whatsapp", name="phone_verification_channel")
phone_verification_purpose = sa.Enum("user_verification", "alert_recipient", name="phone_verification_purpose")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "phone_e164" not in user_columns:
        op.add_column("users", sa.Column("phone_e164", sa.String(length=20), nullable=True))
    if "phone_verification_status" not in user_columns:
        op.add_column(
            "users",
            sa.Column("phone_verification_status", sa.String(length=24), nullable=False, server_default="pending"),
        )
    if "phone_verified_at" not in user_columns:
        op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
    if "phone_last_otp_sent_at" not in user_columns:
        op.add_column("users", sa.Column("phone_last_otp_sent_at", sa.DateTime(timezone=True), nullable=True))
    if "phone_otp_attempts" not in user_columns:
        op.add_column("users", sa.Column("phone_otp_attempts", sa.Integer(), nullable=False, server_default="0"))

    recipient_columns = {column["name"] for column in inspector.get_columns("admin_alert_recipients")}
    if "phone_e164" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("phone_e164", sa.String(length=20), nullable=True))
    if "verification_status" not in recipient_columns:
        op.add_column(
            "admin_alert_recipients",
            sa.Column("verification_status", sa.String(length=24), nullable=False, server_default="pending"),
        )
    if "verified_at" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    if "verified_by_user_id" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("verified_by_user_id", sa.Integer(), nullable=True))
    if "otp_attempts" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default="0"))
    if "last_otp_sent_at" not in recipient_columns:
        op.add_column("admin_alert_recipients", sa.Column("last_otp_sent_at", sa.DateTime(timezone=True), nullable=True))
    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("admin_alert_recipients")}
    if "fk_admin_alert_recipients_verified_by_user_id_users" not in existing_fks:
        op.create_foreign_key(
            "fk_admin_alert_recipients_verified_by_user_id_users",
            "admin_alert_recipients",
            "users",
            ["verified_by_user_id"],
            ["id"],
        )

    if "phone_verifications" not in table_names:
        op.create_table(
            "phone_verifications",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("phone_e164", sa.String(length=20), nullable=False),
            sa.Column("otp_hash", sa.String(length=72), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("channel", sa.String(length=24), nullable=False),
            sa.Column("purpose", sa.String(length=40), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("recipient_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["admin_alert_recipients.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    existing_phone_indexes = {index["name"] for index in inspector.get_indexes("phone_verifications")}
    if "ix_phone_verifications_phone_purpose_active" not in existing_phone_indexes:
        op.create_index(
            "ix_phone_verifications_phone_purpose_active",
            "phone_verifications",
            ["phone_e164", "purpose", "used", "expires_at"],
            unique=False,
        )
    if "ix_phone_verifications_user_id" not in existing_phone_indexes:
        op.create_index("ix_phone_verifications_user_id", "phone_verifications", ["user_id"], unique=False)
    if "ix_phone_verifications_recipient_id" not in existing_phone_indexes:
        op.create_index("ix_phone_verifications_recipient_id", "phone_verifications", ["recipient_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_phone_verifications_recipient_id", table_name="phone_verifications")
    op.drop_index("ix_phone_verifications_user_id", table_name="phone_verifications")
    op.drop_index("ix_phone_verifications_phone_purpose_active", table_name="phone_verifications")
    op.drop_table("phone_verifications")

    op.drop_constraint("fk_admin_alert_recipients_verified_by_user_id_users", "admin_alert_recipients", type_="foreignkey")
    op.drop_column("admin_alert_recipients", "last_otp_sent_at")
    op.drop_column("admin_alert_recipients", "otp_attempts")
    op.drop_column("admin_alert_recipients", "verified_by_user_id")
    op.drop_column("admin_alert_recipients", "verified_at")
    op.drop_column("admin_alert_recipients", "verification_status")
    op.drop_column("admin_alert_recipients", "phone_e164")

    op.drop_column("users", "phone_otp_attempts")
    op.drop_column("users", "phone_last_otp_sent_at")
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "phone_verification_status")
    op.drop_column("users", "phone_e164")

    bind = op.get_bind()
    phone_verification_purpose.drop(bind, checkfirst=True)
    phone_verification_channel.drop(bind, checkfirst=True)
    phone_verification_status.drop(bind, checkfirst=True)
