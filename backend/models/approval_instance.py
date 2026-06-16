"""ApprovalInstance ORM model — DB-backed storage for maker-checker approval workflows.

Replaces the Phase P1 in-memory dict storage. Each row tracks one approval instance
through its lifecycle: no_approval_required -> pending_l1 -> pending_l2 -> approved/rejected.

Supports:
- IP-2 (single stage maker-checker)
- IP-3 (sequential two-stage with L1/L2)
- IP-4 (cross-domain/parallel)
- IP-5 (critical/emergency dual approval)
- TTL/expiry per workflow type
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ApprovalInstance(Base):
    """Persistent approval instance tracking its lifecycle state."""

    __tablename__ = "approval_instances"
    __table_args__ = (
        Index("ix_approval_instances_actor_user_id", "actor_user_id"),
        Index("ix_approval_instances_subject_user_id", "subject_user_id"),
        Index("ix_approval_instances_status", "status"),
        Index("ix_approval_instances_workflow_key", "workflow_key"),
        Index("ix_approval_instances_org_id", "org_id"),
        Index("ix_approval_instances_factory_id", "factory_id"),
        Index("ix_approval_instances_resource", "resource_type", "resource_id"),
        Index("ix_approval_instances_expires_at", "expires_at"),
        Index("ix_approval_instances_org_status", "org_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instance_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)

    # Workflow identifiers
    workflow_key: Mapped[str] = mapped_column(String(64), nullable=False)
    action_key: Mapped[str] = mapped_column(String(64), nullable=False)

    # Resource being acted on
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(64), nullable=False)

    # Multi-tenant scoping
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    factory_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Actor (person taking action) vs Subject (person who created the resource)
    actor_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    subject_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Workflow state
    current_workflow_state: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="approved",
        # index=True removed — the index is defined explicitly
        # in __table_args__ as ix_approval_instances_status.
        # Having both creates a duplicate on SQLite.
    )
    approval_stage: Mapped[str | None] = mapped_column(String(8), nullable=True)  # L1, L2

    # Change tracking
    requested_change: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    attributes: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    request_context: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # TTL / expiry
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Completion metadata
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rejected_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to the same dict format expected by the Phase P1 in-memory callers."""
        return {
            "instance_id": self.instance_id,
            "workflow_key": self.workflow_key,
            "action_key": self.action_key,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "org_id": self.org_id,
            "factory_id": self.factory_id,
            "actor_user_id": self.actor_user_id,
            "subject_user_id": self.subject_user_id,
            "current_workflow_state": self.current_workflow_state,
            "requested_change": self.requested_change,
            "attributes": self.attributes,
            "request_context": self.request_context,
            "status": self.status,
            "approval_stage": self.approval_stage,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "approved_by_user_id": self.approved_by_user_id,
            "rejected_by_user_id": self.rejected_by_user_id,
            "rejection_reason": self.rejection_reason,
        }
