"""Steel vendor master for accounts payable tracking."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelVendor(Base):
    __tablename__ = "steel_vendors"
    __table_args__ = (
        Index("ix_steel_vendors_factory_id", "factory_id"),
        Index("uq_steel_vendors_factory_name", "factory_id", "name", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    vendor_code: Mapped[str | None] = mapped_column(String(24), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pan_number: Mapped[str | None] = mapped_column(String(16), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(160), nullable=True)
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
