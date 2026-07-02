"""Patch ocr.py to integrate Indian number normalizer into verification export validation."""

from pathlib import Path

path = Path("backend/routers/ocr.py")
content = path.read_text(encoding="utf-8")

changes = 0

# 1. Add import after ocr_normalization block
old_import = """from backend.services.ocr_normalization import (
    build_cell_confidence_matrix as build_heuristic_confidence_matrix,
    normalize_structured_payload,
)
from backend.services.ocr_confidence import calculate_structural_confidence
from backend.tenancy import resolve_factory_id, resolve_org_id"""

new_import = """from backend.services.indian_number_normalizer import parse_indian_number
from backend.services.ocr_normalization import (
    build_cell_confidence_matrix as build_heuristic_confidence_matrix,
    normalize_structured_payload,
)
from backend.services.ocr_confidence import calculate_structural_confidence
from backend.tenancy import resolve_factory_id, resolve_org_id"""

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes += 1
    print("1. Import added OK")
else:
    print("1. Import NOT FOUND - trying alternative approach...")
    # Find the last line of the anthropic_usage import block and insert after it
    marker = "from backend.services.anthropic_usage import ("
    idx = content.find(marker)
    if idx >= 0:
        # Find the closing paren
        close_idx = content.find(")", idx)
        after_close = content.index("\n", close_idx) + 1
        insert_line = "from backend.services.indian_number_normalizer import parse_indian_number\n"
        content = content[:after_close] + insert_line + content[after_close:]
        changes += 1
        print("1. Import added OK (alternative position)")

# 2. Replace ledger section to add balance check
old_ledger_check = """    if is_ledger_like:
        dr_index = next((index for index, header in enumerate(normalized_headers) if header in {"dr", "debit"} or "debit" in header), None)
        cr_index = next((index for index, header in enumerate(normalized_headers) if header in {"cr", "credit"} or "credit" in header), None)
        for row_index, row in enumerate(plain_rows, start=1):
            dr_value = row[dr_index].strip() if dr_index is not None and dr_index < len(row) else ""
            cr_value = row[cr_index].strip() if cr_index is not None and cr_index < len(row) else ""
            if dr_value and cr_value:
                blockers.append(f"Row {row_index} contains both debit and credit values.")
            
            row_text_lower = [str(cell).strip().lower() for cell in row]
            if any(token in {"total", "balance", "sum", "grand total"} for token in row_text_lower):
                if not (dr_value or cr_value):
                    warnings.append(f"Summary row {row_index} ('{row[0] if row else ''}') is missing a numeric total.")"""

new_ledger_check = """    if is_ledger_like:
        dr_index = next((index for index, header in enumerate(normalized_headers) if header in {"dr", "debit"} or "debit" in header), None)
        cr_index = next((index for index, header in enumerate(normalized_headers) if header in {"cr", "credit"} or "credit" in header), None)
        dr_total = 0.0
        cr_total = 0.0
        has_numeric_values = False
        for row_index, row in enumerate(plain_rows, start=1):
            dr_value = row[dr_index].strip() if dr_index is not None and dr_index < len(row) else ""
            cr_value = row[cr_index].strip() if cr_index is not None and cr_index < len(row) else ""
            if dr_value and cr_value:
                blockers.append(f"Row {row_index} contains both debit and credit values.")
            
            dr_parsed = parse_indian_number(dr_value)
            cr_parsed = parse_indian_number(cr_value)
            if dr_parsed is not None:
                dr_total += float(dr_parsed)
                has_numeric_values = True
            if cr_parsed is not None:
                cr_total += float(cr_parsed)
                has_numeric_values = True

            row_text_lower = [str(cell).strip().lower() for cell in row]
            if any(token in {"total", "balance", "sum", "grand total"} for token in row_text_lower):
                if not (dr_value or cr_value):
                    warnings.append(f"Summary row {row_index} ('{row[0] if row else ''}') is missing a numeric total.")
        
        if has_numeric_values and abs(dr_total - cr_total) > 1.0:
            warnings.append(
                f"Ledger does not balance: Dr total (INR {dr_total:,.0f}) vs Cr total (INR {cr_total:,.0f}), "
                f"difference = INR {abs(dr_total - cr_total):,.0f}. Review required."
            )"""

if old_ledger_check in content:
    content = content.replace(old_ledger_check, new_ledger_check, 1)
    changes += 1
    print("2. Ledger balance check added OK")
else:
    print("2. Ledger balance check NOT FOUND")
    # Debug: find 'if is_ledger_like:' and show context
    idx = content.find("if is_ledger_like:")
    if idx >= 0:
        print(f"   Found at position {idx}")
        snippet = content[idx:idx+700]
        print(f"   Snippet repr: {repr(snippet[:300])}")
    else:
        print("   'if is_ledger_like:' not found in file!")

# 3. Replace the impossible totals check parsing
old_totals_check = """                for row in plain_rows:
                    val_str = row[idx].replace(",", "").replace(" ", "").strip()
                    if not val_str: continue
                    if any(kw in str(row).lower() for kw in ("total", "sum", "balance")):
                        try:
                            total_val = float(val_str)
                            has_total = True
                        except ValueError: pass
                    else:
                        try:
                            values.append(float(val_str))
                        except ValueError: pass"""

new_totals_check = """                for row in plain_rows:
                    val_str = str(row[idx]).strip() if row[idx] is not None else ""
                    if not val_str: continue
                    if any(kw in str(row).lower() for kw in ("total", "sum", "balance")):
                        parsed = parse_indian_number(val_str)
                        if parsed is not None:
                            total_val = float(parsed)
                            has_total = True
                    else:
                        parsed = parse_indian_number(val_str)
                        if parsed is not None:
                            values.append(float(parsed))"""

if old_totals_check in content:
    content = content.replace(old_totals_check, new_totals_check, 1)
    changes += 1
    print("3. Impossible totals check updated OK")
else:
    print("3. Impossible totals check NOT FOUND")
    idx = content.find('val_str = row[idx].replace(","')
    if idx >= 0:
        print(f"   Found at position {idx}")
        snippet = content[idx-50:idx+300]
        print(f"   Snippet: {repr(snippet)}")

if changes > 0:
    path.write_text(content, encoding="utf-8")
    print(f"\n✅ {changes} change(s) applied successfully")
else:
    print("\n❌ No changes were applied")
