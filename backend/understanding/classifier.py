from __future__ import annotations

from backend.understanding.models import Classification


def classify(text: str) -> dict[str, object]:
    normalized = (text or "").strip().lower()
    if "trading account" in normalized:
        result = Classification(doc_type="ledger", confidence=0.95)
        return {"doc_type": result.doc_type, "confidence": result.confidence}
    if "to " in normalized and "by " in normalized:
        result = Classification(doc_type="ledger", confidence=0.85)
        return {"doc_type": result.doc_type, "confidence": result.confidence}
    result = Classification(doc_type="generic", confidence=0.6 if normalized else 0.0)
    return {"doc_type": result.doc_type, "confidence": result.confidence}
