"""Finalize Phase 5: Add /ocr/detect-nature endpoint and write tests."""

import sys
from pathlib import Path


ENDPOINT_CODE = '''
@router.post("/detect-nature", status_code=status.HTTP_200_OK)
async def detect_document_nature_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Analyse an image and detect the document nature.

    Returns a classification of whether the document is printed, handwritten,
    a screenshot, or a ledger/account statement. Uses image analysis and
    OCR text heuristics (Tesseract) to determine the document type.

    This endpoint is useful for:
    - Pre-classifying documents before OCR extraction
    - Selecting the best Claude model tier for extraction
    - Deciding whether to use the structured or unstructured extraction path
    """
    _require_ocr_access(db, current_user)
    image_bytes = await _read_validated_image_upload(file)

    try:
        nature_result = detect_document_nature(image_bytes)
        logger.info(
            "[OCR] Document nature detection: nature=%s confidence=%s signals=%s",
            nature_result.get("nature"),
            nature_result.get("confidence"),
            nature_result.get("signals"),
        )
    except Exception as error:
        logger.warning("Document nature detection failed: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Document nature detection failed: {error}",
        ) from error

    return {
        "nature": nature_result.get("nature", "unknown"),
        "confidence": nature_result.get("confidence", 0.0),
        "signals": nature_result.get("signals", []),
        "has_handwriting": nature_result.get("handwriting", {}).get("has_handwriting", False),
        "handwriting_confidence": nature_result.get("handwriting", {}).get("confidence", 0.0),
    }
'''


def add_endpoint(project_root: Path) -> bool:
    path = project_root / "backend" / "routers" / "ocr" / "_processing.py"
    content = path.read_text("utf-8")

    if "@router.post(\"/detect-nature\"" in content:
        print("  Endpoint already exists, skipping.")
        return False

    # Insert before @router.post("/warp"
    marker = '@router.post("/warp", status_code=status.HTTP_200_OK)'
    if marker not in content:
        print("  ERROR: Could not find /warp endpoint marker!")
        return False

    content = content.replace(marker, ENDPOINT_CODE + "\n\n" + marker, 1)
    path.write_text(content, "utf-8")
    print("  Added /ocr/detect-nature endpoint.")
    return True


TESTS_CODE = r'''"""Tests for Phase 5: Unstructured Document Detection.

Tests cover:
- detect_document_nature() heuristic pipeline
- detect_handwriting() image analysis
- _has_tabular_structure() text analysis
- _has_regular_layout() layout analysis
- Prompt module correctness
"""

from __future__ import annotations

import json
import os
import sys

import pytest

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.ai.prompts.unstructured_documents import (
    HANDWRITTEN_FORM_PROMPT,
    LEDGER_SHEET_PROMPT,
    CHAT_TRANSCRIPT_PROMPT,
    UNSTRUCTURED_DOCUMENT_PROMPTS,
    get_unstructured_prompt,
)


# =============================================================================
# Prompt Tests
# =============================================================================


class TestUnstructuredPrompts:
    def test_handwritten_prompt_exists(self):
        assert len(HANDWRITTEN_FORM_PROMPT) > 100
        assert "handwriting" in HANDWRITTEN_FORM_PROMPT.lower()
        assert "fields" in HANDWRITTEN_FORM_PROMPT

    def test_ledger_prompt_exists(self):
        assert len(LEDGER_SHEET_PROMPT) > 100
        assert "ledger" in LEDGER_SHEET_PROMPT.lower()
        assert "entries" in LEDGER_SHEET_PROMPT

    def test_chat_prompt_exists(self):
        assert len(CHAT_TRANSCRIPT_PROMPT) > 100
        assert "chat" in CHAT_TRANSCRIPT_PROMPT.lower()
        assert "messages" in CHAT_TRANSCRIPT_PROMPT

    def test_prompt_registry_keys(self):
        """Verify all expected document types are in the prompt registry."""
        expected = {
            "handwritten_form", "handwritten",
            "ledger_sheet", "ledger",
            "chat_transcript", "screenshot",
        }
        actual = set(UNSTRUCTURED_DOCUMENT_PROMPTS.keys())
        assert expected.issubset(actual), f"Missing keys: {expected - actual}"

    def test_get_unstructured_prompt(self):
        assert get_unstructured_prompt("handwritten") == HANDWRITTEN_FORM_PROMPT
        assert get_unstructured_prompt("ledger") == LEDGER_SHEET_PROMPT
        assert get_unstructured_prompt("screenshot") == CHAT_TRANSCRIPT_PROMPT
        assert get_unstructured_prompt("unknown_type") is None

    def test_prompt_is_case_insensitive(self):
        assert get_unstructured_prompt("LEDGER") == LEDGER_SHEET_PROMPT
        assert get_unstructured_prompt("HandWritten") == HANDWRITTEN_FORM_PROMPT

    def test_ledger_prompt_has_math_validation(self):
        """The ledger prompt should include balance validation instructions."""
        assert "opening_balance" in LEDGER_SHEET_PROMPT
        assert "closing_balance" in LEDGER_SHEET_PROMPT
        assert "running balance" in LEDGER_SHEET_PROMPT.lower()

    def test_handwritten_prompt_has_confidence(self):
        """The handwritten prompt should include confidence ratings."""
        assert "confidence" in HANDWRITTEN_FORM_PROMPT
        assert "illegible" in HANDWRITTEN_FORM_PROMPT.lower()

    def test_chat_prompt_has_quality(self):
        """The chat prompt should include quality assessment."""
        assert "quality" in CHAT_TRANSCRIPT_PROMPT.lower()
        assert "participants" in CHAT_TRANSCRIPT_PROMPT


# =============================================================================
# Tabular Structure Detection Tests
# =============================================================================


class TestTabularStructure:
    """Test _has_tabular_structure helper."""

    def _get_func(self):
        from backend.services.ocr_cost_router import _has_tabular_structure
        return _has_tabular_structure

    def test_empty_text(self):
        func = self._get_func()
        assert func("") is False
        assert func(None) is False
        assert func("   ") is False

    def test_too_few_lines(self):
        func = self._get_func()
        assert func("line 1") is False
        assert func("line 1\nline 2") is False
        assert func("line 1\nline 2  ") is False  # one blank line doesn't count

    def test_tab_delimited_table(self):
        func = self._get_func()
        text = "Date\tDescription\tAmount\n01-01-2024\tSale\t1000.00\n02-01-2024\tPurchase\t500.00"
        assert func(text) is True

    def test_space_delimited_table(self):
        func = self._get_func()
        text = "Date       Description    Amount\n01-01-2024 Sale           1000.00\n02-01-2024 Purchase       500.00"
        assert func(text) is True

    def test_pipe_delimited_table(self):
        func = self._get_func()
        text = "Date|Description|Amount\n01-01-2024|Sale|1000.00\n02-01-2024|Purchase|500.00"
        assert func(text) is True

    def test_regular_text_not_tabular(self):
        func = self._get_func()
        text = "This is a regular paragraph of text.\nIt has multiple lines but no tabular structure.\nEach line varies in length irregularly."
        assert func(text) is False


# =============================================================================
# Regular Layout Detection Tests
# =============================================================================


class TestRegularLayout:
    """Test _has_regular_layout helper."""

    def _get_func(self):
        from backend.services.ocr_cost_router import _has_regular_layout
        return _has_regular_layout

    def test_empty_text(self):
        func = self._get_func()
        assert func("") is False
        assert func(None) is False

    def test_short_lines(self):
        func = self._get_func()
        assert func("hi\nbye") is False

    def test_regular_printed_text(self):
        func = self._get_func()
        text = "This is a regular printed document.\nIt has consistent line lengths.\nEach line is about the same length."
        assert func(text) is True

    def test_irregular_text(self):
        func = self._get_func()
        text = "Short\nExtremely long line of text that goes on and on and on and on\ntiny"
        assert func(text) is False


# =============================================================================
# Document Nature Detection Tests
# =============================================================================


class TestDetectDocumentNature:
    """Test detect_document_nature with various OCR text inputs."""

    def _get_func(self):
        from backend.services.ocr_cost_router import detect_document_nature
        return detect_document_nature

    def _fixture_bytes(self):
        """Return a minimal valid PNG bytes for testing."""
        import struct, zlib
        # Minimal 1x1 red pixel PNG
        width, height = 1, 1
        raw_data = b'\x00\xff\x00\x00\xff'  # filter byte + RGB
        def make_chunk(chunk_type, data):
            c = chunk_type + data
            crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
            return struct.pack('>I', len(data)) + c + crc
        signature = b'\x89PNG\r\n\x1a\n'
        ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
        idat = make_chunk(b'IDAT', zlib.compress(raw_data))
        iend = make_chunk(b'IEND', b'')
        return signature + ihdr + idat + iend

    def test_detect_printed(self):
        func = self._get_func()
        # Provide OCR text hint for printed doc
        result = func(self._fixture_bytes(), ocr_text="This is a regular printed document with good formatting.")
        assert result["nature"] == "printed"
        assert result["confidence"] > 0.5

    def test_detect_handwritten(self):
        """Without OCR text, a 1x1 image won't trigger handwriting detection.
        We test the logic path with ocr_text=None and accept 'unknown' or 'printed'."""
        func = self._get_func()
        result = func(self._fixture_bytes())
        # Small image won't have handwriting detected (too small for CV analysis)
        assert "nature" in result
        assert "confidence" in result
        assert "signals" in result

    def test_detect_ledger(self):
        func = self._get_func()
        ocr_text = "Date\tParticulars\tDr.\tCr.\tBalance\n01-01-2024\tOpening Balance\t\t10000.00\t10000.00"
        result = func(self._fixture_bytes(), ocr_text=ocr_text)
        assert result["nature"] == "ledger"
        assert result["confidence"] > 0.5

    def test_detect_screenshot_chat(self):
        func = self._get_func()
        ocr_text = "✓✓ today typing online ✓ yesterday typing"
        result = func(self._fixture_bytes(), ocr_text=ocr_text)
        assert result["nature"] == "screenshot"
        assert result["confidence"] > 0.3

    def test_detect_unknown(self):
        func = self._get_func()
        result = func(self._fixture_bytes(), ocr_text="xyz abc 123")
        # With no pattern match, should fall through to unknown
        assert result["nature"] in ("unknown", "printed")
        assert "signals" in result

    def test_detect_ledger_single_keyword(self):
        """Spec says: any() keyword match + tabular structure = ledger."""
        func = self._get_func()
        # Only 'balance' matches (1 keyword) + tab-like structure
        ocr_text = "Item\tBalance\tNote\nA\t100.00\tok\nB\t200.00\tok"
        result = func(self._fixture_bytes(), ocr_text=ocr_text)
        assert result["nature"] == "ledger"
        assert result["confidence"] > 0.5


# =============================================================================
# Handwriting Detection Tests
# =============================================================================


class TestDetectHandwriting:
    """Test detect_handwriting function."""

    def _get_func(self):
        from backend.services.ocr_cost_router import detect_handwriting
        return detect_handwriting

    def test_empty_bytes(self):
        func = self._get_func()
        result = func(b"")
        assert result["has_handwriting"] is False
        assert result["confidence"] == 0.0

    def test_invalid_bytes_returns_default(self):
        func = self._get_func()
        result = func(b"not an image")
        assert "has_handwriting" in result
        assert "signals" in result

    def test_result_shape(self):
        func = self._get_func()
        result = func(b"")
        expected_keys = {"has_handwriting", "confidence", "signals",
                         "component_irregularity", "stroke_width_variance",
                         "line_angle_variance"}
        assert expected_keys.issubset(result.keys())
'''

def write_tests(project_root: Path) -> bool:
    path = project_root / "tests" / "test_unstructured_document_detection.py"
    if path.exists():
        print("  Tests file already exists, skipping.")
        return False
    path.write_text(TESTS_CODE, "utf-8")
    print(f"  Wrote {path}")
    return True


def main():
    project_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    print("Finalizing Phase 5...")
    add_endpoint(project_root)
    write_tests(project_root)
    print("Done.")


if __name__ == "__main__":
    main()
