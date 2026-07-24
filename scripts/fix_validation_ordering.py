"""
Fix the validation pipeline integration in build_structured_ocr_result.

Ensures:
1. Validation runs AFTER cross-validation (so cross_validation_result is available)
2. Validation code is placed just before the return statement
3. Does NOT duplicate if already present
"""

def main():
    path = "backend/services/ocr_document_pipeline.py"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if validation code already exists in build_structured_ocr_result
    if "validation_result" in content and "# Phase 4: Run multi-stage validation pipeline" in content:
        print("Phase 4 validation code already present. Checking position...")
        
        # Check if it's before or after cross-validation
        before_pos = content.find("# Phase 4: Run multi-stage validation pipeline")
        cv_pos = content.find("CROSS-VALIDATION: Compare AI-enhanced rows")
        
        if before_pos < cv_pos:
            print(f"  WARNING: Validation code at position {before_pos} is BEFORE cross-validation at {cv_pos}")
            print("  Need to move it to after cross-validation.")
            # We'll remove the old block and add it in the right place
            content = _remove_validation_block(content)
            content = _add_validation_block(content)
        else:
            print("  Validation code is AFTER cross-validation - correct ordering.")
            return
    else:
        print("Phase 4 validation code not found. Adding it...")
        content = _add_validation_block(content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {path}")
    print("  Done!")


def _remove_validation_block(content: str) -> str:
    """Remove the Phase 4 validation block and declaration."""
    markers = [
        "\n    # Phase 4: Run multi-stage validation pipeline",
        "\n    try:\n        pipeline = OcrValidationPipeline()\n        validation_result = pipeline.validate",
    ]
    for marker in markers:
        if marker in content:
            # Find the block: from the marker to the next blank line + "    raw_text" or similar
            start = content.find(marker)
            # Find the end by looking for "validation_result = None" or the next section
            end_except = content.find("\n    raw_text", start)
            if end_except == -1:
                end_except = content.find("\n    \n    raw_text", start)
            if end_except != -1:
                content = content[:start] + content[end_except:]
                print(f"  Removed validation block at position {start}")
            break
    return content


def _add_validation_block(content: str) -> str:
    """Add validation block after cross-validation, before return."""
    # Find the factual confidence section that comes after cross-validation
    # Look for the marker that's just before pipeline_metadata updates
    marker = '\n    # NEW (P0-3): Update pipeline metadata with AI result'
    
    validation_block = """
    # Phase 4: Run multi-stage validation pipeline
    validation_result: dict | None = None
    try:
        pipeline = OcrValidationPipeline()
        validation_result = pipeline.validate(
            headers=normalized_headers,
            rows=normalized_rows,
            doc_type=doc_type_hint,
            data={"headers": normalized_headers, "rows": normalized_rows},
            cross_validation=cross_validation_result.to_dict() if cross_validation_result else None,
        )
        for issue in validation_result.all_issues:
            if issue.severity == "error":
                warnings.append(f"VALIDATION: {issue.message}")
    except Exception as val_err:
        logger.warning("Validation pipeline failed: %s", val_err, exc_info=True)
        validation_result = None

"""
    
    if marker in content:
        content = content.replace(marker, validation_block + marker, 1)
        print("  Added validation block after cross-validation")
    else:
        print("  ! Could not find insertion marker")
    return content


if __name__ == "__main__":
    main()
