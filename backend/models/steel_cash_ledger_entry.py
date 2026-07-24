"""Steel cash ledger entry for tracking individual cash/bank transactions."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class SteelCashLedgerEntry(Base):
    __tablename__ = "steel_cash_ledger_entries"
    __table_args__ = (
        Index("ix_steel_cash_ledger_entries_factory_id", "factory_id"),
        Index("ix_steel_cash_ledger_entries_account_id", "account_id"),
        Index("ix_steel_cash_ledger_entries_entry_date", "entry_date"),
        Index("ix_steel_cash_ledger_entries_entry_type", "entry_type"),
        Index("ix_steel_cash_ledger_entries_reference_type", "reference_type"),
        Index("ix_steel_cash_ledger_entries_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.factory_id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("steel_cash_accounts.id"), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_type: Mapped[str] = mapped_column(String(8), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    balance_after: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    reference_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    payment_mode: Mapped[str] = mapped_column(String(24), nullable=False, default="bank_transfer")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
