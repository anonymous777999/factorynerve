from __future__ import annotations

import os
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.ocr_utils import extract_table_from_image as extract_base_ocr
from backend.services.ocr_document_pipeline import build_structured_ocr_result


DEFAULT_IMAGE_PATHS = [
    Path(r"C:\Users\shubh\Downloads\dpr testing img 1.jpeg"),
    Path(r"C:\Users\shubh\Downloads\dpr testing img 2.jpeg"),
]


def _candidate_paths() -> list[Path]:
    env_paths = [item.strip() for item in (os.getenv("OCR_TEST_IMAGE_PATHS") or "").split(os.pathsep) if item.strip()]
    if env_paths:
        return [Path(item) for item in env_paths]
    return DEFAULT_IMAGE_PATHS


def main() -> None:
    os.environ.setdefault("TABLE_SCAN_PROVIDER", "tesseract")
    os.environ.setdefault("TABLE_SCAN_PROVIDER_CHAIN", "tesseract")

    image_paths = [path for path in _candidate_paths() if path.exists()]
    if not image_paths:
        raise SystemExit("No OCR test image found. Set OCR_TEST_IMAGE_PATHS or place the sample images in Downloads.")

    for path in image_paths:
        image_bytes = path.read_bytes()
        base_result = extract_base_ocr(image_bytes, columns=5, language="auto")
        structured = build_structured_ocr_result(
            image_bytes,
            base_result=base_result,
            used_language="auto",
            fallback_used=False,
            doc_type_hint="table",
        )

        assert structured is not None, "Structured OCR result was None"
        assert "rows" in structured, "Structured OCR result missing rows"
        assert structured["rows"] is not None, "Structured OCR rows were None"
        assert isinstance(structured["rows"], list), "Structured OCR rows were not a list"

        print(
            f"PASS {path.name}: rows={len(structured['rows'])} "
            f"headers={len(structured.get('headers') or [])} "
            f"tier={(structured.get('routing') or {}).get('model_tier', 'unknown')}"
        )


if __name__ == "__main__":
    main()
