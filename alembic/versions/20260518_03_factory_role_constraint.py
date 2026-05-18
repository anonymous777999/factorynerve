"""Enforce factory role rank against global role and add audit state snapshots.

Revision ID: 20260518_03
Revises: 20260518_02
Create Date: 2026-05-18

Uses trigger functions with CASE rank mapping because cross-table role validation
cannot be enforced with a plain CHECK constraint or foreign key on PostgreSQL.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_03"
down_revision = "20260518_02"
branch_labels = None
depends_on = None


_ROLE_RANK_CASE = """
CASE %s
    WHEN 'attendance' THEN 0
    WHEN 'operator' THEN 1
    WHEN 'supervisor' THEN 2
    WHEN 'accountant' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'admin' THEN 4
    WHEN 'owner' THEN 5
    ELSE -1
END
"""


def upgrade() -> None:
    bind = op.get_bind()
    json_type = postgresql.JSONB(astext_type=sa.Text()) if bind.dialect.name == "postgresql" else sa.JSON()
    op.add_column("audit_logs", sa.Column("previous_state", json_type, nullable=True))
    op.add_column("audit_logs", sa.Column("new_state", json_type, nullable=True))

    if bind.dialect.name != "postgresql":
        return

    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION enforce_user_factory_role_rank()
        RETURNS trigger AS $$
        DECLARE
            global_role_text text;
            factory_role_rank integer;
            global_role_rank integer;
        BEGIN
            SELECT role::text INTO global_role_text
            FROM users
            WHERE id = NEW.user_id;

            IF global_role_text IS NULL THEN
                RAISE EXCEPTION 'User % not found for factory role assignment', NEW.user_id;
            END IF;

            factory_role_rank := {_ROLE_RANK_CASE % "NEW.role::text"};
            global_role_rank := {_ROLE_RANK_CASE % "global_role_text"};

            IF factory_role_rank > global_role_rank THEN
                RAISE EXCEPTION 'Factory role % exceeds global role % for user %', NEW.role, global_role_text, NEW.user_id;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_user_factory_roles_role_rank
        BEFORE INSERT OR UPDATE OF user_id, role
        ON user_factory_roles
        FOR EACH ROW
        EXECUTE FUNCTION enforce_user_factory_role_rank();
        """
    )
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION enforce_user_global_role_floor()
        RETURNS trigger AS $$
        DECLARE
            global_role_rank integer;
            highest_factory_role_rank integer;
        BEGIN
            global_role_rank := {_ROLE_RANK_CASE % "NEW.role::text"};

            SELECT MAX({_ROLE_RANK_CASE % "role::text"})
            INTO highest_factory_role_rank
            FROM user_factory_roles
            WHERE user_id = NEW.id;

            IF COALESCE(highest_factory_role_rank, -1) > global_role_rank THEN
                RAISE EXCEPTION 'Global role % is below an assigned factory role for user %', NEW.role, NEW.id;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_users_role_floor
        BEFORE UPDATE OF role
        ON users
        FOR EACH ROW
        EXECUTE FUNCTION enforce_user_global_role_floor();
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS trg_user_factory_roles_role_rank ON user_factory_roles;")
        op.execute("DROP FUNCTION IF EXISTS enforce_user_factory_role_rank();")
        op.execute("DROP TRIGGER IF EXISTS trg_users_role_floor ON users;")
        op.execute("DROP FUNCTION IF EXISTS enforce_user_global_role_floor();")

    op.drop_column("audit_logs", "new_state")
    op.drop_column("audit_logs", "previous_state")
