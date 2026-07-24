"""Wire unstructured prompts into the OCR pipeline in _common.py."""
from pathlib import Path

COMMON_PATH = Path("backend/routers/ocr/_common.py")
content = COMMON_PATH.read_text("utf-8")
modified = False

# 1. Add import for get_unstructured_prompt
old_import = "from backend.services.ocr_document_types import _build_type_specific_prompt_for_claude"
new_import = old_import + "\nfrom backend.ai.prompts.unstructured_documents import get_unstructured_prompt"
if old_import in content and "get_unstructured_prompt" not in content:
    content = content.replace(old_import, new_import, 1)
    modified = True
    print("  Added import for get_unstructured_prompt")

# 2. Modify _run_table_excel_pipeline: move detect_document_nature outside if/else
old_excel_nature = """    cost_decision = None
    explicit_model = _normalize_requested_model(requested_model)
    if explicit_model:
        selected_model = explicit_model
        logger.info(\"[OCR] Using user-requested model for Excel: %s\", selected_model)
    else:
        # Cost-optimized model selection (Phase 2)
        try:
            nature_result = detect_document_nature(image_bytes)
            has_handwriting = nature_result.get(\"handwriting\", {}).get(\"has_handwriting\", False) or nature_result.get(\"nature\") == \"handwritten\"
            doc_nature = nature_result.get(\"nature\", \"printed\")
        except Exception:
            has_handwriting = False
            doc_nature = \"printed\"
        cost_decision = select_cost_optimal_model("""

new_excel_nature = """    # Detect document nature for prompt selection and cost routing
    cost_decision = None
    explicit_model = _normalize_requested_model(requested_model)
    try:
        nature_result = detect_document_nature(image_bytes)
        has_handwriting = nature_result.get(\"handwriting\", {}).get(\"has_handwriting\", False) or nature_result.get(\"nature\") == \"handwritten\"
        doc_nature = nature_result.get(\"nature\", \"printed\")
    except Exception:
        has_handwriting = False
        doc_nature = \"printed\"

    if explicit_model:
        selected_model = explicit_model
        logger.info(\"[OCR] Using user-requested model for Excel: %s\", selected_model)
    else:
        # Cost-optimized model selection (Phase 2)
        cost_decision = select_cost_optimal_model("""

if old_excel_nature in content:
    content = content.replace(old_excel_nature, new_excel_nature, 1)
    modified = True
    print("  Moved detect_document_nature outside if/else in _run_table_excel_pipeline")
else:
    print("  WARNING: Could not find _run_table_excel_pipeline nature detection block")

# 3. Add unstructured prompt to _run_table_excel_pipeline prompt selection
old_excel_prompt = """    # Phase 0.2: Classify document and select type-specific prompt
    model_type_prompt = None
    if doc_type_hint:"""

new_excel_prompt = """    # Phase 5: Select unstructured prompt for handwritten/ledger/screenshot docs
    # Phase 0.2: Classify document and select type-specific prompt as fallback
    model_type_prompt = None
    unstructured_prompt = get_unstructured_prompt(doc_nature)
    if unstructured_prompt:
        model_type_prompt = unstructured_prompt
        logger.info(\"[OCR] Using unstructured prompt for doc_nature=%s\", doc_nature)
    elif doc_type_hint:"""

if old_excel_prompt in content:
    content = content.replace(old_excel_prompt, new_excel_prompt, 1)
    modified = True
    print("  Added unstructured prompt to _run_table_excel_pipeline")
else:
    print("  WARNING: Could not find _run_table_excel_pipeline prompt section")

# 4. Modify _run_table_preview_pipeline: detect doc_nature even when user requests model
old_preview_nature = """    if requested_model or force_model:
        selected_model, forced, explicit_model = _select_table_preview_model(
            image_quality_score,
            requested_model=requested_model or force_model,
        )
        model_tier = resolve_anthropic_model_tier(selected_model)
        cost_decision = None
        logger.info(\"[OCR] Using user-requested model: %s (tier=%s)\", selected_model, model_tier)
    else:
        # Detect handwriting and document nature for cost routing
        try:
            nature_result = detect_document_nature(image_bytes)
            has_handwriting = nature_result.get(\"handwriting\", {}).get(\"has_handwriting\", False) or nature_result.get(\"nature\") == \"handwritten\"
            doc_nature = nature_result.get(\"nature\", \"printed\")
        except Exception:
            has_handwriting = False
            doc_nature = \"printed\""""

new_preview_nature = """    # Detect document nature for prompt selection
    try:
        nature_result = detect_document_nature(image_bytes)
        has_handwriting = nature_result.get(\"handwriting\", {}).get(\"has_handwriting\", False) or nature_result.get(\"nature\") == \"handwritten\"
        doc_nature = nature_result.get(\"nature\", \"printed\")
    except Exception:
        has_handwriting = False
        doc_nature = \"printed\"

    if requested_model or force_model:
        selected_model, forced, explicit_model = _select_table_preview_model(
            image_quality_score,
            requested_model=requested_model or force_model,
        )
        model_tier = resolve_anthropic_model_tier(selected_model)
        cost_decision = None
        logger.info(\"[OCR] Using user-requested model: %s (tier=%s)\", selected_model, model_tier)
    else:
        # Cost-optimized model selection (Phase 2)"""

if old_preview_nature in content:
    content = content.replace(old_preview_nature, new_preview_nature, 1)
    modified = True
    print("  Moved detect_document_nature outside if/else in _run_table_preview_pipeline")
else:
    print("  WARNING: Could not find _run_table_preview_pipeline nature detection block")

# 5. Add unstructured prompt to _run_table_preview_pipeline prompt selection
old_preview_prompt = """    # Phase 0.2: Classify document and select type-specific prompt
    model_type_prompt = None
    if not doc_type_hint or doc_type_hint == \"unknown\":"""

new_preview_prompt = """    # Phase 5: Select unstructured prompt for handwritten/ledger/screenshot docs
    # Phase 0.2: Classify document and select type-specific prompt as fallback
    model_type_prompt = None
    unstructured_prompt = get_unstructured_prompt(doc_nature)
    if unstructured_prompt:
        model_type_prompt = unstructured_prompt
        logger.info(\"[OCR] Using unstructured prompt for doc_nature=%s\", doc_nature)
    elif not doc_type_hint or doc_type_hint == \"unknown\":"""

if old_preview_prompt in content:
    content = content.replace(old_preview_prompt, new_preview_prompt, 1)
    modified = True
    print("  Added unstructured prompt to _run_table_preview_pipeline")
else:
    print("  WARNING: Could not find _run_table_preview_pipeline prompt section")

if modified:
    COMMON_PATH.write_text(content, "utf-8")
    print("\n✅ All changes applied to _common.py")
else:
    print("\nℹ️  No changes were applied")
