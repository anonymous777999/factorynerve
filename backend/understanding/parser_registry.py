from __future__ import annotations

from backend.understanding.models import ParsedDocument
from backend.understanding.parsers.generic_parser import parse as parse_generic
from backend.understanding.parsers.ledger_parser import parse as parse_ledger


_PARSERS = {
    "ledger": parse_ledger,
    "generic": parse_generic,
}


def parse_document(doc_type: str, rows: list[list[str]]) -> ParsedDocument:
    parser = _PARSERS.get((doc_type or "").strip().lower(), parse_generic)
    return parser(rows or [])
