from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest
from backend import ledger_scan

@pytest.fixture
def mock_claude():
    with patch("backend.ledger_scan._call_claude") as m:
        yield m

def test_validate_data_major_error_math_mismatch():
    rows = [
        {"particular": "Entry 1", "dr": 100, "cr": None},
        {"particular": "Total", "dr": 150, "cr": None} # Mismatch: 100 != 150
    ]
    result = ledger_scan.validate_data(rows)
    assert result["metadata"]["major_error"] is True
    assert result["metadata"]["minor_error"] is False
    assert any("match sum of rows" in w for w in result["metadata"]["validation_warnings"])

def test_validate_data_minor_error_duplicate():
    rows = [
        {"particular": "Entry 1", "dr": 100, "cr": None},
        {"particular": "Entry 1", "dr": 100, "cr": None}, # Duplicate
        {"particular": "Total", "dr": 200, "cr": None}
    ]
    result = ledger_scan.validate_data(rows)
    assert result["metadata"]["major_error"] is False
    assert result["metadata"]["minor_error"] is True
    assert any("duplicate" in w for w in result["metadata"]["validation_warnings"])

def test_validate_data_minor_error_non_numeric():
    rows = [
        {"particular": "Entry 1", "dr": "100.00", "cr": None}, # OK, normalized
        {"particular": "Entry 2", "dr": "abc", "cr": None},    # Minor
        {"particular": "Total", "dr": 100, "cr": None}
    ]
    result = ledger_scan.validate_data(rows)
    assert result["metadata"]["minor_error"] is True
    assert any("Non-numeric value" in w for w in result["metadata"]["validation_warnings"])

def test_run_provider_enforces_max_retry_and_no_image_resend(mock_claude):
    # Turn 1: Return malformed JSON (major error - rows is None)
    # Turn 2: Return valid JSON with one row
    valid_json = '[{"particular": "Entry 1", "dr": 100, "cr": null}]'
    mock_claude.side_effect = [
        {"text": "malformed", "history": [], "model_used": "haiku", "attempt": 1, "fallback_used": False},
        {"text": valid_json, "history": [], "model_used": ledger_scan.MODEL_OPUS, "attempt": 2, "fallback_used": True}
    ]
    
    with patch("backend.ledger_scan.MAX_RETRY", 1):
        with patch("backend.ledger_scan.validate_data") as mock_val:
            mock_val.return_value = {
                "rows": [{"particular": "Entry 1", "dr": 100, "cr": None}], 
                "metadata": {"major_error": False, "minor_error": False}
            }
            
            # We need to bypass other providers and just test anthropic logic
            with patch("backend.ledger_scan._ledger_scan_provider", return_value="anthropic"):
                with patch("backend.ledger_scan._has_provider_key", return_value=True):
                    # We need to patch _ledger_scan_provider_chain to return only anthropic
                    with patch("backend.ledger_scan._ledger_scan_provider_chain", return_value=["anthropic"]):
                        rows, meta = ledger_scan.extract_data_from_image("fake_base64")
    
    assert mock_claude.call_count == 2
    # Check second call (retry)
    args, kwargs = mock_claude.call_args_list[1]
    assert args[0] is not None  # image IS resent for major recovery in this version
    assert kwargs["model_override"] == ledger_scan.MODEL_OPUS # Major error -> Opus
    assert "Fix this JSON" in kwargs["user_message"]
    assert len(rows) == 1
    assert meta["fallback_used"] is True
    assert meta["attempt"] == 2

def test_run_provider_minor_error_uses_sonnet(mock_claude):
    # NOTE: In the refactored version, minor errors do NOT trigger retry by default
    # only JSON failure or major_error (validation) does.
    # So we mock a major validation error to test Opus retry.
    valid_json = json.dumps([{"particular": "Entry 1", "dr": 100, "cr": None}])
    mock_claude.side_effect = [
        {"text": valid_json, "history": [], "model_used": "haiku", "attempt": 1, "fallback_used": False},
        {"text": valid_json, "history": [], "model_used": ledger_scan.MODEL_OPUS, "attempt": 2, "fallback_used": True}
    ]
    
    # Mock validation to return major error (e.g. math mismatch)
    with patch("backend.ledger_scan.validate_data") as mock_val:
        mock_val.return_value = {
            "rows": [{"particular": "Entry 1", "dr": 100, "cr": None}],
            "metadata": {"major_error": True, "minor_error": False, "validation_warnings": ["Math mismatch"]}
        }
        
        with patch("backend.ledger_scan._ledger_scan_provider_chain", return_value=["anthropic"]):
            with patch("backend.ledger_scan._has_provider_key", return_value=True):
                 rows, meta = ledger_scan.extract_data_from_image("fake_base64")

    # Check second call (retry)
    assert meta["model_used"] == ledger_scan.MODEL_OPUS
    assert meta["fallback_used"] is True

def test_run_provider_stops_after_max_retry(mock_claude):
    # Turn 1: Return malformed JSON
    # Turn 2: Return malformed JSON again
    mock_claude.side_effect = [
        {"text": "malformed", "history": [], "model_used": "haiku", "attempt": 1, "fallback_used": False},
        {"text": "malformed", "history": [], "model_used": ledger_scan.MODEL_OPUS, "attempt": 2, "fallback_used": True}
    ]
    
    with patch("backend.ledger_scan.MAX_RETRY", 1):
        with patch("backend.ledger_scan._ledger_scan_provider_chain", return_value=["anthropic"]):
            with patch("backend.ledger_scan._has_provider_key", return_value=True):
                with pytest.raises(ValueError) as excinfo:
                    ledger_scan.extract_data_from_image("fake_base64")
                assert "LedgerScan failed" in str(excinfo.value)
                # Check that the underlying cause was the retry limit/failure
                assert "AI response was not valid JSON after retry" in str(excinfo.value.__cause__)
    
    assert mock_claude.call_count == 2 # 1 initial + 1 retry = 2
