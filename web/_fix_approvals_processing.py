"""Replace processing inline strings in approvals-page.tsx with centralized utility calls."""
import os

path = os.path.join(os.getcwd(), "src/components/approvals-page.tsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 1. Update typeClasses to use badgeClass("processing")
old_type = """    case "ocr":
    case "reconciliation":
      return "border-status-processing-border bg-status-processing-bg text-status-processing-fg shadow-sm";"""

new_type = """    case "ocr":
    case "reconciliation":
      return `${badgeClass("processing")} shadow-sm`;"""
content = content.replace(old_type, new_type)

# 2. Replace 6 inline processing QueueStatPill / SummaryMetric tones
# Pattern: tone="border-status-processing-border bg-status-processing-bg text-status-processing-fg"
# These are used in QueueStatPill and SummaryMetric components

old_pill = 'tone="border-status-processing-border bg-status-processing-bg text-status-processing-fg"'
new_pill = 'tone={badgeClass("processing")}'
count_pill = content.count(old_pill)
content = content.replace(old_pill, new_pill)

# 3. Also check for the standalone processing text in SummaryMetric helper
# SummaryMetric uses tone as a className prop directly
# Already handled above since it uses the same pattern

if content != original:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"SUCCESS: approvals-page.tsx updated — {count_pill} pill tones replaced")
else:
    print("NO CHANGES: approvals-page.tsx unchanged")
