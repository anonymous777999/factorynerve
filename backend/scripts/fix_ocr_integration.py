"""Fix OCR integration - add preprocessing import and call to document pipeline."""
import re
import ast

def main():
    # Step 1: Add import to ocr_document_pipeline.py
    with open("backend/services/ocr_document_pipeline.py", "r") as f:
        content = f.read()

    import_line = "from backend.services.ocr_image_preprocessing import preprocess_image, preprocess_image_metadata"
    if import_line not in content:
        # Find last existing backend import
        pattern = re.compile(r"^from backend\.\S+ import \S+$", re.MULTILINE)
        matches = list(pattern.finditer(content))
        if matches:
            last = matches[-1]
            pos = last.end()
            insert_at = content.index("\n", pos) + 1
            content = content[:insert_at] + import_line + "\n" + content[insert_at:]
            print("ADDED: preprocessing import")
    else:
        print("SKIP: import already exists")

    # Step 2: Add preprocessing call in build_structured_ocr_result
    marker = "    pipeline_metadata = PipelineMetadata(tesseract_fallback_used=fallback_used)"
    code_to_add = (
        "    # Preprocess image for better OCR on factory documents (P0-1)\n"
        "    try:\n"
        "        preprocessed = preprocess_image(image_bytes)\n"
        "        if preprocessed is not None and preprocessed != image_bytes:\n"
        "            image_bytes = preprocessed\n"
        "            pipeline_metadata.preprocessing_applied = True\n"
        "    except Exception:\n"
        "        pipeline_metadata.preprocessing_applied = False\n"
        "\n"
    )
    if marker in content and "preprocess_image(image_bytes)" not in content:
        content = content.replace(marker, code_to_add + marker, 1)
        print("ADDED: preprocessing call")
    elif "preprocess_image(image_bytes)" in content:
        print("SKIP: preprocessing call already exists")
    else:
        print("WARN: marker not found trying alt...")
        alt_marker = "PipelineMetadata(tesseract_fallback_used=fallback_used)"
        if alt_marker in content:
            idx = content.find(alt_marker)
            line_start = content.rfind("\n", 0, idx) + 1
            indent = content[line_start:idx]
            code_alt = (
                "    # Preprocess image for better OCR on factory documents (P0-1)\n"
                "    try:\n"
                "        preprocessed = preprocess_image(image_bytes)\n"
                "        if preprocessed is not None and preprocessed != image_bytes:\n"
                "            image_bytes = preprocessed\n"
                "            pipeline_metadata.preprocessing_applied = True\n"
                "    except Exception:\n"
                "        pipeline_metadata.preprocessing_applied = False\n\n"
                + indent
            )
            content = content[:line_start] + code_alt + content[line_start:]
            print("ADDED: preprocessing call via alt marker")

    with open("backend/services/ocr_document_pipeline.py", "w") as f:
        f.write(content)

    # Step 3: Verify syntax
    for path in ["backend/services/ocr_document_pipeline.py"]:
        with open(path, "r") as f:
            try:
                ast.parse(f.read())
                print(f"OK: {path}")
            except SyntaxError as e:
                print(f"ERROR: {path}: {e}")

    # Step 4: Verify
    with open("backend/services/ocr_document_pipeline.py", "r") as f:
        content = f.read()
    print(f"\nImport present: {'from backend.services.ocr_image_preprocessing import' in content}")
    print(f"Call present: {'preprocess_image(image_bytes)' in content}")


if __name__ == "__main__":
    main()
