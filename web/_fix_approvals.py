"""Fix approvals-page.tsx: replace inline status badge functions with centralized utility."""
import os

path = os.path.join(os.getcwd(), "src/components/approvals-page.tsx")
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# 1. Add imports after cn import
content = content.replace(
    'import { cn } from "@/lib/utils";',
    'import { cn } from "@/lib/utils";\nimport { badgeClass, textClass } from "@/lib/status-badge-classes";\nimport type { StatusTone } from "@/lib/status-badge-classes";'
)

# 2. Replace severityClasses
old_severity = """function severityClasses(severity: ReviewSeverity) {
  switch (severity) {
    case "critical":
      return "border-status-danger-border bg-status-danger-bg text-status-danger-fg shadow-md";
    case "high":
      return "border-status-warning-border bg-status-warning-bg text-status-warning-fg shadow-sm";
    case "warning":
      return "border-status-warning-border bg-status-warning-bg text-status-warning-fg shadow-sm";
    default:
      return "border-status-success-border bg-status-success-bg text-status-success-fg shadow-sm";
  }
}"""

new_severity = """function severityClasses(severity: ReviewSeverity) {
  const t: StatusTone = severity === "critical" ? "danger" : "warning";
  return `${badgeClass(t)} ${severity === "critical" ? "shadow-md" : "shadow-sm"}`;
}"""
content = content.replace(old_severity, new_severity)

# 3. Replace typeClasses
old_type = """function typeClasses(kind: TaskKind | SignalKind) {
  switch (kind) {
    case "attendance":
      return "border-status-info-border bg-status-info-bg text-status-info-fg shadow-sm";
    case "entry":
      return "border-status-info-border bg-status-info-bg text-status-info-fg shadow-sm";
    case "ocr":
      return "border-status-processing-border bg-status-processing-bg text-status-processing-fg shadow-sm";
    case "reconciliation":
      return "border-status-processing-border bg-status-processing-bg text-status-processing-fg shadow-sm";
    case "batch":
      return "border-status-warning-border bg-status-warning-bg text-status-warning-fg shadow-sm";
    default:
      return "border-status-warning-border bg-status-warning-bg text-status-warning-fg shadow-sm";
  }
}"""

new_type = """function typeClasses(kind: TaskKind | SignalKind) {
  switch (kind) {
    case "attendance":
    case "entry":
      return `${badgeClass("info")} shadow-sm`;
    case "ocr":
    case "reconciliation":
      return "border-status-processing-border bg-status-processing-bg text-status-processing-fg shadow-sm";
    case "batch":
    default:
      return `${badgeClass("warning")} shadow-sm`;
  }
}"""
content = content.replace(old_type, new_type)

# 4. Replace ageClasses
old_age = """function ageClasses(ageBand: AgeBand) {
  switch (ageBand) {
    case "stale":
      return "text-status-danger-fg";
    case "aging":
      return "text-status-warning-fg";
    default:
      return "text-status-success-fg";
  }
}"""

new_age = """function ageClasses(ageBand: AgeBand) {
  const t: StatusTone = ageBand === "stale" ? "danger" : ageBand === "aging" ? "warning" : "success";
  return textClass(t);
}"""
content = content.replace(old_age, new_age)

if content != original:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: approvals-page.tsx updated")
else:
    print("NO CHANGES: approvals-page.tsx unchanged")
