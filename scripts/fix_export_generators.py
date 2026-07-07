"""Clean up ocr_document_types/__init__.py: remove mock generator definitions and
properly wire real generators from excel_export_engine and pdf_export_engine.
"""

import sys
from pathlib import Path


def fix_file(root: str) -> list[str]:
    root_path = Path(root)
    init_file = root_path / "backend" / "services" / "ocr_document_types" / "__init__.py"
    if not init_file.exists():
        return [f"ERROR: {init_file} not found"]

    content = init_file.read_text("utf-8")
    changes = []

    # Step 1: Remove the old scraper-inserted import block (the one with _real_ prefixes from imports)
    # Find and remove the import block we just added
    old_block_start = content.find("from backend.services.excel_export_engine import (")
    if old_block_start >= 0:
        block_end = content.find("\n\n", old_block_start)
        if block_end < 0:
            block_end = content.find("\n#", old_block_start)
        if block_end < 0:
            block_end = len(content)
        # Extend to include the pdf import block too
        content = content[:old_block_start] + content[block_end:]
        changes.append("Removed duplicate import block")

    # Step 2: Find and remove all _real_* function definitions (the renamed mocks)
    # These are functions like: def _real_invoice_excel(data: dict) -> bytes:
    import re
    
    # Remove def _real_* functions - each starts with "def _real_" and ends at the next "def " or end of file
    pattern = re.compile(r'\n+def _real_\w+\(data: dict\) -> bytes:.*?(?=\n\n\n# ===|def |\Z)', re.DOTALL)
    content = pattern.sub('\n', content)
    changes.append("Removed stale _real_* function definitions")

    # Clean up extra blank lines
    content = re.sub(r'\n{4,}', '\n\n\n', content)

    # Step 3: Replace _real_* references in ExportFormat registrations with real generator references
    # Map of old mock function names to new real generators
    # The _real_* functions are referenced in export_formats=[ExportFormat(... generator=...)]
    real_generators = {
        "_real_invoice_excel": "_real_invoice_excel",
        "_real_po_excel": "_real_po_excel",
        "_real_dn_excel": "_real_dn_excel",
        "_real_wb_excel": "_real_wb_excel",
        "_real_ledger_excel": "_real_ledger_excel",
        "_real_kv_excel": "_real_kv_excel",
        "_real_chat_excel": "_real_chat_excel",
        "_real_generic_excel": "_real_generic_excel",
        "_real_invoice_pdf": "_real_invoice_pdf",
        "_real_po_pdf": "_real_po_pdf",
        "_real_dn_pdf": "_real_dn_pdf",
        "_real_wb_pdf": "_real_wb_pdf",
        "_real_ledger_pdf": "_real_ledger_pdf",
        "_real_kv_pdf": "_real_kv_pdf",
        "_real_chat_pdf": "_real_chat_pdf",
        "_real_generic_pdf": "_real_generic_pdf",
    }
    # Since the functions were renamed, the references in export_formats still point to _real_* names
    # We need to update the import to match

    # Step 4: Add proper import block at the top of the file after existing imports
    import_block = """from backend.services.excel_export_engine import (
    _generate_invoice_excel as _real_invoice_excel,
    _generate_po_excel as _real_po_excel,
    _generate_dn_excel as _real_dn_excel,
    _generate_wb_excel as _real_wb_excel,
    _generate_ledger_excel as _real_ledger_excel,
    _generate_kv_excel as _real_kv_excel,
    _generate_chat_excel as _real_chat_excel,
    _generate_generic_excel as _real_generic_excel,
)
from backend.services.pdf_export_engine import (
    _generate_invoice_pdf as _real_invoice_pdf,
    _generate_po_pdf as _real_po_pdf,
    _generate_dn_pdf as _real_dn_pdf,
    _generate_wb_pdf as _real_wb_pdf,
    _generate_ledger_pdf as _real_ledger_pdf,
    _generate_kv_pdf as _real_kv_pdf,
    _generate_chat_pdf as _real_chat_pdf,
    _generate_generic_pdf as _real_generic_pdf,
)
"""

    # Find where to insert - after the last import line and before the mock generators section
    insert_marker = "from backend.services.ocr_document_registry import"
    insert_pos = content.find(insert_marker)
    if insert_pos >= 0:
        # Find the end of this import line
        line_end = content.find("\n", insert_pos)
        # Find next blank line (end of import section)
        next_blank = content.find("\n\n\n", line_end)
        if next_blank < 0:
            next_blank = content.find("\n\n# Mock", line_end)
        if next_blank < 0:
            next_blank = line_end + 1
        content = content[:next_blank] + "\n" + import_block + content[next_blank:]
        changes.append("Added proper real generator imports")

    init_file.write_text(content, "utf-8")
    return changes


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    changes = fix_file(root)
    for c in changes:
        print(f"- {c}")
    print(f"\n{len(changes)} changes applied.")
