"""PDF Export Engine — Production-grade PDF generators for all document types.

Each generator follows this template (section 6.3):
1. Company header (from settings)
2. Document title + type badge
3. Metadata line (date, document ID, confidence)
4. Type-specific content
5. Footer: page X of Y, QR verification code, timestamp
6. Audit trail on last page
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any, Callable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Shared style constants ───────────────────────────────────────────────────

_COLORS = {
    "header_bg": colors.HexColor("#1a1a2e"),
    "header_fg": colors.white,
    "subheader_bg": colors.HexColor("#e0e0e0"),
    "accent": colors.HexColor("#007bff"),
    "success": colors.HexColor("#28a745"),
    "warning": colors.HexColor("#ffc107"),
    "danger": colors.HexColor("#dc3545"),
    "light_gray": colors.HexColor("#f8f9fa"),
    "border": colors.HexColor("#dee2e6"),
}


def _base_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=18,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=_COLORS["header_bg"],
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=styles["Heading2"],
            fontSize=12,
            spaceAfter=4,
            alignment=TA_CENTER,
            textColor=colors.grey,
        ),
        "meta": ParagraphStyle(
            "DocMeta",
            parent=styles["Normal"],
            fontSize=8,
            spaceAfter=2,
            alignment=TA_CENTER,
            textColor=colors.grey,
        ),
        "normal": ParagraphStyle(
            "DocNormal",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
        ),
        "header_cell": ParagraphStyle(
            "HeaderCell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
        ),
        "cell_right": ParagraphStyle(
            "CellRight",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_RIGHT,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontSize=7,
            alignment=TA_CENTER,
            textColor=colors.grey,
        ),
        "badge": ParagraphStyle(
            "Badge",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
    }


def _company_header(story, styles):
    """Standard company header block."""
    story.append(Paragraph("ABC Steel Ltd", styles["title"]))
    story.append(Paragraph("123 Industrial Area, Mumbai - 400001", styles["subtitle"]))
    story.append(Paragraph("GSTIN: 24AABCS1234K1Z5 | PAN: AABCA1234A", styles["meta"]))
    story.append(Spacer(1, 8))


def _build_table(story, headers: list[str], rows: list[list], col_widths: list | None = None):
    """Build a styled table with header row and alternating colors."""
    s = _base_styles()
    header_paras = [Paragraph(h, s["header_cell"]) for h in headers]
    data = [header_paras]

    for r in rows:
        data.append([Paragraph(str(c or ""), s["cell"]) for c in r])

    available = 180 * mm  # A4 usable width
    if col_widths is None:
        cw = [available / max(len(headers), 1)] * len(headers)
    else:
        cw = col_widths

    t = Table(data, colWidths=cw, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), _COLORS["header_bg"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, _COLORS["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    # Alternating row colours
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), _COLORS["light_gray"]))
    t.setStyle(TableStyle(style_cmds))
    story.append(t)


def _audit_trail(data, verification_meta: dict | None = None) -> list:
    """Build audit trail content elements."""
    s = _base_styles()
    items = []
    items.append(PageBreak())
    items.append(Paragraph("Audit Trail", s["title"]))
    items.append(Spacer(1, 6))
    items.append(Paragraph(
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
        f"Document ID: {verification_meta.get('id', 'N/A') if verification_meta else 'N/A'}",
        s["meta"],
    ))
    items.append(Spacer(1, 8))
    audit_rows = [
        ["Field", "Value"],
        ["Export Timestamp", datetime.now().isoformat(timespec="seconds")],
        ["Verification Status", verification_meta.get("status", "N/A") if verification_meta else "N/A"],
        ["Confidence Score", f"{verification_meta.get('avg_confidence', 'N/A')}" if verification_meta else "N/A"],
        ["Doc Type Hint", verification_meta.get("doc_type_hint", "N/A") if verification_meta else "N/A"],
        ["Source Filename", verification_meta.get("source_filename", "N/A") if verification_meta else "N/A"],
    ]
    _build_table(items, ["Field", "Value"], audit_rows[1:], col_widths=[60 * mm, 120 * mm])
    items.append(Spacer(1, 8))
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=2, border=0)
        qr.add_data(verification_id or "N/A")
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_bytes = io.BytesIO()
        qr_img.save(qr_bytes, format="PNG")
        qr_bytes.seek(0)
        items.append(Image(qr_bytes, width=40, height=40))
    except ImportError:
        items.append(Paragraph("QR: N/A (install qrcode)", s["footer"]))
    return items


# ── Type-specific generators ─────────────────────────────────────────────────

def _generate_invoice_pdf(data: dict, meta: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("TAX INVOICE", s["title"]))
    story.append(Spacer(1, 6))

    header = data.get("invoice_header", {})
    meta_rows = [
        ["Invoice No:", header.get("invoice_number", ""), "Date:", header.get("invoice_date", "")],
        ["Supplier:", header.get("supplier", {}).get("name", ""), "GSTIN:", header.get("supplier", {}).get("gstin", "")],
        ["Buyer:", header.get("recipient", {}).get("name", ""), "GSTIN:", header.get("recipient", {}).get("gstin", "UNREGISTERED")],
        ["Place of Supply:", header.get("place_of_supply", ""), "", ""],
    ]
    _build_table(story, ["Field", "Value", "Field", "Value"],
                 [[r[1], r[3]] for r in meta_rows],
                 col_widths=[40*mm, 50*mm, 30*mm, 50*mm])

    story.append(Spacer(1, 8))
    line_items = data.get("line_items", [])
    item_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Amount"]
    item_rows = []
    for i, item in enumerate(line_items, 1):
        amt = float(item.get("qty", 0)) * float(item.get("rate", 0))
        item_rows.append([
            str(i),
            item.get("description", ""),
            item.get("hsn_code", ""),
            str(item.get("qty", "")),
            item.get("unit", ""),
            f"₹{float(item.get('rate', 0)):,.2f}",
            f"₹{amt:,.2f}",
        ])
    _build_table(story, item_headers, item_rows,
                 col_widths=[10*mm, 50*mm, 20*mm, 15*mm, 15*mm, 20*mm, 25*mm])

    story.append(Spacer(1, 8))
    totals = data.get("totals", {})
    tax_summary = data.get("tax_summary", {})
    total_rows = [
        ["Total Taxable:", f"₹{float(totals.get('total_taxable', 0)):,.2f}"],
        ["CGST:", f"₹{float(tax_summary.get('cgst', 0)):,.2f}"],
        ["SGST:", f"₹{float(tax_summary.get('sgst', 0)):,.2f}"],
        ["IGST:", f"₹{float(tax_summary.get('igst', 0)):,.2f}"],
        ["Invoice Total:", f"₹{float(totals.get('invoice_total', 0)):,.2f}"],
    ]
    _build_table(story, ["Description", "Amount"], total_rows,
                 col_widths=[80*mm, 50*mm])

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_po_pdf(data: dict, meta: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("PURCHASE ORDER", s["title"]))
    story.append(Spacer(1, 6))

    po_meta = [
        ["PO No:", data.get("po_number", ""), "Date:", data.get("po_date", "")],
        ["Vendor:", data.get("vendor", {}).get("name", ""), "GSTIN:", data.get("vendor", {}).get("gstin", "")],
        ["Delivery Date:", data.get("delivery_date", ""), "Payment Terms:", data.get("payment_terms", "")],
    ]
    _build_table(story, ["Field", "Value", "Field", "Value"],
                 [[r[1], r[3]] for r in po_meta],
                 col_widths=[35*mm, 55*mm, 35*mm, 55*mm])

    story.append(Spacer(1, 8))
    line_items = data.get("line_items", [])
    item_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Amount"]
    item_rows = []
    for i, item in enumerate(line_items, 1):
        item_rows.append([
            str(i),
            item.get("description", ""),
            item.get("hsn_code", ""),
            str(item.get("qty", "")),
            item.get("unit", ""),
            f"₹{float(item.get('rate', 0)):,.2f}",
            f"₹{float(item.get('amount', 0)):,.2f}",
        ])
    _build_table(story, item_headers, item_rows,
                 col_widths=[10*mm, 50*mm, 20*mm, 15*mm, 15*mm, 20*mm, 25*mm])

    story.append(Spacer(1, 8))
    totals = data.get("totals", {})
    total_rows = [
        ["Subtotal:", f"₹{float(totals.get('subtotal', 0)):,.2f}"],
        ["Total:", f"₹{float(totals.get('total', 0)):,.2f}"],
    ]
    _build_table(story, ["Description", "Amount"], total_rows,
                 col_widths=[80*mm, 50*mm])

    if data.get("delivery_terms"):
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Delivery Terms:</b> {data['delivery_terms']}", s["normal"]))
    if data.get("payment_terms"):
        story.append(Paragraph(f"<b>Payment Terms:</b> {data['payment_terms']}", s["normal"]))

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_dn_pdf(data: dict, meta: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("DELIVERY NOTE / CHALLAN", s["title"]))
    story.append(Spacer(1, 6))

    dn_meta = [
        ["Challan No:", data.get("challan_number", ""), "Date:", data.get("date", "")],
        ["Supplier:", data.get("supplier", {}).get("name", ""), "GSTIN:", data.get("supplier", {}).get("gstin", "")],
        ["Recipient:", data.get("recipient", {}).get("name", ""), "GSTIN:", data.get("recipient", {}).get("gstin", "")],
        ["Vehicle:", data.get("vehicle", {}).get("number", ""), "Driver:", data.get("vehicle", {}).get("driver_name", "")],
    ]
    _build_table(story, ["Field", "Value", "Field", "Value"],
                 [[r[1], r[3]] for r in dn_meta],
                 col_widths=[35*mm, 55*mm, 35*mm, 55*mm])

    story.append(Spacer(1, 8))
    line_items = data.get("line_items", [])
    item_headers = ["#", "Description", "HSN", "Ordered Qty", "Delivered Qty", "Unit"]
    item_rows = []
    for i, item in enumerate(line_items, 1):
        item_rows.append([
            str(i),
            item.get("description", ""),
            item.get("hsn_code", ""),
            str(item.get("ordered_qty", "")),
            str(item.get("delivered_qty", "")),
            item.get("unit", ""),
        ])
    _build_table(story, item_headers, item_rows,
                 col_widths=[10*mm, 50*mm, 20*mm, 25*mm, 25*mm, 20*mm])

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_wb_pdf(data: dict, meta: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=(100*mm, 150*mm),
                            rightMargin=8*mm, leftMargin=8*mm,
                            topMargin=10*mm, bottomMargin=10*mm)
    s = _base_styles()
    story = []

    story.append(Paragraph("WEIGHBRIDGE SLIP", s["title"]))
    story.append(Spacer(1, 4))

    slip_rows = [
        ["Slip No:", data.get("slip_no", ""), "Date:", data.get("date", "")],
        ["Vehicle:", data.get("vehicle_no", ""), "Time:", data.get("time", "")],
        ["Material:", data.get("material", ""), "Party:", data.get("party_name", "")],
        ["Gross Wt:", f"{data.get('gross_weight', 0)} kg", "Tare Wt:", f"{data.get('tare_weight', 0)} kg"],
        ["", "", "Net Wt:", f"{data.get('net_weight', 0)} kg"],
    ]
    _build_table(story, ["Field", "Value", "Field", "Value"],
                 [[r[1], r[3]] for r in slip_rows],
                 col_widths=[22*mm, 20*mm, 22*mm, 20*mm])

    if data.get("rate") or data.get("amount"):
        story.append(Spacer(1, 4))
        rate_rows = [
            ["Rate:", f"₹{float(data.get('rate', 0)):,.2f}/kg", "Amount:", f"₹{float(data.get('amount', 0)):,.2f}"],
        ]
        _build_table(story, ["Field", "Value", "Field", "Value"], rate_rows,
                     col_widths=[22*mm, 20*mm, 22*mm, 20*mm])

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_ledger_pdf(data: dict, meta: dict | None = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("LEDGER SHEET / ACCOUNT STATEMENT", s["title"]))
    story.append(Spacer(1, 6))

    rows = data.get("rows", [])
    metadata = data.get("metadata", {})
    account_name = metadata.get("account_name", "Ledger Account")
    period = metadata.get("period", "")

    meta_rows = [
        ["Account:", account_name, "Period:", period],
        ["Opening Balance:", metadata.get("opening_balance", "0.00"), "", ""],
        ["Closing Balance:", metadata.get("closing_balance", "0.00"), "", ""],
    ]
    _build_table(story, ["Field", "Value", "Field", "Value"],
                 [[r[1], r[3]] for r in meta_rows],
                 col_widths=[40*mm, 50*mm, 30*mm, 50*mm])

    story.append(Spacer(1, 8))
    if rows and isinstance(rows[0], dict):
        ld_headers = list(rows[0].keys())
    else:
        ld_headers = ["Date", "Particulars", "Vch Type", "Debit (₹)", "Credit (₹)", "Balance (₹)"]
    ld_rows = []
    for row in rows:
        if isinstance(row, dict):
            ld_rows.append([str(row.get(h, "") or "") for h in ld_headers])
        elif isinstance(row, (list, tuple)):
            ld_rows.append([str(v) for v in row])

    cr = [30*mm, 30*mm, 20*mm, 25*mm, 25*mm, 25*mm]
    _build_table(story, ld_headers, ld_rows, col_widths=cr[:len(ld_headers)])

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_kv_pdf(data: dict, meta: dict | None = None) -> bytes:
    """Generate handwritten form / key-value pair PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("HANDWRITTEN FORM — TRANSCRIPTION", s["title"]))
    story.append(Spacer(1, 6))

    kv_headers = ["Field", "Value", "Confidence"]
    kv_rows = []
    fields = data.get("fields", data.get("key_value_pairs", data.get("extracted_data", {})))
    if isinstance(fields, dict):
        for key, val in fields.items():
            if isinstance(val, dict):
                kv_rows.append([str(key), str(val.get("value", "")), f"{float(val.get('confidence', 0)):.0%}"])
            else:
                kv_rows.append([str(key), str(val), ""])
    elif isinstance(fields, list):
        for item in fields:
            kv_rows.append([
                str(item.get("field", item.get("key", ""))),
                str(item.get("value", "")),
                f"{float(item.get('confidence', 0)):.0%}" if item.get("confidence") else "",
            ])

    _build_table(story, kv_headers, kv_rows,
                 col_widths=[50*mm, 80*mm, 20*mm])

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_chat_pdf(data: dict, meta: dict | None = None) -> bytes:
    """Generate chat transcript PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("CHAT / SCREENSHOT TRANSCRIPT", s["title"]))
    story.append(Spacer(1, 6))

    messages = data.get("messages", data.get("conversation", []))
    msg_headers = ["#", "Sender", "Timestamp", "Message"]
    msg_rows = []
    for i, msg in enumerate(messages, 1):
        msg_rows.append([
            str(i),
            msg.get("sender", msg.get("from", "")),
            msg.get("timestamp", msg.get("time", "")),
            msg.get("message", msg.get("text", "")),
        ])

    _build_table(story, msg_headers, msg_rows,
                 col_widths=[10*mm, 25*mm, 30*mm, 85*mm])

    if data.get("summary"):
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"<b>Summary:</b> {data['summary']}", s["normal"]))

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def _generate_generic_pdf(data: dict, meta: dict | None = None) -> bytes:
    """Generic tabular data PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=20*mm)
    s = _base_styles()
    story = []

    _company_header(story, s)
    story.append(Spacer(1, 4))
    story.append(Paragraph("OCR EXPORT", s["title"]))
    story.append(Spacer(1, 6))

    headers = data.get("headers", [])
    rows = data.get("rows", [])
    if headers and rows:
        _build_table(story, headers, rows,
                     col_widths=[180*mm / max(len(headers), 1)] * len(headers))

    story.extend(_audit_trail(data, meta))
    doc.build(story)
    buf.seek(0)
    return buf.read()


# ── Generator registry ───────────────────────────────────────────────────────

PDF_GENERATORS: dict[str, Callable[[dict, dict | None], bytes]] = {
    "gst_invoice": _generate_invoice_pdf,
    "purchase_order": _generate_po_pdf,
    "delivery_note": _generate_dn_pdf,
    "weighbridge_slip": _generate_wb_pdf,
    "ledger_sheet": _generate_ledger_pdf,
    "handwritten_form": _generate_kv_pdf,
    "chat_transcript": _generate_chat_pdf,
    "generic_table": _generate_generic_pdf,
}


def get_pdf_generator(doc_type: str) -> Callable[[dict, dict | None], bytes]:
    """Get the PDF generator for a document type, falling back to generic."""
    return PDF_GENERATORS.get(doc_type, _generate_generic_pdf)


def generate_pdf_export(data: dict, doc_type: str = "generic_table",
                        verification_meta: dict | None = None) -> bytes:
    """Generate a PDF export for the given document type and data."""
    generator = get_pdf_generator(doc_type)
    return generator(data, verification_meta)
