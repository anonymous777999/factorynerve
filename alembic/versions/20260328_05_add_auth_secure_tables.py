"""Add auth-secure tables.

Revision ID: 20260328_05
Revises: 20260328_04
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260328_05"
down_revision = "20260328_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_auth_users_email"),
    )
    op.create_index("ix_auth_users_email", "auth_users", ["email"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("auth_user_id", sa.String(length=36), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("csrf_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_auth_sessions_user_active", "auth_sessions", ["auth_user_id", "revoked_at"])
    op.create_index("ix_auth_sessions_expires", "auth_sessions", ["expires_at"])
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"])

    op.create_table(
        "auth_password_resets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("auth_user_id", sa.String(length=36), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_auth_password_resets_expires", "auth_password_resets", ["expires_at"])
    op.create_index("ix_auth_password_resets_token_hash", "auth_password_resets", ["token_hash"])

    op.create_table(
        "auth_audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("auth_user_id", sa.String(length=36), sa.ForeignKey("auth_users.id"), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip_hash", sa.String(length=128), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=128), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
    )
    op.create_index("ix_auth_audit_logs_user_time", "auth_audit_logs", ["auth_user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_audit_logs_user_time", table_name="auth_audit_logs")
    op.drop_table("auth_audit_logs")

    op.drop_index("ix_auth_password_resets_token_hash", table_name="auth_password_resets")
    op.drop_index("ix_auth_password_resets_expires", table_name="auth_password_resets")
    op.drop_table("auth_password_resets")

    op.drop_index("ix_auth_sessions_token_hash", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_expires", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_active", table_name="auth_sessions")
    op.drop_table("auth_sessions")

    op.drop_index("ix_auth_users_email", table_name="auth_users")
    op.drop_table("auth_users")
