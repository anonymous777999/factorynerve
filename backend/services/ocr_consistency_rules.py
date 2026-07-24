"""Cross-field consistency validators for OCR extraction.

Checks that span multiple fields/columns within and across rows:
- Date logic (delivery after PO date)
- Totals match sum of line items
- Tax percentage consistency
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from backend.validators.validation_types import ValidationIssue


logger = logging.getLogger(__name__)


def _parse_float(value: Any) -> float | None:
    """Safely parse a numeric value."""
    if value is None:
        return None
    try:
        cleaned = str(value).replace(",", "").replace(" ", "").replace("₹", "").replace("$", "").replace("INR", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _parse_date(value: str) -> datetime | None:
    """Attempt to parse a date string in common formats."""
    if not value or not value.strip():
        return None
    value = value.strip()
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%d-%b-%Y", "%d %b %Y", "%b %d, %Y",
        "%Y/%m/%d", "%d.%m.%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _find_header_index(headers: list[str], *candidates: str) -> int | None:
    """Find the first header index matching any candidate (case-insensitive, substring)."""
    lowered = [h.lower().strip() for h in headers]
    for candidate in candidates:
        candidate_lower = candidate.lower().strip()
        for idx, header in enumerate(lowered):
            if candidate_lower == header or candidate_lower in header:
                return idx
    return None


# =============================================================================
# Stage 4: Consistency Validation (always runs)
# =============================================================================

def validate_date_logic(
    doc_type: str | None,
    headers: list[str],
    rows: list[list[str]],
) -> list[ValidationIssue]:
    """Check date logic — e.g. delivery date >= PO date, invoice date <= due date.

    Rules:
    - If both PO date and delivery date exist, delivery should not be before PO.
    - If both invoice date and due date exist, due date should be >= invoice date.
    """
    issues: list[ValidationIssue] = []

    if not headers or not rows:
        return issues

    lowered = [h.lower().strip() for h in headers]

    po_date_idx = _find_header_index(headers, "po_date", "po date", "order_date", "order date", "purchase_date")
    delivery_date_idx = _find_header_index(headers, "delivery_date", "delivery date", "ship_date", "dispatch_date")
    invoice_date_idx = _find_header_index(headers, "invoice_date", "invoice date", "date", "issue_date")
    due_date_idx = _find_header_index(headers, "due_date", "due date", "payment_date", "payment due")

    for row_idx, row in enumerate(rows):
        # PO date vs delivery date
        if po_date_idx is not None and delivery_date_idx is not None:
            po_str = row[po_date_idx] if po_date_idx < len(row) else ""
            del_str = row[delivery_date_idx] if delivery_date_idx < len(row) else ""
            po_date = _parse_date(po_str)
            del_date = _parse_date(del_str)
            if po_date and del_date and del_date < po_date:
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.dates",
                    message=f"Delivery date ({del_str}) is before PO date ({po_str})",
                    severity="warning",
                ))

        # Invoice date vs due date
        if invoice_date_idx is not None and due_date_idx is not None:
            inv_str = row[invoice_date_idx] if invoice_date_idx < len(row) else ""
            due_str = row[due_date_idx] if due_date_idx < len(row) else ""
            inv_date = _parse_date(inv_str)
            due_date = _parse_date(due_str)
            if inv_date and due_date and due_date < inv_date:
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.dates",
                    message=f"Due date ({due_str}) is before invoice date ({inv_str})",
                    severity="warning",
                ))

        # General: skip rows with obvious placeholder dates
        if invoice_date_idx is not None:
            inv_str = row[invoice_date_idx] if invoice_date_idx < len(row) else ""
            if inv_str.strip() and inv_str.strip() in {"01/01/1900", "01-01-1900", "1900-01-01", "00/00/0000", ""}:
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.invoice_date",
                    message=f"Placeholder date detected: '{inv_str}'",
                    severity="info",
                ))

    return issues


def validate_totals_match_sum(
    headers: list[str],
    rows: list[list[str]],
) -> list[ValidationIssue]:
    """Check that totals rows match the sum of preceding detail rows.

    Looks for amount/value columns and rows marked as 'total', 'grand total', etc.
    """
    issues: list[ValidationIssue] = []
    if not headers or len(rows) < 2:
        return issues

    amount_idx = _find_header_index(headers, "amount", "total", "value", "net", "gross", "taxable_value", "subtotal")
    if amount_idx is None:
        return issues

    # Find total rows (last few rows or rows with 'total' keyword)
    detail_values: list[float] = []
    has_total = False

    for row_idx, row in enumerate(rows):
        row_text = " ".join(str(cell).lower() for cell in row if cell)
        is_total_row = any(kw in row_text for kw in ("total", "subtotal", "grand total", "sum", "balance"))

        val = _parse_float(row[amount_idx] if amount_idx < len(row) else None)

        if is_total_row and val is not None:
            total_val = val
            expected_total = round(sum(detail_values), 2)
            if detail_values and abs(expected_total - total_val) > 1.0:
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.amount",
                    message=f"Total ({total_val}) does not match sum of detail rows ({expected_total}). Difference = {abs(expected_total - total_val):.2f}",
                    severity="warning",
                    suggested_value=str(expected_total),
                ))
            has_total = True
            detail_values = []  # Reset for next section
        elif val is not None:
            detail_values.append(val)

    if not has_total:
        return issues

    return issues


def validate_tax_percentage_consistency(
    headers: list[str],
    rows: list[list[str]],
) -> list[ValidationIssue]:
    """Check tax percentage consistency across rows.

    For GST invoices: cgst + sgst should equal igst when both are present,
    and percentages should be within valid range (0-28%).
    """
    issues: list[ValidationIssue] = []
    if not headers or not rows:
        return issues

    cgst_idx = _find_header_index(headers, "cgst", "cgst_percent", "cgst_%", "cgst %", "central_gst")
    sgst_idx = _find_header_index(headers, "sgst", "sgst_percent", "sgst_%", "sgst %", "state_gst")
    igst_idx = _find_header_index(headers, "igst", "igst_percent", "igst_%", "igst %", "integrated_gst")

    if cgst_idx is None and sgst_idx is None and igst_idx is None:
        return issues

    for row_idx, row in enumerate(rows):
        cgst = _parse_float(row[cgst_idx] if cgst_idx is not None and cgst_idx < len(row) else None)
        sgst = _parse_float(row[sgst_idx] if sgst_idx is not None and sgst_idx < len(row) else None)
        igst = _parse_float(row[igst_idx] if igst_idx is not None and igst_idx < len(row) else None)

        # Check CGST + SGST = IGST
        if cgst is not None and sgst is not None and igst is not None:
            combined = round(cgst + sgst, 2)
            if abs(combined - igst) > 0.1:
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.tax",
                    message=f"CGST ({cgst}%) + SGST ({sgst}%) = {combined}%, but IGST declared as {igst}%",
                    severity="warning",
                ))

        # Check individual percentages are in valid range
        for tax_name, tax_val in [("CGST", cgst), ("SGST", sgst), ("IGST", igst)]:
            if tax_val is not None and (tax_val < 0 or tax_val > 28):
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.{tax_name.lower()}",
                    message=f"{tax_name} percentage {tax_val}% is outside valid range (0-28%)",
                    severity="warning",
                ))

    return issues


def validate_vehicle_number_format(
    headers: list[str],
    rows: list[list[str]],
) -> list[ValidationIssue]:
    """Check vehicle number format for weighbridge/delivery notes.

    Indian vehicle number format: 2 letters + 2 digits + optional space + 1-4 letters/digits.
    e.g. MH-12-AB-1234, GJ 05 CD 5678
    """
    issues: list[ValidationIssue] = []
    vehicle_idx = _find_header_index(headers, "vehicle", "vehicle_no", "vehicle_number", "truck_no", "truck")

    if vehicle_idx is None:
        return issues

    import re
    vehicle_pattern = re.compile(r"^[A-Za-z]{2}\s?[-]?\d{1,2}\s?[-]?[A-Za-z]{1,2}\s?[-]?\d{1,4}$")

    for row_idx, row in enumerate(rows):
        if vehicle_idx < len(row):
            vehicle = str(row[vehicle_idx]).strip()
            if vehicle and not vehicle_pattern.match(vehicle):
                issues.append(ValidationIssue(
                    field=f"row.{row_idx}.vehicle_number",
                    message=f"Vehicle number '{vehicle}' does not match standard format (e.g., MH-12-AB-1234)",
                    severity="info",
                ))

    return issues
