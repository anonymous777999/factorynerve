"""
Integrate Phase 4 validation pipeline into OCR codebase.

Adds:
1. Import of OcrValidationPipeline to _common.py
2. Validation to _run_table_preview_pipeline output in _common.py
3. Validation to _serialize_verification output in _common.py
4. Validation to _processing.py ocr_logbook endpoint
"""

import re


def patch_common_imports(content: str) -> str:
    """Add OcrValidationPipeline import after existing OCR imports."""
    marker = "from backend.services.ocr_confidence import calculate_structural_confidence"
    replacement = marker + "\nfrom backend.validators import OcrValidationPipeline"
    if replacement not in content and marker in content:
        content = content.replace(marker, replacement, 1)
        print("  + Added OcrValidationPipeline import to _common.py")
    else:
        print("  ~ Import already present or marker not found")
    return content


def patch_table_preview_return(content: str) -> str:
    """Add validation to _run_table_preview_pipeline return dict."""
    marker = '''        "reused": False,
        "reused_verification_id": None,
    }'''
    # Only add if not already present
    if '"validation":' in content:
        print("  ~ Validation already in _run_table_preview_pipeline")
        return content

    validation_line = '''        "validation": OcrValidationPipeline().validate(
            headers=headers,
            rows=rows,
            doc_type=doc_type_hint,
        ).to_dict() if headers else None,
'''

    if marker in content:
        content = content.replace(
            marker,
            validation_line + marker,
            1,
        )
        print("  + Added validation to _run_table_preview_pipeline")
    else:
        print("  ! Marker not found in _run_table_preview_pipeline")
    return content


def patch_serialize_verification(content: str) -> str:
    """Add validation to _serialize_verification return dict."""
    marker = '''        "created_at": verification.created_at.isoformat() if verification.created_at else None,
        "updated_at": verification.updated_at.isoformat() if verification.updated_at else None,
    }'''
    if '"validation":' in content:
        print("  ~ Validation already in _serialize_verification")
        return content

    validation_line = '''        "validation": _build_verification_validation(verification),
'''

    if marker in content:
        content = content.replace(
            marker,
            validation_line + marker,
            1,
        )
        print("  + Added validation to _serialize_verification")
    else:
        print("  ! Marker not found in _serialize_verification")
    return content


def add_verification_validation_helper(content: str) -> str:
    """Add the _build_verification_validation helper function."""
    helper = r'''
def _build_verification_validation(verification: OcrVerification) -> dict[str, Any] | None:
    """Run the validation pipeline against stored verification data.

    Reconstructs the validation result from stored headers/rows.
    Returns None if no validation can be run.
    """
    headers = verification.headers or []
    rows = verification.reviewed_rows or verification.original_rows or []
    if not headers and not rows:
        return None
    try:
        pipeline = OcrValidationPipeline()
        result = pipeline.validate(
            headers=headers,
            rows=rows,
            doc_type=verification.doc_type_hint,
            cross_validation=verification.cross_validation,
        )
        return result.to_dict()
    except Exception:
        logger.warning("Validation from cache failed for verification id=%s", verification.id, exc_info=True)
        return None


'''

    # Add after _normalize_routing_meta function (which ends with a return statement and a blank line)
    marker = "        \"usage\": normalized_usage,\n    }"
    if helper.strip() not in content and "_build_verification_validation" not in content:
        # Find where to insert - after the _normalize_routing_meta function
        # Search for the function that ends with the routing_meta normalization
        insert_marker = "\ndef _save_verification_source"
        if insert_marker in content:
            content = content.replace(
                insert_marker,
                helper + insert_marker,
                1,
            )
            print("  + Added _build_verification_validation helper")
        else:
            print("  ! Could not find insertion point for helper")
    else:
        print("  ~ Helper already present")
    return content


def patch_processing_py(content: str) -> str:
    """Add validation to the ocr_logbook endpoint final_payload."""
    # In the _processing.py file, after "structured" is built, add validation to final_payload
    # The final_payload is built at the end of ocr_logbook endpoint
    # Look for the return statement at the end of the endpoint
    
    # Add import
    marker_import = "from backend.routers.ocr._common import ("
    if "from backend.validators import OcrValidationPipeline" not in content:
        content = content.replace(
            "from backend.services.ocr_document_pipeline import (",
            "from backend.validators import OcrValidationPipeline\nfrom backend.services.ocr_document_pipeline import (",
            1,
        )
        print("  + Added import to _processing.py")
    
    # Add validation to final_payload. The endpoint builds final_payload and returns it.
    # Look for 'final_payload.update(_job_urls(str(job["job_id"])))' in the async endpoint
    # or look for 'return final_payload' at the end
    if '"validation":' not in content:
        # Find the return statement of the main ocr_logbook endpoint
        # It should be "return final_payload" after building the payload
        marker = "\n    return final_payload"
        validation_code = '''
    try:
        pipeline = OcrValidationPipeline()
        validation_result = pipeline.validate(
            headers=structured.get("headers") or [],
            rows=structured.get("rows") or [],
            doc_type=requested_doc_type,
            cross_validation=structured.get("cross_validation"),
        )
        final_payload["validation"] = validation_result.to_dict()
    except Exception as val_err:
        logger.warning("Validation pipeline failed in ocr_logbook: %s", val_err, exc_info=True)
        final_payload["validation"] = None

'''
        # Find the correct return statement - the main one after final_payload is built
        # Let me be more specific to avoid matching the async endpoint
        marker_confidence = '''if old_conf is not None and new_conf is not None:
            if new_conf < old_conf:
                final_payload["confidence_dropped"] = True
            else:
                final_payload["confidence_improved"] = True

    return final_payload'''
        
        if marker_confidence in content:
            content = content.replace(
                marker_confidence,
                marker_confidence.replace('\n    return final_payload', validation_code + '\n    return final_payload'),
                1,
            )
            print("  + Added validation to ocr_logbook final_payload")
        else:
            print("  ! Marker not found in _processing.py")
    
    return content


def main():
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    
    # Patch _common.py
    common_path = f"{root}/backend/routers/ocr/_common.py"
    print(f"Patching {common_path}...")
    with open(common_path, "r", encoding="utf-8") as f:
        common_content = f.read()
    
    common_content = patch_common_imports(common_content)
    common_content = patch_table_preview_return(common_content)
    common_content = add_verification_validation_helper(common_content)
    common_content = patch_serialize_verification(common_content)
    
    with open(common_path, "w", encoding="utf-8") as f:
        f.write(common_content)
    print(f"  Wrote {common_path}")
    
    # Patch _processing.py
    processing_path = f"{root}/backend/routers/ocr/_processing.py"
    print(f"Patching {processing_path}...")
    with open(processing_path, "r", encoding="utf-8") as f:
        processing_content = f.read()
    
    processing_content = patch_processing_py(processing_content)
    
    with open(processing_path, "w", encoding="utf-8") as f:
        f.write(processing_content)
    print(f"  Wrote {processing_path}")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
