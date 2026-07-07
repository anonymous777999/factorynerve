"""Phase 4 final fixes - without emoji to avoid cp1252 issues."""
import sys
sys.stdout.reconfigure(encoding='utf-8')  # type: ignore[attr-defined]

with open('backend/routers/ocr/_common.py', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# Fix 1: Excel pipeline cost saved
old_cost_calc = '    # Record cost and latency metrics\n    OCR_EXTRACTION_LATENCY.labels(tier=_tier).observe(elapsed_ms / 1000.0)\n    _opus_cost = float(usage_summary.get("estimated_cost", 0) or 0) * 5  # rough Opus multiplier (~5x Sonnet)\n    _saved = max(0.0, _opus_cost - float(usage_summary.get("estimated_cost", 0) or 0))\n    if _saved > 0:\n        OCR_COST_SAVED.inc(_saved)'
new_cost_calc = '    # Record cost and latency metrics\n    OCR_EXTRACTION_LATENCY.labels(tier=_tier).observe(elapsed_ms / 1000.0)\n    _opus_cost_for_metrics = calculate_anthropic_cost(\n        _TABLE_EXCEL_MODEL_OPUS,\n        input_tokens=int(usage_summary.get("input_tokens", 0) or 0),\n        output_tokens=int(usage_summary.get("output_tokens", 0) or 0),\n    )\n    _opus_est = float(_opus_cost_for_metrics.get("estimated_cost", 0) or 0)\n    _actual = float(usage_summary.get("estimated_cost", 0) or 0)\n    _saved = max(0.0, _opus_est - _actual)\n    if _saved > 0:\n        OCR_COST_SAVED.inc(_saved)'

if old_cost_calc in content:
    content = content.replace(old_cost_calc, new_cost_calc, 1)
    print('1. OK - Excel pipeline cost saved fixed (*5 -> calculate_anthropic_cost)')
    changes += 1
else:
    print('1. NOT FOUND - Excel pipeline cost saved pattern')

# Fix 2: Add success metric after correction_success
old_success = '                    "usage": usage_summary,\n                    "response": response_debug,\n                }\n            )\n            logger.info(\n                "[OCR] Correction pass response model=%s'
new_success = '                    "usage": usage_summary,\n                    "response": response_debug,\n                }\n            )\n            OCR_CORRECTION_PASSES.labels(status="success").inc()\n            logger.info(\n                "[OCR] Correction pass response model=%s'

if old_success in content:
    content = content.replace(old_success, new_success, 1)
    print('2. OK - Correction pass success metric added')
    changes += 1
else:
    # Try without the trailing %s
    alt_success = '                    "usage": usage_summary,\n                    "response": response_debug,\n                }\n            )\n            logger.info(\n                "[OCR] Correction pass response'
    if alt_success in content:
        alt_new = '                    "usage": usage_summary,\n                    "response": response_debug,\n                }\n            )\n            OCR_CORRECTION_PASSES.labels(status="success").inc()\n            logger.info(\n                "[OCR] Correction pass response'
        content = content.replace(alt_success, alt_new, 1)
        print('2. OK - Correction pass success metric added (alt pattern)')
        changes += 1
    else:
        print('2. NOT FOUND - Correction success pattern')

# Fix 3: Add HTTP-error failure metric after correction_error
old_failure = '                    "status_code": response.status_code,\n                    "error": error_message,\n                }\n            )\n    except Exception as error:'
new_failure = '                    "status_code": response.status_code,\n                    "error": error_message,\n                }\n            )\n            OCR_CORRECTION_PASSES.labels(status="failure").inc()\n    except Exception as error:'

if old_failure in content:
    content = content.replace(old_failure, new_failure, 1)
    print('3. OK - Correction pass HTTP-error failure metric added')
    changes += 1
else:
    print('3. NOT FOUND - Correction error pattern')

# Fix 4: Remove duplicate return extraction_json
old_dup = '    return extraction_json\n    return extraction_json'
if old_dup in content:
    content = content.replace(old_dup, '    return extraction_json', 1)
    print('4. OK - Removed duplicate return extraction_json')
    changes += 1
else:
    print('4. NOT FOUND - Duplicate return (may already be fixed)')

if changes > 0:
    with open('backend/routers/ocr/_common.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('\n=> %d fix(es) applied' % changes)
else:
    print('\n=> No changes applied')
