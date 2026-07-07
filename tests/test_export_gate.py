"""Tests for Export Gate (Phase 6.4)."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from backend.services.export_gate import (
    Check,
    ExportGateResult,
    validate_export_readiness,
)


class TestCheck:
    def test_basic(self):
        c = Check(name="test", passed=True)
        assert c.passed is True
        assert bool(c) is True

    def test_failed(self):
        c = Check(name="test", passed=False, message="nope")
        assert c.passed is False
        assert bool(c) is False
        assert c.message == "nope"


class TestExportGateResult:
    def test_all_pass(self):
        result = ExportGateResult(
            passed=True,
            checks=[Check("a", True), Check("b", True)],
            blocking_issues=[],
        )
        assert result.all_checks_pass is True

    def test_some_fail(self):
        result = ExportGateResult(
            passed=False,
            checks=[Check("a", True), Check("b", False)],
            blocking_issues=[Check("b", False)],
        )
        assert result.all_checks_pass is False
        assert len(result.blocking_issues) == 1


class TestValidateExportReadiness:
    """Tests the 4 checks from section 6.4:
    1. Status must be "approved"
    2. No blocking cross-validation issues
    3. Reviewer notes present
    4. Confidence above block threshold
    """

    def _make_verification(self, **overrides):
        """Helper to create a mock OcrVerification-like object."""
        defaults = {
            "status": "approved",
            "cross_validation": None,
            "reviewer_notes": "Approved after verification",
            "avg_confidence": 0.85,
            "doc_type_hint": "gst_invoice",
        }
        defaults.update(overrides)
        return MagicMock(**defaults)

    def test_all_checks_pass(self):
        """Approved, no blocking issues, has notes, confidence above threshold."""
        ver = self._make_verification()
        result = validate_export_readiness(ver)
        assert result.passed is True
        assert all(c.passed for c in result.checks)

    def test_draft_status_fails(self):
        """Non-approved status should fail the gate."""
        ver = self._make_verification(status="draft")
        result = validate_export_readiness(ver)
        assert result.passed is False
        status_check = [c for c in result.checks if c.name == "status"][0]
        assert status_check.passed is False

    def test_pending_status_fails(self):
        ver = self._make_verification(status="pending")
        result = validate_export_readiness(ver)
        assert result.passed is False
        status_check = [c for c in result.checks if c.name == "status"][0]
        assert status_check.passed is False

    def test_rejected_status_fails(self):
        ver = self._make_verification(status="rejected")
        result = validate_export_readiness(ver)
        assert result.passed is False

    def test_blocking_cross_validation_fails(self):
        """Blocking cross-validation issues should fail."""
        ver = self._make_verification(
            cross_validation={"has_blocking_issues": True, "errors": ["Math mismatch"]}
        )
        result = validate_export_readiness(ver)
        assert result.passed is False
        val_check = [c for c in result.checks if c.name == "validation"][0]
        assert val_check.passed is False

    def test_no_blocking_cross_validation_ok(self):
        """No blocking cross-validation issues should pass."""
        ver = self._make_verification(
            cross_validation={"has_blocking_issues": False}
        )
        result = validate_export_readiness(ver)
        val_check = [c for c in result.checks if c.name == "validation"][0]
        assert val_check.passed is True

    def test_empty_cross_validation_ok(self):
        """No cross_validation at all should pass (null/none)."""
        ver = self._make_verification(cross_validation=None)
        result = validate_export_readiness(ver)
        val_check = [c for c in result.checks if c.name == "validation"][0]
        assert val_check.passed is True

    def test_missing_reviewer_notes_fails(self):
        """Empty reviewer_notes should fail."""
        ver = self._make_verification(reviewer_notes="")
        result = validate_export_readiness(ver)
        notes_check = [c for c in result.checks if c.name == "reviewer_notes"][0]
        assert notes_check.passed is False

    @patch("backend.services.export_gate.get_document_type")
    def test_confidence_below_threshold_fails(self, mock_get_dt):
        """Confidence below block threshold should fail."""
        mock_doc_type = MagicMock()
        mock_doc_type.block_below_confidence = 0.50
        mock_doc_type.display_name = "GST Invoice"
        mock_get_dt.return_value = mock_doc_type

        ver = self._make_verification(avg_confidence=0.30)
        result = validate_export_readiness(ver)
        conf_check = [c for c in result.checks if c.name == "confidence"][0]
        assert conf_check.passed is False

    @patch("backend.services.export_gate.get_document_type")
    def test_confidence_at_threshold_passes(self, mock_get_dt):
        """Confidence exactly at threshold should pass."""
        mock_doc_type = MagicMock()
        mock_doc_type.block_below_confidence = 0.50
        mock_get_dt.return_value = mock_doc_type

        ver = self._make_verification(avg_confidence=0.50)
        result = validate_export_readiness(ver)
        conf_check = [c for c in result.checks if c.name == "confidence"][0]
        assert conf_check.passed is True

    @patch("backend.services.export_gate.get_document_type")
    def test_confidence_above_threshold_passes(self, mock_get_dt):
        """High confidence should pass."""
        mock_doc_type = MagicMock()
        mock_doc_type.block_below_confidence = 0.40
        mock_get_dt.return_value = mock_doc_type

        ver = self._make_verification(avg_confidence=0.95)
        result = validate_export_readiness(ver)
        conf_check = [c for c in result.checks if c.name == "confidence"][0]
        assert conf_check.passed is True
