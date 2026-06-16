"""Create approval_instances table for maker-checker approval workflows.

The ApprovalInstance model was defined in backend/models/approval_instance.py
but no migration was ever generated. The init_db() compatibility bootstrap
skips Base.metadata.create_all() when legacy tables exist, so the table was
never created in production.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260616_01_add_approval_instances_table"
down_revision = "20260614_02_factory_scoped_unique_constraints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_instances",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("instance_id", sa.String(length=36), nullable=False),
        sa.Column("workflow_key", sa.String(length=64), nullable=False),
        sa.Column("action_key", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("org_id", sa.String(length=36), nullable=True),
        sa.Column("factory_id", sa.String(length=36), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("subject_user_id", sa.Integer(), nullable=True),
        sa.Column("current_workflow_state", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="approved"),
        sa.Column("approval_stage", sa.String(length=8), nullable=True),
        sa.Column("requested_change", sa.JSON(), nullable=True),
        sa.Column("attributes", sa.JSON(), nullable=True),
        sa.Column("request_context", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("rejected_by_user_id", sa.Integer(), nullable=True),
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_approval_instances"),
    )

    op.create_index(
        "ix_approval_instances_instance_id",
        "approval_instances",
        ["instance_id"],
        unique=True,
    )
    op.create_index(
        "ix_approval_instances_actor_user_id",
        "approval_instances",
        ["actor_user_id"],
    )
    op.create_index(
        "ix_approval_instances_subject_user_id",
        "approval_instances",
        ["subject_user_id"],
    )
    op.create_index(
        "ix_approval_instances_status",
        "approval_instances",
        ["status"],
    )
    op.create_index(
        "ix_approval_instances_workflow_key",
        "approval_instances",
        ["workflow_key"],
    )
    op.create_index(
        "ix_approval_instances_org_id",
        "approval_instances",
        ["org_id"],
    )
    op.create_index(
        "ix_approval_instances_factory_id",
        "approval_instances",
        ["factory_id"],
    )
    op.create_index(
        "ix_approval_instances_resource",
        "approval_instances",
        ["resource_type", "resource_id"],
    )
    op.create_index(
        "ix_approval_instances_expires_at",
        "approval_instances",
        ["expires_at"],
    )
    op.create_index(
        "ix_approval_instances_org_status",
        "approval_instances",
        ["org_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_approval_instances_org_status", table_name="approval_instances")
    op.drop_index("ix_approval_instances_expires_at", table_name="approval_instances")
    op.drop_index("ix_approval_instances_resource", table_name="approval_instances")
    op.drop_index("ix_approval_instances_factory_id", table_name="approval_instances")
    op.drop_index("ix_approval_instances_org_id", table_name="approval_instances")
    op.drop_index("ix_approval_instances_workflow_key", table_name="approval_instances")
    op.drop_index("ix_approval_instances_status", table_name="approval_instances")
    op.drop_index("ix_approval_instances_subject_user_id", table_name="approval_instances")
    op.drop_index("ix_approval_instances_actor_user_id", table_name="approval_instances")
    op.drop_index("ix_approval_instances_instance_id", table_name="approval_instances")
    op.drop_table("approval_instances")
