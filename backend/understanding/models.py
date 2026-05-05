from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class Classification:
    doc_type: str
    confidence: float


@dataclass(slots=True)
class LedgerEntry:
    description: str
    amount: str


@dataclass(slots=True)
class ParsedDocument:
    doc_type: str
    debit: list[LedgerEntry] = field(default_factory=list)
    credit: list[LedgerEntry] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)


@dataclass(slots=True)
class Sheet:
    name: str
    columns: list[str]
    rows: list[list[str]]


@dataclass(slots=True)
class NormalizedDocument:
    sheets: list[Sheet]
