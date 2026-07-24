"""Export Gate — Pre-export validation for OCR documents.

Checks that a verification record meets all requirements before
being exported to Excel, PDF, or downstream systems.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.models.ocr_verification import OcrVerification
from backend.services.ocr_document_registry import get_document_type


@dataclass
class Check:
    """A single validation check result."""
    name: str
    passed: bool
    message: str = ""

    def __bool__(self) -> bool:
        return self.passed


@dataclass
class ExportGateResult:
    """Aggregate result of export readiness validation."""
    passed: bool
    checks: list[Check] = field(default_factory=list)
    blocking_issues: list[Check] = field(default_factory=list)

    @property
    def all_checks_pass(self) -> bool:
        return all(c.passed for c in self.checks)


def validate_export_readiness(verification: OcrVerification) -> ExportGateResult:
    """Check if a verification document is ready for export.

    Requirements (6.4 Export Validation Gate):
    - Document must be "approved" status
    - No blocking cross-validation issues
    - Reviewer notes present (for audit trail)
    - Confidence above document type's block threshold
    """
    checks: list[Check] = []

    # 1. Status check — only approved documents can be exported
    status_ok = verification.status == "approved"
    checks.append(Check(
        name="status",
        passed=status_ok,
        message=(
            f"Document status is '{verification.status}', expected 'approved'"
            if not status_ok else ""
        ),
    ))

    # 2. Validation check — no blocking cross-validation issues
    cross_val = verification.cross_validation or {}
    has_blocking = bool(cross_val.get("has_blocking_issues", False))
    checks.append(Check(
        name="validation",
        passed=not has_blocking,
        message=(
            "Document has unresolved blocking cross-validation issues"
            if has_blocking else ""
        ),
    ))

    # 3. Reviewer notes check — required for audit trail
    has_notes = bool(verification.reviewer_notes)
    checks.append(Check(
        name="reviewer_notes",
        passed=has_notes,
        message="Reviewer notes are empty — add notes before export for audit trail"
        if not has_notes else "",
    ))

    # 4. Confidence check — must be above document type's block threshold
    doc_type = get_document_type(verification.doc_type_hint or "")
    confidence_ok = True
    conf_message = ""
    if doc_type and verification.avg_confidence is not None:
        threshold = doc_type.block_below_confidence
        confidence_ok = verification.avg_confidence >= threshold
        conf_message = (
            f"Confidence {verification.avg_confidence:.2f} is below "
            f"block threshold {threshold:.2f} for {doc_type.display_name}"
            if not confidence_ok else ""
        )
    elif doc_type and verification.avg_confidence is None:
        confidence_ok = False
        conf_message = "No confidence score available — cannot pass threshold check"
    checks.append(Check(
        name="confidence",
        passed=confidence_ok,
        message=conf_message,
    ))

    blocking = [c for c in checks if not c.passed]
    return ExportGateResult(
        passed=all(c.passed for c in checks),
        checks=checks,
        blocking_issues=blocking,
    )
