"""Comprehensive tests for the Phase 4 OCR validation pipeline.

Tests cover:
1. ValidationIssue, ValidationStageResult, ValidationResult dataclasses
2. OcrValidationPipeline — structural, schema, business rule, consistency stages
3. Per-document-type business rules (invoice, weighbridge, delivery note, PO, stock)
4. Consistency rules (date logic, totals matching, tax percentages, vehicle numbers)
5. End-to-end validation with mixed input
"""

from __future__ import annotations

import pytest

from backend.validators.validation_types import (
    ValidationIssue,
    ValidationStageResult,
    ValidationResult,
)
from backend.validators.ocr_validation_pipeline import OcrValidationPipeline
from backend.services.ocr_business_rules import (
    run_all_rules,
    validate_line_item_math,
    validate_gstin_format,
    validate_weighbridge_weights,
    validate_delivery_quantities,
    validate_po_item_math,
    validate_stock_balance,
    _find_header_index,
    _validate_gstin,
)
from backend.services.ocr_consistency_rules import (
    validate_date_logic,
    validate_totals_match_sum,
    validate_tax_percentage_consistency,
    validate_vehicle_number_format,
)


# =============================================================================
# ValidationIssue tests
# =============================================================================

class TestValidationIssue:
    def test_basic_creation(self):
        issue = ValidationIssue(field="line_items.0.amount", message="Qty x Rate mismatch", severity="error")
        assert issue.field == "line_items.0.amount"
        assert issue.message == "Qty x Rate mismatch"
        assert issue.severity == "error"
        assert issue.suggested_value is None

    def test_with_suggested_value(self):
        issue = ValidationIssue(field="gstin", message="Invalid GSTIN", severity="error", suggested_value="24AABCS1234K1Z5")
        assert issue.suggested_value == "24AABCS1234K1Z5"

    def test_to_dict(self):
        issue = ValidationIssue(field="test", message="Test issue", severity="warning")
        d = issue.to_dict()
        assert d == {"field": "test", "message": "Test issue", "severity": "warning"}

    def test_to_dict_with_suggested(self):
        issue = ValidationIssue(field="test", message="Test", severity="info", suggested_value="fix")
        d = issue.to_dict()
        assert d["suggested_value"] == "fix"

    def test_warning_severity(self):
        issue = ValidationIssue(field="f", message="m", severity="warning")
        assert issue.severity == "warning"

    def test_info_severity(self):
        issue = ValidationIssue(field="f", message="m", severity="info")
        assert issue.severity == "info"


# =============================================================================
# ValidationStageResult tests
# =============================================================================

class TestValidationStageResult:
    def test_empty_stage_passes(self):
        stage = ValidationStageResult(stage_name="structural", passed=True)
        assert stage.passed is True
        assert stage.errors == []
        assert stage.warnings == []
        assert stage.infos == []

    def test_error_classification(self):
        stage = ValidationStageResult(
            stage_name="schema",
            passed=False,
            issues=[
                ValidationIssue(field="a", message="Error", severity="error"),
                ValidationIssue(field="b", message="Warning", severity="warning"),
                ValidationIssue(field="c", message="Info", severity="info"),
            ],
        )
        assert len(stage.errors) == 1
        assert len(stage.warnings) == 1
        assert len(stage.infos) == 1

    def test_to_dict(self):
        stage = ValidationStageResult(
            stage_name="test",
            passed=False,
            issues=[ValidationIssue(field="f", message="m", severity="error")],
        )
        d = stage.to_dict()
        assert d["passed"] is False
        assert len(d["issues"]) == 1


# =============================================================================
# ValidationResult tests
# =============================================================================

class TestValidationResult:
    def test_no_issues_passes(self):
        result = ValidationResult(passed=True, summary="All checks passed")
        assert result.passed is True
        assert result.blockers is False
        assert result.can_export_with_warnings is True

    def test_with_errors(self):
        stage = ValidationStageResult(
            stage_name="business_rule",
            passed=False,
            issues=[ValidationIssue(field="f", message="m", severity="error")],
        )
        result = ValidationResult(
            passed=False,
            summary="1 error",
            stages={"business_rule": stage},
            blockers=True,
            can_export_with_warnings=False,
        )
        assert result.error_count == 1
        assert result.blockers is True
        assert result.can_export_with_warnings is False

    def test_all_issues_property(self):
        s1 = ValidationStageResult(
            stage_name="s1",
            passed=True,
            issues=[ValidationIssue(field="f1", message="m1", severity="warning")],
        )
        s2 = ValidationStageResult(
            stage_name="s2",
            passed=True,
            issues=[ValidationIssue(field="f2", message="m2", severity="info")],
        )
        result = ValidationResult(passed=True, summary="ok", stages={"s1": s1, "s2": s2})
        assert len(result.all_issues) == 2

    def test_to_dict_structure(self):
        result = ValidationResult(
            passed=True,
            summary="All good",
            stages={
                "structural": ValidationStageResult(stage_name="structural", passed=True),
            },
        )
        d = result.to_dict()
        assert d["passed"] is True
        assert "stages" in d
        assert "structural" in d["stages"]


# =============================================================================
# OcrValidationPipeline — Stage 1: Structural tests
# =============================================================================

class TestStructuralValidation:
    """Stage 1: Row/column consistency, empty cell ratio, header quality."""

    def test_perfect_table_passes(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["Item", "Qty", "Rate"],
            rows=[["Widget", "10", "50"], ["Gadget", "5", "30"]],
        )
        assert result.passed is True
        assert len(result.issues) == 0

    def test_empty_headers_fails(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["", "", ""],
            rows=[["a", "b", "c"]],
        )
        # All headers empty -> error
        assert any(i.severity == "error" for i in result.issues)

    def test_partial_empty_headers_warns(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["Item", "", "Rate"],
            rows=[["Widget", "10", "50"]],
        )
        assert any(i.severity == "warning" for i in result.issues)

    def test_empty_cell_ratio_warns(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["A", "B"],
            rows=[["", ""], ["", "val"]],
        )
        assert any("empty" in i.message.lower() for i in result.issues)

    def test_duplicate_headers(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["Item", "Item", "Rate"],
            rows=[["A", "B", "1"]],
        )
        assert any("duplicate" in i.message.lower() for i in result.issues)

    def test_row_column_mismatch(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(
            headers=["A", "B", "C"],
            rows=[["1", "2"], ["3", "4", "5", "6"]],
        )
        assert any("Row" in i.message for i in result.issues)

    def test_no_rows_headers_only(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(headers=["A", "B"], rows=[])
        assert result.passed is True  # No rows means no row-level issues

    def test_no_headers_no_rows(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_structural(headers=[], rows=[])
        assert result.passed is True  # Nothing to validate


# =============================================================================
# OcrValidationPipeline — Stage 2: Schema tests
# =============================================================================

class TestSchemaValidation:
    """Stage 2: Required fields, type checking, pattern validation."""

    def test_numeric_type_check_passes(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Item", "Qty", "Rate"],
            rows=[["Widget", "10", "50.5"]],
            doc_type="generic",
            data=None,
        )
        assert result.passed is True

    def test_numeric_type_check_fails(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Item", "Qty"],
            rows=[["Widget", "not_a_number"]],
            doc_type="generic",
            data=None,
        )
        assert any("not a valid number" in i.message for i in result.issues)

    def test_required_fields_invoice(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Item", "Qty"],  # Missing invoice_no, date, vendor, total
            rows=[["Widget", "10"]],
            doc_type="invoice",
            data=None,
        )
        assert any("required" in i.message.lower() for i in result.issues)

    def test_required_fields_weighbridge(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Vehicle No", "Gross"],  # Missing tare, net
            rows=[["MH-12-AB-1234", "5000"]],
            doc_type="weighbridge_slip",
            data=None,
        )
        assert any("required" in i.message.lower() for i in result.issues)

    def test_all_required_fields_present(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Invoice No", "Date", "Vendor", "Total", "Item", "Qty"],
            rows=[["INV-001", "2024-01-15", "ABC Corp", "500", "Widget", "10"]],
            doc_type="invoice",
            data=None,
        )
        required_warnings = [i for i in result.issues if "required" in i.message.lower()]
        assert len(required_warnings) == 0

    def test_non_numeric_indian_notation_allowed(self):
        pipeline = OcrValidationPipeline()
        result = pipeline._run_schema(
            headers=["Amount"],
            rows=[["1,50,000"]],
            doc_type="generic",
            data=None,
        )
        # Indian notation with commas should parse as valid number
        assert len([i for i in result.issues if "not a valid number" in i.message]) == 0


# =============================================================================
# OcrValidationPipeline — Stage 3: Business Rules
# =============================================================================

class TestBusinessRuleInvoice:
    """Invoice: line_item_math and gstin_format rules."""

    def test_line_item_math_correct(self):
        issues = validate_line_item_math(
            data={},
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "500"], ["Gadget", "5", "30", "150"]],
        )
        assert len(issues) == 0

    def test_line_item_math_mismatch(self):
        issues = validate_line_item_math(
            data={},
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "300"]],
        )
        assert len(issues) >= 1
        assert "500" in issues[0].message  # Expected 10 * 50 = 500
        assert "300" in issues[0].message  # Declared as 300

    def test_line_item_math_invalid_values(self):
        issues = validate_line_item_math(
            data={},
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "abc", "50", "500"]],
        )
        assert len(issues) >= 1
        assert any("Invalid numeric" in i.message for i in issues)

    def test_gstin_valid(self):
        assert _validate_gstin("24AABCS1234K1Z5") is True

    def test_gstin_too_short(self):
        assert _validate_gstin("24ABCDE1234") is False

    def test_gstin_invalid_format(self):
        assert _validate_gstin("24AABCS1234K1ZZ") is False

    def test_gstin_format_validation(self):
        issues = validate_gstin_format(
            data={},
            headers=["Item", "GSTIN", "Rate"],
            rows=[["Widget", "12345", "50"]],
        )
        assert len(issues) >= 1
        assert any("GSTIN" in i.message for i in issues)


class TestBusinessRuleWeighbridge:
    """Weighbridge: gross > tare, net = gross - tare."""

    def test_weights_correct(self):
        issues = validate_weighbridge_weights(
            data={},
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-01-AB-1234", "5000", "2000", "3000"]],
        )
        assert len(issues) == 0

    def test_gross_less_than_tare(self):
        issues = validate_weighbridge_weights(
            data={},
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-01-AB-1234", "1000", "2000", "1000"]],
        )
        assert any("gross" in i.message.lower() and "tare" in i.message.lower() for i in issues)

    def test_net_mismatch(self):
        issues = validate_weighbridge_weights(
            data={},
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-01-AB-1234", "5000", "2000", "3500"]],
        )
        assert any("should be" in i.message.lower() for i in issues)


class TestBusinessRuleDeliveryNote:
    """Delivery note: delivered <= ordered."""

    def test_delivery_within_limit(self):
        issues = validate_delivery_quantities(
            data={},
            headers=["Item", "Ordered", "Delivered"],
            rows=[["Widget", "100", "50"]],
        )
        assert len(issues) == 0

    def test_delivery_exceeds_ordered(self):
        issues = validate_delivery_quantities(
            data={},
            headers=["Item", "Ordered", "Delivered"],
            rows=[["Widget", "50", "75"]],
        )
        assert len(issues) >= 1
        assert "exceeds" in issues[0].message


class TestBusinessRulePurchaseOrder:
    """Purchase order: qty x rate = amount."""

    def test_po_math_correct(self):
        issues = validate_po_item_math(
            data={},
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "500"]],
        )
        assert len(issues) == 0

    def test_po_math_mismatch(self):
        issues = validate_po_item_math(
            data={},
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "400"]],
        )
        assert len(issues) >= 1
        assert "500" in issues[0].message


class TestBusinessRuleStock:
    """Stock sheet: opening + receipts - issues = closing."""

    def test_stock_balance_correct(self):
        issues = validate_stock_balance(
            data={},
            headers=["Date", "Opening", "Receipts", "Issues", "Closing"],
            rows=[["01-Jan", "100", "50", "30", "120"]],
        )
        assert len(issues) == 0

    def test_stock_balance_mismatch(self):
        issues = validate_stock_balance(
            data={},
            headers=["Date", "Opening", "Receipts", "Issues", "Closing"],
            rows=[["01-Jan", "100", "50", "30", "100"]],
        )
        assert len(issues) >= 1


class TestRunAllRules:
    """Test run_all_rules dispatcher."""

    def test_unknown_type_returns_empty(self):
        issues = run_all_rules("unknown_type")
        assert issues == []

    def test_invoice_rules_run(self):
        issues = run_all_rules(
            "invoice",
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "500"]],
        )
        assert isinstance(issues, list)

    def test_weighbridge_rules_run(self):
        issues = run_all_rules(
            "weighbridge_slip",
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-01", "5000", "2000", "3000"]],
        )
        assert isinstance(issues, list)


# =============================================================================
# Consistency Rules
# =============================================================================

class TestDateLogic:
    def test_delivery_after_po_date(self):
        issues = validate_date_logic(
            doc_type="delivery_note",
            headers=["Item", "PO Date", "Delivery Date"],
            rows=[["Widget", "2024-01-01", "2024-01-15"]],
        )
        assert len(issues) == 0

    def test_delivery_before_po_date(self):
        issues = validate_date_logic(
            doc_type="delivery_note",
            headers=["Item", "PO Date", "Delivery Date"],
            rows=[["Widget", "2024-01-15", "2024-01-01"]],
        )
        assert len(issues) >= 1
        assert any("before" in i.message.lower() for i in issues)

    def test_placeholder_date_detected(self):
        issues = validate_date_logic(
            doc_type="invoice",
            headers=["Item", "Date"],
            rows=[["Widget", "01/01/1900"]],
        )
        assert any("placeholder" in i.message.lower() for i in issues)

    def test_no_date_columns(self):
        issues = validate_date_logic(
            doc_type="generic",
            headers=["Item", "Qty"],
            rows=[["Widget", "10"]],
        )
        assert len(issues) == 0


class TestTotalsMatchSum:
    def test_totals_match(self):
        issues = validate_totals_match_sum(
            headers=["Item", "Amount"],
            rows=[["Widget", "100"], ["Gadget", "200"], ["Total", "300"]],
        )
        assert len(issues) == 0

    def test_totals_mismatch(self):
        issues = validate_totals_match_sum(
            headers=["Item", "Amount"],
            rows=[["Widget", "100"], ["Gadget", "200"], ["Total", "350"]],
        )
        assert len(issues) >= 1
        assert any("Total" in i.message and "sum" in i.message.lower() for i in issues)

    def test_no_total_row(self):
        issues = validate_totals_match_sum(
            headers=["Item", "Amount"],
            rows=[["Widget", "100"], ["Gadget", "200"]],
        )
        assert len(issues) == 0

    def test_single_row_no_total(self):
        issues = validate_totals_match_sum(
            headers=["Item", "Amount"],
            rows=[["Widget", "100"]],
        )
        assert len(issues) == 0


class TestTaxPercentageConsistency:
    def test_tax_consistency_correct(self):
        issues = validate_tax_percentage_consistency(
            headers=["Item", "CGST", "SGST", "IGST"],
            rows=[["Widget", "9", "9", "18"]],
        )
        assert len(issues) == 0

    def test_tax_mismatch(self):
        issues = validate_tax_percentage_consistency(
            headers=["Item", "CGST", "SGST", "IGST"],
            rows=[["Widget", "9", "9", "15"]],
        )
        assert len(issues) >= 1

    def test_tax_out_of_range(self):
        issues = validate_tax_percentage_consistency(
            headers=["Item", "CGST"],
            rows=[["Widget", "30"]],
        )
        assert any("outside valid range" in i.message.lower() for i in issues)

    def test_no_tax_columns(self):
        issues = validate_tax_percentage_consistency(
            headers=["Item", "Qty"],
            rows=[["Widget", "10"]],
        )
        assert len(issues) == 0


class TestVehicleNumberFormat:
    def test_valid_indian_vehicle(self):
        issues = validate_vehicle_number_format(
            headers=["Vehicle No", "Gross"],
            rows=[["MH-12-AB-1234", "5000"]],
        )
        assert len(issues) == 0  # Valid format

    def test_valid_without_hyphen(self):
        issues = validate_vehicle_number_format(
            headers=["Vehicle No", "Gross"],
            rows=[["GJ 05 CD 5678", "5000"]],
        )
        assert len(issues) == 0  # Valid format

    def test_invalid_vehicle(self):
        issues = validate_vehicle_number_format(
            headers=["Vehicle No", "Gross"],
            rows=[["ABCDEF", "5000"]],
        )
        assert len(issues) >= 1

    def test_no_vehicle_column(self):
        issues = validate_vehicle_number_format(
            headers=["Item", "Qty"],
            rows=[["Widget", "10"]],
        )
        assert len(issues) == 0


# =============================================================================
# Full pipeline integration tests
# =============================================================================

class TestFullValidationPipeline:
    def test_valid_invoice_table(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Invoice No", "Date", "Vendor", "Item", "Qty", "Rate", "Amount"],
            rows=[["INV-001", "2024-01-15", "ABC Corp", "Widget", "10", "50", "500"]],
            doc_type="invoice",
            data={},
        )
        assert result.passed is True
        assert result.error_count == 0
        assert result.blockers is False
        # May have info-level items (cross-validation not run) but no errors

    def test_invalid_invoice_table(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "300"],  # 10*50=500, not 300
                  ["Gadget", "abc", "30", "150"]],  # "abc" not a number
            doc_type="invoice",
            data={},
        )
        assert result.passed is False
        assert result.blockers is True
        assert result.error_count >= 1

    def test_weighbridge_pipeline(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-12-AB-1234", "5000", "2000", "3000"]],
            doc_type="weighbridge_slip",
        )
        assert result.passed is True

    def test_invalid_weighbridge(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Vehicle", "Gross", "Tare", "Net"],
            rows=[["MH-12-AB-1234", "1000", "2000", "500"]],  # gross < tare
            doc_type="weighbridge_slip",
        )
        assert result.passed is False
        assert result.error_count >= 1

    def test_empty_table_does_not_crash(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=[],
            rows=[],
            doc_type="unknown",
        )
        # Should not crash, should return passed result
        assert result.passed is True  # Nothing to validate = no errors

    def test_large_table_performance(self):
        pipeline = OcrValidationPipeline()
        headers = [f"Col {i}" for i in range(10)]
        rows = [[f"val_{r}_{c}" for c in range(10)] for r in range(100)]
        result = pipeline.validate(headers=headers, rows=rows, doc_type="generic")
        # Should complete without error
        assert isinstance(result.passed, bool)

    def test_cross_validation_input_blocked(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Item", "Qty"],
            rows=[["Widget", "10"]],
            doc_type="generic",
            cross_validation={"status": "blocked", "explanation": "Values differ from image", "discrepancies": 3},
        )
        # Should detect blocked cross-validation
        cv_stage = result.stages.get("cross_validation")
        assert cv_stage is not None
        assert not cv_stage.passed
        # The explanation message should be included
        assert any("Values differ from image" in i.message for i in cv_stage.issues)

    def test_cross_validation_needs_review(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Item", "Amount"],
            rows=[["Widget", "100"]],
            doc_type="generic",
            cross_validation={"status": "needs_review", "discrepancies": 2},
        )
        cv_stage = result.stages.get("cross_validation")
        assert cv_stage is not None
        assert cv_stage.passed is True  # needs_review is warning, not error
        assert any("review" in i.message.lower() for i in cv_stage.issues)

    def test_to_dict_matches_spec(self):
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=["Item", "Qty", "Rate", "Amount"],
            rows=[["Widget", "10", "50", "300"]],
            doc_type="invoice",
        )
        d = result.to_dict()
        assert "passed" in d
        assert "summary" in d
        assert "stages" in d
        assert "blockers" in d
        assert "can_export_with_warnings" in d
        assert isinstance(d["stages"], dict)
        # Should have all 5 stages
        for stage in ["structural", "schema", "business_rule", "cross_validation", "consistency"]:
            assert stage in d["stages"], f"Missing stage: {stage}"
            assert "passed" in d["stages"][stage]
            assert "issues" in d["stages"][stage]


# =============================================================================
# Helper function tests
# =============================================================================

class TestHelpers:
    def test_find_header_index_exact_match(self):
        assert _find_header_index(["Item", "Qty", "Rate"], "Qty") == 1

    def test_find_header_index_substring(self):
        assert _find_header_index(["Item", "Quantity", "Rate"], "quan") == 1

    def test_find_header_index_case_insensitive(self):
        assert _find_header_index(["ITEM", "QTY", "RATE"], "qty") == 1

    def test_find_header_index_not_found(self):
        assert _find_header_index(["Item", "Qty"], "Amount") is None

    def test_find_header_index_with_aliases(self):
        assert _find_header_index(["Item", "Quantity", "Rate"], "amt", "amount", "total") is None
        assert _find_header_index(["Item", "Total", "Rate"], "amt", "amount", "total") == 1
