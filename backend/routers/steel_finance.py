"""Steel finance intelligence routes: overview, product profitability, receivables, payables, expenses, and CRUD for vendors/bills/expenses."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.authorization import PDP, ResourceContext
from backend.database import get_db
from backend.models.user import User
from backend.models.steel_cash_account import SteelCashAccount
from backend.models.steel_cash_ledger_entry import SteelCashLedgerEntry
from backend.models.steel_expense import SteelExpense
from backend.models.steel_vendor import SteelVendor
from backend.models.steel_vendor_bill import SteelVendorBill
from backend.models.steel_vendor_bill_line import SteelVendorBillLine
from backend.models.steel_vendor_payment import SteelVendorPayment
from backend.models.steel_vendor_payment_allocation import SteelVendorPaymentAllocation
from backend.security import get_current_user
from backend.services.steel_finance import (
    build_cash_flow_monthly_trend,
    build_cash_flow_summary,
    build_expenses_summary,
    build_financial_overview,
    build_payables_summary,
    build_product_profitability,
    build_receivables_summary,
)
from backend.services.steel_service import (
    require_active_steel_factory,
)
from backend.tenancy import resolve_org_id

router = APIRouter(tags=["Steel Finance"])


@router.get("/finance/overview")
def get_steel_financial_overview(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Top-level financial snapshot: revenue, cash collected, realized margin, and receivables."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_financial_overview(db, factory.factory_id, days=days)


@router.get("/finance/product-profitability")
def get_steel_product_profitability(
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Profit margin by finished-good product (estimated from batch costs)."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_product_profitability(db, factory.factory_id, days=days)


@router.get("/finance/receivables")
def get_steel_receivables(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Accounts receivable aging and top overdue customers (allocation-based)."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_receivables_summary(db, factory.factory_id)


# ── Payables Summary ───────────────────────────────────────────────────────


@router.get("/finance/payables")
def get_steel_payables(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Accounts payable aging and top overdue vendors (allocation-based)."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_payables_summary(db, factory.factory_id)


# ── Expenses Summary ───────────────────────────────────────────────────────


@router.get("/finance/expenses")
def get_steel_expenses_summary(
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Operational expenses by category and monthly trend."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_expenses_summary(db, factory.factory_id, days=days)


# ═══════════════════════════════════════════════════════════════════════════
# CRUD: Vendors
# ═══════════════════════════════════════════════════════════════════════════


class VendorCreateRequest(BaseModel):
    vendor_code: str | None = Field(default=None, max_length=24)
    name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    gst_number: str | None = Field(default=None, max_length=32)
    pan_number: str | None = Field(default=None, max_length=16)
    contact_person: str | None = Field(default=None, max_length=160)
    payment_terms_days: int = Field(default=0, ge=0)
    credit_limit: float = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=500)


@router.get("/vendors")
def list_steel_vendors(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    vendors = (
        db.query(SteelVendor)
        .filter(SteelVendor.factory_id == factory.factory_id, SteelVendor.is_active.is_(True))
        .order_by(SteelVendor.name.asc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": v.id,
                "vendor_code": v.vendor_code,
                "name": v.name,
                "phone": v.phone,
                "email": v.email,
                "address": v.address,
                "city": v.city,
                "state": v.state,
                "gst_number": v.gst_number,
                "pan_number": v.pan_number,
                "contact_person": v.contact_person,
                "payment_terms_days": int(v.payment_terms_days or 0),
                "credit_limit": round(float(v.credit_limit or 0.0), 2),
                "status": v.status,
                "notes": v.notes,
                "is_active": v.is_active,
                "created_at": v.created_at.isoformat(),
            }
            for v in vendors
        ]
    }


@router.post("/vendors")
def create_steel_vendor(
    payload: VendorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    existing = (
        db.query(SteelVendor)
        .filter(
            SteelVendor.factory_id == factory.factory_id,
            SteelVendor.name == payload.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A vendor with this name already exists.")

    vendor = SteelVendor(
        org_id=resolve_org_id(current_user),
        factory_id=factory.factory_id,
        vendor_code=payload.vendor_code,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        gst_number=payload.gst_number,
        pan_number=payload.pan_number,
        contact_person=payload.contact_person,
        payment_terms_days=payload.payment_terms_days,
        credit_limit=payload.credit_limit,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return {
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "vendor_code": vendor.vendor_code,
        }
    }


# ═══════════════════════════════════════════════════════════════════════════
# CRUD: Vendor Bills
# ═══════════════════════════════════════════════════════════════════════════


class VendorBillLineCreateRequest(BaseModel):
    item_id: int | None = None
    description: str | None = Field(default=None, max_length=200)
    quantity: float = Field(default=1, gt=0)
    unit: str = Field(default="kg", max_length=16)
    rate: float = Field(default=0, ge=0)
    expense_category: str | None = Field(default=None, max_length=40)


class VendorBillCreateRequest(BaseModel):
    vendor_id: int
    bill_number: str = Field(min_length=1, max_length=40)
    bill_date: date
    due_date: date
    expense_category: str = Field(default="raw_material", max_length=40)
    subtotal_amount: float = Field(default=0, ge=0)
    tax_amount: float = Field(default=0, ge=0)
    total_amount: float = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=500)
    lines: list[VendorBillLineCreateRequest] | None = Field(default=None, max_length=25)


@router.get("/vendor-bills")
def list_steel_vendor_bills(
    limit: int = Query(default=50, ge=1, le=200),
    status: str | None = Query(default=None, max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    query = db.query(SteelVendorBill).filter(SteelVendorBill.factory_id == factory.factory_id)
    if status:
        valid_statuses = {"unpaid", "partial", "paid", "cancelled"}
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(sorted(valid_statuses))}")
        query = query.filter(SteelVendorBill.status == status)

    bills = query.order_by(SteelVendorBill.bill_date.desc()).limit(limit).all()

    vendor_ids = {b.vendor_id for b in bills}
    vendors = (
        db.query(SteelVendor)
        .filter(SteelVendor.id.in_(vendor_ids))
        .all()
    ) if vendor_ids else []
    vendor_map = {v.id: v for v in vendors}

    return {
        "items": [
            {
                "id": b.id,
                "vendor_id": b.vendor_id,
                "vendor_name": vendor_map.get(b.vendor_id).name if vendor_map.get(b.vendor_id) else None,
                "bill_number": b.bill_number,
                "bill_date": b.bill_date.isoformat(),
                "due_date": b.due_date.isoformat(),
                "status": b.status,
                "expense_category": b.expense_category,
                "currency": b.currency,
                "subtotal_amount": round(float(b.subtotal_amount or 0.0), 2),
                "tax_amount": round(float(b.tax_amount or 0.0), 2),
                "total_amount": round(float(b.total_amount or 0.0), 2),
                "notes": b.notes,
                "created_at": b.created_at.isoformat(),
            }
            for b in bills
        ]
    }


@router.post("/vendor-bills")
def create_steel_vendor_bill(
    payload: VendorBillCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    bill = SteelVendorBill(
        org_id=resolve_org_id(current_user),
        factory_id=factory.factory_id,
        vendor_id=payload.vendor_id,
        bill_number=payload.bill_number,
        bill_date=payload.bill_date,
        due_date=payload.due_date,
        status="unpaid",
        expense_category=payload.expense_category,
        currency="INR",
        subtotal_amount=payload.subtotal_amount,
        tax_amount=payload.tax_amount,
        total_amount=payload.total_amount,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(bill)
    db.flush()

    if payload.lines:
        for line in payload.lines:
            line_total = line.quantity * line.rate if line.rate else 0.0
            db.add(SteelVendorBillLine(
                bill_id=bill.id,
                item_id=line.item_id,
                description=line.description,
                quantity=line.quantity,
                unit=line.unit,
                rate=line.rate,
                line_total=line_total,
                expense_category=line.expense_category,
            ))

    db.commit()
    db.refresh(bill)

    return {
        "bill": {
            "id": bill.id,
            "bill_number": bill.bill_number,
            "vendor_id": bill.vendor_id,
            "total_amount": round(float(bill.total_amount or 0.0), 2),
        }
    }


# ═══════════════════════════════════════════════════════════════════════════
# CRUD: Expenses
# ═══════════════════════════════════════════════════════════════════════════


class ExpenseCreateRequest(BaseModel):
    expense_number: str | None = Field(default=None, max_length=40)
    expense_date: date
    category: str = Field(default="other", max_length=40)
    description: str = Field(min_length=2, max_length=300)
    amount: float = Field(default=0, ge=0)
    tax_amount: float = Field(default=0, ge=0)
    total_amount: float = Field(default=0, ge=0)
    payment_status: str = Field(default="unpaid", max_length=16)
    vendor_id: int | None = None
    notes: str | None = Field(default=None, max_length=500)


@router.get("/expenses")
def list_steel_expenses(
    limit: int = Query(default=50, ge=1, le=200),
    category: str | None = Query(default=None, max_length=40),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    query = db.query(SteelExpense).filter(SteelExpense.factory_id == factory.factory_id)
    if category:
        query = query.filter(SteelExpense.category == category)

    expenses = query.order_by(SteelExpense.expense_date.desc()).limit(limit).all()

    return {
        "items": [
            {
                "id": e.id,
                "expense_number": e.expense_number,
                "expense_date": e.expense_date.isoformat(),
                "category": e.category,
                "description": e.description,
                "amount": round(float(e.amount or 0.0), 2),
                "tax_amount": round(float(e.tax_amount or 0.0), 2),
                "total_amount": round(float(e.total_amount or 0.0), 2),
                "payment_status": e.payment_status,
                "vendor_id": e.vendor_id,
                "notes": e.notes,
                "created_at": e.created_at.isoformat(),
            }
            for e in expenses
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════
# Cash Flow Intelligence
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/finance/cash-flow")
def get_steel_cash_flow(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cash flow summary: account balances, breakdown by type, recent transactions."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_cash_flow_summary(db, factory.factory_id)


@router.get("/finance/cash-flow/monthly")
def get_steel_cash_flow_monthly(
    months: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Monthly cash inflow/outflow trend."""
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    return build_cash_flow_monthly_trend(db, factory.factory_id, months=months)


# ═══════════════════════════════════════════════════════════════════════════
# CRUD: Cash Accounts
# ═══════════════════════════════════════════════════════════════════════════


class CashAccountCreateRequest(BaseModel):
    account_name: str = Field(min_length=2, max_length=160)
    account_type: str = Field(default="bank", max_length=24)
    account_number: str | None = Field(default=None, max_length=40)
    bank_name: str | None = Field(default=None, max_length=160)
    ifsc_code: str | None = Field(default=None, max_length=20)
    opening_balance: float = Field(default=0, ge=0)
    currency: str = Field(default="INR", max_length=8)
    notes: str | None = Field(default=None, max_length=500)


@router.get("/cash-accounts")
def list_steel_cash_accounts(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )
    accounts = (
        db.query(SteelCashAccount)
        .filter(
            SteelCashAccount.factory_id == factory.factory_id,
            SteelCashAccount.is_active.is_(True),
        )
        .order_by(SteelCashAccount.account_name.asc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "account_name": a.account_name,
                "account_type": a.account_type,
                "account_number": a.account_number,
                "bank_name": a.bank_name,
                "ifsc_code": a.ifsc_code,
                "opening_balance": round(float(a.opening_balance or 0.0), 2),
                "current_balance": round(float(a.current_balance or 0.0), 2),
                "currency": a.currency,
                "is_active": a.is_active,
                "notes": a.notes,
                "created_at": a.created_at.isoformat(),
            }
            for a in accounts
        ]
    }


@router.post("/cash-accounts")
def create_steel_cash_account(
    payload: CashAccountCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    valid_types = {"bank", "cash", "digital_wallet"}
    if payload.account_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"account_type must be one of: {', '.join(sorted(valid_types))}",
        )

    account = SteelCashAccount(
        org_id=resolve_org_id(current_user),
        factory_id=factory.factory_id,
        account_name=payload.account_name,
        account_type=payload.account_type,
        account_number=payload.account_number,
        bank_name=payload.bank_name,
        ifsc_code=payload.ifsc_code,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance,
        currency=payload.currency,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(account)
    db.flush()

    # Create opening balance ledger entry if opening_balance > 0
    if payload.opening_balance > 0:
        entry = SteelCashLedgerEntry(
            org_id=resolve_org_id(current_user),
            factory_id=factory.factory_id,
            account_id=account.id,
            entry_date=date.today(),
            entry_type="debit",
            amount=payload.opening_balance,
            balance_after=payload.opening_balance,
            description=f"Opening balance for {payload.account_name}",
            category="opening_balance",
            payment_mode="bank_transfer",
            created_by_user_id=current_user.id,
        )
        db.add(entry)

    db.commit()
    db.refresh(account)

    return {
        "account": {
            "id": account.id,
            "account_name": account.account_name,
            "account_type": account.account_type,
            "current_balance": round(float(account.current_balance or 0.0), 2),
        }
    }


# ═══════════════════════════════════════════════════════════════════════════
# CRUD: Cash Ledger Entries
# ═══════════════════════════════════════════════════════════════════════════


class LedgerEntryCreateRequest(BaseModel):
    account_id: int
    entry_date: date
    entry_type: str = Field(max_length=8, pattern="^(debit|credit)$")
    amount: float = Field(gt=0)
    description: str = Field(min_length=2, max_length=300)
    reference_type: str | None = Field(default=None, max_length=40)
    reference_id: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=40)
    payment_mode: str = Field(default="bank_transfer", max_length=24)
    notes: str | None = Field(default=None, max_length=500)


@router.get("/cash-ledger")
def list_steel_cash_ledger(
    account_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    query = (
        db.query(SteelCashLedgerEntry)
        .filter(SteelCashLedgerEntry.factory_id == factory.factory_id)
    )
    if account_id is not None:
        query = query.filter(SteelCashLedgerEntry.account_id == account_id)

    entries = query.order_by(SteelCashLedgerEntry.entry_date.desc(), SteelCashLedgerEntry.created_at.desc()).limit(limit).all()

    account_ids = {e.account_id for e in entries}
    accounts = (
        db.query(SteelCashAccount)
        .filter(SteelCashAccount.id.in_(account_ids))
        .all()
    ) if account_ids else []
    account_map = {a.id: a for a in accounts}

    return {
        "items": [
            {
                "id": e.id,
                "account_id": e.account_id,
                "account_name": account_map.get(e.account_id).account_name if account_map.get(e.account_id) else None,
                "entry_date": e.entry_date.isoformat(),
                "entry_type": e.entry_type,
                "amount": round(float(e.amount or 0.0), 2),
                "balance_after": round(float(e.balance_after or 0.0), 2),
                "reference_type": e.reference_type,
                "reference_id": e.reference_id,
                "description": e.description,
                "category": e.category,
                "payment_mode": e.payment_mode,
                "notes": e.notes,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    }


@router.post("/cash-ledger")
def create_steel_cash_ledger_entry(
    payload: LedgerEntryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    account = db.query(SteelCashAccount).filter(
        SteelCashAccount.id == payload.account_id,
        SteelCashAccount.factory_id == factory.factory_id,
    ).with_for_update().first()
    if not account:
        raise HTTPException(status_code=404, detail="Cash account not found in this factory.")

    # Compute new balance
    current_balance = float(account.current_balance or 0.0)
    if payload.entry_type == "debit":
        new_balance = current_balance + payload.amount
    else:
        new_balance = current_balance - payload.amount

    entry = SteelCashLedgerEntry(
        org_id=resolve_org_id(current_user),
        factory_id=factory.factory_id,
        account_id=payload.account_id,
        entry_date=payload.entry_date,
        entry_type=payload.entry_type,
        amount=payload.amount,
        balance_after=new_balance,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        description=payload.description,
        category=payload.category,
        payment_mode=payload.payment_mode,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(entry)

    # Update account balance
    account.current_balance = new_balance
    db.commit()
    db.refresh(entry)

    return {
        "entry": {
            "id": entry.id,
            "account_id": entry.account_id,
            "entry_type": entry.entry_type,
            "amount": round(float(entry.amount or 0.0), 2),
            "balance_after": round(float(entry.balance_after or 0.0), 2),
        }
    }


@router.post("/expenses")
def create_steel_expense(
    payload: ExpenseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        factory = require_active_steel_factory(db, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    PDP(db=db).require_permission(
        actor=current_user,
        permission_key="customer.record.view",
        resource=ResourceContext(factory_id=factory.factory_id),
    )

    expense = SteelExpense(
        org_id=resolve_org_id(current_user),
        factory_id=factory.factory_id,
        expense_number=payload.expense_number,
        expense_date=payload.expense_date,
        category=payload.category,
        description=payload.description,
        amount=payload.amount,
        tax_amount=payload.tax_amount,
        total_amount=payload.total_amount,
        payment_status=payload.payment_status,
        vendor_id=payload.vendor_id,
        notes=payload.notes,
        created_by_user_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    return {
        "expense": {
            "id": expense.id,
            "expense_number": expense.expense_number,
            "category": expense.category,
            "total_amount": round(float(expense.total_amount or 0.0), 2),
        }
    }
