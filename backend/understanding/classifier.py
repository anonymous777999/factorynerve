from __future__ import annotations
from typing import Optional
from backend.understanding.models import Classification
from backend.services.ocr_document_registry import list_document_types, get_document_type


class DocumentClassifier:
    def __init__(self):
        self.types = list_document_types()
        self._keyword_index = self._build_keyword_index()

    def _build_keyword_index(self) -> dict[str, list[tuple[str, float]]]:
        """Map keyword -> [(type_id, weight)]"""
        index = {}
        for dt in self.types:
            for kw in dt.classifier_keywords:
                index.setdefault(kw.lower(), []).append((dt.type_id, dt.classifier_weight))
        return index

    def classify(self, ocr_text: str, image_bytes: Optional[bytes] = None) -> list[tuple[str, float]]:
        """
        Returns: [(type_id, confidence)] sorted by confidence desc
        """
        text = (ocr_text or "").lower()
        scores = {}

        # 1. Keyword scoring
        for kw, type_weights in self._keyword_index.items():
            if kw in text:
                for type_id, weight in type_weights:
                    scores[type_id] = scores.get(type_id, 0) + weight

        # 2. Structural hints (table vs form vs mixed)
        structure_bonus = self._analyze_structure(text)
        for type_id, bonus in structure_bonus.items():
            scores[type_id] = scores.get(type_id, 0) + bonus

        # 3. Vision model classification (if image provided)
        if image_bytes:
            vision_scores = self._vision_classify(image_bytes)
            for type_id, conf in vision_scores:
                scores[type_id] = scores.get(type_id, 0) + conf * 2.0  # Higher weight

        # Normalize and sort
        if not scores:
            return [("unknown_document", 0.1)]

        max_score = max(scores.values())
        normalized = [(tid, min(score/max_score, 1.0)) for tid, score in scores.items()]
        return sorted(normalized, key=lambda x: x[1], reverse=True)

    def _analyze_structure(self, text: str) -> dict[str, float]:
        """Detect document structure type from text patterns"""
        bonuses = {}
        lines = text.split('\n')

        # Table-like: many lines with similar column count
        if len(lines) > 5:
            # Check for table patterns (e.g., invoices, delivery notes)
            table_keywords = ["sl.no", "description", "qty", "rate", "amount", "hsn", "gstin"]
            if any(kw in text for kw in table_keywords):
                bonuses["gst_invoice"] = bonuses.get("gst_invoice", 0) + 0.3
                bonuses["delivery_note"] = bonuses.get("delivery_note", 0) + 0.3

        # Form-like: key:value pairs (e.g., weighbridge slips, gate entries)
        if any(':' in line for line in lines[:10]):
            bonuses["weighbridge_slip"] = bonuses.get("weighbridge_slip", 0) + 0.3
            bonuses["gate_entry"] = bonuses.get("gate_entry", 0) + 0.2

        return bonuses

    def _vision_classify(self, image_bytes: bytes) -> list[tuple[str, float]]:
        """Use vision model for layout classification"""
        # Placeholder: Integrate with Claude/other vision models
        return []


def classify(ocr_text: str, image_bytes: bytes | None = None) -> list[tuple[str, float]]:
    """Module-level convenience wrapper for document classification.

    Creates a DocumentClassifier and classifies the given text/image.
    Returns [(type_id, confidence)] sorted by confidence descending.
    """
    classifier = DocumentClassifier()
    return classifier.classify(ocr_text, image_bytes)
