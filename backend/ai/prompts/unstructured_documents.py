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

Extract ALL visible information from this handwritten form or note.

INSTRUCTIONS:
1. Read all handwritten text carefully
2. Organize into key-value pairs based on context
3. For numbers, prefer numeric values where clear
4. If text is illegible, mark as [illegible] with position
5. Note the handwriting quality assessment
6. Include any printed/form fields visible

OUTPUT FORMAT:
{
  "fields": [
    {"label": "Field Name", "value": "extracted value", "confidence": 0.0-1.0}
  ],
  "notes": ["Any observations about the document"],
  "quality": {
    "readability": "good|fair|poor",
    "partial_extraction": bool,
    "challenging_areas": ["description of difficult areas"]
  }
}

IMPORTANT: Do NOT hallucinate values. If you cannot read something, mark it as unclear.
"""


# =============================================================================
# LEDGER SHEET PROMPT (Section 5.2)
# =============================================================================

LEDGER_SHEET_PROMPT: str = """You are a financial document extraction expert.

Extract this ledger/account statement into structured tabular data.

INSTRUCTIONS:
1. Identify the account header (name, account number, period)
2. Extract ALL rows in order (date, description, debit, credit, balance)
3. Balance column is critical — ensure running balance is mathematically correct
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
      "balance": 0.00,
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
- Verify: opening_balance + sum(debits) - sum(credits) = closing_balance
- Running balance after each entry must be correct
- Flag any mathematical inconsistencies
"""


# =============================================================================
# CHAT/SCREENSHOT TRANSCRIPT PROMPT (Section 5.3)
# =============================================================================

CHAT_TRANSCRIPT_PROMPT: str = """You are a chat transcript extraction expert.

Extract this screenshot of a conversation into structured message data.

INSTRUCTIONS:
1. Identify different speakers (names, colors, positions — left/right)
2. Extract each message in order
3. Preserve timestamps where visible
4. Note message content — text, images, documents
5. Handle read receipts, delivery status
6. Preserve emoji and formatting where meaningful

OUTPUT FORMAT:
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
