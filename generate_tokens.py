import os

css = []
css.append("/* ============================================================")
css.append("   DPR.ai Design Token System")
css.append("   Palette: Iron & Teal")
css.append("   Themes: Light (operational) | Dark (floor/night)")
css.append("   ============================================================ */")
css.append("")
css.append("/* 1. RAW COLOR SCALE */")
css.append(":root {")
for name, val in [("--iron-950","#111714"),("--iron-900","#1A2420"),("--iron-800","#243330"),("--iron-700","#2E413D"),("--iron-600","#3A504C"),("--iron-500","#4A6460"),("--iron-400","#607A76"),("--iron-300","#829995"),("--iron-200","#AABFBC"),("--iron-100","#D0DFDD"),("--iron-50","#EEF4F3"),("--teal-950","#011F17"),("--teal-900","#04342C"),("--teal-800","#085041"),("--teal-700","#0A5E4C"),("--teal-600","#0F6E56"),("--teal-500","#178A6C"),("--teal-400","#1D9E75"),("--teal-300","#3DB88D"),("--teal-200","#5DCAA5"),("--teal-100","#9FE1CB"),("--teal-50","#E1F5EE"),("--stone-950","#0F0F0D"),("--stone-900","#1C1C1A"),("--stone-800","#2C2C2A"),("--stone-700","#444441"),("--stone-600","#5F5E5A"),("--stone-500","#888780"),("--stone-400","#B4B2A9"),("--stone-300","#D3D1C7"),("--stone-200","#E5E4DC"),("--stone-100","#F1EFE8"),("--stone-50","#F9F8F5"),("--amber-900","#412402"),("--amber-800","#633806"),("--amber-700","#854F0B"),("--amber-600","#BA7517"),("--amber-500","#EF9F27"),("--amber-400","#FAC775"),("--amber-300","#FAEEDA"),("--amber-200","#FDF4E7"),("--green-900","#173404"),("--green-800","#27500A"),("--green-700","#3B6D11"),("--green-500","#639922"),("--green-200","#C0DD97"),("--green-50","#EAF3DE"),("--red-900","#501313"),("--red-800","#791F1F"),("--red-700","#A32D2D"),("--red-500","#E24B4A"),("--red-200","#F7C1C1"),("--red-50","#FCEBEB"),("--blue-900","#042C53"),("--blue-800","#0C447C"),("--blue-600","#185FA5"),("--blue-400","#378ADD"),("--blue-200","#85B7EB"),("--blue-50","#E6F1FB")]:
    css.append(f"  {name}: {val};")
css.append("}")
css.append("")

# Light mode semantic tokens
css.append("/* 2. LIGHT MODE SEMANTIC TOKENS */")
css.append(':root, [data-theme="light"] {')
light_tokens = [
    ("--bg-canvas", "var(--stone-50)"), ("--bg-surface", "#FFFFFF"),
    ("--bg-surface-raised", "#FFFFFF"), ("--bg-surface-sunken", "var(--stone-100)"),
    ("--bg-overlay", "rgba(17, 23, 20, 0.5)"),
    ("--bg-iron", "var(--iron-950)"), ("--bg-iron-hover", "var(--iron-800)"),
    ("--bg-iron-subtle", "var(--iron-50)"), ("--bg-iron-muted", "var(--iron-100)"),
    ("--bg-teal", "var(--teal-600)"), ("--bg-teal-hover", "var(--teal-700)"),
    ("--bg-teal-subtle", "var(--teal-50)"), ("--bg-teal-muted", "var(--teal-100)"),
    ("--bg-success", "var(--green-50)"), ("--bg-success-strong", "var(--green-700)"),
    ("--bg-warning", "var(--amber-300)"), ("--bg-warning-strong", "var(--amber-600)"),
    ("--bg-danger", "var(--red-50)"), ("--bg-danger-strong", "var(--red-700)"),
    ("--bg-info", "var(--blue-50)"), ("--bg-info-strong", "var(--blue-600)"),
    ("--text-primary", "var(--iron-950)"), ("--text-secondary", "var(--stone-600)"),
    ("--text-tertiary", "var(--stone-500)"), ("--text-disabled", "var(--stone-400)"),
    ("--text-inverse", "#FFFFFF"), ("--text-inverse-muted", "var(--iron-200)"),
    ("--text-teal", "var(--teal-800)"), ("--text-teal-strong", "var(--teal-900)"),
    ("--text-on-teal", "var(--teal-50)"), ("--text-iron", "var(--iron-900)"),
    ("--text-on-iron", "#FFFFFF"),
    ("--text-success", "var(--green-800)"), ("--text-warning", "var(--amber-800)"),
    ("--text-danger", "var(--red-800)"), ("--text-info", "var(--blue-800)"),
    ("--border-subtle", "var(--stone-200)"), ("--border-default", "var(--stone-300)"),
    ("--border-strong", "var(--stone-400)"), ("--border-iron", "var(--iron-800)"),
    ("--border-teal", "var(--teal-400)"), ("--border-teal-subtle", "var(--teal-100)"),
    ("--border-success", "var(--green-200)"), ("--border-warning", "var(--amber-400)"),
    ("--border-danger", "var(--red-200)"), ("--border-info", "var(--blue-200)"),
    ("--border-focus", "var(--teal-500)"),
    ("--interactive-primary", "var(--iron-950)"), ("--interactive-primary-hover", "var(--iron-800)"),
    ("--interactive-accent", "var(--teal-600)"), ("--interactive-accent-hover", "var(--teal-700)"),
    ("--interactive-ghost-hover", "var(--stone-100)"), ("--interactive-selected", "var(--teal-50)"),
    ("--interactive-selected-border", "var(--teal-400)"),
    ("--chart-primary", "var(--teal-500)"), ("--chart-secondary", "var(--teal-300)"),
    ("--chart-tertiary", "var(--teal-100)"), ("--chart-iron", "var(--iron-700)"),
    ("--chart-iron-light", "var(--iron-300)"), ("--chart-amber", "var(--amber-500)"),
    ("--chart-red", "var(--red-500)"), ("--chart-green", "var(--green-500)"),
    ("--chart-grid", "var(--stone-200)"), ("--chart-axis", "var(--stone-400)"),
    ("--shadow-sm", "0 1px 2px rgba(17, 23, 20, 0.06)"),
    ("--shadow-md", "0 4px 12px rgba(17, 23, 20, 0.08)"),
    ("--shadow-lg", "0 8px 24px rgba(17, 23, 20, 0.10)"),
    ("--shadow-focus", "0 0 0 3px rgba(15, 110, 86, 0.25)"),
]
for name, val in light_tokens:
    css.append(f"  {name}: {val};")
css.append("}")
css.append("")

# Dark mode
css.append("/* 3. DARK MODE SEMANTIC TOKENS */")
css.append('[data-theme="dark"],')
css.append('@media (prefers-color-scheme: dark) {')
css.append('  :root:not([data-theme="light"]) {')
dark_tokens = [
    ("--bg-canvas", "var(--iron-950)"), ("--bg-surface", "var(--iron-900)"),
    ("--bg-surface-raised", "var(--iron-800)"), ("--bg-surface-sunken", "var(--stone-900)"),
    ("--bg-overlay", "rgba(0, 0, 0, 0.65)"),
    ("--bg-iron", "var(--teal-400)"), ("--bg-iron-hover", "var(--teal-300)"),
    ("--bg-iron-subtle", "var(--iron-800)"), ("--bg-iron-muted", "var(--iron-700)"),
    ("--bg-teal", "var(--teal-500)"), ("--bg-teal-hover", "var(--teal-400)"),
    ("--bg-teal-subtle", "rgba(15, 110, 86, 0.15)"), ("--bg-teal-muted", "rgba(15, 110, 86, 0.25)"),
    ("--bg-success", "rgba(59, 109, 17, 0.20)"), ("--bg-success-strong", "var(--green-700)"),
    ("--bg-warning", "rgba(186, 117, 23, 0.20)"), ("--bg-warning-strong", "var(--amber-600)"),
    ("--bg-danger", "rgba(163, 45, 45, 0.20)"), ("--bg-danger-strong", "var(--red-700)"),
    ("--bg-info", "rgba(24, 95, 165, 0.20)"), ("--bg-info-strong", "var(--blue-600)"),
    ("--text-primary", "var(--stone-50)"), ("--text-secondary", "var(--iron-200)"),
    ("--text-tertiary", "var(--iron-300)"), ("--text-disabled", "var(--iron-500)"),
    ("--text-inverse", "var(--iron-950)"), ("--text-inverse-muted", "var(--iron-700)"),
    ("--text-teal", "var(--teal-200)"), ("--text-teal-strong", "var(--teal-100)"),
    ("--text-on-teal", "var(--teal-950)"),
    ("--text-iron", "var(--iron-100)"), ("--text-on-iron", "var(--iron-950)"),
    ("--text-success", "var(--green-200)"), ("--text-warning", "var(--amber-400)"),
    ("--text-danger", "var(--red-200)"), ("--text-info", "var(--blue-200)"),
    ("--border-subtle", "rgba(170, 191, 188, 0.10)"), ("--border-default", "rgba(170, 191, 188, 0.18)"),
    ("--border-strong", "rgba(170, 191, 188, 0.30)"), ("--border-iron", "var(--iron-600)"),
    ("--border-teal", "var(--teal-600)"), ("--border-teal-subtle", "rgba(15, 110, 86, 0.30)"),
    ("--border-success", "rgba(59, 109, 17, 0.40)"), ("--border-warning", "rgba(186, 117, 23, 0.40)"),
    ("--border-danger", "rgba(163, 45, 45, 0.40)"), ("--border-info", "rgba(24, 95, 165, 0.40)"),
    ("--border-focus", "var(--teal-400)"),
    ("--interactive-primary", "var(--teal-400)"), ("--interactive-primary-hover", "var(--teal-300)"),
    ("--interactive-accent", "var(--teal-500)"), ("--interactive-accent-hover", "var(--teal-400)"),
    ("--interactive-ghost-hover", "var(--iron-800)"),
    ("--interactive-selected", "rgba(15, 110, 86, 0.15)"),
    ("--interactive-selected-border", "var(--teal-600)"),
    ("--chart-primary", "var(--teal-400)"), ("-
