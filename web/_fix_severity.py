"""Fix severityClasses in approvals-page.tsx: restore info->success mapping."""
import os

path = os.path.join(os.getcwd(), "src/components/approvals-page.tsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

original = content

old = '  const t: StatusTone = severity === "critical" ? "danger" : "warning";'
new = '  const t: StatusTone = severity === "critical" ? "danger" : severity === "info" ? "success" : "warning";'
content = content.replace(old, new)

if content != original:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: severityClasses mapping fixed")
else:
    print("NO CHANGE: pattern not found")
