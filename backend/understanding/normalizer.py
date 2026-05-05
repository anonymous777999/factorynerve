from __future__ import annotations

from backend.understanding.models import NormalizedDocument, ParsedDocument, Sheet


def _ledger_rows(parsed: ParsedDocument) -> list[list[str]]:
    size = max(len(parsed.debit), len(parsed.credit))
    rows: list[list[str]] = []
    for index in range(size):
        debit = parsed.debit[index] if index < len(parsed.debit) else None
        credit = parsed.credit[index] if index < len(parsed.credit) else None
        rows.append([
            debit.description if debit else "",
            debit.amount if debit else "",
            credit.description if credit else "",
            credit.amount if credit else "",
        ])
    return rows


def _generic_columns(rows: list[list[str]]) -> list[str]:
    width = max((len(row) for row in rows), default=1)
    return [f"Column {index}" for index in range(1, width + 1)]


def normalize(parsed: ParsedDocument) -> dict[str, object]:
    if parsed.doc_type == "ledger":
        sheet = Sheet(
            name="Sheet 1",
            columns=["Dr", "Amount", "Cr", "Amount"],
            rows=_ledger_rows(parsed),
        )
        document = NormalizedDocument(sheets=[sheet])
        return {"sheets": [{"name": sheet.name, "columns": sheet.columns, "rows": sheet.rows} for sheet in document.sheets]}
    rows = [[str(cell or "").strip() for cell in row] for row in parsed.rows or []]
    sheet = Sheet(name="Sheet 1", columns=_generic_columns(rows), rows=rows)
    document = NormalizedDocument(sheets=[sheet])
    return {"sheets": [{"name": sheet.name, "columns": sheet.columns, "rows": sheet.rows} for sheet in document.sheets]}
