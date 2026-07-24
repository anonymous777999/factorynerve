"""Remove duplicate `def _real_*` function definitions from ocr_document_types/__init__.py
that conflict with imports from excel_export_engine and pdf_export_engine.
"""
import sys
import re
from pathlib import Path


def cleanup(root: str) -> list[str]:
    root_path = Path(root)
    init_file = root_path / "backend" / "services" / "ocr_document_types" / "__init__.py"
    if not init_file.exists():
        return [f"ERROR: {init_file} not found"]

    content = init_file.read_text("utf-8")
    changes = []

    # The issue: there are function definitions like:
    #   def _real_invoice_excel(data: dict) -> bytes:
    #       ...
    #       return b"Mock ..."
    # These need to be REMOVED because _real_invoice_excel is now imported.
    # Also the "# Mock export generators and downstream handlers" section header.

    # Strategy: remove every block starting with "def _real_" and ending at
    # the next "def " or section header, or end of content.
    # We'll do this iteratively since the functions are scattered.

    # First, remove the section header comment
    old_comment = "# Mock export generators and downstream handlers"
    if old_comment in content:
        # Find the line containing this and remove from there up to next section
        idx = content.find(old_comment)
        end_of_block = content.find("\n\n\n# ===", idx)
        if end_of_block < 0:
            end_of_block = content.find("\n\n# ===", idx)
        if end_of_block < 0:
            # Just remove the comment line
            line_end = content.find("\n", idx)
            line_end2 = content.find("\n", line_end + 1)
            if line_end2 > idx:
                content = content[:idx] + content[line_end2:]
                changes.append("Removed '# Mock export generators...' section header")
            else:
                content = content[:idx] + content[line_end:]
                changes.append("Removed '# Mock export generators...' comment")
        else:
            content = content[:idx] + content[end_of_block:]
            changes.append("Removed mock generators section (2)")

    # Now remove all "def _real_*(...) -> bytes:" blocks
    pattern = re.compile(
        r'\n\s*def _real_\w+\(data: dict\) -> bytes:.*?(?=\n\s*def |\n\s*async def |\n\n\n# ===|\n\n# ===|\Z)',
        re.DOTALL
    )

    count = 0
    while True:
        match = pattern.search(content)
        if not match:
            break
        # Remove the function body
        content = content[:match.start()] + content[match.end():]
        count += 1

    if count > 0:
        changes.append(f"Removed {count} duplicate def _real_* function definitions")

    # Clean up excessive blank lines
    content = re.sub(r'\n{4,}', '\n\n\n', content)

    # Also remove any "TODO: Replace with actual" comments inside the remaining functions
    # that are no longer relevant (the ones from JSON generators etc.)
    # Actually, let's leave those since the JSON generators are still stubs.

    init_file.write_text(content, "utf-8")
    return changes


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    changes = cleanup(root)
    for c in changes:
        print(f"  - {c}")
    print(f"\n{len(changes)} changes applied.")
