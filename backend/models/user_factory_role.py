"""Junction table for user roles per factory."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.user import UserRole


class UserFactoryRole(Base):
    __tablename__ = "user_factory_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "factory_id", name="uq_user_factory"),
        Index("ix_user_factory_roles_org_id", "org_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole, name="user_factory_role"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = relationship("User", back_populates="factory_roles")
    factory = relationship("Factory", back_populates="user_roles")
