"""Remove the unused `from backend.database import get_db` import from _common.py."""
import sys
from pathlib import Path

root = sys.argv[1] if len(sys.argv) > 1 else "."
filepath = Path(root) / "backend" / "routers" / "ocr" / "_common.py"
content = filepath.read_text("utf-8")
content = content.replace(
    "from backend.services.pdf_export_engine import generate_pdf_export\nfrom backend.database import get_db\n",
    "from backend.services.pdf_export_engine import generate_pdf_export\n",
)
filepath.write_text(content, "utf-8")
print("Fixed dead import in _common.py")
