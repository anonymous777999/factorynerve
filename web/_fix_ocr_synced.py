"""Replace synced inline string in ocr-scan-page.tsx with badgeClass call."""
import os

path = os.path.join(os.getcwd(), "src/components/ocr-scan-page.tsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 1. Add import after @/lib/auth
content = content.replace(
    'import { warmBackendConnection } from "@/lib/auth";',
    'import { warmBackendConnection } from "@/lib/auth";\nimport { badgeClass } from "@/lib/status-badge-classes";'
)

# 2. Replace inline synced badge string
content = content.replace(
    ': "border-status-synced-border bg-status-synced-bg text-status-synced-fg",',
    ': badgeClass("synced"),',
)

if content != original:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: ocr-scan-page.tsx updated")
else:
    print("NO CHANGES: ocr-scan-page.tsx unchanged")
