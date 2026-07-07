"""
ocr_master_integration.py
=========================
FactoryNerve DPR.ai — exact code patches for each backend file.
Copy each section into the file named in the header comment.
Minimal changes — every existing function stays intact.
"""


# ═══════════════════════════════════════════════════════════════
# FILE: backend/services/ocr_document_classifier.py  (NEW FILE)
# CREATE this file. Called BEFORE table_scan.py in the pipeline.
# ═══════════════════════════════════════════════════════════════

CLASSIFIER_FILE = '''
import json
import anthropic

CLASSIFIER_SYSTEM_PROMPT = """
You are a document classifier for Indian steel factory records.
Look at this image and identify which document type it is.
Return ONLY a JSON object — no explanation, no markdown, no preamble.

Respond with exactly this structure:
{
  "doc_type": "<see allowed values>",
  "confidence": <0.0 to 1.0>,
  "language": "<eng | hin | mar | eng+hin | eng+mar | eng+hin+mar>",
  "structure": "<tabular | form | form+table | multi-section | wide-tabular>",
  "sections_count": <integer>,
  "has_printed_template": <true | false>,
  "has_handwriting": <true | false>,
  "notes": "<unusual features, max 20 words>"
}

Allowed doc_type values:
ledger | stock_register | gate_challan | invoice | dispatch_challan |
production_log | salary_register | maintenance_log | energy_log |
quality_cert | purchase_order | scrap_register | unknown
"""

def classify_document(image_bytes: bytes, client: anthropic.Anthropic) -> dict:
    """
    Classify a factory document image.
    Returns dict with doc_type, confidence, language, structure, notes.
    Uses Haiku — fast and cheap for classification.
    """
    import base64
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=CLASSIFIER_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}
                    },
                    {
                        "type": "text",
                        "text": "Classify this document."
                    }
                ]
            }]
        )
        text = response.content[0].text.strip()
        # Strip JSON fences if model adds them
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    except Exception as e:
        # On failure, return safe default — pipeline continues with unknown type
        return {
            "doc_type": "unknown",
            "confidence": 0.0,
            "language": "eng",
            "structure": "tabular",
            "sections_count": 1,
            "has_printed_template": False,
            "has_handwriting": True,
            "notes": f"Classification failed: {str(e)[:50]}"
        }
'''


# ═══════════════════════════════════════════════════════════════
# FILE: backend/services/indian_number_normalizer.py  (NEW FILE)
# CREATE this file. Import in ocr_normalization.py
# ═══════════════════════════════════════════════════════════════

NORMALIZER_FILE = '''
import re
from typing import Optional, Union

def parse_indian_number(value: str) -> Optional[Union[int, float]]:
    """
    Parse Indian number format to int or float.

    Indian grouping: 47,22,000 = 47 lakh 22 thousand = 4722000
    This is NOT the same as Western 4,722,000.

    Examples:
        "47,22,000"   -> 4722000
        "1,00,000"    -> 100000
        "10,00,000"   -> 1000000
        "1,00,00,000" -> 10000000
        "14,000"      -> 14000
        "Rs.47,22,000"-> 4722000  (strip prefix)
        "0.450"       -> 0.45     (decimal for MT weights)
        "4722000"     -> 4722000  (plain integer)
    """
    if not value:
        return None

    s = str(value).strip()

    # Strip currency prefixes: ₹, Rs., Re., रु.
    s = re.sub(r'^[₹\u20b9Rr][sS]?\.?\s*', '', s)

    # Strip unit suffixes
    s = re.sub(
        r'\s*(MT|KG|KGS|NOS|PCS|MM|M\b|L\b|KL|m³|kWH|kVAH|kVARH|kVA)\s*$',
        '', s, flags=re.IGNORECASE
    )

    s = s.strip()
    if not s:
        return None

    # Remove all commas — Indian comma grouping doesn't change the number value
    no_commas = s.replace(',', '')

    # Decimal check
    if '.' in no_commas:
        try:
            return round(float(no_commas), 6)
        except ValueError:
            return None

    try:
        return int(no_commas)
    except ValueError:
        return None


def format_indian_number(value: int) -> str:
    """
    Format integer to Indian number system string.

    Examples:
        4722000 -> "47,22,000"
        100000  -> "1,00,000"
        14000   -> "14,000"
        999     -> "999"
    """
    if value is None:
        return ""

    is_negative = value < 0
    s = str(abs(int(value)))

    if len(s) <= 3:
        result = s
    else:
        result = s[-3:]
        s = s[:-3]
        while s:
            result = s[-2:] + ',' + result
            s = s[:-2]

    return ('-' if is_negative else '') + result


def normalise_cell_value(raw: str) -> dict:
    """
    Normalise a single cell value.
    Returns dict compatible with OcrCell structure.

    Usage in ocr_normalization.py:
        norm = normalise_cell_value(cell_text)
        cell["normalized"] = norm["normalized"]
        cell["is_numeric"] = norm["is_numeric"]
    """
    if not raw or not str(raw).strip():
        return {"value": raw, "normalized": None, "is_numeric": False}

    parsed = parse_indian_number(raw)
    if parsed is not None:
        return {
            "value": str(raw).strip(),
            "normalized": parsed,
            "is_numeric": True,
            "formatted_indian": format_indian_number(int(parsed)) if isinstance(parsed, int) else str(parsed)
        }

    return {"value": str(raw).strip(), "normalized": None, "is_numeric": False}
'''


# ═══════════════════════════════════════════════════════════════
# FILE: backend/table_scan.py  (MODIFY — 3 changes only)
# ═══════════════════════════════════════════════════════════════

TABLE_SCAN_CHANGES = """
CHANGE 1 — Add import at top of file:
─────────────────────────────────────
from services.ocr_document_classifier import classify_document
from prompts.ocr_prompts import PROMPT_ROUTER, DOMAIN_CONTEXT

─────────────────────────────────────
CHANGE 2 — Modify extract_table_from_image() signature and body.
           Find the line where the Claude prompt is built and
           REPLACE the hardcoded prompt string with the router call.

BEFORE (your current code — something like this):
    prompt = f\"\"\"
    Extract table data from this image.
    Return JSON with headers and rows.
    \"\"\"

AFTER:
    # Get doc_type from params (passed from ocr_document_pipeline.py)
    doc_type = kwargs.get("doc_type", "unknown")
    template_columns = kwargs.get("template_columns", [])
    factory_name = kwargs.get("factory_name", "")

    # Route to correct prompt
    prompt_fn = PROMPT_ROUTER.get(doc_type, PROMPT_ROUTER["unknown"])
    prompt = prompt_fn(
        template_columns=template_columns,
        factory_name=factory_name
    )

─────────────────────────────────────
CHANGE 3 — In the JSON response parsing section, add normalisation.
           Find where you parse the JSON response from Claude and
           ADD this after parsing:

    from services.indian_number_normalizer import normalise_cell_value

    # Normalise all numeric cells
    for row in parsed_json.get("rows", []):
        for cell in row.get("cells", []):
            norm = normalise_cell_value(cell.get("value", ""))
            if norm["is_numeric"] and cell.get("normalized") is None:
                cell["normalized"] = norm["normalized"]
"""


# ═══════════════════════════════════════════════════════════════
# FILE: backend/services/ocr_document_pipeline.py  (MODIFY — 2 changes)
# ═══════════════════════════════════════════════════════════════

PIPELINE_CHANGES = """
CHANGE 1 — Add classifier call BEFORE the existing extract_table_from_image() call.
           Find the function that orchestrates the pipeline (likely _run_table_preview_pipeline
           or similar). ADD this block at the top before the AI extraction step:

    # STEP: Classify document type
    from services.ocr_document_classifier import classify_document

    classification = classify_document(image_bytes, anthropic_client)
    detected_doc_type = classification.get("doc_type", "unknown")
    detected_language = classification.get("language", "eng")

    # Use user-provided doc_type_hint if they specified one, else use detected
    effective_doc_type = doc_type_hint if doc_type_hint and doc_type_hint != "auto" else detected_doc_type

    # Upgrade language if classifier detected non-English script
    if "hin" in detected_language or "mar" in detected_language:
        language = detected_language   # Override with richer language

    # Store classification result in routing_meta for audit trail
    routing_meta["classifier_result"] = classification

─────────────────────────────────────
CHANGE 2 — Pass effective_doc_type to extract_table_from_image() call.
           Find the call to extract_table_from_image() or equivalent.

BEFORE:
    result = extract_table_from_image(image_bytes, model=model, language=language)

AFTER:
    result = extract_table_from_image(
        image_bytes,
        model=model,
        language=language,
        doc_type=effective_doc_type,
        template_columns=template.column_names if template else [],
        factory_name=factory_name or ""
    )
"""


# ═══════════════════════════════════════════════════════════════
# FILE: backend/services/ocr_normalization.py  (MODIFY — 1 change)
# ═══════════════════════════════════════════════════════════════

NORMALIZATION_CHANGES = """
CHANGE 1 — Replace all number parsing with Indian-aware parser.
           Find any place where you do int(value) or float(value) on cell data.
           Replace with:

    from services.indian_number_normalizer import normalise_cell_value, parse_indian_number

    # Instead of: num = int(cell_value.replace(",", ""))
    # Use:
    num = parse_indian_number(cell_value)
    if num is None:
        # not a number — keep as text
        pass

CHANGE 2 — Add confusable digit pairs for handwritten Indian registers.
           Find your _is_confusable_digit() or similar function.
           EXTEND the confusables list:

    CONFUSABLE_DIGIT_PAIRS = [
        ('O', '0'),   # letter O vs zero
        ('I', '1'),   # letter I vs one
        ('l', '1'),   # lowercase L vs one
        ('9', '4'),   # 9 vs 4 — very common in Indian handwriting
        ('9', '2'),   # 9 vs 2 — common in Indian handwriting  ← ADD THIS
        ('5', '6'),   # 5 vs 6
        ('0', '6'),   # 0 vs 6
        ('8', '0'),   # 8 vs 0
        ('1', '7'),   # 1 vs 7 — common in Indian handwriting  ← ADD THIS
        ('3', '8'),   # 3 vs 8
    ]

CHANGE 3 — Tighten confidence thresholds for handwritten docs.
           Find where you set confidence tiers (high/medium/review_required).
           Add this BEFORE the existing threshold check:

    # Stricter thresholds for handwritten Indian factory registers
    HANDWRITTEN_DOC_TYPES = {
        "ledger", "stock_register", "production_log",
        "salary_register", "maintenance_log", "scrap_register"
    }

    if doc_type in HANDWRITTEN_DOC_TYPES and has_handwriting:
        HIGH_CONFIDENCE = 0.95    # was 0.85
        MEDIUM_CONFIDENCE = 0.80  # was 0.65 / 0.5
        REVIEW_REQUIRED_THRESHOLD = 0.75  # was 0.5
    else:
        HIGH_CONFIDENCE = 0.85
        MEDIUM_CONFIDENCE = 0.65
        REVIEW_REQUIRED_THRESHOLD = 0.5
"""


# ═══════════════════════════════════════════════════════════════
# FILE: backend/services/ocr_excel_builder.py  (MODIFY — key fixes)
# (or wherever build_excel_bytes / build_ledger_excel_bytes live)
# ═══════════════════════════════════════════════════════════════

EXCEL_BUILDER_CHANGES = """
CHANGE 1 — FIX THE DUPLICATE TOTAL ROW BUG.
           Find where you generate the SUM row for the ledger.
           The bug: you compute SUM of cells that contain Indian-formatted strings.
           openpyxl reads "47,22,000" as a string — SUM returns 0 or wrong.

BEFORE (broken):
    ws.cell(row=total_row, column=2).value = f'=SUM(B2:B{total_row-1})'
    ws.cell(row=total_row, column=3).value = f'=SUM(C2:C{total_row-1})'

AFTER (correct — write normalised integers to cells, format with Indian number format):
    from services.indian_number_normalizer import parse_indian_number, format_indian_number

    # Write numeric values (integers) to data cells — NOT formatted strings
    # Apply Indian number format so Excel displays them correctly
    INDIAN_NUM_FORMAT = '##\\,##\\,##0'   # Excel format code for Indian grouping

    for row_idx, row in enumerate(data_rows, start=2):
        for col_idx, cell in enumerate(row["cells"], start=1):
            norm = cell.get("normalized")
            if norm is not None and isinstance(norm, (int, float)):
                ws.cell(row=row_idx, column=col_idx).value = norm
                ws.cell(row=row_idx, column=col_idx).number_format = INDIAN_NUM_FORMAT
            else:
                ws.cell(row=row_idx, column=col_idx).value = cell.get("value", "")

    # Now the SUM formula works because cells contain integers
    ws.cell(row=total_row, column=2).value = f'=SUM(B2:B{total_row-1})'
    ws.cell(row=total_row, column=3).value = f'=SUM(C2:C{total_row-1})'
    ws.cell(row=total_row, column=2).number_format = INDIAN_NUM_FORMAT
    ws.cell(row=total_row, column=3).number_format = INDIAN_NUM_FORMAT

─────────────────────────────────────
CHANGE 2 — ALWAYS CREATE THE METADATA SHEET.
           Find the code that creates (or skips) the OCR Metadata sheet.
           Remove any check for CELL_FORMAT_V2 env var on the metadata sheet.

BEFORE:
    if os.getenv("CELL_FORMAT_V2", "false").lower() == "true":
        _create_metadata_sheet(wb, rows_with_confidence)

AFTER:
    _create_metadata_sheet(wb, rows_with_confidence)   # Always create

─────────────────────────────────────
CHANGE 3 — ADD DRAFT WARNING ROW for non-approved exports.
           Find where you write the header row in build_excel_bytes.
           ADD this immediately after the header row, for draft/pending/rejected status:

    if verification_status in ("draft", "pending", "rejected"):
        warning_row = total_col_count
        ws.cell(row=2, column=1).value = "⚠ DRAFT — Not approved. Do not use for official records."
        ws.cell(row=2, column=1).font = Font(bold=True, color="7F6000")
        ws.cell(row=2, column=1).fill = PatternFill("solid", fgColor="FFF2CC")
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=total_col_count)
        data_start_row = 3   # Push data rows down by 1
    else:
        data_start_row = 2   # Approved export — no warning row

─────────────────────────────────────
CHANGE 4 — FIX BALANCE CHECK to use normalised integers, not string comparison.

BEFORE (broken — comparing formatted strings):
    dr_total = sum(row[1] for row in rows if row[1])  # "47,22,000" + "14,000" = wrong
    cr_total = sum(row[2] for row in rows if row[2])

AFTER:
    from services.indian_number_normalizer import parse_indian_number

    dr_total = sum(
        parse_indian_number(str(row[1])) or 0
        for row in rows if row[1]
    )
    cr_total = sum(
        parse_indian_number(str(row[2])) or 0
        for row in rows if row[2]
    )
    balanced = abs(dr_total - cr_total) <= 1   # Allow ₹1 rounding
"""


# ═══════════════════════════════════════════════════════════════
# FILE: backend/prompts/ocr_prompts.py  (NEW FILE)
# CREATE this file. Paste the PROMPT_ROUTER content here.
# ═══════════════════════════════════════════════════════════════

# (The full prompt content is in ocr_master_prompts.js — paste each
#  PROMPT_* constant here as a Python string, e.g.:)

PROMPTS_FILE_SKELETON = '''
# backend/prompts/ocr_prompts.py

DOMAIN_CONTEXT = """
You are reading documents from an Indian steel manufacturing factory...
[paste DOMAIN_CONTEXT from ocr_master_prompts.js]
"""

OUTPUT_SCHEMA = """
Return ONLY a JSON object. No markdown, no preamble...
[paste OUTPUT_SCHEMA from ocr_master_prompts.js]
"""

def PROMPT_LEDGER(template_columns=None, factory_name=""):
    return f"""{DOMAIN_CONTEXT}
You are extracting a LEDGER or TRIAL BALANCE document...
[paste full PROMPT_LEDGER body from ocr_master_prompts.js]
{OUTPUT_SCHEMA}"""

# ... repeat for all 12 doc types ...

PROMPT_ROUTER = {
    "ledger":           PROMPT_LEDGER,
    "stock_register":   PROMPT_STOCK_REGISTER,
    "gate_challan":     PROMPT_GATE_CHALLAN,
    "invoice":          PROMPT_INVOICE,
    "dispatch_challan": PROMPT_DISPATCH_CHALLAN,
    "production_log":   PROMPT_PRODUCTION_LOG,
    "salary_register":  PROMPT_SALARY_REGISTER,
    "maintenance_log":  PROMPT_MAINTENANCE_LOG,
    "energy_log":       PROMPT_ENERGY_LOG,
    "quality_cert":     PROMPT_QUALITY_CERT,
    "purchase_order":   PROMPT_PURCHASE_ORDER,
    "scrap_register":   PROMPT_SCRAP_REGISTER,
    "unknown":          PROMPT_LEDGER,
}
'''


# ═══════════════════════════════════════════════════════════════
# SUMMARY — all files to change / create
# ═══════════════════════════════════════════════════════════════

CHANGE_SUMMARY = """
NEW FILES to create (copy content from above):
  backend/services/ocr_document_classifier.py   ← CLASSIFIER_FILE
  backend/services/indian_number_normalizer.py  ← NORMALIZER_FILE
  backend/prompts/__init__.py                   ← empty file
  backend/prompts/ocr_prompts.py                ← PROMPTS_FILE_SKELETON + all 12 prompts

EXISTING FILES to modify (minimal changes per section above):
  backend/table_scan.py                         ← TABLE_SCAN_CHANGES (3 changes)
  backend/services/ocr_document_pipeline.py     ← PIPELINE_CHANGES (2 changes)
  backend/services/ocr_normalization.py         ← NORMALIZATION_CHANGES (3 changes)
  backend/services/ocr_excel_builder.py         ← EXCEL_BUILDER_CHANGES (4 changes)

ENV VAR to enable:
  CELL_FORMAT_V2=true                           ← Enable metadata sheet (or remove the gate)

NO CHANGES NEEDED to:
  Frontend (ocr-scan-page.tsx, ocr-verification-v2-page.tsx)
  Database schema (ocr_verifications, ocr_templates)
  API routes (ocr.py router)
  Approval workflow
  RBAC / permissions
  Background jobs
  Share links / caching
"""
