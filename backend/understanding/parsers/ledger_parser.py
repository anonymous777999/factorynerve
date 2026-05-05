from __future__ import annotations

import re

from backend.understanding.models import LedgerEntry, ParsedDocument


_AMOUNT_RE = re.compile(r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*$")
_SIDE_RE = re.compile(r"(?=\b(?:To|By)\b)", re.IGNORECASE)


def _split_segments(row: list[str]) -> list[str]:
    joined = " ".join(str(cell or "").strip() for cell in row if str(cell or "").strip())
    parts = [part.strip(" |") for part in _SIDE_RE.split(joined) if part.strip(" |")]
    return parts or ([joined] if joined else [])


def _parse_segment(segment: str) -> tuple[str, LedgerEntry] | None:
    cleaned = " ".join(segment.replace("|", " ").split())
    lowered = cleaned.lower()
    if not (lowered.startswith("to ") or lowered.startswith("by ")):
        return None
    amount_match = _AMOUNT_RE.search(cleaned)
    amount = amount_match.group(1) if amount_match else ""
    body = cleaned[3:].strip()
    if amount:
        body = body[: amount_match.start() - 3].strip()
    side = "debit" if lowered.startswith("to ") else "credit"
    return side, LedgerEntry(description=body, amount=amount)


def parse(rows: list[list[str]]) -> ParsedDocument:
    debit: list[LedgerEntry] = []
    credit: list[LedgerEntry] = []
    for row in rows or []:
        for segment in _split_segments(row):
            parsed = _parse_segment(segment)
            if parsed is None:
                continue
            side, entry = parsed
            (debit if side == "debit" else credit).append(entry)
    return ParsedDocument(doc_type="ledger", debit=debit, credit=credit, rows=rows or [])
