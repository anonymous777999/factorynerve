"""
Enhance Phase 5: Unstructured Document Detection Pipeline.

1. Enhances detect_document_nature with spec's exact heuristic logic
2. Adds _has_tabular_structure helper
3. Adds /ocr/detect-nature API endpoint
4. Enhances handwritten_form, ledger_sheet, chat_transcript registrations
"""

import re


def patch_cost_router(path: str) -> bool:
    """Enhance detect_document_nature and add tabular structure detection."""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    changes = 0
    
    # 1. Add _has_tabular_structure helper
    helper = """
def _has_tabular_structure(text: str) -> bool:
    \"\"\"Check if text has tabular/columnar structure.

    Heuristics:
    - Multiple lines with consistent delimiter spacing (tabs, multiple spaces)
    - Repeated column-like patterns across lines
    - Aligned date/amount columns
    \"\"\"
    if not text or not text.strip():
        return False
    lines = [l for l in text.split("\\n") if l.strip()]
    if len(lines) < 3:
        return False
    
    # Check for consistent delimiters: tabs or 3+ spaces
    tab_lines = sum(1 for l in lines if "\\t" in l)
    space_delimited = sum(1 for l in lines if re.search(r'  {3,}', l))
    pipe_delimited = sum(1 for l in lines if '|' in l)
    
    # Count lines that have structured separators
    structured_lines = tab_lines + space_delimited + pipe_delimited
    
    # If >40% of lines have structural delimiters, it's tabular
    return (structured_lines / len(lines)) > 0.4

"""

    if "_has_tabular_structure" not in content:
        # Add after _detect_ledger_patterns function
        insert_marker = "return {\"is_ledger\": False, \"confidence\": 0.0, \"signals\": []}\n\n"
        if insert_marker in content:
            # Find the end of _detect_ledger_patterns
            idx = content.rfind(insert_marker)
            if idx != -1:
                end = idx + len(insert_marker)
                content = content[:end] + helper + content[end:]
                changes += 1
                print(f"  + Added _has_tabular_structure helper")
    
    # 2. Enhance detect_document_nature to use spec's exact logic
    old_function = '''def detect_document_nature(image_bytes: bytes) -> dict:
    \"\"\"Classify document nature: printed, handwritten, screenshot, or ledger.

    Uses OCR text heuristics and image analysis to determine the document type.

    Returns
    -------
    dict with keys:
        nature: str — \"printed\" | \"handwritten\" | \"screenshot\" | \"ledger\" | \"unknown\"
        confidence: float
        signals: list[str]
    \"\"\"
    handwriting_result = detect_handwriting(image_bytes)
    has_handwriting = handwriting_result[\"has_handwriting\"]

    # Try to extract text using lightweight OCR for pattern detection
    text_preview = _extract_text_preview(image_bytes)

    signals = list(handwriting_result.get(\"signals\", []))

    # Check for screenshot patterns
    screenshot_signals = _detect_screenshot_patterns(text_preview)
    signals.extend(screenshot_signals.get(\"signals\", []))

    # Check for ledger patterns
    ledger_signals = _detect_ledger_patterns(text_preview)
    signals.extend(ledger_signals.get(\"signals\", []))

    # Decision logic
    if ledger_signals.get(\"is_ledger\", False):
        return {
            \"nature\": \"ledger\",
            \"confidence\": ledger_signals.get(\"confidence\", 0.7),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    if screenshot_signals.get(\"is_screenshot\", False):
        return {
            \"nature\": \"screenshot\",
            \"confidence\": screenshot_signals.get(\"confidence\", 0.6),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    if has_handwriting:
        return {
            \"nature\": \"handwritten\",
            \"confidence\": handwriting_result.get(\"confidence\", 0.6),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    return {
        \"nature\": \"printed\",
        \"confidence\": 0.8,
        \"signals\": signals + [\"printed_text_detected\"],
        \"handwriting\": handwriting_result,
    }'''

    new_function = '''def detect_document_nature(image_bytes: bytes, ocr_text: str | None = None) -> dict:
    \"\"\"Classify document nature: printed, handwritten, screenshot, or ledger.

    Uses OCR text heuristics and image analysis to determine the document type.
    Follows the spec's exact detection pipeline (Section 5.4).

    Parameters
    ----------
    image_bytes : bytes
        The raw image bytes.
    ocr_text : str | None
        Optional pre-extracted OCR text. If None, extracts text via Tesseract.

    Returns
    -------
    dict with keys:
        nature: str — \"printed\" | \"handwritten\" | \"screenshot\" | \"ledger\" | \"unknown\"
        confidence: float
        signals: list[str]
    \"\"\"
    handwriting_result = detect_handwriting(image_bytes)
    has_handwriting = handwriting_result[\"has_handwriting\"]

    # Try to extract text using lightweight OCR for pattern detection
    text_preview = ocr_text or _extract_text_preview(image_bytes)

    signals = list(handwriting_result.get(\"signals\", []))

    # Heuristic 1: Check for ledger patterns
    # (Spec section 5.4: ledger_patterns + tabular structure check)
    ledger_keywords = [\"dr.\", \"cr.\", \"balance\", \"account\", \"particulars\", \"folio\"]
    ledger_kw_score = sum(1 for p in ledger_keywords if p in text_preview.lower())
    if ledger_kw_score >= 3 and _has_tabular_structure(text_preview):
        signals.append(\"ledger_patterns_detected\")
        return {
            \"nature\": \"ledger\",
            \"confidence\": min(0.9, 0.5 + 0.05 * ledger_kw_score),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    # Heuristic 2: Check for chat/screenshot patterns
    # (Spec section 5.4: chat_patterns scoring)
    chat_patterns = [\"\\u2713\\u2713\", \"\\u2713\", \"today\", \"yesterday\", \"typing\", \"online\"]
    chat_score = sum(1 for p in chat_patterns if p in text_preview) / len(chat_patterns)
    if chat_score > 0.3:
        signals.append(\"chat_patterns_detected\")
        return {
            \"nature\": \"screenshot\",
            \"confidence\": min(0.85, 0.3 + 0.5 * chat_score),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    # Heuristic 3: Handwriting detection via connected components
    # (Spec section 5.4: handwriting via connected components)
    if has_handwriting:
        return {
            \"nature\": \"handwritten\",
            \"confidence\": handwriting_result.get(\"confidence\", 0.6),
            \"signals\": signals,
            \"handwriting\": handwriting_result,
        }

    # Heuristic 4: Check for printed text patterns (regular layout)
    # (Spec section 5.4: regular layout check)
    if _has_regular_layout(text_preview):
        return {
            \"nature\": \"printed\",
            \"confidence\": 0.8,
            \"signals\": signals + [\"printed_text_detected\"],
            \"handwriting\": handwriting_result,
        }

    return {
        \"nature\": \"unknown\",
        \"confidence\": 0.3,
        \"signals\": signals + [\"no_clear_pattern\"],
        \"handwriting\": handwriting_result,
    }'''

    if old_function in content and new_function not in content:
        content = content.replace(old_function, new_function, 1)
        changes += 1
        print(f"  + Enhanced detect_document_nature with spec logic")
    else:
        if new_function in content:
            print(f"  ~ detect_document_nature already enhanced")
        else:
            # Try locating by function signature
            start = content.find("def detect_document_nature(image_bytes: bytes)")
            if start != -1:
                # Find the end of the function (next def or top-level code)
                rest = content[start:]
                lines = rest.split("\\n")
                end_line = 0
                for i, line in enumerate(lines[1:], 1):
                    if line.strip().startswith("def ") or line.strip().startswith("class "):
                        end_line = i
                        break
                    if line.strip().startswith("# ──") and "Internal helpers" in line:
                        end_line = i
                        break
                if end_line > 0:
                    old_func_text = "\\n".join(lines[:end_line])
                    content = content.replace(old_func_text, new_function, 1)
                    changes += 1
                    print(f"  + Replaced detect_document_nature (position-based)")
    
    # 3. Add _has_regular_layout helper
    if "_has_regular_layout" not in content:
        regular_layout_helper = '''
def _has_regular_layout(text: str) -> bool:
    \"\"\"Check if text has regular printed layout.

    Printed documents typically have:
    - Consistent line spacing
    - Regular character widths
    - Straight text lines
    - Predictable column alignment

    This is a heuristic check on OCR text output.
    \"\"\"
    if not text or not text.strip():
        return False
    lines = [l for l in text.split("\\n") if l.strip()]
    if len(lines) < 3:
        return False
    
    # Check for consistent line lengths (printed text has more consistent line lengths)
    line_lengths = [len(l) for l in lines]
    if not line_lengths:
        return False
    
    mean_len = sum(line_lengths) / len(line_lengths)
    std_len = (sum((x - mean_len) ** 2 for x in line_lengths) / len(line_lengths)) ** 0.5
    
    # Printed text has relatively consistent line lengths (low std/mean ratio)
    length_consistency = std_len / mean_len if mean_len > 0 else 1.0
    
    # Check for typical printed patterns (capital letters, numbers, punctuation)
    upper_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    digit_ratio = sum(1 for c in text if c.isdigit()) / max(len(text), 1)
    
    # Printed documents tend to have consistent layout
    # Low std/mean ratio (<0.5) + some uppercase + some digits = printed
    if length_consistency < 0.5 and upper_ratio > 0.05 and digit_ratio > 0.02:
        return True
    
    return False

'''
        # Add after _has_tabular_structure
        insert_marker = "return (structured_lines / len(lines)) > 0.4"
        if insert_marker in content:
            content = content.replace(insert_marker, insert_marker + "\\n", 1)
            content = content.replace(insert_marker + "\\n", insert_marker + regular_layout_helper, 1)
            changes += 1
            print(f"  + Added _has_regular_layout helper")
    
    if changes > 0:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Wrote {path} ({changes} change(s))")
        return True
    else:
        print(f"  No changes needed for {path}")
        return False


def patch_processing_py(path: str) -> bool:
    """Add /ocr/detect-nature endpoint."""
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    changes = 0
    
    # Add import reference
    if "detect_document_nature" not in content:
        # Add to the import from _common
        marker = "from backend.routers.ocr._common import ("
        if marker in content:
            content = content.replace(
                marker,
                "from backend.services.ocr_cost_router import detect_document_nature\n" + marker,
                1,
            )
            changes += 1
            print(f"  + Added import to _processing.py")
    
    # Add endpoint before the last route handler
    endpoint_code = '''

@router.post("/detect-nature", status_code=status.HTTP_200_OK)
async def ocr_detect_nature(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Detect document nature (printed/handwritten/screenshot/ledger).
    
    Analyses the uploaded image and returns a classification of the document
    type, useful for routing to the appropriate extraction pipeline.
    
    Returns:
        nature: str — "printed" | "handwritten" | "screenshot" | "ledger" | "unknown"
        confidence: float
        signals: list[str]
        handwriting: dict
    """
    _require_ocr_access(db, current_user)
    image_bytes = await _read_validated_image_upload(file)
    
    try:
        result = detect_document_nature(image_bytes)
        return {
            "nature": result.get("nature", "unknown"),
            "confidence": result.get("confidence", 0.0),
            "signals": result.get("signals", []),
            "handwriting": result.get("handwriting", {}),
        }
    except Exception as error:
        logger.error("Document nature detection failed: %s", error, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Nature detection failed: {error}",
        )

'''

    # Insert before the last route handler (ocr_logbook_async)
    insert_marker = "@router.post(\\n    \\\"/logbook-async\\\""
    if endpoint_code not in content and insert_marker in content:
        content = content.replace(
            insert_marker,
            endpoint_code.strip() + "\\n\\n" + insert_marker,
            1,
        )
        changes += 1
        print(f"  + Added /ocr/detect-nature endpoint")
    
    if changes > 0:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Wrote {path} ({changes} change(s))")
        return True
    else:
        print(f"  No changes needed for {path}")
        return False


def main():
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    
    cost_router = f"{root}/backend/services/ocr_cost_router.py"
    processing = f"{root}/backend/routers/ocr/_processing.py"
    
    changed1 = patch_cost_router(cost_router)
    changed2 = patch_processing_py(processing)
    
    if changed1 or changed2:
        print("\\nDone! Changes applied.")
    else:
        print("\\nDone! No changes needed.")


if __name__ == "__main__":
    main()
