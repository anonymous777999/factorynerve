"""Wire Phase 4 Prometheus cost metrics into the OCR pipelines."""


def apply(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add import for the cost metrics
    old_import = (
        "from backend.services.ocr_confidence import calculate_structural_confidence"
    )
    new_import = (
        "from backend.metrics import (\n"
        "    OCR_MODEL_TIER_REQUESTS,\n"
        "    OCR_COST_SAVED,\n"
        "    OCR_CORRECTION_PASSES,\n"
        "    OCR_EXTRACTION_LATENCY,\n"
        "    OCR_TIER_COST,\n"
        ")\n"
        "from backend.services.ocr_confidence import calculate_structural_confidence"
    )
    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print("1. Added cost metrics import")
    else:
        print("1. Import target not found!")

    # 2. Wire metrics into excel pipeline (after model selection, before extraction)
    # Find the point after the model selection logger.info and before "Harden vision payload"
    old_excel_metrics = (
        '        "Table Excel model selected requested_model=%s model=%s quality_score=%s mime=%s size_bytes=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        selected_model,\n"
        "        image_quality_score,\n"
        '        inspection["image_mime_type"],\n'
        '        inspection["size_bytes"],\n'
        "    )\n\n"
        "    # Harden vision payload with resizing\n"
        "    image_base64 = preprocess_image_bytes(image_bytes)"
    )
    new_excel_metrics = (
        '        "Table Excel model selected requested_model=%s model=%s quality_score=%s mime=%s size_bytes=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        selected_model,\n"
        "        image_quality_score,\n"
        '        inspection["image_mime_type"],\n'
        '        inspection["size_bytes"],\n'
        "    )\n\n"
        "    # Record model tier selection metric\n"
        "    _tier = cost_decision[\"tier\"] if cost_decision else resolve_anthropic_model_tier(selected_model)\n"
        "    OCR_MODEL_TIER_REQUESTS.labels(tier=_tier).inc()\n\n"
        "    # Harden vision payload with resizing\n"
        "    image_base64 = preprocess_image_bytes(image_bytes)"
    )
    if old_excel_metrics in content:
        content = content.replace(old_excel_metrics, new_excel_metrics, 1)
        print("2. Wired tier metric in excel pipeline")
    else:
        print("2. Excel metrics target not found!")

    # 3. Wire cost and latency metrics into excel pipeline (after processing)
    old_excel_complete = (
        '        "Table Excel completed requested_model=%s model=%s quality_score=%s elapsed_ms=%s extracted_type=%s total_tokens=%s estimated_cost=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        used_model,\n"
        "        image_quality_score,\n"
        "        elapsed_ms,\n"
        '        metadata.get("extracted_type"),\n'
        '        usage_summary.get("total_tokens", 0),\n'
        '        usage_summary.get("estimated_cost", 0),\n'
        "    )\n"
        "    metadata.update("
    )
    new_excel_complete = (
        '        "Table Excel completed requested_model=%s model=%s quality_score=%s elapsed_ms=%s extracted_type=%s total_tokens=%s estimated_cost=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        used_model,\n"
        "        image_quality_score,\n"
        "        elapsed_ms,\n"
        '        metadata.get("extracted_type"),\n'
        '        usage_summary.get("total_tokens", 0),\n'
        '        usage_summary.get("estimated_cost", 0),\n'
        "    )\n"
        "    # Record cost and latency metrics\n"
        "    OCR_EXTRACTION_LATENCY.labels(tier=_tier).observe(elapsed_ms / 1000.0)\n"
        "    _opus_cost = float(usage_summary.get(\"estimated_cost\", 0) or 0) * 5  # rough Opus multiplier (~5x Sonnet)\n"
        "    _saved = max(0.0, _opus_cost - float(usage_summary.get(\"estimated_cost\", 0) or 0))\n"
        "    if _saved > 0:\n"
        "        OCR_COST_SAVED.inc(_saved)\n"
        "    OCR_TIER_COST.labels(tier=_tier).inc(float(usage_summary.get(\"estimated_cost\", 0) or 0))\n"
        "    metadata.update("
    )
    if old_excel_complete in content:
        content = content.replace(old_excel_complete, new_excel_complete, 1)
        print("3. Wired cost/latency metrics in excel pipeline")
    else:
        print("3. Excel complete target not found!")

    # 4. Wire tier metrics into preview pipeline (after model selection)
    old_preview_metrics = (
        '        "Structured table preview model selected requested_model=%s model=%s quality_score=%s mime=%s size_bytes=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        selected_model,\n"
        "        image_quality_score,\n"
        '        inspection["image_mime_type"],\n'
        '        inspection["size_bytes"],\n'
        "    )\n\n"
        "    # Harden vision payload with resizing\n"
        "    image_base64 = preprocess_image_bytes(image_bytes)"
    )
    new_preview_metrics = (
        '        "Structured table preview model selected requested_model=%s model=%s quality_score=%s mime=%s size_bytes=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        selected_model,\n"
        "        image_quality_score,\n"
        '        inspection["image_mime_type"],\n'
        '        inspection["size_bytes"],\n'
        "    )\n\n"
        "    # Record model tier selection metric\n"
        "    OCR_MODEL_TIER_REQUESTS.labels(tier=model_tier).inc()\n\n"
        "    # Harden vision payload with resizing\n"
        "    image_base64 = preprocess_image_bytes(image_bytes)"
    )
    if old_preview_metrics in content:
        content = content.replace(old_preview_metrics, new_preview_metrics, 1)
        print("4. Wired tier metric in preview pipeline")
    else:
        print("4. Preview metrics target not found!")

    # 5. Wire cost/latency metrics into preview pipeline (after processing, before debug_payload)
    old_preview_complete = (
        '        "Structured table preview completed requested_model=%s model=%s quality_score=%s elapsed_ms=%s rows=%s columns=%s total_tokens=%s estimated_cost=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        used_model,\n"
        "        image_quality_score,\n"
        "        elapsed_ms,\n"
        "        len(rows),\n"
        "        len(headers),\n"
        '        usage_summary.get("total_tokens", 0),\n'
        "        estimated_cost,\n"
        "    )\n"
        "    debug_payload = {"
    )
    new_preview_complete = (
        '        "Structured table preview completed requested_model=%s model=%s quality_score=%s elapsed_ms=%s rows=%s columns=%s total_tokens=%s estimated_cost=%s",\n'
        "        explicit_model or \"auto\",\n"
        "        used_model,\n"
        "        image_quality_score,\n"
        "        elapsed_ms,\n"
        "        len(rows),\n"
        "        len(headers),\n"
        '        usage_summary.get("total_tokens", 0),\n'
        "        estimated_cost,\n"
        "    )\n"
        "    # Record cost and latency metrics\n"
        "    OCR_EXTRACTION_LATENCY.labels(tier=model_tier).observe(elapsed_ms / 1000.0)\n"
        "    if cost_saved_usd > 0:\n"
        "        OCR_COST_SAVED.inc(cost_saved_usd)\n"
        "    OCR_TIER_COST.labels(tier=model_tier).inc(estimated_cost)\n"
        "    debug_payload = {"
    )
    if old_preview_complete in content:
        content = content.replace(old_preview_complete, new_preview_complete, 1)
        print("5. Wired cost/latency metrics in preview pipeline")
    else:
        print("5. Preview complete target not found!")

    # 6. Wire correction pass metrics
    old_correction_success = (
        '                "correction_success",\n'
        '                "usage": usage_summary,\n'
        '                "response": response_debug,\n'
        "            }\n"
        "            )\n"
        '            logger.info(\n'
        '                "[OCR] Correction pass response model=%s input_tokens=%s output_tokens=%s total_tokens=%s estimated_cost=%s",'
    )
    new_correction_success = (
        '                "correction_success",\n'
        '                "usage": usage_summary,\n'
        '                "response": response_debug,\n'
        "            }\n"
        "            )\n"
        "            OCR_CORRECTION_PASSES.labels(status=\"success\").inc()\n"
        '            logger.info(\n'
        '                "[OCR] Correction pass response model=%s input_tokens=%s output_tokens=%s total_tokens=%s estimated_cost=%s",'
    )

    # Find correction failure points
    old_correction_failure_error = (
        '                "status": "correction_error",\n'
        '                "status_code": response.status_code,\n'
        '                "error": error_message,\n'
        "            }\n"
        "            )\n"
        "    except Exception as error:"
    )
    new_correction_failure_error = (
        '                "status": "correction_error",\n'
        '                "status_code": response.status_code,\n'
        '                "error": error_message,\n'
        "            }\n"
        "            )\n"
        "            OCR_CORRECTION_PASSES.labels(status=\"failure\").inc()\n"
        "    except Exception as error:"
    )

    # Also handle the exception case
    old_correction_exception = (
        '                "status": "correction_exception",\n'
        '                "error": str(error),\n'
        "            }\n"
        "        )\n\n"
        "    return None"
    )
    new_correction_exception = (
        '                "status": "correction_exception",\n'
        '                "error": str(error),\n'
        "            }\n"
        "        )\n"
        "        OCR_CORRECTION_PASSES.labels(status=\"failure\").inc()\n\n"
        "    return None"
    )

    # Apply correction pass metrics
    count = 0
    if old_correction_success in content:
        content = content.replace(old_correction_success, new_correction_success, 1)
        count += 1
        print("6a. Wired correction success metric")
    else:
        print("6a. Correction success pattern not found!")
    if old_correction_failure_error in content:
        content = content.replace(old_correction_failure_error, new_correction_failure_error, 1)
        count += 1
        print("6b. Wired correction failure (status error) metric")
    else:
        print("6b. Correction failure (status error) pattern not found!")
    if old_correction_exception in content:
        content = content.replace(old_correction_exception, new_correction_exception, 1)
        count += 1
        print("6c. Wired correction failure (exception) metric")
    else:
        print("6c. Correction exception pattern not found!")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"File saved. {count}/3 correction metrics wired.")


if __name__ == "__main__":
    apply("backend/routers/ocr/_common.py")
