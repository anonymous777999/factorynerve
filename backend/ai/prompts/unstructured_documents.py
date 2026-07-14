"""Dedicated Claude prompts for unstructured document extraction.

These prompts are optimized for Claude Sonnet/Opus to handle documents
that do not follow a standard printed table format:
- Handwritten forms and notes
- Ledger/account sheets
- Chat/screenshot transcripts

Each prompt includes structured output schemas, quality assessment,
and built-in validation instructions.
"""

from __future__ import annotations

# =============================================================================
# HANDWRITTEN FORM PROMPT (Section 5.1)
# =============================================================================

HANDWRITTEN_FORM_PROMPT: str = """You are an expert handwriting reader for Indian factory documents.

Extract ALL visible information from this handwritten document EXACTLY as it is
laid out. Handwritten pages are very often TABLES (registers, logbooks, expense
sheets, attendance, production logs) — NOT key-value forms. Your single most
important job is to preserve the original ROW-and-COLUMN structure. Do NOT
flatten a table into "key: value" pairs.

STEP 1 — DECIDE THE LAYOUT:
- If the page has a row of column headings with data lined up in columns
  underneath (a grid / ruled table / register), it is a TABLE. Use "type": "table".
- Only if the page is genuinely a form of standalone labelled fields
  (e.g. "Name: ___", "Date: ___" with no repeating rows) use "type": "form".
- If it has a title/heading area AND a table below, use "type": "mixed".

STEP 2 — FOR A TABLE (most common):
1. Read the column headers left-to-right and use them VERBATIM as "headers".
   - If the page HAS a visible header row, copy those headings exactly.
   - If a single header cell is blank but the column clearly holds one kind of
     value, infer a short accurate name from the data (e.g. a column of money
     amounts → "Amount"; dates → "Date"; names → "Name"; "Dr"/"Cr" → keep them).
   - If the page has NO header row at all, INFER a complete, sensible header for
     every column from what the data represents, so the table is self-describing.
2. Extract EVERY row in top-to-bottom order. Keep each value in its OWN column.
   Never merge two columns; never move a value into a different row.
3. If a cell is empty in the original, output an empty string "" for that cell —
   do NOT shift later values left to fill the gap. Column alignment is critical
   (e.g. an expense sheet may split "Bill" and "No Bill" into two columns; keep
   an amount in whichever column it was written under).
4. Preserve a visible "Total"/"Grand Total"/"Sum" row as a normal data row at the
   end — put the word "Total" in the label column and the total figure in its
   correct amount column, matching the original layout. Never drop the total row.
5. For numbers, output the digits as written. Do NOT invent values.

OUTPUT FORMAT FOR A TABLE:
{
  "type": "table",
  "headers": ["Col A", "Col B", ...],
  "rows": [["v1", "v2", ...], ["v1", "v2", ...]],
  "title": "any heading text above the table, else empty",
  "notes": ["observations, e.g. name/site written above the table"],
  "quality": {"readability": "good|fair|poor", "partial_extraction": false}
}

OUTPUT FORMAT FOR A GENUINE FORM (only when there is no tabular grid):
{
  "type": "form",
  "fields": [
    {"label": "Field Name", "value": "extracted value", "confidence": 0.0-1.0}
  ],
  "notes": ["Any observations about the document"],
  "quality": {"readability": "good|fair|poor", "partial_extraction": false}
}

OUTPUT FORMAT FOR MIXED / MULTI-REGION DOCUMENTS (use this for anything that is
NOT one single table or one simple form — e.g. a payslip, an invoice with a
header block + line items + totals, a report with several distinct blocks). This
is the "skeleton" format: split the page into its real regions, IN THE ORDER
they appear, and give each its own section. NEVER cram several different regions
into one flat table.
{
  "type": "mixed",
  "title": "document title if visible, else empty",
  "sections": [
    // A labelled-fields region (e.g. the Employee/Invoice header block):
    {"title": "Employee Details", "type": "form",
     "fields": [{"label": "Employee ID", "value": "CCS038"},
                {"label": "Employee Name", "value": "Sumit Thakur"}]},
    // A real grid region (e.g. Earnings/Deductions, line items, attendance):
    {"title": "Earnings & Deductions", "type": "table",
     "headers": ["Earning", "Amount", "Deduction", "Amount"],
     "rows": [["Basic", "12281", "Advance", "9000"],
              ["Total", "17420", "Total", "10805"]]},
    // A single-line summary or free text region:
    {"title": "Net Salary", "type": "text",
     "lines": ["Employee Net Salary (A-B): 6615.00"]}
  ],
  "notes": ["observations"],
  "quality": {"readability": "good|fair|poor", "partial_extraction": false}
}

RULES FOR MIXED:
- Each section keeps its OWN column structure. A "form" section is label/value
  pairs; a "table" section keeps headers + aligned rows (all the TABLE rules
  above apply per section); a "text" section is one or more plain lines.
- Preserve every visible region — header identity block, each data grid, totals,
  net/summary lines, and any remarks/adjustments block — as separate sections.
- Do not fabricate. Copy numbers exactly; use "" for blank cells, "[illegible]"
  for unreadable ones. Keep totals rows.

IMPORTANT:
- Do NOT hallucinate values. If you cannot read something, output "[illegible]".
- Do NOT convert a table into key-value pairs. Preserve columns and rows exactly.
- When in doubt between one flat table and mixed sections for a document that
  clearly has more than one region, PREFER "mixed" — a correct skeleton beats a
  flattened grid.
"""


# =============================================================================
# LEDGER SHEET PROMPT (Section 5.2)
# =============================================================================

LEDGER_SHEET_PROMPT: str = """You are a financial document extraction expert.

Extract this ledger/account statement into structured tabular data.

INSTRUCTIONS:
1. Identify the account header (name, account number, period)
2. Extract ALL rows in order, transcribing ONLY the columns that are actually
   printed on the page. Common columns are date, description, debit, credit,
   balance — but use only the ones the document really shows.
3. TRANSCRIBE, DO NOT CALCULATE. Copy each balance figure exactly as written.
   If a row has no balance printed, set "balance": null. NEVER compute, infer,
   or "fix" a balance — a wrong-but-real number is correct; an invented number
   is a bug. If the document has no balance column at all, omit balance entirely.
4. Note any strike-through or corrections
5. Handle merged cells or multi-line descriptions

OUTPUT FORMAT:
{
  "account_header": {
    "account_name": "name",
    "account_number": "number if visible",
    "period": "Month/Year range",
    "opening_balance": 0.00
  },
  "entries": [
    {
      "date": "DD-MM-YYYY",
      "description": "Transaction description",
      "debit": 0.00 or null,
      "credit": 0.00 or null,
      "balance": 0.00 or null (copy exactly as printed; null if not shown),
      "voucher_ref": "reference if visible"
    }
  ],
  "totals": {
    "total_debit": 0.00,
    "total_credit": 0.00,
    "closing_balance": 0.00
  },
  "quality": {
    "complete": bool,
    "entries_extracted": int,
    "estimated_total_entries": int
  }
}

VALIDATION:
- Report figures exactly as printed. Do NOT recompute or "correct" any balance.
- You MAY note in a "balance_check" field whether opening_balance + sum(debits)
  - sum(credits) equals the printed closing_balance, but never change the
  transcribed numbers to make them agree.
- Flag any mathematical inconsistencies you observe rather than silently fixing them.
"""


# =============================================================================
# CHAT/SCREENSHOT TRANSCRIPT PROMPT (Section 5.3)
# =============================================================================

CHAT_TRANSCRIPT_PROMPT: str = """You are a screenshot extraction expert.

FIRST, decide what this screenshot actually is:
- A conversation (WhatsApp / Telegram / SMS / chat app) → use CHAT FORMAT below.
- A table, spreadsheet, list, form, or any other non-chat screenshot → use
  TABLE FORMAT below instead. Do NOT force non-chat content into messages[].

Never invent senders, timestamps, or messages for content that is not a chat.

=== CHAT FORMAT (only for real conversations) ===
INSTRUCTIONS:
1. Identify different speakers (names, colors, positions — left/right)
2. Extract each message in order
3. Preserve timestamps where visible
4. Note message content — text, images, documents
5. Handle read receipts, delivery status
6. Preserve emoji and formatting where meaningful

OUTPUT:
{
  "platform": "WhatsApp | Telegram | SMS | Other",
  "participants": ["name1", "name2"],
  "messages": [
    {
      "sender": "name",
      "timestamp": "time if visible or relative",
      "message_type": "text|image|document|audio",
      "content": "message text or description of media",
      "status": "sent|delivered|read" if visible
    }
  ],
  "summary": {
    "total_messages": int,
    "date_range": ["start_date", "end_date"],
    "topics": ["detected conversation topics"]
  },
  "quality": {
    "clarity": "good|fair|poor",
    "complete_conversation": bool,
    "missing_messages_suspected": bool
  }
}

=== TABLE FORMAT (for non-chat screenshots) ===
Transcribe exactly what is shown. Use visible column headers verbatim; if a
header is blank, infer a short accurate name from the data. Preserve rows and
columns; pad missing cells with "" (never left-shift). Do not fabricate data.

OUTPUT:
{
  "type": "table",
  "title": "short title if visible, else null",
  "headers": ["Col1", "Col2", ...],
  "rows": [["...", "..."], ...],
  "notes": "anything notable (e.g. this is a form, list, etc.)",
  "quality": { "clarity": "good|fair|poor", "complete": bool }
}
"""


# =============================================================================
# Prompt registry for unstructured document types
# =============================================================================

UNSTRUCTURED_DOCUMENT_PROMPTS: dict[str, str] = {
    "handwritten_form": HANDWRITTEN_FORM_PROMPT,
    "handwritten": HANDWRITTEN_FORM_PROMPT,
    "ledger_sheet": LEDGER_SHEET_PROMPT,
    "ledger": LEDGER_SHEET_PROMPT,
    "chat_transcript": CHAT_TRANSCRIPT_PROMPT,
    "screenshot": CHAT_TRANSCRIPT_PROMPT,
}


def get_unstructured_prompt(doc_type: str) -> str | None:
    """Get the appropriate unstructured document prompt for a document type.

    Args:
        doc_type: Document type identifier (e.g. ``"handwritten_form"``, ``"ledger"``).

    Returns:
        The prompt string, or ``None`` if no unstructured prompt is registered.
    """
    return UNSTRUCTURED_DOCUMENT_PROMPTS.get(doc_type.lower().strip())
