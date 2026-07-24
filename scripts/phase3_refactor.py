"""Phase 3 refactoring script: extract correction pass into cost router."""
import re


def apply(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add build_correction_request to the import
    old_import = (
        "from backend.services.ocr_cost_router import (\n"
        "    select_cost_optimal_model,\n"
        "    detect_document_nature,\n"
        ")"
    )
    new_import = (
        "from backend.services.ocr_cost_router import (\n"
        "    select_cost_optimal_model,\n"
        "    detect_document_nature,\n"
        "    build_correction_request,\n"
        ")"
    )
    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print("1. Added build_correction_request to import")
    else:
        print("1. Import not found!")

    # 2. Update function signature to add needs_correction_pass parameter
    old_sig = (
        "def _call_table_excel_anthropic(\n"
        "    image_base64: str | bytes,\n"
        "    *,\n"
        "    image_mime_type: str,\n"
        "    selected_model: str,\n"
        "    requested_model: str | None = None,\n"
        "    system_prompt: str | None,\n"
        "    user_message: str | None,\n"
        ") -> dict[str, object]:"
    )
    new_sig = (
        "def _call_table_excel_anthropic(\n"
        "    image_base64: str | bytes,\n"
        "    *,\n"
        "    image_mime_type: str,\n"
        "    selected_model: str,\n"
        "    requested_model: str | None = None,\n"
        "    system_prompt: str | None,\n"
        "    user_message: str | None,\n"
        "    needs_correction_pass: bool = False,\n"
        ") -> dict[str, object]:"
    )
    if old_sig in content:
        content = content.replace(old_sig, new_sig, 1)
        print("2. Added needs_correction_pass parameter")
    else:
        print("2. Function signature not found!")

    # 3. Add the _run_anthropic_correction_pass helper function
    # Find the end of _call_table_excel_anthropic
    end_marker = (
        '    extraction_json["_selected_model"] = selected_model\n'
        "    return extraction_json"
    )

    helper_fn = (
        '    extraction_json["_selected_model"] = selected_model\n'
        "    return extraction_json\n\n\n"
        "def _run_anthropic_correction_pass(\n"
        "    *,\n"
        "    extraction_json: dict[str, object],\n"
        "    validation_errors: list[str] | None,\n"
        "    first_model_used: str | None,\n"
        "    explicit_model: str | None,\n"
        "    selected_model: str,\n"
        "    image_base64: str | bytes,\n"
        "    image_mime_type: str,\n"
        "    usage_summaries: list[dict[str, Any]],\n"
        "    model_attempts: list[dict[str, Any]],\n"
        "    last_response_debug: dict[str, Any] | None,\n"
        ') -> dict[str, object] | None:\n'
        '    """Run a correction pass via the cost router.\n\n'
        "    Called when:\n"
        "    1. ``needs_correction_pass`` from cost decision is True (proactive)\n"
        "    2. Validation errors were found (reactive)\n\n"
        "    Returns corrected JSON with merged metadata, or None on failure.\n"
        '    """\n'
        "    api_key = _require_anthropic_api_key()\n\n"
        "    correction_request = build_correction_request(\n"
        "        extraction_json=extraction_json,\n"
        "        validation_errors=validation_errors,\n"
        "        first_model_used=first_model_used,\n"
        "        explicit_model=explicit_model,\n"
        "    )\n"
        '    correction_model = correction_request["correction_model"]\n'
        '    messages = correction_request["messages"]\n'
        '    is_proactive = correction_request["is_proactive"]\n\n'
        '    logger.info(\n'
        '        "[OCR] Correction pass: model=%s proactive=%s reason=%s",\n'
        "        correction_model,\n"
        "        is_proactive,\n"
        '        correction_request["reason"],\n'
        "    )\n\n"
        "    retry_payload = {\n"
        '        "model": correction_model,\n'
        '        "max_tokens": 4096,\n'
        '        "messages": messages,\n'
        "    }\n\n"
        "    try:\n"
        "        response = requests.post(\n"
        "            _ANTHROPIC_MESSAGES_URL,\n"
        "            headers={\n"
        '                "Content-Type": "application/json",\n'
        '                "x-api-key": api_key,\n'
        '                "anthropic-version": "2023-06-01",\n'
        "            },\n"
        "            json=retry_payload,\n"
        "            timeout=_table_excel_timeout_seconds(),\n"
        "        )\n\n"
        "        if response.status_code == 200:\n"
        "            ai_data = response.json()\n"
        "            actual_model = verify_anthropic_response_model(\n"
        "                correction_model,\n"
        "                ai_data,\n"
        '                context="OCR route correction pass",\n'
        "            )\n"
        "            usage_summary = build_anthropic_usage_summary(actual_model, ai_data)\n"
        "            usage_summaries.append(usage_summary)\n"
        "            response_debug = serialize_anthropic_response_debug(ai_data)\n"
        "            model_attempts.append(\n"
        "                {\n"
        '                    "model": actual_model,\n'
        '                    "status": "correction_success",\n'
        '                    "usage": usage_summary,\n'
        '                    "response": response_debug,\n'
        "                }\n"
        "            )\n"
        '            logger.info(\n'
        '                "[OCR] Correction pass response model=%s input_tokens=%s output_tokens=%s total_tokens=%s estimated_cost=%s",\n'
        "                actual_model,\n"
        '                usage_summary["input_tokens"],\n'
        '                usage_summary["output_tokens"],\n'
        '                usage_summary["total_tokens"],\n'
        '                usage_summary["estimated_cost"],\n'
        "            )\n"
        "            raw_text = _extract_table_excel_json_text(ai_data)\n"
        "            corrected_json = _extract_json_candidate(raw_text)\n"
        "            if isinstance(corrected_json, dict):\n"
        '                logger.info(\n'
        '                    "[OCR] Correction pass successful model=%s proactive=%s",\n'
        "                    actual_model,\n"
        "                    is_proactive,\n"
        "                )\n"
        '                corrected_json.setdefault("_provider_model", actual_model)\n'
        '                corrected_json.setdefault("_correction_applied", True)\n'
        '                corrected_json["_usage_summary"] = merge_anthropic_usage_summaries(\n'
        "                    actual_model,\n"
        "                    usage_summaries,\n"
        "                )\n"
        '                corrected_json["_model_attempts"] = list(model_attempts)\n'
        '                corrected_json["_debug_response"] = response_debug\n'
        '                corrected_json["_requested_model"] = explicit_model\n'
        '                corrected_json["_selected_model"] = selected_model\n'
        '                corrected_json["_correction_proactive"] = is_proactive\n'
        "                return corrected_json\n\n"
        '            logger.error("[OCR] Correction pass returned invalid JSON")\n'
        "        else:\n"
        '            logger.error("[OCR] Correction pass failed status=%s", response.status_code)\n'
        "            try:\n"
        "                error_payload = response.json()\n"
        "                error_message = (\n"
        '                    (error_payload.get("error") or {}).get("message")\n'
        "                    if isinstance(error_payload, dict)\n"
        "                    else str(error_payload)\n"
        "                )\n"
        "            except ValueError:\n"
        '                error_message = f"Anthropic API returned status {response.status_code}."\n'
        "            model_attempts.append(\n"
        "                {\n"
        '                    "model": correction_model,\n'
        '                    "status": "correction_error",\n'
        '                    "status_code": response.status_code,\n'
        '                    "error": error_message,\n'
        "                }\n"
        "            )\n"
        "    except Exception as error:\n"
        '        logger.error("[OCR] Correction pass failed unexpectedly: %s", error)\n'
        "        model_attempts.append(\n"
        "            {\n"
        '                "model": correction_model,\n'
        '                "status": "correction_exception",\n'
        '                "error": str(error),\n'
        "            }\n"
        "        )\n\n"
        "    return None\n"
    )

    if end_marker in content:
        content = content.replace(end_marker, helper_fn, 1)
        print("3. Added _run_anthropic_correction_pass helper")
    else:
        print("3. End marker not found!")

    # 4. Replace the inline correction pass logic
    # Find the validation_errors section and everything up to the final return
    old_block_start = "    validation_errors = _validate_table_excel_json(extraction_json)"
    old_block_end = '    extraction_json["_selected_model"] = selected_model\n    return extraction_json'

    start_idx = content.find(old_block_start)
    end_idx = content.find(old_block_end, start_idx)

    if start_idx >= 0 and end_idx > start_idx:
        # Advance end_idx to end of that line
        end_of_return = content.find("\n", end_idx) + 1
        old_block = content[start_idx:end_of_return]

        new_block = (
            '    validation_errors = _validate_table_excel_json(extraction_json)\n\n'
            '    # Decide whether to run a correction pass\n'
            '    should_correct = bool(validation_errors) or needs_correction_pass\n\n'
            '    if should_correct:\n'
            '        corrected = _run_anthropic_correction_pass(\n'
            '            extraction_json=extraction_json,\n'
            '            validation_errors=validation_errors,\n'
            '            first_model_used=first_model_used,\n'
            '            explicit_model=explicit_model,\n'
            '            selected_model=selected_model,\n'
            '            image_base64=image_base64,\n'
            '            image_mime_type=image_mime_type,\n'
            '            usage_summaries=usage_summaries,\n'
            '            model_attempts=model_attempts,\n'
            '            last_response_debug=last_response_debug,\n'
            '        )\n'
            '        if corrected is not None:\n'
            '            logger.info(\n'
            '                "[OCR] Correction pass applied for model=%s errors=%s proactive=%s",\n'
            '                first_model_used,\n'
            '                len(validation_errors) if validation_errors else 0,\n'
            '                needs_correction_pass and not validation_errors,\n'
            '            )\n'
            '            return corrected\n'
            '        logger.warning("[OCR] Correction pass failed, falling back to original extraction")\n\n'
            '    extraction_json.setdefault("_provider_model", first_model_used)\n'
            '    extraction_json["_usage_summary"] = merge_anthropic_usage_summaries(\n'
            '        first_model_used,\n'
            '        usage_summaries,\n'
            '    )\n'
            '    extraction_json["_model_attempts"] = model_attempts\n'
            '    extraction_json["_debug_response"] = last_response_debug\n'
            '    extraction_json["_requested_model"] = explicit_model\n'
            '    extraction_json["_selected_model"] = selected_model\n'
            '    return extraction_json\n'
        )

        content = content[:start_idx] + new_block + content[end_of_return:]
        print("4. Replaced inline correction pass with new delegate-based logic")
    else:
        print(f"4. Block boundaries not found! start={start_idx}, end={end_idx}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("File saved successfully")


if __name__ == "__main__":
    apply("backend/routers/ocr/_common.py")
