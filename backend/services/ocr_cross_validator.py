from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal

from backend.ocr_utils import extract_table_from_image

logger = logging.getLogger(__name__)

@dataclass(slots=True)
class Discrepancy:
    row_index: int
    column_index: int
    tesseract_value: float
    ai_value: float
    percentage_diff: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "row_index": self.row_index,
            "column_index": self.column_index,
            "tesseract_value": self.tesseract_value,
            "ai_value": self.ai_value,
            "percentage_diff": round(self.percentage_diff, 4),
        }

@dataclass(slots=True)
class CrossValidationResult:
    status: Literal["verified", "needs_review", "blocked", "unvalidated"]
    discrepancies: list[Discrepancy] = field(default_factory=list)
    explanation: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "discrepancies": [d.to_dict() for d in self.discrepancies],
            "explanation": self.explanation,
        }

class OcrCrossValidator:
    """
    Server-side cross-validation of AI-extracted values against
    deterministic Tesseract extraction.

    Strategy:
    1. Run Tesseract to extract tabular data (deterministic, ~1s).
    2. Compare numeric values between Tesseract and AI extraction by positional alignment.
    3. Flag discrepancies > 10% for warning, > 30% to block.
    """

    # Thresholds from the remediation plan
    AUTO_VERIFY_THRESHOLD = 0.10   # <10% difference -> auto-verified
    FLAG_REVIEW_THRESHOLD = 0.30   # >30% difference -> blocked/needs_review

    def __init__(self):
        pass

    def _parse_numeric(self, val_str: str) -> float | None:
        """Cleans and attempts to parse a string as a float."""
        if not val_str:
            return None
        cleaned = (
            val_str.replace(",", "")
            .replace(" ", "")
            .replace("Rs.", "")
            .replace("INR", "")
            .replace("₹", "")
            .replace("$", "")
        )
        try:
            return float(cleaned)
        except ValueError:
            return None

    @staticmethod
    def _value_exists_in(value: float, candidates: list[float], tolerance: float = 0.001) -> bool:
        """True if ``value`` matches any candidate within a relative tolerance."""
        for candidate in candidates:
            if candidate == value:
                return True
            denominator = max(abs(candidate), abs(value))
            if denominator and abs(candidate - value) / denominator <= tolerance:
                return True
        return False

    def validate(
        self,
        image_bytes: bytes,
        ai_extracted_rows: list[list[str | Any]],
        tesseract_rows: list[list[str | Any]] | None = None,
    ) -> CrossValidationResult:
        """
        Compares AI-extracted rows against Tesseract-extracted rows.
        Uses positional alignment (row/col index) to find discrepancies,
        with a global-value fallback to tolerate row misalignment (e.g. the
        AI dropping a header row or merging rows).

        Args:
            image_bytes: Original document image (used only if ``tesseract_rows``
                is not provided).
            ai_extracted_rows: Rows extracted by the AI provider.
            tesseract_rows: Pre-computed Tesseract rows. When supplied, the
                expensive Tesseract re-extraction is skipped.
        """
        if tesseract_rows is None:
            try:
                # 1. Get Tesseract Ground Truth
                tesseract_result = extract_table_from_image(image_bytes)
                tesseract_rows = tesseract_result.rows
            except Exception as e:
                logger.error("Tesseract extraction failed during cross-validation: %s", e, exc_info=True)
                return CrossValidationResult(
                    status="unvalidated",
                    explanation=f"Tesseract error: {str(e)}"
                )

        if not tesseract_rows:
            return CrossValidationResult(
                status="unvalidated",
                explanation="Tesseract could not extract any table structure. Cannot verify AI results."
            )

        # Collect every number Tesseract saw anywhere in the document. Used as
        # a fallback so that row misalignment (header dropped, rows merged)
        # doesn't produce false discrepancies for values that DO exist in the image.
        tesseract_numbers: list[float] = []
        for t_row in tesseract_rows:
            for cell in t_row:
                num = self._parse_numeric(str(cell).strip())
                if num is not None:
                    tesseract_numbers.append(num)

        discrepancies = []

        # Align rows by index (take the minimum of both sets to avoid index errors)
        num_rows_to_compare = min(len(tesseract_rows), len(ai_extracted_rows))

        for r_idx in range(num_rows_to_compare):
            t_row = tesseract_rows[r_idx]
            a_row = ai_extracted_rows[r_idx]

            # Align columns by index
            num_cols_to_compare = min(len(t_row), len(a_row))

            for c_idx in range(num_cols_to_compare):
                t_val_str = str(t_row[c_idx]).strip()
                a_val_str = str(a_row[c_idx]).strip()

                # If both are empty, skip
                if not t_val_str and not a_val_str:
                    continue

                t_num = self._parse_numeric(t_val_str)
                a_num = self._parse_numeric(a_val_str)

                # If both are numeric, compare them
                if t_num is not None and a_num is not None:
                    if t_num == 0 and a_num == 0:
                        continue

                    diff = abs(t_num - a_num)
                    # Avoid division by zero
                    if t_num != 0:
                        pct_diff = diff / abs(t_num)
                    else:
                        pct_diff = 1.0 if a_num != 0 else 0.0

                    # Use a small epsilon for floating point equality
                    if pct_diff > 0.001:
                        # Misalignment tolerance: if the AI value matches ANY
                        # number Tesseract extracted (within 0.1%), assume a
                        # row/column shift rather than a hallucination.
                        if self._value_exists_in(a_num, tesseract_numbers):
                            continue
                        discrepancies.append(Discrepancy(
                            row_index=r_idx,
                            column_index=c_idx,
                            tesseract_value=t_num,
                            ai_value=a_num,
                            percentage_diff=pct_diff
                        ))

        if not discrepancies:
            return CrossValidationResult(status="verified", explanation="All numeric values match Tesseract.")

        # Determine status based on the largest discrepancy found
        max_pct = max(d.percentage_diff for d in discrepancies)
        
        if max_pct > self.FLAG_REVIEW_THRESHOLD:
            status = "blocked"
            explanation = f"CRITICAL: Significant discrepancy detected ({max_pct:.1%}). Manual review required."
        elif max_pct > self.AUTO_VERIFY_THRESHOLD:
            status = "needs_review"
            explanation = f"WARNING: Discrepancy detected ({max_pct:.1%}). Review recommended."
        else:
            status = "verified"
            explanation = "Minor discrepancies detected, but within acceptable range."

        return CrossValidationResult(
            status=status,
            discrepancies=discrepancies,
            explanation=explanation
        )
