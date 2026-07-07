"""Multi-stage validation pipeline for OCR extraction results.

Runs all five stages in order:
1. STRUCTURAL — row/column consistency, empty cell ratio, header uniqueness
2. SCHEMA — required fields, type checking, pattern validation
3. BUSINESS RULE — per-document-type arithmetic rules
4. CROSS-VALIDATION — AI vs Tesseract discrepancy detection
5. CONSISTENCY — date logic, totals matching, tax percentages

Returns a unified ``ValidationResult`` with per-stage breakdown.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.validators.validation_types import (
    Severity,
    ValidationIssue,
    ValidationResult,
    ValidationStageResult,
)
from backend.services.ocr_consistency_rules import (
    validate_date_logic,
    validate_tax_percentage_consistency,
    validate_totals_match_sum,
    validate_vehicle_number_format,
)
from backend.services.ocr_business_rules import run_all_rules


logger = logging.getLogger(__name__)


class OcrValidationPipeline:
    """Orchestrates the multi-stage validation pipeline for OCR results.

    Usage::

        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "500"]],
            doc_type="invoice",
        )
        if not result.passed:
            print(result.to_dict())
    """

    # ── Structural consistency thresholds ────────────────────────────────────
    MAX_EMPTY_CELL_RATIO: float = 0.50  # Stage 1: reject >50% empty cells
    MIN_COLUMN_COUNT: int = 1
    ALLOW_DUPLICATE_HEADERS: bool = True  # Some tables legitimately have duplicate headers

    def validate(
        self,
        *,
        headers: list[str] | None = None,
        rows: list[list[str]] | None = None,
        doc_type: str | None = None,
        data: dict[str, Any] | None = None,
        cross_validation: dict[str, Any] | None = None,
        image_bytes: bytes | None = None,
    ) -> ValidationResult:
        """Run all validation stages and return the combined result.

        Args:
            headers: Column headers from OCR extraction.
            rows: Row data (list of string lists).
            doc_type: Document type (e.g. ``"invoice"``, ``"weighbridge_slip"``).
            data: Optional structured data dict for richer validation.
            cross_validation: Optional pre-computed cross-validation result dict.
            image_bytes: Optional image bytes for running cross-validation live.

        Returns:
            A ``ValidationResult`` with all stage results.
        """
        safe_headers = headers or []
        safe_rows = rows or []
        safe_doc_type = (doc_type or "").lower().strip()

        # Run stages in order
        stages: dict[str, ValidationStageResult] = {}

        # Stage 1: Structural
        stages["structural"] = self._run_structural(safe_headers, safe_rows)

        # Stage 2: Schema
        stages["schema"] = self._run_schema(safe_headers, safe_rows, safe_doc_type, data)

        # Stage 3: Business Rule
        stages["business_rule"] = self._run_business_rules(safe_doc_type, data, safe_headers, safe_rows)

        # Stage 4: Cross-validation
        stages["cross_validation"] = self._run_cross_validation(cross_validation)

        # Stage 5: Consistency
        stages["consistency"] = self._run_consistency(safe_doc_type, safe_headers, safe_rows)

        # Compose final result
        all_issues = [i for s in stages.values() for i in s.issues]
        errors = [i for i in all_issues if i.severity == "error"]
        warnings = [i for i in all_issues if i.severity == "warning"]
        infos = [i for i in all_issues if i.severity == "info"]

        passed = len(errors) == 0
        blockers = len(errors) > 0
        can_export = len(errors) == 0  # No errors means exportable (warnings OK)

        parts: list[str] = []
        if errors:
            parts.append(f"{len(errors)} error{'s' if len(errors) != 1 else ''}")
        if warnings:
            parts.append(f"{len(warnings)} warning{'s' if len(warnings) != 1 else ''}")
        if infos:
            parts.append(f"{len(infos)} info")
        summary = ", ".join(parts) if parts else "All checks passed"

        return ValidationResult(
            passed=passed,
            summary=summary,
            stages=stages,
            blockers=blockers,
            can_export_with_warnings=can_export,
        )

    # ── Stage 1: Structural ──────────────────────────────────────────────────

    def _run_structural(self, headers: list[str], rows: list[list[str]]) -> ValidationStageResult:
        """Row/column consistency checks, empty cell ratio, header quality."""
        issues: list[ValidationIssue] = []

        # 1. Row/column consistency
        if headers and rows:
            expected_cols = len(headers)
            for row_idx, row in enumerate(rows):
                if len(row) != expected_cols:
                    issues.append(ValidationIssue(
                        field=f"row.{row_idx}",
                        message=f"Row {row_idx + 1} has {len(row)} columns, expected {expected_cols}",
                        severity="warning",
                    ))

        # 2. Empty cell ratio
        if rows:
            total_cells = sum(len(row) for row in rows)
            empty_cells = sum(1 for row in rows for cell in row if not str(cell or "").strip())
            if total_cells > 0 and (empty_cells / total_cells) > self.MAX_EMPTY_CELL_RATIO:
                empty_pct = round(empty_cells / total_cells * 100)
                issues.append(ValidationIssue(
                    field="table",
                    message=f"Empty cell ratio is {empty_pct}% (threshold: {self.MAX_EMPTY_CELL_RATIO * 100}%). High level of incomplete data.",
                    severity="warning",
                ))

        # 3. Header quality
        if headers:
            non_empty_headers = [h for h in headers if str(h or "").strip()]
            if not non_empty_headers:
                issues.append(ValidationIssue(
                    field="headers",
                    message="All headers are empty",
                    severity="error",
                ))
            elif len(non_empty_headers) < len(headers):
                issues.append(ValidationIssue(
                    field="headers",
                    message=f"{len(headers) - len(non_empty_headers)} header(s) are empty",
                    severity="warning",
                ))

            # Header uniqueness check
            lowered = [h.lower().strip() for h in non_empty_headers]
            seen: set[str] = set()
            for header in lowered:
                if header in seen:
                    issues.append(ValidationIssue(
                        field="headers",
                        message=f"Duplicate header: '{header}'",
                        severity="info" if self.ALLOW_DUPLICATE_HEADERS else "warning",
                    ))
                seen.add(header)

        passed = len([i for i in issues if i.severity == "error"]) == 0
        return ValidationStageResult(stage_name="structural", passed=passed, issues=issues)

    # ── Stage 2: Schema ──────────────────────────────────────────────────────

    def _run_schema(
        self,
        headers: list[str],
        rows: list[list[str]],
        doc_type: str,
        data: dict[str, Any] | None,
    ) -> ValidationStageResult:
        """Required fields, type checking, pattern validation."""
        issues: list[ValidationIssue] = []

        if not headers:
            passed = len([i for i in issues if i.severity == "error"]) == 0
            return ValidationStageResult(stage_name="schema", passed=passed, issues=issues)

        lowered = [h.lower().strip() for h in headers]

        # 1. Type checking: identify numeric columns and validate values
        numeric_keywords = {"qty", "quantity", "rate", "amount", "price", "total", "value", "gst", "cgst", "sgst", "igst", "debit", "credit", "dr", "cr", "weight", "gross", "tare", "net"}
        for col_idx, header in enumerate(lowered):
            if any(kw in header for kw in numeric_keywords):
                for row_idx, row in enumerate(rows):
                    if col_idx < len(row):
                        val = str(row[col_idx]).strip()
                        if val and val != "-":
                            cleaned = val.replace(",", "").replace(" ", "").replace("₹", "").replace("$", "")
                            try:
                                float(cleaned)
                            except ValueError:
                                issues.append(ValidationIssue(
                                    field=f"row.{row_idx}.col.{col_idx}",
                                    message=f"'{header}' column: '{val}' is not a valid number",
                                    severity="warning",
                                ))

        # 2. Pattern validation for known formats (GSTIN) — handled by business rules
        # 3. Required fields check — for known document types
        # Map of canonical type IDs and their aliases to required field patterns
        _REQUIRED_FIELDS_V2: dict[tuple[str, ...], list[str]] = {
            ("invoice", "gst_invoice"): ["invoice_no", "date", "vendor", "total"],
            ("delivery_note", "challan"): ["challan_no", "date", "customer", "item"],
            ("weighbridge_slip", "weighbridge"): ["vehicle_no", "gross", "tare", "net"],
            ("purchase_order", "po"): ["po_no", "date", "vendor", "item"],
            ("goods_receipt_note", "grn", "material_receipt"): ["grn_no", "date", "supplier", "item"],
            ("stock_sheet", "stock"): ["date", "opening", "closing"],
            ("ledger_sheet", "ledger", "logbook"): ["date", "particulars", "debit", "credit"],
            ("production_report",): ["date", "shift", "product", "qty"],
            ("packing_list",): ["date", "customer", "item"],
            ("vendor_quotation", "quotation"): ["date", "vendor", "item"],
            ("dispatch_note",): ["date", "customer", "item"],
            ("credit_note",): ["credit_note_no", "date", "customer"],
        }

        # Find matching required fields by checking doc_type against all alias tuples
        required: list[str] = []
        doc_lower = doc_type.lower().strip()
        for aliases, fields in _REQUIRED_FIELDS_V2.items():
            if doc_lower in aliases or any(alias in doc_lower for alias in aliases):
                required = fields
                break
        for req_field in required:
            # Normalize: match both 'invoice_no' and 'invoice no' variations
            req_normalized = req_field.replace("_", " ").replace("-", " ")
            if not any(
                req_field in h or req_normalized in h
                or h.replace(" ", "_").replace("-", "_") == req_field
                for h in lowered
            ):
                issues.append(ValidationIssue(
                    field=f"schema.{req_field}",
                    message=f"Required column '{req_field}' not found in extracted headers",
                    severity="warning",
                ))

        passed = len([i for i in issues if i.severity == "error"]) == 0
        return ValidationStageResult(stage_name="schema", passed=passed, issues=issues)

    # ── Stage 3: Business Rule ───────────────────────────────────────────────

    def _run_business_rules(
        self,
        doc_type: str,
        data: dict[str, Any] | None,
        headers: list[str],
        rows: list[list[str]],
    ) -> ValidationStageResult:
        """Run per-document-type business rules."""
        issues = run_all_rules(doc_type, data=data, headers=headers, rows=rows)
        passed = len([i for i in issues if i.severity == "error"]) == 0
        return ValidationStageResult(stage_name="business_rule", passed=passed, issues=issues)

    # ── Stage 4: Cross-validation ────────────────────────────────────────────

    def _run_cross_validation(
        self,
        cross_validation: dict[str, Any] | None,
    ) -> ValidationStageResult:
        """Evaluate cross-validation results."""
        issues: list[ValidationIssue] = []

        if cross_validation is None:
            stage = ValidationStageResult(
                stage_name="cross_validation",
                passed=True,
                issues=[],
            )
            stage.issues.append(ValidationIssue(
                field="cross_validation",
                message="Cross-validation did not run. Factual confidence reflects structural score only.",
                severity="info",
            ))
            return stage

        status = str(cross_validation.get("status") or "unvalidated")
        discrepancies = int(cross_validation.get("discrepancies", 0) or 0)
        explanation = str(cross_validation.get("explanation") or "")

        if status == "blocked":
            issues.append(ValidationIssue(
                field="cross_validation",
                message=explanation or "Critical discrepancy detected. Manual review required.",
                severity="error",
            ))
        elif status == "needs_review":
            issues.append(ValidationIssue(
                field="cross_validation",
                message=explanation or f"Discrepancy detected ({discrepancies} field(s)). Review recommended.",
                severity="warning",
            ))
        elif status == "verified":
            issues.append(ValidationIssue(
                field="cross_validation",
                message="All numeric values match Tesseract baseline.",
                severity="info",
            ))
        else:
            issues.append(ValidationIssue(
                field="cross_validation",
                message=explanation or "Cross-validation not available.",
                severity="info",
            ))

        passed = len([i for i in issues if i.severity == "error"]) == 0
        return ValidationStageResult(stage_name="cross_validation", passed=passed, issues=issues)

    # ── Stage 5: Consistency ─────────────────────────────────────────────────

    def _run_consistency(
        self,
        doc_type: str,
        headers: list[str],
        rows: list[list[str]],
    ) -> ValidationStageResult:
        """Run cross-field consistency checks."""
        issues: list[ValidationIssue] = []

        issues.extend(validate_date_logic(doc_type, headers, rows))
        issues.extend(validate_totals_match_sum(headers, rows))
        issues.extend(validate_tax_percentage_consistency(headers, rows))
        issues.extend(validate_vehicle_number_format(headers, rows))

        passed = len([i for i in issues if i.severity == "error"]) == 0
        return ValidationStageResult(stage_name="consistency", passed=passed, issues=issues)
