"""Fix remaining Phase 3 issues: duplicate return, extra blanks, wire needs_correction_pass."""


def apply(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Fix duplicate "return extraction_json"
    old = (
        '    extraction_json["_selected_model"] = selected_model\n'
        "    return extraction_json\n"
        "    return extraction_json\n\n\n"
        "\n"
        "def _run_anthropic_correction_pass("
    )
    new = (
        '    extraction_json["_selected_model"] = selected_model\n'
        "    return extraction_json\n\n\n"
        "def _run_anthropic_correction_pass("
    )
    if old in content:
        content = content.replace(old, new, 1)
        print("1. Fixed duplicate return extraction_json")
    else:
        print("1. Duplicate return pattern not found")

    # 2. Fix extra blank line before _extract_table_excel_scalar
    old = "    return None\n\n\n\n\ndef _extract_table_excel_scalar("
    new = "    return None\n\n\ndef _extract_table_excel_scalar("
    if old in content:
        content = content.replace(old, new, 1)
        print("2. Fixed extra blank lines before _extract_table_excel_scalar")
    else:
        print("2. Pattern not found, trying alternative...")
        alt = "    return None\n\n\n\ndef _extract_table_excel_scalar("
        if alt in content:
            content = content.replace(alt, "    return None\n\n\ndef _extract_table_excel_scalar(", 1)
            print("2. Fixed with alt pattern")
        else:
            print("2. Still not found")

    # 3. Wire needs_correction_pass into excel pipeline call
    old_excel_call = (
        "    extracted_json = _call_table_excel_anthropic(\n"
        "        image_base64,\n"
        '        image_mime_type="image/jpeg", # preprocess_image_bytes always returns JPEG\n'
        "        selected_model=selected_model,\n"
        "        requested_model=requested_model,\n"
        "        system_prompt=system_prompt,\n"
        "        user_message=user_message,\n"
        "    )"
    )
    new_excel_call = (
        "    needs_correction = cost_decision.get(\"needs_correction_pass\", False) if 'cost_decision' in dir() or 'cost_decision' in locals() and cost_decision else False\n"
        "    extracted_json = _call_table_excel_anthropic(\n"
        "        image_base64,\n"
        '        image_mime_type="image/jpeg", # preprocess_image_bytes always returns JPEG\n'
        "        selected_model=selected_model,\n"
        "        requested_model=requested_model,\n"
        "        system_prompt=system_prompt,\n"
        "        user_message=user_message,\n"
        "        needs_correction_pass=needs_correction,\n"
        "    )"
    )
    if old_excel_call in content:
        content = content.replace(old_excel_call, new_excel_call, 1)
        print("3. Wired needs_correction_pass in excel pipeline")
    else:
        print("3. Excel call pattern not found")

    # 4. Wire needs_correction_pass into preview pipeline call
    old_preview_call = (
        "    extracted_json = _call_table_excel_anthropic(\n"
        "        image_base64,\n"
        '        image_mime_type="image/jpeg", # preprocess_image_bytes always returns JPEG\n'
        "        selected_model=selected_model,\n"
        "        requested_model=requested_model or force_model,\n"
        "        system_prompt=None,\n"
        "        user_message=None,\n"
        "    )"
    )
    new_preview_call = (
        "    needs_correction = cost_decision.get(\"needs_correction_pass\", False) if cost_decision else False\n"
        "    extracted_json = _call_table_excel_anthropic(\n"
        "        image_base64,\n"
        '        image_mime_type="image/jpeg", # preprocess_image_bytes always returns JPEG\n'
        "        selected_model=selected_model,\n"
        "        requested_model=requested_model or force_model,\n"
        "        system_prompt=None,\n"
        "        user_message=None,\n"
        "        needs_correction_pass=needs_correction,\n"
        "    )"
    )
    if old_preview_call in content:
        content = content.replace(old_preview_call, new_preview_call, 1)
        print("4. Wired needs_correction_pass in preview pipeline")
    else:
        print("4. Preview call pattern not found")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("File saved")


if __name__ == "__main__":
    apply("backend/routers/ocr/_common.py")
