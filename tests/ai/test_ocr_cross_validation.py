import pytest
from unittest.mock import MagicMock, patch
from backend.services.ocr_cross_validator import OcrCrossValidator, CrossValidationResult, Discrepancy
from backend.services.ocr_confidence import calculate_factual_confidence
from backend.ocr_utils import OcrResult

def test_cross_validator_detects_hallucination():
    """
    Test that the validator correctly identifies a significant numeric discrepancy
    between Tesseract and AI as 'blocked'.
    """
    validator = OcrCrossValidator()
    
    # Mock image bytes
    image_bytes = b"fake_image_bytes"
    
    # AI result: [["10000"]]
    ai_rows = [["10000"]]
    
    # We need to mock 'extract_table_from_image' to return Tesseract's "truth"
    # Tesseract truth: [["50000"]] -> This is a 400% difference (400% > 30% threshold)
    with patch("backend.services.ocr_cross_validator.extract_table_from_image") as mock_extract:
        mock_extract.return_value = OcrResult(
            rows=[["50000"]],
            avg_confidence=1.0,
            warnings=[]
        )
        
        result = validator.validate(image_bytes, ai_rows)
        
        assert result.status == "blocked"
        assert len(result.discrepancies) == 1
        assert result.discrepancies[0].tesseract_value == 50000.0
        assert result.discrepancies[0].ai_value == 10000.0
        assert "CRITICAL" in result.explanation

def test_cross_validator_verifies_match():
    """
    Test that the validator correctly identifies matching numbers as 'verified'.
    """
    validator = OcrCrossValidator()
    image_bytes = b"fake_image_bytes"
    ai_rows = [["10000"]]
    
    with patch("backend.services.ocr_cross_validator.extract_table_from_image") as mock_extract:
        mock_extract.return_value = OcrResult(
            rows=[["10000"]],
            avg_confidence=1.0,
            warnings=[]
        )
        
        result = validator.validate(image_bytes, ai_rows)
        
        assert result.status == "verified"
        assert len(result.discrepancies) == 0

def test_cross_validator_needs_review():
    """
    Test that a moderate discrepancy (e.g. 15%) triggers 'needs_review'.
    """
    validator = OcrCrossValidator()
    image_bytes = b"fake_image_bytes"
    ai_rows = [["11500"]] # 15% difference from 10000
    
    with patch("backend.services.ocr_cross_validator.extract_table_from_image") as mock_extract:
        mock_extract.return_value = OcrResult(
            rows=[["10000"]],
            avg_confidence=1.0,
            warnings=[]
        )
        
        result = validator.validate(image_bytes, ai_rows)
        
        assert result.status == "needs_review"
        assert len(result.discrepancies) == 1
        assert "WARNING" in result.explanation

def test_factual_confidence_blending():
    """
    Test that factual confidence correctly blends structural confidence
    and penalizes based on CrossValidationResult.
    """
    # Case 1: Perfect match
    res_verified = CrossValidationResult(status="verified", explanation="Match")
    assert calculate_factual_confidence(res_verified, 90.0)["score"] == 90.0
    
    # Case 2: Blocked (Digital corruption)
    res_blocked = CrossValidationResult(status="blocked", explanation="Bad")
    assert calculate_factual_confidence(res_blocked, 90.0)["score"] == 10.0
    
    # Case 3: Needs review (Penalty applied)
    # 15% penalty from 1 discrepancy of 15%
    res_review = CrossValidationResult(
        status="needs_review", 
        explanation="Diff",
        discrepancies=[Discrepancy(0, 0, 100.0, 115.0, 0.15)]
    )
    # 90.0 * (1 - 0.15) = 76.5
    assert calculate_factual_confidence(res_review, 90.0)["score"] == 76.5

    # Case 4: Unvalidated (Cap at 50%)
    res_unvalidated = CrossValidationResult(status="unvalidated", explanation="No Tesseract")
    assert calculate_factual_confidence(res_unvalidated, 90.0)["score"] == 45.0
