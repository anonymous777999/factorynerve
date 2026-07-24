from __future__ import annotations

# Import the shared router, logger, and common helpers
from backend.routers.ocr._common import (  # noqa: F401
    router,
    logger,
    requests,
    TableExcelRouteError,
    _normalize_table_excel_value,
    _normalize_table_excel_extracted_json,
    _inspect_table_excel_image,
    _select_table_excel_model,
    _TABLE_EXCEL_MODEL_HAIKU,
    _TABLE_EXCEL_MODEL_SONNET,
    _TABLE_EXCEL_MODEL_OPUS,
    _run_table_excel_pipeline,
    _call_table_excel_anthropic,
    _build_table_preview_payload,
    _run_table_preview_pipeline,
    _run_ocr_with_fallback,
    _should_retry_with_fallback_language,
)

# Import sub-modules to register their routes with the shared router
import backend.routers.ocr._templates  # noqa: F401
import backend.routers.ocr._verifications  # noqa: F401
import backend.routers.ocr._processing  # noqa: F401
