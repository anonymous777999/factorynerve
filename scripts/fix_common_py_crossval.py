"""Apply cross_validation changes to backend/routers/ocr/_common.py.

This script makes two targeted edits to add cross_validation support:
1. Add cross_validation field to OcrVerificationUpdatePayload
2. Add cross_validation parameter to _apply_verification_payload
"""
import re

FILE = "backend/routers/ocr/_common.py"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add cross_validation field to OcrVerificationUpdatePayload (after scan_quality)
old1 = "    scan_quality: dict | None = None\n    document_hash: str | None = Field(default=None, max_length=128)"
new1 = "    scan_quality: dict | None = None\n    cross_validation: dict | None = None\n    document_hash: str | None = Field(default=None, max_length=128)"
if old1 in content:
    content = content.replace(old1, new1, 1)
    print("OK: Added cross_validation to OcrVerificationUpdatePayload")
else:
    print("WARN: Could not find anchor for OcrVerificationUpdatePayload")

# 2. Add cross_validation parameter to _apply_verification_payload function signature
old2 = "    raw_column_added: bool | None = None,\n    reviewer_notes: str | None = None,\n) -> None:\n    if template_id is not None:"
new2 = "    raw_column_added: bool | None = None,\n    cross_validation: dict | None = None,\n    reviewer_notes: str | None = None,\n) -> None:\n    if template_id is not None:"
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("OK: Added cross_validation param to _apply_verification_payload")
else:
    print("WARN: Could not find anchor for _apply_verification_payload signature")

# 3. Add cross_validation assignment after scan_quality in _apply_verification_payload body
old3 = "    if scan_quality is not None:\n        verification.scan_quality = scan_quality\n    if document_hash is not None:"
new3 = "    if scan_quality is not None:\n        verification.scan_quality = scan_quality\n    if cross_validation is not None:\n        verification.cross_validation = cross_validation\n    if document_hash is not None:"
if old3 in content:
    content = content.replace(old3, new3, 1)
    print("OK: Added cross_validation assignment in _apply_verification_payload body")
else:
    print("WARN: Could not find anchor for assignment after scan_quality")

# 4. Add cross_validation assignment after raw_column_added in _apply_verification_payload body
old4 = "    if raw_column_added is not None:\n        verification.raw_column_added = bool(raw_column_added)\n    if reviewer_notes is not None:"
new4 = "    if raw_column_added is not None:\n        verification.raw_column_added = bool(raw_column_added)\n    if cross_validation is not None:\n        verification.cross_validation = cross_validation\n    if reviewer_notes is not None:"
if old4 in content:
    content = content.replace(old4, new4, 1)
    print("OK: Added cross_validation assignment after raw_column_added")
else:
    print("WARN: Could not find anchor for assignment after raw_column_added")

with open(FILE, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)

print("Done: _common.py updated")
