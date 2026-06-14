#!/usr/bin/env python3
"""Generate DPR.ai Iron & Teal tokens.css"""
import os

L = []
def w(s=""):
    L.append(s)

# Header
w("/* ============================================================")
w("   DPR.ai Design Token System")
w("   Palette: Iron & Teal")
w("   Themes: Light (operational) | Dark (floor/night)")
w("   ============================================================ */")
w()

# 1. Raw Color Scale
w("/* 1. RAW COLOR SCALE */")
w(":root {")
palette = [
    ("iron-950","#111714"),("iron-900","#1A2420"),("iron-800","#243330"),("iron-700","#2E413D"),
    ("iron-600","#3A504C"),("iron-500","#4A6460"),("iron-400","#607A76"),("iron-300","#829995"),
    ("iron-200","#AABFBC"),("iron-100","#D0DFDD"),("iron-50","#EEF4F3"),
    ("teal-950","#011F17"),("teal-900","#04342C"),("teal-800","#085041"),("teal-700","#0A5E4C"),
    ("teal-600","#0F6E56"),("teal-500","#178A6C"),("teal-400","#1D9E75"),("teal-300","#3DB88D"),
    ("teal-200","#5DCAA5"),("teal-100","#9FE1CB"),("teal-50","#E1F5EE"),
    ("stone-950","#0F0F0D"),("stone-900","#1C1C1A"),("stone-800","#2C2C2A"),("stone-700","#444441"),
    ("stone-600","#5F5E5A"),("stone-500","#888780"),("stone-400","#B4B2A9"),("stone-300","#D3D1C7"),
    ("stone-200","#E5E4DC"),("stone-100","#F1EFE8"),("stone-50","#F9F8F5"),
    ("amber-900","#412402"),("amber-800","#633806"),("amber-700","#854F0B"),("amber-600","#BA7517"),
    ("amber-500","#EF9F27"),("amber-400","#FAC775"),("amber-300","#FAEEDA"),("amber-200","#FDF4E7"),
    ("green-900","#173404"),("green-800","#27500A"),("green-700","#3B6D11"),("green-500","#639922"),
    ("green-200","#C0DD97"),("green-50","#EAF3DE"),
    ("red-900","#501313"),("red-800","#791F1F"),("red-700","#A32D2D"),("red-500","#E24B4A"),
    ("red-200","#F7C1C1"),("red-50","#FCEBEB"),
    ("blue-900","#042C53"),("blue-800","#0C447C"),("blue-600","#185FA5"),("blue-400","#378ADD"),
    ("blue-200","#85B7EB"),("blue-50","#E6F1FB"),
]
for n,v in palette:
    w(f"  --{n}: {v};")
w("}")
w()

# 2. Light Mode Semantic Tokens
w("/* 2. LIGHT MODE (Operational Theme) */")
w(':root, [data-theme="light"] {')
light = [
    ("--bg-canvas","var(--stone-50)"),("--bg-surface","#FFFFFF"),("--bg-surface-raised","#FFFFFF"),
    ("--bg-surface-sunken","var(--stone-100)"),("--bg-overlay","rgba(17, 23, 20, 0.5)"),
    ("--bg-iron","var(--iron-950)"),("--bg-iron-hover","var(--iron-800)"),
    ("--bg-iron-subtle","var(--iron-50)"),("--bg-iron-muted","var(--iron-100)"),
    ("--bg-teal","var(--teal-600)"),("--bg-teal-hover","var(--teal-700)"),
    ("--bg-teal-subtle","var(--teal-50)"),("--bg-teal-muted","var(--teal-100)"),
    ("--bg-success","var(--green-50)"),("--bg-success-strong","var(--green-700)"),
    ("--bg-warning","var(--amber-300)"),("--bg-warning-strong","var(--amber-600)"),
    ("--bg-danger","var(--red-50)"),("--bg-danger-strong","var(--red-700)"),
    ("--bg-info","var(--blue-50)"),("--bg-info-strong","var(--blue-600)"),
    ("--text-primary","var(--iron-950)"),("--text-secondary","var(--stone-600)"),
    ("--text-tertiary","var(--stone-500)"),("--text-disabled","var(--stone-400)"),
    ("--text-inverse","#FFFFFF"),("--text-inverse-muted","var(--iron-200)"),
    ("--text-teal","var(--teal-800)"),("--text-teal-strong","var(--teal-900)"),
    ("--text-on-teal","var(--teal-50)"),("--text-iron","var(--iron-900)"),
    ("--text-on-iron","#FFFFFF"),
    ("--text-success","var(--green-800)"),("--text-warning","var(--amber-800)"),
    ("--text-danger","var(--red-800)"),("--text-info","var(--blue-800)"),
    ("--border-subtle","var(--stone-200)"),("--border-default","var(--stone-300)"),
    ("--border-strong","var(--stone-400)"),("--border-iron","var(--iron-800)"),
    ("--border-teal","var(--teal-400)"),("--border-teal-subtle","var(--teal-100)"),
    ("--border-success","var(--green-200)"),("--border-warning","var(--amber-400)"),
    ("--border-danger","var(--red-200)"),("--border-info","var(--blue-200)"),
    ("--border-focus","var(--teal-500)"),
    ("--interactive-primary","var(--iron-950)"),("--interactive-primary-hover","var(--iron-800)"),
    ("--interactive-accent","var(--teal-600)"),("--interactive-accent-hover","var(--teal-700)"),
    ("--interactive-ghost-hover","var(--stone-100)"),("--interactive-selected","var(--teal-50)"),
    ("--interactive-selected-border","var(--teal-400)"),
    ("--chart-primary","var(--teal-500)"),("--chart-secondary","var(--teal-300)"),
    ("--chart-tertiary","var(--teal-100)"),("--chart-iron","var(--iron-700)"),
    ("--chart-iron-light","var(--iron-300)"),("--chart-amber","var(--amber-500)"),
    ("--chart-red","var(--red-500)"),("--chart-green","var(--green-500)"),
    ("--chart-grid","var(--stone-200)"),("--chart-axis","var(--stone-400)"),
    ("--shadow-sm","0 1px 2px rgba(17, 23, 20, 0.06)"),
    ("--shadow-md","0 4px 12px rgba(17, 23, 20, 0.08)"),
    ("--shadow-lg","0 8px 24px rgba(17, 23, 20, 0.10)"),
    ("--shadow-focus","0 0 0 3px rgba(15, 110, 86, 0.25)"),
]
for n,v in light:
    w(f"  {n}: {v};")
w("}")
w()

# 3. Dark Mode
w("/* 3. DARK MODE (Floor / Night Theme) */")
w('[data-theme="dark"],')
w("@media (prefers-color-scheme: dark) {")
w('  :root:not([data-theme="light"]) {')
dark = [
    ("--bg-canvas","var(--iron-950)"),("--bg-surface","var(--iron-900)"),
    ("--bg-surface-raised","var(--iron-800)"),("--bg-surface-sunken","var(--stone-900)"),
    ("--bg-overlay","rgba(0, 0, 0, 0.65)"),
    ("--bg-iron","var(--teal-400)"),("--bg-iron-hover","var(--teal-300)"),
    ("--bg-iron-subtle","var(--iron-800)"),("--bg-iron-muted","var(--iron-700)"),
    ("--bg-teal","var(--teal-500)"),("--bg-teal-hover","var(--teal-400)"),
    ("--bg-teal-subtle","rgba(15, 110, 86, 0.15)"),("--bg-teal-muted","rgba(15, 110, 86, 0.25)"),
    ("--bg-success","rgba(59, 109, 17, 0.20)"),("--bg-success-strong","var(--green-700)"),
    ("--bg-warning","rgba(186, 117, 23, 0.20)"),("--bg-warning-strong","var(--amber-600)"),
    ("--bg-danger","rgba(163, 45, 45, 0.20)"),("--bg-danger-strong","var(--red-700)"),
    ("--bg-info","rgba(24, 95, 165, 0.20)"),("--bg-info-strong","var(--blue-600)"),
    ("--text-primary","var(--stone-50)"),("--text-secondary","var(--iron-200)"),
    ("--text-tertiary","var(--iron-300)"),("--text-disabled","var(--iron-500)"),
    ("--text-inverse","var(--iron-950)"),("--text-inverse-muted","var(--iron-700)"),
    ("--text-teal","var(--teal-200)"),("--text-teal-strong","var(--teal-100)"),
    ("--text-on-teal","var(--teal-950)"),
    ("--text-iron","var(--iron-100)"),("--text-on-iron","var(--iron-950)"),
    ("--text-success","var(--green-200)"),("--text-warning","var(--amber-400)"),
    ("--text-danger","var(--red-200)"),("--text-info","var(--blue-200)"),
    ("--border-subtle","rgba(170, 191, 188, 0.10)"),("--border-default","rgba(170, 191, 188, 0.18)"),
    ("--border-strong","rgba(170, 191, 188, 0.30)"),("--border-iron","var(--iron-600)"),
    ("--border-teal","var(--teal-600)"),("--border-teal-subtle","rgba(15, 110, 86, 0.30)"),
    ("--border-success","rgba(59, 109, 17, 0.40)"),("--border-warning","rgba(186, 117, 23, 0.40)"),
    ("--border-danger","rgba(163, 45, 45, 0.40)"),("--border-info","rgba(24, 95, 165, 0.40)"),
    ("--border-focus","var(--teal-400)"),
    ("--interactive-primary","var(--teal-400)"),("--interactive-primary-hover","var(--teal-300)"),
    ("--interactive-accent","var(--teal-500)"),("--interactive-accent-hover","var(--teal-400)"),
    ("--interactive-ghost-hover","var(--iron-800)"),
    ("--interactive-selected","rgba(15, 110, 86, 0.15)"),
    ("--interactive-selected-border","var(--teal-600)"),
    ("--chart-primary","var(--teal-400)"),("--chart-secondary","var(--teal-600)"),
    ("--chart-tertiary","var(--teal-800)"),("--chart-iron","var(--iron-400)"),
    ("--chart-iron-light","var(--iron-600)"),
    ("--chart-grid","rgba(170, 191, 188, 0.12)"),("--chart-axis","var(--iron-400)"),
    ("--shadow-sm","0 1px 2px rgba(0, 0, 0, 0.30)"),
    ("--shadow-md","0 4px 12px rgba(0, 0, 0, 0.40)"),
    ("--shadow-lg","0 8px 24px rgba(0, 0, 0, 0.50)"),
    ("--shadow-focus","0 0 0 3px rgba(29, 158, 117, 0.30)"),
]
for n,v in dark:
    w(f"    {n}: {v};")
w("  }")
w("}")
w()

# 4. Typography
w("/* 4. TYPOGRAPHY */")
w(":root {")
typo = [
    ("--font-sans","'IBM Plex Sans', system-ui, -apple-system, sans-serif"),
    ("--font-mono","'IBM Plex Mono', 'Fira Code', monospace"),
    ("--text-xs","11px"),("--text-sm","13px"),("--text-base","15px"),("--text-md","16px"),
    ("--text-lg","18px"),("--text-xl","22px"),("--text-2xl","28px"),("--text-3xl","36px"),
    ("--weight-regular","400"),("--weight-medium","500"),("--weight-semibold","600"),
    ("--leading-none","1"),("--leading-tight","1.25"),("--leading-snug","1.4"),
    ("--leading-normal","1.6"),("--leading-relaxed","1.65"),("--leading-loose","1.75"),
    ("--tracking-tight","-0.01em"),("--tracking-normal","0"),("--tracking-wide","0.03em"),
    ("--tracking-wider","0.06em"),("--tracking-widest","0.08em"),
]
for n,v in typo:
    w(f"  {n}: {v};")
w("}")
w()

# 5. Spacing & Layout
w("/* 5. SPACING & LAYOUT */")
w(":root {")
sp = [
    ("--space-1","4px"),("--space-2","8px"),("--space-3","12px"),("--space-4","16px"),
    ("--space-5","20px"),("--space-6","24px"),("--space-8","32px"),("--space-10","40px"),
    ("--space-12","48px"),("--space-16","64px"),("--space-20","80px"),
    ("--radius-sm","4px"),("--radius-md","8px"),("--radius-lg","12px"),
    ("--radius-xl","16px"),("--radius-2xl","24px"),("--radius-full","9999px"),
    ("--layout-sidebar","240px"),("--layout-sidebar-sm","64px"),("--layout-topbar","56px"),
    ("--layout-max-content","1280px"),("--layout-max-narrow","800px"),
]
for n,v in sp:
    w(f"  {n}: {v};")
w("}")
w()

# 6. Component Tokens
w("/* 6. COMPONENT TOKENS */")
w(":root {")
comp = [
    ("--btn-primary-bg","var(--interactive-primary)"),("--btn-primary-bg-hover","var(--interactive-primary-hover)"),
    ("--btn-primary-text","var(--text-inverse)"),("--btn-primary-border","transparent"),
    ("--btn-accent-bg","var(--interactive-accent)"),("--btn-accent-bg-hover","var(--interactive-accent-hover)"),
    ("--btn-accent-text","var(--text-on-teal)"),("--btn-accent-border","transparent"),
    ("--btn-ghost-bg","transparent"),("--btn-ghost-bg-hover","var(--interactive-ghost-hover)"),
    ("--btn-ghost-text","var(--text-primary)"),("--btn-ghost-border","var(--border-default)"),
    ("--btn-danger-bg","var(--bg-danger-strong)"),("--btn-danger-text","#FFFFFF"),("--btn-danger-border","transparent"),
    ("--btn-height-sm","32px"),("--btn-height-md","38px"),("--btn-height-lg","44px"),
    ("--btn-padding-sm","0 12px"),("--btn-padding-md","0 16px"),("--btn-padding-lg","0 20px"),
    ("--btn-radius","var(--radius-md)"),("--btn-font-size","var(--text-sm)"),("--btn-weight","var(--weight-medium)"),
    ("--input-bg","var(--bg-surface)"),("--input-bg-focus","var(--bg-surface)"),("--input-bg-disabled","var(--bg-surface-sunken)"),
    ("--input-text","var(--text-primary)"),("--input-placeholder","var(--text-tertiary)"),
    ("--input-border","var(--border-strong)"),("--input-border-hover","var(--border-teal)"),
    ("--input-border-focus","var(--border-focus)"),("--input-border-error","var(--border-danger)"),
    ("--input-height","38px"),("--input-padding","0 12px"),("--input-radius","var(--radius-md)"),
    ("--input-font-size","var(--text-base)"),("--input-focus-ring","var(--shadow-focus)"),
    ("--card-bg","var(--bg-surface)"),("--card-bg-hover","var(--bg-surface)"),
    ("--card-border","var(--border-subtle)"),("--card-border-hover","var(--border-teal-subtle)"),
    ("--card-radius","var(--radius-lg)"),("--card-padding","var(--space-5) var(--space-6)"),
    ("--card-padding-sm","var(--space-4) var(--space-5)"),
    ("--nav-bg","var(--iron-950)"),("--nav-border","var(--iron-800)"),("--nav-text","var(--iron-200)"),
    ("--nav-text-hover","#FFFFFF"),("--nav-text-active","var(--teal-200)"),
    ("--nav-item-bg-hover","var(--iron-800)"),("--nav-item-bg-active","rgba(15, 110, 86, 0.20)"),
    ("--nav-item-border-active","var(--teal-500)"),("--nav-icon-color","var(--iron-300)"),("--nav-icon-active","var(--teal-300)"),
    ("--topbar-bg","var(--bg-surface)"),("--topbar-border","var(--border-subtle)"),("--topbar-text","var(--text-primary)"),
    ("--topbar-height","var(--layout-topbar)"),
    ("--table-header-bg","var(--bg-surface-sunken)"),("--table-header-text","var(--text-secondary)"),
    ("--table-row-bg","var(--bg-surface)"),("--table-row-bg-hover","var(--bg-teal-subtle)"),
    ("--table-row-bg-selected","var(--interactive-selected)"),("--table-row-border","var(--border-subtle)"),
    ("--table-cell-text","var(--text-primary)"),("--table-cell-text-muted","var(--text-secondary)"),
    ("--scrollbar-track","var(--bg-surface-sunken)"),("--scrollbar-thumb","var(--border-strong)"),
    ("--scrollbar-thumb-hover","var(--teal-400)"),("--divider-color","var(--border-subtle)"),
]
for n,v in comp:
    w(f"  {n}: {v};")
w("}")
w()

# 7. User-Role Surface Tokens
w("/* 7. USER-ROLE SURFACE TOKENS */")
w(":root {")
roles = [
    ("--role-floor-bg","var(--bg-canvas)"),("--role-floor-surface","var(--bg-surface)"),
    ("--role-floor-accent","var(--teal-500)"),("--role-floor-text-size","var(--text-md)"),
    ("--role-floor-input-height","44px"),("--role-floor-btn-height","var(--btn-height-lg)"),
    ("--role-manager-bg","var(--bg-canvas)"),("--role-manager-surface","var(--bg-surface)"),
    ("--role-manager-accent","var(--teal-600)"),("--role-manager-text-size","var(--text-base)"),
    ("--role-owner-bg","var(--iron-950)"),("--role-owner-surface","var(--iron-900)"),
    ("--role-owner-accent","var(--teal-400)"),("--role-owner-text-size","var(--text-sm)"),
]
for n,v in roles:
    w(f"  {n}: {v};")
w("}")
w()

# 8. COMPATIBILITY ALIASES
w("/* 8. COMPATIBILITY ALIASES — old token names mapped to Iron & Teal */")
w(":root {")
compat = [
    # Surface aliases
    ("--surface-app","var(--bg-canvas)"),("--surface-shell","var(--bg-surface-sunken)"),
    ("--surface-panel","var(--bg-surface)"),("--surface-card","var(--bg-surface)"),
    ("--surface-elevated","var(--bg-surface-raised)"),("--surface-overlay","var(--bg-overlay)"),
    ("--surface-hover","var(--interactive-ghost-hover)"),("--surface-active","var(--bg-teal-subtle)"),
    ("--surface-selected","var(--interactive-selected)"),
    ("--surface-skeleton","var(--stone-200)"),("--surface-skeleton-shine","var(--stone-100)"),
    ("--surface-industrial-deep","var(--bg-canvas)"),("--surface-industrial-raised","var(--bg-surface-sunken)"),
    ("--surface-industrial-card","var(--bg-surface)"),
    # Action aliases
    ("--action-primary","var(--interactive-accent)"),("--action-primary-hover","var(--interactive-accent-hover)"),
    ("--action-primary-active","var(--teal-700)"),("--action-primary-text","var(--text-on-teal)"),
    ("--action-secondary","var(--bg-surface)"),("--action-secondary-hover","var(--stone-100)"),
    ("--action-secondary-border","var(--border-default)"),("--action-secondary-text","var(--text-primary)"),
    ("--action-ghost-hover","var(--interactive-ghost-hover)"),
    ("--action-destructive","var(--bg-danger-strong)"),("--action-destructive-hover","var(--red-700)"),
    ("--action-disabled","var(--stone-200)"),("--action-disabled-text","var(--stone-400)"),
    # Accent aliases
    ("--accent","var(--interactive-accent)"),("--accent-strong","var(--teal-700)"),
    ("--accent-soft","rgba(15, 110, 86, 0.10)"),("--accent-quiet","rgba(15, 110, 86, 0.06)"),
    # Status aliases
    ("--status-success-fg","var(--text-success)"),("--status-success-bg","var(--bg-success)"),
    ("--status-success-border","var(--border-success)"),("--status-success-icon","var(--green-500)"),
    ("--status-warning-fg","var(--text-warning)"),("--status-warning-bg","var(--bg-warning)"),
    ("--status-warning-border","var(--border-warning)"),("--status-warning-icon","var(--amber-500)"),
    ("--status-danger-fg","var(--text-danger)"),("--status-danger-bg","var(--bg-danger)"),
    ("--status-danger-border","var(--border-danger)"),("--status-danger-icon","var(--red-500)"),
    ("--status-processing-fg","var(--teal-400)"),("--status-processing-bg","var(--bg-teal-subtle)"),
    ("--status-processing-border","var(--border-teal)"),("--status-processing-icon","var(--teal-500)"),
    ("--status-paused-fg","var(--stone-500)"),("--status-paused-bg","var(--stone-100)"),
    ("--status-paused-border","var(--stone-200)"),("--status-paused-icon","var(--stone-400)"),
    ("--status-inactive-fg","var(--stone-500)"),("--status-inactive-bg","var(--stone-100)"),
    ("--status-inactive-border","var(--stone-200)"),("--status-inactive-icon","var(--stone-400)"),
    ("--status-draft-fg","var(--stone-600)"),("--status-draft-bg","var(--stone-100)"),
    ("--status-draft-border","var(--stone-200)"),("--status-draft-icon","var(--stone-500)"),
    ("--status-synced-fg","var(--text-success)"),("--status-synced-bg","var(--bg-success)"),
    ("--status-synced-border","var(--border-success)"),("--status-synced-icon","var(--green-500)"),
    ("--status-info-fg","var(--text-info)"),("--status-info-bg","var(--bg-info)"),
    ("--status-info-border","var(--border-info)"),("--status-info-icon","var(--blue-400)"),
    # Workflow aliases
    ("--workflow-active","var(--interactive-accent)"),("--workflow-active-bg","var(--bg-teal-subtle)"),
    ("--workflow-complete","var(--green-500)"),("--workflow-complete-bg","var(--bg-success)"),
    ("--workflow-blocked","var(--red-500)"),("--workflow-blocked-bg","var(--bg-danger)"),
    ("--workflow-pending","var(--stone-500)"),("--workflow-pending-bg","var(--stone-100)"),
    ("--workflow-ai-processing","var(--teal-500)"),("--workflow-ai-bg","var(--bg-teal-subtle)"),
    # AI processing aliases
    ("--ai-processing-bg","var(--bg-teal-subtle)"),("--ai-processing-fg","var(--text-teal)"),
    ("--ai-processing-border","var(--border-teal)"),
    # Confidence aliases
    ("--confidence-high-fg","var(--green-500)"),("--confidence-medium-fg","var(--amber-500)"),
    ("--confidence-low-fg","var(--stone-400)"),
    # Focus ring aliases
    ("--focus-ring","var(--shadow-focus)"),("--focus-ring-danger","0 0 0 3px rgba(226, 75, 74, 0.30)"),
    ("--focus-ring-offset","2px"),("--focus-ring-width","2px"),("--min-touch-target","44px"),
    # Glow aliases
    ("--glow-primary","0 0 0 1px rgba(15, 110, 86, 0.15), 0 0 12px rgba(15, 110, 86, 0.08)"),
    ("--glow-success","0 0 0 1px rgba(59, 109, 17, 0.20), 0 0 8px rgba(59, 109, 17, 0.08)"),
    ("--glow-warning","0 0 0 1px rgba(186, 117, 23, 0.20), 0 0 12px rgba(186, 117, 23, 0.08)"),
    ("--glow-danger","0 0 0 1px rgba(163, 45, 45, 0.20), 0 0 8px rgba(163, 45, 45, 0.08)"),
    ("--glow-subtle","0 0 40px rgba(15, 110, 86, 0.06)"),
    ("--glow-focus","0 0 0 2px var(--iron-950), 0 0 0 4px var(--teal-500), 0 0 8px rgba(29, 158, 117, 0.20)"),
    ("--glow-focus-input","inset 0 0 0 1px var(--border-focus), 0 0 0 3px rgba(15, 110, 86, 0.20)"),
    ("--glow-card-hover","0 4px 16px rgba(0, 0, 0, 0.20), 0 1px 4px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(255, 255, 255, 0.05)"),
    ("--glow-processing","0 0 0 1px rgba(15, 110, 86, 0.20), 0 0 14px rgba(15, 110, 86, 0.12)"),
    ("--glow-none","none"),
    # Glass aliases
    ("--glass-blur","12px"),("--glass-bg","rgba(17, 23, 20, 0.70)"),
    ("--glass-border","rgba(255, 255, 255, 0.08)"),
    ("--glass-subtle-bg","rgba(255, 255, 255, 0.04)"),("--glass-subtle-border","rgba(255, 255, 255, 0.06)"),
    ("--glass-elevated-bg","rgba(255, 255, 255, 0.08)"),("--glass-elevated-border","rgba(255, 255, 255, 0.10)"),
    ("--glass-accent-bg","rgba(15, 110, 86, 0.10)"),("--glass-accent-border","rgba(15, 110, 86, 0.20)"),
    ("--glass-accent-hover","rgba(15, 110, 86, 0.15)"),
    # Command system aliases
    ("--command-bg","rgba(0, 0, 0, 0.50)"),("--command-panel-bg","var(--bg-surface-raised)"),
    ("--command-border","var(--border-strong)"),("--command-shadow","var(--shadow-lg)"),
    ("--command-hover","var(--interactive-ghost-hover)"),("--command-active","var(--bg-teal-subtle)"),
    ("--command-selected","var(--interactive-selected)"),("--command-focus-ring","var(--shadow-focus)"),
    ("--command-font-size","var(--text-md)"),("--command-shortcut-font","var(--font-mono)"),
    ("--command-group-label","var(--text-xs)"),("--command-match-highlight","var(--interactive-accent)"),
    ("--command-shortcut-muted","var(--text-tertiary)"),("--command-danger","var(--text-danger)"),
    # Gradient aliases
    ("--gradient-primary","linear-gradient(135deg, var(--interactive-accent) 0%, var(--teal-700) 100%)"),
    ("--gradient-success","linear-gradient(135deg, var(--green-500) 0%, var(--green-700) 100%)"),
    ("--gradient-surface","linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-surface-sunken) 100%)"),
    ("--gradient-subtle","linear-gradient(135deg, rgba(15, 110, 86, 0.08) 0%, rgba(15, 110, 86, 0.03) 100%)"),
    # Text aliases
    ("--text","var(--text-primary)"),("--text-muted","var(--text-secondary)"),
    ("--text-link","var(--text-teal)"),("--text-link-hover","var(--text-teal-strong)"),
    # Border aliases
    ("--border","var(--border-default)"),("--border-secondary","var(--border-default)"),("--divider","var(--border-subtle)"),
    # Shadow aliases
    ("--shadow-xs","0 1px 2px rgba(17, 23, 20, 0.04)"),
    ("--shadow-xl","0 20px 25px rgba(17, 23, 20, 0.15), 0 8px 10px rgba(17, 23, 20, 0.08)"),
    ("--shadow-2xl","0 42px 90px rgba(17, 23, 20, 0.20)"),
    ("--shadow-inset","inset 0 1px 2px rgba(17, 23, 20, 0.06)"),("--shadow-soft","var(--shadow-sm)"),
    # Z-index aliases
    ("--z-base","0"),("--z-raised","10"),("--z-sticky","20"),("--z-overlay-bg","30"),
    ("--z-overlay","40"),("--z-modal","50"),("--z-command","60"),("--z-toast","70"),("--z-tooltip","80"),
    # Layout aliases
    ("--sidebar-width","var(--layout-sidebar)"),("--layout-content-max","1280px"),
    ("--layout-card-min-height","12rem"),("--layout-card-min-height-lg","22rem"),("--layout-card-max-width","21rem"),
    # Spacing aliases
    ("--space-px","1px"),("--space-0","0px"),("--space-0-5","2px"),("--space-1-5","6px"),
    ("--space-2-5","10px"),("--space-3-5","14px"),("--space-7","28px"),("--space-9","36px"),
    ("--space-14","56px"),("--space-24","96px"),
    ("--space-xs","var(--space-1)"),("--space-sm","var(--space-2)"),("--space-md","var(--space-4)"),
    ("--space-lg","var(--space-6)"),("--space-xl","var(--space-10)"),("--space-2xl","var(--space-16)"),
    # Radius aliases
    ("--radius-none","0px"),("--radius-xs","3px"),("--radius-control","var(--radius-sm)"),
    ("--radius-panel","var(--radius-md)"),("--radius-overlay","var(--radius-lg)"),("--radius-badge","var(--radius-xs)"),
    # Typography aliases
    ("--text-2xs","10px"),("--font-display","var(--font-sans)"),("--font-numeric","var(--font-sans)"),
    ("--leading-none","1"),("--leading-relaxed","1.65"),("--tracking-wider","0.06em"),
    ("--type-table-cell","var(--text-base)"),("--type-table-header","var(--text-sm)"),
    ("--type-label","var(--text-sm)"),("--type-label-dense","var(--text-xs)"),("--type-body","var(--text-md)"),
    ("--type-panel-title","var(--text-lg)"),("--type-page-title","var(--text-xl)"),
    ("--type-numeric-lg","var(--text-3xl)"),("--type-numeric-md","var(--text-xl)"),("--type-numeric-sm","var(--text-md)"),
    ("--type-status","var(--text-xs)"),("--type-code","var(--text-sm)"),("--type-timestamp","var(--text-xs)"),
    # Motion aliases
    ("--motion-instant","0ms"),("--motion-fast","80ms"),("--motion-base","120ms"),("--motion-moderate","150ms"),("--motion-reduced","0ms"),
    ("--ease-standard","cubic-bezier(0.2, 0, 0, 1)"),("--ease-decelerate","cubic-bezier(0, 0, 0.2, 1)"),
    ("--ease-accelerate","cubic-bezier(0.4, 0, 1, 1)"),("--ease-spring","cubic-bezier(0.34, 1.56, 0.64, 1)"),
    ("--ease-snappy","cubic-bezier(0.2, 0, 0, 1)"),("--ease-smooth","cubic-bezier(0.4, 0, 0.2, 1)"),
    ("--ease-overshoot","cubic-bezier(0.34, 1.4, 0.64, 1)"),("--ease-premium-enter","cubic-bezier(0.16, 1, 0.3, 1)"),
    ("--stagger-step","40ms"),("--stagger-max","320ms"),
    # Density aliases
    ("--density-row-height","40px"),("--density-row-height-lg","48px"),
    ("--density-cell-pad-x","var(--space-3)"),("--density-cell-pad-y","var(--space-2)"),
    ("--density-gap","var(--space-2)"),("--density-icon-size","16px"),
    ("--density-badge-pad-x","var(--space-2)"),("--density-badge-pad-y","var(--space-0-5)"),
    ("--density-input-height","32px"),("--density-btn-height","32px"),
    ("--density-section-pad-x","var(--space-6)"),("--density-section-pad-y","var(--space-6)"),
    ("--density-section-header-y","var(--space-4)"),("--density-shell-gap","var(--space-2)"),
    ("--density-shell-stack-gap","var(--space-4)"),("--density-section-gap","var(--space-4)"),
    ("--density-font-table","var(--text-base)"),("--density-font-label","var(--text-sm)"),("--density-scale","1"),
    # Feedback / misc
    ("--feedback-instant","100ms"),("--feedback-success-duration","3000ms"),("--feedback-error-duration","5000ms"),
    ("--spinner-color","var(--teal-500)"),("--signal","var(--teal-600)"),("--success","var(--green-500)"),
    ("--warning","var(--amber-500)"),("--danger","var(--red-500)"),
    # OCR / workstation
    ("--ambient-primary","radial-gradient(ellipse 80% 50% at 50% -20%, rgba(15, 110, 86, 0.12), transparent 70%)"),
    ("--perspective-workstation","1200px"),("--tilt-max-deg","4deg"),("--shell-mobile-fixed-stack-clearance","0px"),
]
for n,v in compat:
    w(f"  {n}: {v};")
w("}")
w()

# Dark mode compat overrides
w("[data-theme=\"dark\"] {")
w("  --glass-bg: rgba(15, 23, 20, 0.70);")
w("  --command-bg: rgba(0, 0, 0, 0.60);")
w("  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.40);")
w("  --shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.40);")
w("}")
w()

# Reduced motion
w("@media (prefers-reduced-motion: reduce) {")
w("  :root {")
w("    --motion-fast: 0ms;")
w("    --motion-base: 0ms;")
w("    --motion-moderate: 0ms;")
w("    --ease-spring: cubic-bezier(0.2, 0, 0, 1);")
w("    --glow-primary: none;")
w("    --glow-success: none;")
w("    --glow-danger: none;")
w("    --glow-card-hover: none;")
w("  }")
w("}")

# Write to file
os.makedirs("web/src/styles", exist_ok=True)
content = "\n".join(L) + "\n"
with open("web/src/styles/tokens.css", "w", encoding="utf-8") as f:
    f.write(content)
print(f"SUCCESS: Wrote {len(L)} lines ({len(content)} chars) to web/src/styles/tokens.css")
