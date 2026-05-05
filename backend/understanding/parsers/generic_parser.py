from __future__ import annotations

from backend.understanding.models import ParsedDocument


def parse(rows: list[list[str]]) -> ParsedDocument:
    cleaned_rows = [[str(cell or "").strip() for cell in row] for row in rows or []]
    return ParsedDocument(doc_type="generic", rows=cleaned_rows)
