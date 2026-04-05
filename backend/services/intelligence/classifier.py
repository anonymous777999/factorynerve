"""Task classification for Factory Intelligence orchestration."""

from __future__ import annotations

from backend.services.intelligence.schemas import ClassificationResult, PreprocessedDocument


def classify_document_task(document: PreprocessedDocument) -> ClassificationResult:
    score = 0
    reasons: list[str] = []
    warning_count = len(document.warnings)
    extracted_count = len(document.extracted_fields)
    entry_count = len(document.segments.get("entries", []))

    if document.document_kind == "pdf":
        score += 2
        reasons.append("PDF input usually needs extra parsing and reconciliation.")
    if warning_count >= 2:
        score += 2
        reasons.append("Image quality warnings increase extraction risk.")
    elif warning_count == 1:
        score += 1
        reasons.append("Minor image quality warning detected.")
    if entry_count >= 10:
        score += 2
        reasons.append("Large entry count implies higher parsing complexity.")
    elif entry_count >= 4:
        score += 1
        reasons.append("Multiple structured entries require normalized parsing.")
    if extracted_count <= 2:
        score += 2
        reasons.append("Few obvious fields were extracted with rules.")
    elif extracted_count <= 4:
        score += 1
        reasons.append("Only partial rule-based extraction is available.")
    if document.segments.get("totals"):
        score += 1
        reasons.append("Totals were detected and should be validated against entries.")
    if len(document.reduced_text) > 2200:
        score += 1
        reasons.append("Reduced context is still relatively long.")

    if score >= 5:
        complexity = "complex"
    elif score >= 3:
        complexity = "medium"
    else:
        complexity = "simple"
    return ClassificationResult(complexity=complexity, reasons=reasons, score=score)
