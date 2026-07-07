"""Wire ExportGate and ExcelExportEngine into verification export response.

Updates _verification_export_response in _common.py to:
1. Run ExportGate validation (non-blocking warnings)
2. Use ExcelExportEngine for type-specific multi-sheet exports
3. Pass verification metadata for audit trail
"""

import sys
from pathlib import Path


def patch_common(root: str) -> list[str]:
    root_path = Path(root)
    common_file = root_path / "backend" / "routers" / "ocr" / "_common.py"
    if not common_file.exists():
        return [f"ERROR: {common_file} not found"]

    content = common_file.read_text("utf-8")
    changes = []

    # 1. Add import for ExportGate and ExcelExportEngine
    old_import = "from backend.services.ocr_document_types import _build_type_specific_prompt_for_claude"
    new_import = """from backend.services.ocr_document_types import _build_type_specific_prompt_for_claude
from backend.services.export_gate import validate_export_readiness, ExportGateResult
from backend.services.excel_export_engine import excel_export_engine
from backend.services.pdf_export_engine import generate_pdf_export
from backend.database import get_db"""

    if old_import in content:
        content = content.replace(old_import, new_import)
        changes.append("Added ExportGate and ExcelExportEngine imports")
    else:
        changes.append("WARNING: Could not find import location")

    # 2. Update _verification_export_response to use ExportGate + ExcelExportEngine
    old_export = '''def _verification_export_response(verification: OcrVerification) -> Response:
    rows = _verification_export_rows(verification)
    if not rows:
        raise HTTPException(status_code=409, detail="Verification record has no rows to export.")
    headers = _verification_export_headers(verification, rows)
    blockers, validation_warnings = _verification_export_validation(verification, headers, rows)
    if blockers:
        raise HTTPException(
            status_code=409,
            detail="Reviewed sheet has blocking validation issues and must be corrected before export.",
        )
    trusted_export = verification.status == "approved"
    export_source = _verification_export_source(verification)
    filename = _verification_export_filename(verification)
    excel_bytes = build_table_excel_bytes(
        {"headers": headers, "rows": rows},
        sheet_name="Verification Export",
        metadata={
            "Verification Id": verification.id,
            "Verification Status": verification.status,
            "Export Source": export_source,
            "Trusted Export": "Yes" if trusted_export else "No",
            "Review Required": "Yes" if validation_warnings or (verification.scan_quality or {}).get("review_required") else "No",
        },
    )
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "X-Ocr-Verification-Id": str(verification.id),
            "X-Ocr-Export-Source": export_source,
            "X-Ocr-Trusted-Export": str(trusted_export).lower(),
            "X-Ocr-Review-Required": str(bool(validation_warnings or (verification.scan_quality or {}).get("review_required"))).lower(),
            "X-Total-Rows": str(len(rows)),
            "X-Total-Columns": str(len(headers)),
        },
    )'''

    new_export = '''def _verification_export_response(verification: OcrVerification) -> Response:
    rows = _verification_export_rows(verification)
    if not rows:
        raise HTTPException(status_code=409, detail="Verification record has no rows to export.")
    headers = _verification_export_headers(verification, rows)
    blockers, validation_warnings = _verification_export_validation(verification, headers, rows)
    if blockers:
        raise HTTPException(
            status_code=409,
            detail="Reviewed sheet has blocking validation issues and must be corrected before export.",
        )

    # Phase 6: ExportGate check (non-blocking — logs warnings, doesn't block export)
    try:
        gate_result = validate_export_readiness(verification)
        if not gate_result.passed:
            logger.warning(
                "[EXPORT GATE] %d blocking checks for verification id=%s: %s",
                len(gate_result.blocking_issues),
                verification.id,
                [c.name for c in gate_result.blocking_issues],
            )
    except Exception as gate_error:
        logger.warning("[EXPORT GATE] Validation error (non-blocking): %s", gate_error)

    trusted_export = verification.status == "approved"
    export_source = _verification_export_source(verification)
    filename = _verification_export_filename(verification)

    # Build verification metadata for audit trail
    verification_meta = {
        "id": verification.id,
        "status": verification.status,
        "avg_confidence": verification.avg_confidence,
        "doc_type_hint": verification.doc_type_hint,
        "source_filename": verification.source_filename,
        "reviewer_notes": verification.reviewer_notes,
    }

    # Phase 6: Use ExcelExportEngine for type-specific exports, fall back to generic
    doc_type = (verification.doc_type_hint or "").strip().lower()
    try:
        data = {"headers": headers, "rows": rows}
        if doc_type:
            data["metadata"] = {
                "id": verification.id,
                "status": verification.status,
                "avg_confidence": verification.avg_confidence,
            }
        excel_bytes = excel_export_engine.export(
            data=data,
            doc_type=doc_type if doc_type else "generic_table",
            verification_meta=verification_meta,
        )
    except Exception as excel_error:
        logger.warning("[EXPORT] ExcelExportEngine failed, falling back to generic: %s", excel_error)
        excel_bytes = build_table_excel_bytes(
            {"headers": headers, "rows": rows},
            sheet_name="Verification Export",
            metadata={
                "Verification Id": verification.id,
                "Verification Status": verification.status,
                "Export Source": export_source,
                "Trusted Export": "Yes" if trusted_export else "No",
                "Review Required": "Yes" if validation_warnings or (verification.scan_quality or {}).get("review_required") else "No",
            },
        )

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
            "X-Ocr-Verification-Id": str(verification.id),
            "X-Ocr-Export-Source": export_source,
            "X-Ocr-Trusted-Export": str(trusted_export).lower(),
            "X-Ocr-Review-Required": str(bool(validation_warnings or (verification.scan_quality or {}).get("review_required"))).lower(),
            "X-Total-Rows": str(len(rows)),
            "X-Total-Columns": str(len(headers)),
            "X-Export-Engine": "excel_export_engine_v6",
        },
    )'''

    if old_export.strip() in content.strip() or old_export[500:1000] in content:
        content = content.replace(old_export, new_export)
        changes.append("Updated _verification_export_response with ExportGate + ExcelExportEngine")
    else:
        changes.append("WARNING: Could not find _verification_export_response. Checking for variations...")
        # Try to find by partial match
        idx = content.find("def _verification_export_response(verification: OcrVerification)")
        if idx >= 0:
            changes.append(f"Found function at position {idx}, but exact text didn't match (likely whitespace diff)")
            # Show surrounding context
            changes.append(content[idx:idx+200].replace("\\n", "\\\\n"))
        else:
            changes.append("Function not found at all")

    common_file.write_text(content, "utf-8")
    return changes


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    changes = patch_common(root)
    for c in changes:
        print(f"  - {c}")
    print(f"\n{len(changes)} changes applied.")
