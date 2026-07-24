"""Fix cost_decision variable scoping in both pipeline functions."""


def apply(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Excel pipeline: add cost_decision = None at start, simplify call site
    old_excel_init = (
        "    explicit_model = _normalize_requested_model(requested_model)\n"
        "    if explicit_model:"
    )
    new_excel_init = (
        "    cost_decision = None\n"
        "    explicit_model = _normalize_requested_model(requested_model)\n"
        "    if explicit_model:"
    )
    if old_excel_init in content:
        content = content.replace(old_excel_init, new_excel_init, 1)
        print("1. Added cost_decision = None to excel pipeline")
    else:
        print("1. Excel init pattern not found")

    # 2. Excel pipeline: simplify needs_correction line
    old_excel_guard = (
        "    needs_correction = cost_decision.get(\"needs_correction_pass\", False) if 'cost_decision' in dir() or 'cost_decision' in locals() and cost_decision else False"
    )
    new_excel_guard = (
        "    needs_correction = bool(cost_decision and cost_decision.get(\"needs_correction_pass\"))"
    )
    if old_excel_guard in content:
        content = content.replace(old_excel_guard, new_excel_guard, 1)
        print("2. Simplified excel needs_correction guard")
    else:
        print("2. Excel guard pattern not found... checking for partial match")
        # Check what the actual line looks like
        idx = content.find("needs_correction = cost_decision.get")
        if idx >= 0:
            print(f"   Found at position {idx}")
            line_end = content.find("\n", idx)
            print(f"   Line: {repr(content[idx:line_end])}")

    # 3. Preview pipeline: simplify needs_correction line
    old_preview_guard = (
        "    needs_correction = cost_decision.get(\"needs_correction_pass\", False) if cost_decision else False"
    )
    new_preview_guard = (
        "    needs_correction = bool(cost_decision and cost_decision.get(\"needs_correction_pass\"))"
    )
    if old_preview_guard in content:
        content = content.replace(old_preview_guard, new_preview_guard, 1)
        print("3. Simplified preview needs_correction guard")
    else:
        print("3. Preview guard pattern not found")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Done")


if __name__ == "__main__":
    apply("backend/routers/ocr/_common.py")
