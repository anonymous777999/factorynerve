"""Per-document-type business rule validators for OCR extraction.

Each function decorated with ``@validation_rule`` is registered by
document type and returns a list of ``ValidationIssue`` objects.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Callable

from backend.validators.validation_types import ValidationIssue


logger = logging.getLogger(__name__)

# ── Rule Registry ────────────────────────────────────────────────────────────
# Maps doc_type -> list of (rule_name, callable)
_rule_registry: dict[str, list[tuple[str, Callable[..., list[ValidationIssue]]]]] = {}


def validation_rule(doc_type: str, name: str):
    """Decorator that registers a validation rule for a specific document type."""
    def decorator(func: Callable[..., list[ValidationIssue]]):
        _rule_registry.setdefault(doc_type, []).append((name, func))
        return func
    return decorator


def get_rules_for(doc_type: str) -> list[tuple[str, Callable[..., list[ValidationIssue]]]]:
    """Return all registered rules for the given document type."""
    return _rule_registry.get(doc_type, [])


def get_all_rules() -> dict[str, list[tuple[str, Callable[..., list[ValidationIssue]]]]]:
    """Return the full rule registry."""
    return dict(_rule_registry)


# ── Helper ───────────────────────────────────────────────────────────────────

def _parse_float(value: Any) -> float | None:
    """Safely parse a numeric value, handling Indian number formats."""
    if value is None:
        return None
    try:
        cleaned = str(value).replace(",", "").replace(" ", "").replace("₹", "").replace("$", "").replace("INR", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _validate_gstin(gstin: str) -> bool:
    """Basic GSTIN validation: 15-char alphanumeric, state code prefix, PAN+checksum."""
    cleaned = str(gstin).strip().upper()
    if len(cleaned) != 15:
        return False
    # Pattern: 2-digit state code + 10-char PAN + 1 entity code + 1 Z + 1 checksum
    if not re.match(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[A-Z]{1}\d{1}$", cleaned):
        return False
    return True


# =============================================================================
# GST INVOICE rules
# =============================================================================

@validation_rule("invoice", "line_item_math")
def validate_line_item_math(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Verify qty × rate = taxable_value for each invoice line item.

    Matches the spec example:
    ``Qty × Rate = 500000, but declared as 50000``
    """
    issues: list[ValidationIssue] = []
    qty_idx = _find_header_index(headers, "qty", "quantity")
    rate_idx = _find_header_index(headers, "rate")
    taxable_idx = _find_header_index(headers, "taxable", "taxable_value", "amount", "total")

    if qty_idx is None or rate_idx is None or taxable_idx is None:
        return issues  # Can't validate without all columns

    for row_idx, row in enumerate(rows):
        qty = _parse_float(row[qty_idx] if qty_idx < len(row) else None)
        rate = _parse_float(row[rate_idx] if rate_idx < len(row) else None)
        taxable = _parse_float(row[taxable_idx] if taxable_idx < len(row) else None)

        if qty is None or rate is None or taxable is None:
            issues.append(ValidationIssue(
                field=f"line_items.{row_idx}",
                message=f"Invalid numeric values in line {row_idx + 1}",
                severity="error",
            ))
            continue

        expected = round(qty * rate, 2)
        if abs(expected - taxable) > 0.01:
            issues.append(ValidationIssue(
                field=f"line_items.{row_idx}.taxable_value",
                message=f"Qty × Rate = {expected}, but declared as {taxable}",
                severity="error",
                suggested_value=str(expected),
            ))

    return issues


@validation_rule("invoice", "gstin_format")
def validate_gstin_format(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Validate GSTIN format in invoice header fields."""
    issues: list[ValidationIssue] = []
    gstin_idx = _find_header_index(headers, "gstin", "gst", "gst_no", "gst_number")

    if gstin_idx is None:
        return issues

    for row_idx, row in enumerate(rows):
        if gstin_idx < len(row):
            gstin = str(row[gstin_idx]).strip()
            if gstin and not _validate_gstin(gstin):
                suggested = None
                # If length is wrong, suggest correct length as hint
                if len(gstin) != 15:
                    suggested = f"Must be 15 characters (found {len(gstin)})"
                issues.append(ValidationIssue(
                    field=f"invoice_header.supplier.gstin",
                    message=f"GSTIN must be 15 characters (found {len(gstin)})" if len(gstin) != 15
                           else f"GSTIN '{gstin}' has invalid format",
                    severity="error",
                    suggested_value=suggested,
                ))
            break  # Only check first row's GSTIN (header field)

    return issues


# =============================================================================
# WEIGHBRIDGE SLIP rules
# =============================================================================

@validation_rule("weighbridge_slip", "gross_vs_tare")
def validate_weighbridge_weights(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Verify gross > tare and net = gross - tare for weighbridge slips."""
    issues: list[ValidationIssue] = []
    gross_idx = _find_header_index(headers, "gross", "gross_weight", "gross_wt")
    tare_idx = _find_header_index(headers, "tare", "tare_weight", "tare_wt")
    net_idx = _find_header_index(headers, "net", "net_weight", "net_wt")

    for row_idx, row in enumerate(rows):
        gross = _parse_float(row[gross_idx] if gross_idx is not None and gross_idx < len(row) else None)
        tare = _parse_float(row[tare_idx] if tare_idx is not None and tare_idx < len(row) else None)
        net = _parse_float(row[net_idx] if net_idx is not None and net_idx < len(row) else None)

        if gross is not None and tare is not None:
            if gross <= tare:
                issues.append(ValidationIssue(
                    field=f"weights.{row_idx}",
                    message=f"Gross weight ({gross}) must be greater than tare weight ({tare})",
                    severity="error",
                ))

        if gross is not None and tare is not None and net is not None:
            expected_net = round(gross - tare, 2)
            if abs(expected_net - net) > 0.01:
                issues.append(ValidationIssue(
                    field=f"weights.{row_idx}.net",
                    message=f"Net weight should be gross - tare = {expected_net}, but declared as {net}",
                    severity="warning",
                    suggested_value=str(expected_net),
                ))

    return issues


# =============================================================================
# DELIVERY NOTE rules
# =============================================================================

@validation_rule("delivery_note", "delivered_vs_ordered")
def validate_delivery_quantities(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Verify delivered quantity ≤ ordered quantity for delivery notes."""
    issues: list[ValidationIssue] = []
    ordered_idx = _find_header_index(headers, "ordered", "order_qty", "ordered_qty", "po_qty")
    delivered_idx = _find_header_index(headers, "delivered", "delivered_qty", "qty", "quantity")

    if ordered_idx is None:
        return issues
    if delivered_idx is None:
        delivered_idx = ordered_idx  # Fall back if only one qty column

    for row_idx, row in enumerate(rows):
        ordered = _parse_float(row[ordered_idx] if ordered_idx < len(row) else None)
        delivered = _parse_float(row[delivered_idx] if delivered_idx < len(row) else None)

        if ordered is not None and delivered is not None and delivered > ordered:
            issues.append(ValidationIssue(
                field=f"items.{row_idx}.delivered_qty",
                message=f"Delivered qty ({delivered}) exceeds ordered qty ({ordered})",
                severity="warning",
            ))

    return issues


# =============================================================================
# PURCHASE ORDER rules
# =============================================================================

@validation_rule("purchase_order", "po_item_math")
def validate_po_item_math(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Verify qty × rate = amount for PO items."""
    issues: list[ValidationIssue] = []
    qty_idx = _find_header_index(headers, "qty", "quantity")
    rate_idx = _find_header_index(headers, "rate", "unit_price", "price")
    amount_idx = _find_header_index(headers, "amount", "total", "value")

    if qty_idx is None or rate_idx is None or amount_idx is None:
        return issues

    for row_idx, row in enumerate(rows):
        qty = _parse_float(row[qty_idx] if qty_idx < len(row) else None)
        rate = _parse_float(row[rate_idx] if rate_idx < len(row) else None)
        amount = _parse_float(row[amount_idx] if amount_idx < len(row) else None)

        if qty is not None and rate is not None and amount is not None:
            expected = round(qty * rate, 2)
            if abs(expected - amount) > 0.01:
                issues.append(ValidationIssue(
                    field=f"items.{row_idx}.amount",
                    message=f"Qty × Rate = {expected}, but declared as {amount}",
                    severity="warning",
                    suggested_value=str(expected),
                ))

    return issues


# =============================================================================
# STOCK SHEET rules
# =============================================================================

@validation_rule("stock_sheet", "stock_balance")
def validate_stock_balance(data: dict[str, Any], headers: list[str], rows: list[list[str]]) -> list[ValidationIssue]:
    """Verify opening + receipts - issues = closing for stock sheets."""
    issues: list[ValidationIssue] = []
    opening_idx = _find_header_index(headers, "opening", "opening_balance", "opening_stock")
    receipt_idx = _find_header_index(headers, "receipt", "received", "inward", "additions")
    issue_idx = _find_header_index(headers, "issue", "issued", "outward", "consumption")
    closing_idx = _find_header_index(headers, "closing", "closing_balance", "closing_stock")

    if closing_idx is None:
        return issues  # Can't validate without closing column

    for row_idx, row in enumerate(rows):
        opening = _parse_float(row[opening_idx] if opening_idx is not None and opening_idx < len(row) else 0)
        receipt = _parse_float(row[receipt_idx] if receipt_idx is not None and receipt_idx < len(row) else None)
        issue_val = _parse_float(row[issue_idx] if issue_idx is not None and issue_idx < len(row) else None)
        closing = _parse_float(row[closing_idx] if closing_idx < len(row) else None)

        if closing is None:
            continue

        if receipt is not None and issue_val is not None:
            expected_closing = round(opening + receipt - issue_val, 2)
            if abs(expected_closing - closing) > 0.01:
                issues.append(ValidationIssue(
                    field=f"stock.{row_idx}.closing_balance",
                    message=f"Opening + Receipts - Issues = {expected_closing}, but declared as {closing}",
                    severity="warning",
                    suggested_value=str(expected_closing),
                ))

    return issues


# ── Helpers ──────────────────────────────────────────────────────────────────

def _find_header_index(headers: list[str], *candidates: str) -> int | None:
    """Find the first header index matching any candidate (case-insensitive, substring)."""
    lowered = [h.lower().strip() for h in headers]
    for candidate in candidates:
        candidate_lower = candidate.lower().strip()
        for idx, header in enumerate(lowered):
            if candidate_lower == header or candidate_lower in header:
                return idx
    return None


def run_all_rules(
    doc_type: str,
    data: dict[str, Any] | None = None,
    headers: list[str] | None = None,
    rows: list[list[str]] | None = None,
) -> list[ValidationIssue]:
    """Run all registered business rules for the given document type.

    Args:
        doc_type: Document type identifier (e.g. ``"invoice"``, ``"weighbridge_slip"``).
        data: Optional structured data dict for richer validation.
        headers: Column headers from OCR extraction.
        rows: Row data from OCR extraction.

    Returns:
        List of validation issues found.
    """
    all_issues: list[ValidationIssue] = []
    rules = get_rules_for(doc_type)

    if not rules:
        return all_issues

    safe_headers = headers or []
    safe_rows = rows or []
    safe_data = data or {}

    for rule_name, rule_fn in rules:
        try:
            issues = rule_fn(safe_data, safe_headers, safe_rows)
            all_issues.extend(issues)
        except Exception as exc:
            logger.warning("Business rule '%s' for '%s' failed: %s", rule_name, doc_type, exc, exc_info=True)

    return all_issues
