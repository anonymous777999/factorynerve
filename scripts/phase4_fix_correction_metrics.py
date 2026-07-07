"""Fix missing correction pass success/failure metrics."""
import re


def apply(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add success metric after 'correction_success' model_attempts entry
    old_success = (
        '                "response": response_debug,\n'
        "            }\n"
        "            )\n"
        '            logger.info(\n'
        '                "[OCR] Correction pass response model=%s input_tokens=%s output_tokens=%s total_tokens=%s estimated_cost=%s",'
    )
    new_success = (
        '                "response": response_debug,\n'
        "            }\n"
        "            )\n"
        "            OCR_CORRECTION_PASSES.labels(status=\"success\").inc()\n"
        '            logger.info(\n'
        '                "[OCR] Correction pass response model=%s input_tokens=%s output_tokens=%s total_tokens=%s estimated_cost=%s",'
    )
    if old_success in content:
        content = content.replace(old_success, new_success, 1)
        print("1. Added correction success metric")
    else:
        print("1. Success pattern not found!")

    # 2. Add failure metric after 'correction_error' model_attempts entry 
    old_failure = (
        '                "error": error_message,\n'
        "            }\n"
        "            )\n"
        "    except Exception as error:"
    )
    new_failure = (
        '                "error": error_message,\n'
        "            }\n"
        "            )\n"
        "            OCR_CORRECTION_PASSES.labels(status=\"failure\").inc()\n"
        "    except Exception as error:"
    )
    if old_failure in content:
        content = content.replace(old_failure, new_failure, 1)
        print("2. Added correction failure (status error) metric")
    else:
        print("2. Failure pattern not found!")
        # Try the version with OCR_CORRECTION_PASSES already there
        alt = (
            '                "error": error_message,\n'
            "            }\n"
            "            )\n"
            "            OCR_CORRECTION_PASSES.labels(status=\"failure\").inc()\n"
            "    except Exception as error:"
        )
        if alt in content:
            print("   (already present)")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Done")


if __name__ == "__main__":
    apply("backend/routers/ocr/_common.py")
