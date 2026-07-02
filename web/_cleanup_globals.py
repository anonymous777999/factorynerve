#!/usr/bin/env python3
"""Clean up globals.css: remove old token redefinitions that override Iron & Teal tokens."""
import re

with open("web/src/app/globals.css", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the massive :root block with a minimal version
old_root = '''/* ============================================================
   DESIGN TOKENS
   ============================================================ */

:root {
  /* --- Font families — IBM Plex (profile mock) with Inter fallback --- */
  --font-body: var(--font-plex-sans, var(--font-inter)), system-ui, -apple-system, sans-serif;
  --font-display: var(--font-plex-sans, var(--font-inter)), system-ui, -apple-system, sans-serif;

  /* --- Primary color scale (not in tokens.css — globals-specific) --- */
  --color-primary: #3b82f6;
  --color-primary-50: #eef7ff;
  --color-primary-100: #dbeaf8;
  --color-primary-700: #1d4ed8;
  --color-primary-900: #1e40af;

  /* --- Secondary color scale (not in tokens.css — globals-specific) --- */
  --color-secondary: #a78bfa;
  --color-secondary-50: #ecfdf8;
  --color-secondary-700: #7c3aed;
  --color-secondary-900: #5b21b6;

  /* --- Status color scales (not in tokens.css — globals-specific flat values) --- */
  --color-success: #22c55e;
  --color-success-50: #f0fdf4;
  --color-success-700: #15803d;

  --color-warning: #f59e0b;
  --color-warning-50: #fffbeb;
  --color-warning-700: #b45309;

  --color-danger: #ef4444;
  --color-danger-50: #fef2f2;
  --color-danger-700: #b91c1c;

  --color-info: #06b6d4;
  --color-info-50: #f0f9ff;
  --color-info-700: #0891b2;

  /* --- Legacy surfaces — aligned to factorynerve-profile.html / tokens.css --- */
  --bg: #0f1117;
  --bg-soft: #13151e;
  --bg-secondary: #161a24;
  --bg-tertiary: #181c28;
  --card: #181c28;
  --card-strong: #1c2030;
  --card-elevated: #222838;
  --card-ghost: rgba(15, 17, 23, 0.72);
  --card-glow: rgba(61, 127, 255, 0.08);

  /* --- Text muted --- */
  --text-muted: #6b7494;

  /* --- Border — profile mock --- */
  --border: #252a3a;
  --divider: #1f2433;

  /* --- Shadow 2xl (tokens.css has xs/sm/md/lg/xl — only 2xl is globals-specific) --- */
  --shadow-2xl: 0 42px 90px rgba(3, 8, 18, 0.34);

  /* --- Modern glow effects for premium feel --- */
  --glow-primary: 0 0 20px rgba(59, 130, 246, 0.3);
  --glow-success: 0 0 20px rgba(34, 197, 94, 0.3);
  --glow-warning: 0 0 20px rgba(245, 158, 11, 0.3);
  --glow-danger: 0 0 20px rgba(239, 68, 68, 0.3);
  --glow-subtle: 0 0 40px rgba(59, 130, 246, 0.08);

  /* --- Glassmorphism effects --- */
  --glass-bg: rgba(24, 28, 40, 0.7);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: blur(12px);

  /* --- Modern gradients --- */
  --gradient-primary: linear-gradient(135deg, var(--action-primary) 0%, #1d4ed8 100%);
  --gradient-success: linear-gradient(135deg, var(--status-success-fg) 0%, #15803d 100%);
  --gradient-surface: linear-gradient(180deg, var(--surface-card) 0%, var(--surface-panel) 100%);
  --gradient-subtle: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);

  /* SINGLE ACCENT — never use #6366f1 or #3EA6FF directly */
  --accent: var(--action-primary);
  --accent-strong: var(--action-primary-active);
  --accent-soft: color-mix(in srgb, var(--action-primary) 18%, transparent);
  --accent-quiet: color-mix(in srgb, var(--action-primary) 10%, transparent);

  /* --- Interaction timing tokens (Sprint 2) --- */
  --transition-fast: 80ms;
  --transition-standard: 120ms;
  --transition-expand: 150ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  /* --- Accessibility tokens (Sprint 2) --- */
  --focus-ring-offset: 2px;
  --focus-ring-width: 2px;
  --min-touch-target: 44px;
  /* Contrast ratio references (WCAG 2.1 AA):
     - Body text (<18pt): 4.5:1 minimum
     - Large text (>=18pt or >=14pt bold): 3:1 minimum
     - UI components: 3:1 minimum */

  /* --- Density mode tokens (Sprint 2) --- */
  /* Default density */
  --density-default-row-height: 40px;
  --density-default-cell-padding-x: 12px;
  --density-default-cell-padding-y: 8px;
  /* Compact density */
  --density-compact-row-height: 36px;
  --density-compact-cell-padding-x: 8px;
  --density-compact-cell-padding-y: 6px;
  /* Comfortable density */
  --density-comfortable-row-height: 48px;
  --density-comfortable-cell-padding-x: 16px;
  --density-comfortable-cell-padding-y: 12px;

  /* --- AI processing state tokens (Sprint 2) --- */
  --ai-processing-bg: rgba(99, 102, 241, 0.08);
  --ai-processing-fg: #4338ca;
  --ai-processing-border: rgba(99, 102, 241, 0.2);
  /* Confidence levels */
  --confidence-high-fg: #137a39;
  --confidence-medium-fg: #a8490a;
  --confidence-low-fg: #4b5563;

  /* --- Feedback timing tokens (Sprint 2) --- */
  --feedback-instant: 100ms;
  --feedback-success-duration: 3000ms;
  --feedback-error-duration: 5000ms;
  --spinner-color: #4338ca;

  /* --- Operational signals (not in tokens.css) --- */
  --signal: #1f8a78;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;

  /* --- Legacy aliases — backward compatibility for components using old var names --- */
  --text: var(--text-primary);
  --muted: var(--text-muted);

  /*
   * REMOVED — defined in tokens.css (tokens.css wins):
   *   --text-primary, --text-secondary, --text-tertiary
   *   --border-strong
   *   --shadow-xs, --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
   *   --space-1 … --space-6
   *   --scrollbar-track, --scrollbar-thumb, --scrollbar-thumb-hover
   */
}'''

new_root = '''/* ============================================================
   DESIGN TOKENS
   All design tokens are now defined in ../styles/tokens.css.
   The compatibility aliases section in tokens.css ensures all old
   token names (--surface-app, --action-primary, --status-*, etc.)
   resolve correctly to the Iron & Teal palette.
   ============================================================ */

:root {
  /* Font family aliases — used by body, headings, and component CSS rules */
  --font-body: var(--font-sans);
  --font-display: var(--font-sans);

  /* Transition duration shorthands — used by component CSS rules */
  --transition-fast: 80ms;
  --transition-standard: 120ms;
  --transition-expand: 150ms;

  /* Shadow 2xl — not defined in tokens.css */
  --shadow-2xl: 0 42px 90px rgba(17, 23, 20, 0.20);
}'''

if old_root in content:
    content = content.replace(old_root, new_root)
    print("OK: Replaced :root block")
else:
    print("WARN: Could not find exact :root block match, trying fuzzy approach")
    # Try to find and replace just the token definitions
    # Find the :root block start
    marker = "/* --- Font families"
    idx = content.find(marker)
    if idx == -1:
        marker = "/* -- font families"
        idx = content.find(marker)
    if idx == -1:
        print("ERR: Could not find font families marker")
    else:
        # Find the closing brace
        brace_count = 0
        root_start = content.rfind(":root", 0, idx)
        if root_start == -1:
            print("ERR: Could not find :root before marker")
        else:
            # Find the opening brace
            open_brace = content.find("{", root_start)
            pos = open_brace + 1
            brace_count = 1
            while pos < len(content) and brace_count > 0:
                if content[pos] == "{":
                    brace_count += 1
                elif content[pos] == "}":
                    brace_count -= 1
                pos += 1
            old_block = content[root_start:pos]
            content = content[:root_start] + new_root + "\n\n" + content[pos:]
            print(f"OK: Replaced :root block ({len(old_block)} chars)")

# 2. Replace the dark/light theme override blocks
old_overrides = '''/* ============================================================
   DARK MODE — AI / CONFIDENCE TOKEN OVERRIDES (Task 27)
   App toggles theme via [data-theme="dark"] on <html> (see layout.tsx),
   so dark-mode contrast fixes must target that attribute, not @media.
   Light-mode foregrounds (in :root) are dark 700-level shades for the
   tinted badge backgrounds; dark mode needs lighter shades to stay >=4.5:1.
   ============================================================ */

[data-theme="dark"] {
  /* AI processing foreground — lightened from #4338ca (1.89:1 on tint, 2.05:1 dot)
     to indigo-200 so text reaches ~10:1 and the dot reaches ~10:1 (3:1 UI). */
  --ai-processing-fg: #c7d2fe;
  /* Confidence foregrounds on their 10% tinted backgrounds */
  --confidence-high-fg: #4ade80;
  --confidence-medium-fg: #fbbf24;
  --confidence-low-fg: #94a3b8;
}

[data-theme="light"] {
  --bg: #f7f6f4;
  --bg-soft: #f3f2ef;
  --bg-secondary: #faf9f7;
  --bg-tertiary: #efeeea;
  --card: #ffffff;
  --card-strong: #f5f4f1;
  --card-elevated: #ffffff;
  --text-muted: #7a756c;
  --border: #e0ddd6;
  --divider: #ebeae6;
}'''

new_overrides = '''/* ============================================================
   DARK MODE / LIGHT MODE TOKEN OVERRIDES
   All handled by tokens.css compatibility aliases.
   This block is intentionally left empty to avoid overriding
   the Iron & Teal token system.
   ============================================================ */'''

if old_overrides in content:
    content = content.replace(old_overrides, new_overrides)
    print("OK: Replaced dark/light theme override blocks")
else:
    print("WARN: Could not find exact dark/light override match")

# 3. Update hardcoded indigo/blue colors in key CSS rules to use teal
replacements = [
    # Focus ring - old indigo to teal
    ("box-shadow: 0 0 0 2px var(--surface-app), 0 0 0 4px var(--action-primary),\n    0 0 8px rgba(79, 120, 232, 0.20);",
     "box-shadow: 0 0 0 2px var(--surface-app), 0 0 0 4px var(--action-primary),\n    0 0 8px rgba(15, 110, 86, 0.20);"),
    # Checkbox accent
    ("accent-color: #6366f1;", "accent-color: var(--teal-500);"),
    # Selection background
    ("background: rgba(99, 102, 241, 0.28);", "background: rgba(15, 110, 86, 0.28);"),
    # Pulse glow animation - old blue to teal
    ("box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);",
     "box-shadow: 0 0 20px rgba(15, 110, 86, 0.3);"),
    ("box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);",
     "box-shadow: 0 0 30px rgba(15, 110, 86, 0.5);"),
    # Auth input focus - old indigo to teal
    ("border-color: rgba(197, 109, 45, 0.7) !important;",
     "border-color: var(--teal-500) !important;"),
    # Factory auth input focus
    ("box-shadow:\n    0 0 0 1px rgba(61, 127, 255, 0.6),\n    0 0 0 4px rgba(61, 127, 255, 0.08);",
     "box-shadow: var(--shadow-focus);"),
    # Select option highlight - old indigo
    ("linear-gradient(0deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.2)),",
     "linear-gradient(0deg, rgba(15, 110, 86, 0.2), rgba(15, 110, 86, 0.2)),"),
    # Auth title glow - old indigo
    ("text-shadow:\n    0 0 26px rgba(99, 102, 241, 0.18),",
     "text-shadow:\n    0 0 26px rgba(15, 110, 86, 0.18),"),
    # Industrial brand mark - old indigo
    ("border: 1px solid rgba(99, 102, 241, 0.22);", "border: 1px solid var(--border-teal-subtle);"),
    # Industrial brand mark gradient
    ("background:\n    linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(99, 102, 241, 0.18)),",
     "background:\n    linear-gradient(135deg, rgba(15, 110, 86, 0.28), rgba(15, 110, 86, 0.18)),"),
    # Industrial CTA button
    ("background:\n    linear-gradient(180deg, rgba(115, 120, 255, 0.96), rgba(85, 88, 227, 0.96)),\n    #6366f1;",
     "background: var(--btn-accent-bg);"),
    # Industrial node active
    ("border-color: rgba(99, 102, 241, 0.34) !important;", "border-color: var(--border-teal) !important;"),
    ("0 16px 36px rgba(99, 102, 241, 0.16),\n    0 -2px 0 rgba(99, 102, 241, 0.8) inset;",
     "0 16px 36px rgba(15, 110, 86, 0.16),\n    0 -2px 0 var(--teal-500) inset;"),
    # Industrial dock active
    ("background: linear-gradient(180deg, rgba(115, 120, 255, 0.96), rgba(85, 88, 227, 0.96));",
     "background: var(--btn-accent-bg);"),
    # Industrial access input focus
    ("box-shadow:\n    0 0 0 1px rgba(99, 102, 241, 0.5),\n    0 0 0 6px rgba(99, 102, 241, 0.08),",
     "box-shadow:\n    0 0 0 1px var(--border-focus),\n    0 0 0 6px rgba(15, 110, 86, 0.08),"),
    # Industrial access CTA shadow
    ("box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.28),\n    0 18px 34px rgba(99, 102, 241, 0.28);",
     "box-shadow: var(--shadow-md);"),
    ("box-shadow:\n    inset 0 1px 0 rgba(255, 255, 255, 0.3),\n    0 22px 38px rgba(99, 102, 241, 0.34);",
     "box-shadow: var(--shadow-lg);"),
    # Sidebar header gradient - old indigo
    ("radial-gradient(circle at top left, rgba(79, 120, 232, 0.06), transparent 32%),",
     "radial-gradient(circle at top left, rgba(15, 110, 86, 0.06), transparent 32%),"),
    # Sidebar header bottom line
    ("background: linear-gradient(90deg, transparent, rgba(79, 120, 232, 0.7), transparent);",
     "background: linear-gradient(90deg, transparent, var(--teal-400), transparent);"),
    # Nav link active - old indigo
    ("background: rgba(79, 120, 232, 0.07);",
     "background: var(--bg-teal-subtle);"),
    ("background: rgba(79, 120, 232, 0.10);",
     "background: var(--bg-teal-muted);"),
    # Route header gradient - old indigo
    ("radial-gradient(circle at top right, rgba(79, 120, 232, 0.08), transparent 22%),",
     "radial-gradient(circle at top right, rgba(15, 110, 86, 0.08), transparent 22%),"),
    # Dashboard reminder left border - old blue
    ("background: var(--action-primary);",
     "background: var(--interactive-accent);"),
    # OCR scope - old indigo gradients
    ("radial-gradient(circle at 12% 8%, rgba(79, 120, 232, 0.08), transparent 18%),",
     "radial-gradient(circle at 12% 8%, rgba(15, 110, 86, 0.08), transparent 18%),"),
    # OCR stagepill done - old indigo
    ("border-color: rgba(79, 120, 232, 0.3);",
     "border-color: var(--border-teal-subtle);"),
    ("background: rgba(79, 120, 232, 0.1);",
     "background: var(--bg-teal-subtle);"),
    ("border-color: rgba(79, 120, 232, 0.34);",
     "border-color: var(--border-teal);"),
    # OCR stagepill current
    ("border-color: rgba(79, 120, 232, 0.48);",
     "border-color: var(--border-teal);"),
    ("linear-gradient(180deg, rgba(79, 120, 232, 0.14), rgba(120, 68, 20, 0.32));",
     "linear-gradient(180deg, rgba(15, 110, 86, 0.14), rgba(15, 110, 86, 0.06));"),
    ("border-color: rgba(79, 120, 232, 0.56);",
     "border-color: var(--border-teal);"),
    ("background: rgba(79, 120, 232, 0.18);",
     "background: var(--bg-teal-muted);"),
    # OCR chip warning - old indigo
    ("border-color: rgba(79, 120, 232, 0.28);",
     "border-color: var(--border-warning);"),
    ("background: rgba(79, 120, 232, 0.08);",
     "background: var(--bg-warning);"),
    # OCR dropzone drag - old indigo
    ("border-color: rgba(79, 120, 232, 0.58);",
     "border-color: var(--border-teal);"),
    ("inset 0 0 0 1px rgba(79, 120, 232, 0.12),\n    0 0 0 1px rgba(79, 120, 232, 0.08);",
     "inset 0 0 0 1px rgba(15, 110, 86, 0.12),\n    0 0 0 1px rgba(15, 110, 86, 0.08);"),
    # OCR button primary - old indigo to orange (keep warm accent for OCR)
    ("border: 1px solid rgba(79, 120, 232, 0.48);",
     "border: 1px solid var(--amber-600);"),
    # Workflow lane critical - old indigo
    ("linear-gradient(180deg, rgba(79, 120, 232, 0.05), rgba(255, 255, 255, 0)),",
     "linear-gradient(180deg, rgba(15, 110, 86, 0.05), rgba(255, 255, 255, 0)),"),
    # Industrial auth card border - old indigo
    ("border: 1px solid rgba(99, 102, 241, 0.28);",
     "border: 1px solid var(--border-teal-subtle);"),
    # Industrial auth input focus - old amber/indigo to teal
    ("border-color: rgba(197, 109, 45, 0.7) !important;\n  box-shadow:\n    0 0 0 1px rgba(197, 109, 45, 0.5),\n    0 0 0 5px rgba(197, 109, 45, 0.08),\n    0 0 24px rgba(197, 109, 45, 0.14),",
     "border-color: var(--border-focus) !important;\n  box-shadow:\n    0 0 0 1px var(--border-focus),\n    0 0 0 5px rgba(15, 110, 86, 0.08),\n    0 0 24px rgba(15, 110, 86, 0.14),"),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1

print(f"OK: Applied {count}/{len(replacements)} color replacements")

# Write the cleaned file
with open("web/src/app/globals.css", "w", encoding="utf-8") as f:
    f.write(content)

print(f"OK: Wrote cleaned globals.css ({len(content)} chars)")
