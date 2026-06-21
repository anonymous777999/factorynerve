"""Steel cash account for cash/bank/digital wallet balance tracking."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelCashAccount(Base):
    __tablename__ = "steel_cash_accounts"
    __table_args__ = (
        Index("ix_steel_cash_accounts_factory_id", "factory_id"),
        Index("ix_steel_cash_accounts_account_type", "account_type"),
        Index("ix_steel_cash_accounts_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    account_name: Mapped[str] = mapped_column(String(160), nullable=False)
    account_type: Mapped[str] = mapped_column(String(24), nullable=False, default="bank")
    account_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    opening_balance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    current_balance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
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
