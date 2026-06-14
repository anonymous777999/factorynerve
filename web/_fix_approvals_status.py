"""Replace inline status class strings with badgeClass()/toneClass() calls in approvals-page.tsx."""
import re

path = 'src/components/approvals-page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # 1. SummaryMetric tone props
    ('tone="border-status-danger-border bg-status-danger-bg text-status-danger-fg"', 'tone={badgeClass("danger")}'),
    ('tone="border-status-info-border bg-status-info-bg text-status-info-fg"', 'tone={badgeClass("info")}'),
    ('tone="border-status-warning-border bg-status-warning-bg text-status-warning-fg"', 'tone={badgeClass("warning")}'),
    ('tone="border-status-success-border bg-status-success-bg text-status-success-fg"', 'tone={badgeClass("success")}'),
    
    # 2. QueueStatPill tone props
    ('tone="border-status-danger-border bg-status-danger-bg text-status-danger-fg"', 'tone={badgeClass("danger")}'),
    ('tone="border-status-info-border bg-status-info-bg text-status-info-fg"', 'tone={badgeClass("info")}'),
    ('tone="border-status-warning-border bg-status-warning-bg text-status-warning-fg"', 'tone={badgeClass("warning")}'),
    ('tone="border-status-success-border bg-status-success-bg text-status-success-fg"', 'tone={badgeClass("success")}'),
    
    # 3. Inline span badges with shadow
    ('className="rounded-full border border-status-danger-border bg-status-danger-bg px-3 py-1 text-status-danger-fg shadow-md"',
     'className={`rounded-full border ${badgeClass("danger")} px-3 py-1 shadow-md`}'),
    ('className="rounded-full border border-status-warning-border bg-status-warning-bg px-3 py-1 text-status-warning-fg shadow-sm"',
     'className={`rounded-full border ${badgeClass("warning")} px-3 py-1 shadow-sm`}'),
    ('className="rounded-full border border-status-danger-border bg-status-danger-bg px-3 py-1 text-status-danger-fg"',
     'className={`rounded-full border ${badgeClass("danger")} px-3 py-1`}'),
    ('className="rounded-full border border-status-warning-border bg-status-warning-bg px-3 py-1 text-status-warning-fg shadow-sm"',
     'className={`rounded-full border ${badgeClass("warning")} px-3 py-1 shadow-sm`}'),
    
    # 4. Inline div sections with tone backgrounds
    ('className="rounded-overlay border border-status-warning-border bg-status-warning-bg p-4"',
     'className={`rounded-overlay border ${toneClass("warning")} p-4`}'),
    ('className="rounded-overlay border border-status-danger-border bg-[rgba(239,68,68,0.1)] p-4"',
     'className="rounded-overlay border border-status-danger-border bg-[rgba(239,68,68,0.1)] p-4"'),  # custom bg, keep as-is
    
    # 5. Inline status badges in the "Restricted" area and QueueStatPill default tones
    ('tone="border-status-danger-border bg-status-danger-bg text-status-danger-fg"', 'tone={badgeClass("danger")}'),
    
    # 6. Detail panel restricted warning box
    ('className="rounded-overlay border border-status-warning-border bg-status-warning-bg px-4 py-4"',
     'className={`rounded-overlay border ${badgeClass("warning")} px-4 py-4`}'),
]

# Add import for toneClass if not present
has_tone_import = 'toneClass' in content
has_badge_import = 'badgeClass' in content

if 'toneClass' not in content.split('from "@/lib/status-badge-classes"')[0].split('from "@\/lib\/status-badge-classes"')[0]:
    # Add toneClass to the existing import line
    content = content.replace(
        'import { badgeClass, textClass } from "@/lib/status-badge-classes"',
        'import { badgeClass, textClass, toneClass } from "@/lib/status-badge-classes"',
    )

# Track which replacements were applied
applied = 0
skipped = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        applied += 1
    else:
        skipped += 1

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Applied: {applied}, Skipped: {skipped}')
