"""GST-compliant PDF invoice generator for Factory Nerve SaaS subscriptions."""

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from backend.models.invoice import Invoice
from backend.models.organization import Organization
from backend.plans import get_plan, normalize_plan

logger = logging.getLogger(__name__)

# Seller / Company defaults — override via env vars
SELLER_NAME = os.getenv("INVOICE_SELLER_NAME", "Factory Nerve Technologies Pvt. Ltd.")
SELLER_GSTIN = os.getenv("INVOICE_SELLER_GSTIN", "29ABCDE1234F1Z5")
SELLER_ADDRESS = os.getenv(
    "INVOICE_SELLER_ADDRESS",
    "123 Tech Park, Whitefield, Bangalore - 560066, Karnataka, India",
)
SELLER_STATE = os.getenv("INVOICE_SELLER_STATE", "Karnataka")
SELLER_STATE_CODE = os.getenv("INVOICE_SELLER_STATE_CODE", "29")
SELLER_PAN = os.getenv("INVOICE_SELLER_PAN", "ABCDE1234F")
SELLER_EMAIL = os.getenv("INVOICE_SELLER_EMAIL", "billing@factorynerve.com")
SAC_CODE = os.getenv("INVOICE_SAC_CODE", "998314")  # IT software services
GST_RATE = float(os.getenv("INVOICE_GST_RATE", "18.0"))  # 18% GST on SaaS

# Colors
COLOR_PRIMARY = colors.HexColor("#0B0E14")
COLOR_SECONDARY = colors.HexColor("#152032")
COLOR_ACCENT = colors.HexColor("#3EA6FF")
COLOR_TEXT = colors.HexColor("#1A1D23")
COLOR_MUTED = colors.HexColor("#6B7280")
COLOR_BORDER = colors.HexColor("#E5E7EB")
COLOR_BG_LIGHT = colors.HexColor("#F9FAFB")
COLOR_WHITE = colors.white

def _format_inr(value: float) -> str:
    """Format number in Indian number system (lakhs, crores)."""
    if value >= 10_000_000:
        return f"₹{value / 10_000_000:,.2f} Cr"
    if value >= 100_000:
        return f"₹{value / 100_000:,.2f} L"
    return f"₹{value:,.2f}"


def generate_invoice_pdf(
    db: Session,
    invoice: Invoice,
    *,
    org: Organization | None = None,
) -> bytes:
    """Generate a GST-compliant PDF invoice for a SaaS subscription payment."""
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 36  # ~ 1 inch
    usable_width = width - 2 * margin

    # ── Resolve buyer org ──────────────────────────────────────────────
    if org is None and invoice.org_id:
        org = db.query(Organization).filter(Organization.org_id == invoice.org_id).first()

    buyer_name = org.name if org else "Customer"
    buyer_email = org.billing_email if org and org.billing_email else "—"

    # ── Invoice details ────────────────────────────────────────────────
    inv_number = invoice.invoice_number or f"INV-{invoice.id:06d}"
    inv_date = invoice.issued_at or invoice.created_at
    if inv_date.tzinfo is not None:
        inv_date = inv_date.astimezone(timezone.utc)
    inv_date_str = inv_date.strftime("%d %B %Y") if inv_date else datetime.now(timezone.utc).strftime("%d %B %Y")

    period_start = invoice.period_start
    period_end = invoice.period_end
    period_str = ""
    if period_start and period_end:
        if period_start.tzinfo is not None:
            period_start = period_start.astimezone(timezone.utc)
        if period_end.tzinfo is not None:
            period_end = period_end.astimezone(timezone.utc)
        period_str = f"{period_start.strftime('%d %b %Y')} – {period_end.strftime('%d %b %Y')}"

    plan_name = get_plan(invoice.plan).get("name", normalize_plan(invoice.plan).title())
    taxable_amount = float(invoice.amount or 0.0)
    tax_amount = float(invoice.tax_amount or 0.0)
    total_amount = taxable_amount + tax_amount
    gst_rate = GST_RATE
    cgst_rate = gst_rate / 2.0
    sgst_rate = gst_rate / 2.0
    cgst_amount = round(taxable_amount * cgst_rate / 100.0, 2)
    sgst_amount = round(taxable_amount * sgst_rate / 100.0, 2)

    # ── Helper: draw a section divider ─────────────────────────────────
    def _divider(y_pos: float) -> float:
        pdf.setStrokeColor(COLOR_BORDER)
        pdf.setLineWidth(0.5)
        pdf.line(margin, y_pos, width - margin, y_pos)
        return y_pos - 8

    y = height - margin

    # ══════════════════════════════════════════════════════════════════
    #  HEADER
    # ══════════════════════════════════════════════════════════════════
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(margin, y, "TAX INVOICE")
    y -= 6

    # Invoice number + date (right-aligned)
    pdf.setFillColor(COLOR_MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(width - margin, height - margin, f"Invoice #: {inv_number}")
    y -= 2
    pdf.drawRightString(width - margin, height - margin - 12, f"Date: {inv_date_str}")
    y -= 4

    y = _divider(y)

    # ══════════════════════════════════════════════════════════════════
    #  SELLER & BUYER SECTIONS (side-by-side)
    # ══════════════════════════════════════════════════════════════════
    col_width = usable_width / 2 - 10
    left_x = margin
    right_x = margin + col_width + 20

    # -- Seller (left) --
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left_x, y, "Seller")
    y -= 14
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)
    seller_info = [
        SELLER_NAME,
        f"GSTIN: {SELLER_GSTIN}",
        f"PAN: {SELLER_PAN}",
        SELLER_ADDRESS,
        f"Email: {SELLER_EMAIL}",
    ]
    for line in seller_info:
        pdf.drawString(left_x, y, line)
        y -= 11
    # -- Buyer (right) --
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(right_x, height - margin - 28, "Buyer")
    buyer_y = height - margin - 28 - 14
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(right_x, buyer_y, buyer_name)
    buyer_y -= 11
    pdf.drawString(right_x, buyer_y, f"Email: {buyer_email}")
    buyer_y -= 11
    if org:
        org_gstin = getattr(org, "gstin", None)
        if org_gstin:
            pdf.drawString(right_x, buyer_y, f"GSTIN: {org_gstin}")

    y = min(y, buyer_y - 8)  # pick the lowest y
    y = _divider(y)

    # ══════════════════════════════════════════════════════════════════
    #  SERVICE DESCRIPTION
    # ══════════════════════════════════════════════════════════════════
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin, y, "Description of Services")
    y -= 14
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)
    service_desc = f"{plan_name} – SaaS Subscription"
    if period_str:
        service_desc += f" ({period_str})"
    pdf.drawString(margin, y, service_desc)
    y -= 3
    pdf.setFillColor(COLOR_MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(margin, y, f"SAC: {SAC_CODE}")
    y -= 14
    y = _divider(y)

    # ══════════════════════════════════════════════════════════════════
    #  TAX TABLE
    # ══════════════════════════════════════════════════════════════════
    # Header row
    pdf.setFillColor(COLOR_SECONDARY)
    pdf.roundRect(margin, y - 16, usable_width, 16, 4, stroke=0, fill=1)

    col_specs = [
        (margin, 120, "Description"),
        (margin + 180, 60, "SAC"),
        (margin + 245, 60, "Taxable Value"),
        (margin + 310, 40, "CGST"),
        (margin + 355, 40, "SGST"),
        (margin + 400, 70, "Total"),
    ]

    pdf.setFillColor(COLOR_WHITE)
    pdf.setFont("Helvetica-Bold", 8)
    for cx, cw, clabel in col_specs:
        pdf.drawString(cx + 4, y - 11, clabel)
    y -= 20

    # Data row
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(margin + 4, y, service_desc[:50])
    pdf.drawString(margin + 184, y, SAC_CODE)
    pdf.drawRightString(margin + 300, y, f"{taxable_amount:,.2f}")
    pdf.drawRightString(margin + 345, y, f"{cgst_amount:,.2f}")
    pdf.drawRightString(margin + 390, y, f"{sgst_amount:,.2f}")
    pdf.drawRightString(margin + 465, y, _format_inr(total_amount))
    y -= 18

    # Light background for data row
    pdf.setFillColor(COLOR_BG_LIGHT)
    pdf.rect(margin, y, usable_width, 18, stroke=0, fill=1)

    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(margin + 4, y + 4, f"@{gst_rate:.0f}% GST")
    pdf.drawRightString(margin + 300, y + 4, f"{taxable_amount:,.2f}")
    pdf.drawRightString(margin + 345, y + 4, f"{cgst_amount:,.2f}")
    pdf.drawRightString(margin + 390, y + 4, f"{sgst_amount:,.2f}")
    pdf.drawRightString(margin + 465, y + 4, "—")

    y -= 4
    y = _divider(y)

    # ══════════════════════════════════════════════════════════════════
    #  TOTALS
    # ══════════════════════════════════════════════════════════════════
    pdf.setFillColor(COLOR_SECONDARY)
    pdf.roundRect(margin, y - 40, usable_width, 40, 4, stroke=0, fill=1)
    y -= 14

    pdf.setFillColor(COLOR_WHITE)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(margin + 8, y, "Subtotal")
    pdf.drawRightString(margin + 300, y, f"{taxable_amount:,.2f}")
    y -= 12
    pdf.drawString(margin + 8, y, f"GST @ {gst_rate:.0f}% (CGST {cgst_rate:.0f}% + SGST {sgst_rate:.0f}%)")
    pdf.drawRightString(margin + 300, y, f"{tax_amount:,.2f}")
    y -= 16

    # Total (bold)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margin + 8, y, "Total")
    pdf.drawRightString(margin + 300, y, _format_inr(total_amount))
    y_totals_end = y - 8

    y = y_totals_end - 8

    # ══════════════════════════════════════════════════════════════════
    #  AMOUNT IN WORDS
    # ══════════════════════════════════════════════════════════════════
    y = _divider(y)
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin, y, "Amount in Words")
    y -= 13
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)
    from backend.utils import number_to_words  # type: ignore  # noqa: F401 — actually used below
    amount_words = number_to_words(total_amount)
    pdf.drawString(margin, y, f"Rupees {amount_words} Only")
    y -= 18

    # ══════════════════════════════════════════════════════════════════
    #  FOOTER — Declaration & Bank Details
    # ══════════════════════════════════════════════════════════════════
    y = _divider(y)

    # Declaration
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin, y, "Declaration")
    y -= 13
    pdf.setFillColor(COLOR_MUTED)
    pdf.setFont("Helvetica", 8)
    declaration_lines = [
        "We declare that this invoice shows the actual price of the services rendered and that all particulars are true and correct.",
        "This is a computer-generated document and does not require a physical signature.",
        "Subject to Bangalore jurisdiction.",
    ]
    for line in declaration_lines:
        pdf.drawString(margin, y, line)
        y -= 10

    y -= 8

    # Bank details (right-aligned)
    bank_details = [
        "Bank Details:",
        "Account Name: Factory Nerve Technologies Pvt. Ltd.",
        "Account No: XXXX XXXX XXXX 1234",
        "IFSC: HDFC0001234",
        "Bank: HDFC Bank, Whitefield Branch",
    ]
    bank_y = y + len(bank_details) * 10 + 8
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(COLOR_MUTED)
    for line in reversed(bank_details):
        pdf.drawRightString(width - margin, bank_y, line)
        bank_y -= 10

    # ══════════════════════════════════════════════════════════════════
    #  TAX SUMMARY (bottom-right)
    # ══════════════════════════════════════════════════════════════════
    pdf.setFillColor(COLOR_PRIMARY)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin, y, "Tax Summary")
    y -= 13
    pdf.setFillColor(COLOR_TEXT)
    pdf.setFont("Helvetica", 9)

    tax_lines = [
        (f"Taxable Value", f"₹{taxable_amount:,.2f}"),
        (f"CGST @ {cgst_rate:.0f}%", f"₹{cgst_amount:,.2f}"),
        (f"SGST @ {sgst_rate:.0f}%", f"₹{sgst_amount:,.2f}"),
        (f"Total Tax", f"₹{tax_amount:,.2f}"),
        (f"Total Invoice Value", f"₹{total_amount:,.2f}"),
    ]
    for label, value in tax_lines:
        pdf.drawString(margin + 4, y, label)
        pdf.drawRightString(margin + 200, y, value)
        y -= 12

    # ══════════════════════════════════════════════════════════════════
    #  FOOTER LINE
    # ══════════════════════════════════════════════════════════════════
    pdf.setStrokeColor(COLOR_ACCENT)
    pdf.setLineWidth(2)
    pdf.line(margin, 30, width - margin, 30)
    pdf.setFillColor(COLOR_MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawCentredString(width / 2, 18, f"Thank you for being a valued Factory Nerve customer • Invoice #{inv_number}")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
