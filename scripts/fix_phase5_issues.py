"""Fix Phase 5 implementation issues.

Fixes:
1. Dead code in _detect_ledger_patterns (code after _has_tabular_structure is unreachable)
2. re import needed at module level for _has_tabular_structure
3. Ledger keyword threshold too strict (>=3 → >=1 to match spec's any())
4. Add /ocr/detect-nature endpoint
"""

import re
import sys
from pathlib import Path


def fix_cost_router(project_root: Path) -> bool:
    """Fix ocr_cost_router.py issues."""
    path = project_root / "backend" / "services" / "ocr_cost_router.py"
    content = path.read_text("utf-8")
    modified = False

    # Fix 1: Add `import re` at module level (remove the local import in _detect_screenshot_patterns)
    # After the `import math` line, add `import re`
    if "import math\n" in content and "import re\n" not in content:
        content = content.replace(
            "import math\n",
            "import math\nimport re\n",
        )
        modified = True
        print("  Fixed: Added 'import re' at module level")

    # Fix 2: Remove the local `import re` inside _detect_screenshot_patterns
    old_local_import = "    import re\n"
    if old_local_import in content:
        content = content.replace(old_local_import, "    # re already imported at module level\n")
        modified = True
        print("  Fixed: Removed local 'import re' from _detect_screenshot_patterns")

    # Fix 3: Fix the dead code in _detect_ledger_patterns
    # The function has:
    #   def _detect_ledger_patterns(...):
    #       ... return at end of _has_tabular_structure ...
    #   def _has_tabular_structure(text):
    #       ... code ...
    #       return (structured_lines / len(lines)) > 0.4
    #   
    #   signals = []    <-- this is dead code (part of another _detect_ledger_patterns???)
    #   preview_lower = text_preview.lower()
    #   ...
    #   return {"is_ledger": False, "confidence": 0.0, "signals": signals}
    #
    # The dead code is a completely different version of _detect_ledger_patterns
    # that appears after _has_tabular_structure. Let me find and remove it.

    # Find the dead code block — the second return from _has_tabular_structure
    # which ends with: `return (structured_lines / len(lines)) > 0.4`
    # Then there's `\n    signals = []` which is dead code.

    # The structure should be:
    # def _detect_ledger_patterns(text_preview):
    #     if not text_preview:
    #         return {"is_ledger": False, ...}
    #     signals = []
    #     ...
    #     return {"is_ledger": False, "confidence": 0.0, "signals": signals}
    #
    # def _has_tabular_structure(text):
    #     ...

    # But instead, _detect_ledger_patterns returns early and there's dead code
    # after _has_tabular_structure that looks like ANOTHER _detect_ledger_patterns

    # Let me find the specific dead code block — the orphan `signals = []` after
    # `_has_tabular_structure`'s return
    dead_code_marker = "\n    signals = []\n    preview_lower = text_preview.lower()\n\n    # Ledger-specific keywords\n    ledger_keywords = [\n        \"dr\", \"cr\", \"debit\", \"credit\", \"balance\", \"particulars\",\n        \"folio\", \"voucher\", \"receipt\", \"payment\", \"by \", \"to \",\n        \"opening balance\", \"closing balance\", \"total\",\n    ]\n    keyword_score = sum(1 for kw in ledger_keywords if kw in preview_lower)\n\n    # Check for tabular structure (repeated columns)\n    import re\n    date_entries = len(re.findall(r'\\d{2}[/-]\\d{2}[/-]\\d{2,4}', text_preview))\n    amount_entries = len(re.findall(r'₹?\\s*[\\d,]+\\.\\d{2}', text_preview))\n\n    if keyword_score >= 4 and (date_entries >= 2 or amount_entries >= 3):\n        signals.append(\"ledger_patterns_detected\")\n        confidence = min(0.95, 0.4 + 0.05 * keyword_score + 0.05 * date_entries)\n        return {\"is_ledger\": True, \"confidence\": confidence, \"signals\": signals}\n\n    return {\"is_ledger\": False, \"confidence\": 0.0, \"signals\": signals}\n"

    if dead_code_marker in content:
        content = content.replace(dead_code_marker, "")
        modified = True
        print("  Fixed: Removed dead code in _detect_ledger_patterns")

    # Fix 4: Lower ledger keyword threshold from >=3 to >=1 (spec's any() logic)
    if 'ledger_kw_score >= 3 and _has_tabular_structure(text_preview)' in content:
        content = content.replace(
            'ledger_kw_score >= 3 and _has_tabular_structure(text_preview)',
            'ledger_kw_score >= 1 and _has_tabular_structure(text_preview)',
        )
        modified = True
        print("  Fixed: Lowered ledger keyword threshold to >=1 (matches spec)")

    path.write_text(content, "utf-8")
    return modified


def add_detect_nature_endpoint(project_root: Path) -> bool:
    """Add /ocr/detect-nature endpoint to _processing.py."""
    path = project_root / "backend" / "routers" / "ocr" / "_processing.py"
    content = path.read_text("utf-8")
    modified = False

    # Check if endpoint already exists
    if "detect-nature" in content:
        print("  Skipped: /ocr/detect-nature endpoint already exists")
        return False

    # Find the position after the ocr_logbook endpoint function (before @router.post("/warp"))
    # The ocr_logbook function ends with `return final_payload` and then there's a blank line
    # and then `@router.post("/warp"` starts
    
    # Insert after the ocr_logbook function's return and before @router.post("/warp")
    endpoint_code = """


@router.post("/detect-nature", status_code=status.HTTP_200_OK)
async def detect_document_nature_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    \"\"\"Analyse an image and detect the document nature.

    Returns a classification of whether the document is printed, handwritten,
    a screenshot, or a ledger/account statement. Uses image analysis and
    OCR text heuristics (Tesseract) to determine the document type.

    This endpoint is useful for:
    - Pre-classifying documents before OCR extraction
    - Selecting the best Claude model tier for extraction
    - Deciding whether to use the structured or unstructured extraction path
    \"\"\"
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

"""

    # Insert before the @router.post("/warp") line
    insert_marker = "@router.post(\"/warp\", status_code=status.HTTP_200_OK)"
    if insert_marker in content:
        content = content.replace(insert_marker, endpoint_code + "\n" + insert_marker)
        modified = True
        print("  Fixed: Added /ocr/detect-nature endpoint to _processing.py")
    else:
        print("  WARNING: Could not find @router.post(\"/warp\") insertion point")

    path.write_text(content, "utf-8")
    return modified


def main():
    project_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    print(f"Project root: {project_root}")

    if fix_cost_router(project_root):
        print("✅ ocr_cost_router.py fixed")
    else:
        print("ℹ️  No changes needed in ocr_cost_router.py")

    if add_detect_nature_endpoint(project_root):
        print("✅ _processing.py updated")
    else:
        print("ℹ️  No changes needed in _processing.py")


if __name__ == "__main__":
    main()
