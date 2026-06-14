"""
Token Usage Audit — Phase 0.3

Extracts all CSS custom property definitions from token CSS files,
then searches the codebase for var(--name) references.

Output: web/TOKEN_AUDIT_REPORT.md
"""

import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
OCR_GOVERNED_DIR = PROJECT_ROOT / "src" / "features" / "ocr" / "governed"

TOKEN_FILES = [
    SRC_DIR / "styles" / "tokens.css",
    OCR_GOVERNED_DIR / "systems" / "styles" / "factory-nerve.tokens.css",
]

SKIP_DIRS = {
    "node_modules", ".next", ".git", "__pycache__",
    "stories", "test-utils",
}

def collect_all_source_files(root_dir):
    """Collect all .tsx, .ts, .css files from the project (excluding node_modules, .next, .git)."""
    files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip excluded dirs
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for filename in filenames:
            if filename.endswith((".tsx", ".ts", ".css")):
                files.append(Path(dirpath) / filename)
    return sorted(files)


def extract_token_definitions(file_path):
    """Extract all CSS custom property names defined in a file (--token-name: ...)."""
    tokens = {}
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return tokens

    # Match lines like `--token-name: value;` or `--token-name: value;`
    # but NOT `var(--token-name)` references
    pattern = re.compile(r"^\s+(--[\w-]+):\s", re.MULTILINE)
    for match in pattern.finditer(content):
        name = match.group(1)
        tokens[name] = file_path
    return tokens


def find_token_references(tokens, source_files):
    """For each token, count how many files reference it via var(--token-name)."""
    references = {}  # token -> set of file paths
    token_names = list(tokens.keys())

    # Build a combined regex for all tokens to scan in one pass per file
    # Sort by longest first to avoid partial matches
    token_names.sort(key=len, reverse=True)
    
    for file_path in source_files:
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        rel_path = file_path.relative_to(PROJECT_ROOT)
        str_path = str(rel_path).replace("\\", "/")

        for token in token_names:
            # Search for var(--token-name) in the file content
            search_pattern = re.escape(f"var(--{token[2:]})")  # strip leading -- from pattern
            if re.search(search_pattern, content):
                if token not in references:
                    references[token] = []
                references[token].append(str_path)

    return references


def categorize_token(token_name, token_source):
    """Categorize a token by its purpose."""
    if token_source and "factory-nerve" in str(token_source):
        prefix = "FN"
    else:
        prefix = "IT"  # Iron & Teal

    # Check if it's a raw color
    if token_name.startswith("--iron-") or token_name.startswith("--teal-") or \
       token_name.startswith("--stone-") or token_name.startswith("--amber-") or \
       token_name.startswith("--green-") or token_name.startswith("--red-") or \
       token_name.startswith("--blue-"):
        return ("Raw Color", prefix)
    
    if token_name.startswith("--prim-"):
        return ("Raw Color (FactoryNerve)", "FN")
    
    # Check categories
    categories = {
        "--bg-": "Surface/Background",
        "--text-": "Text Color",
        "--border-": "Border Color",
        "--interactive-": "Interactive",
        "--chart-": "Chart",
        "--shadow-": "Shadow",
        "--font-": "Typography",
        "--space-": "Spacing",
        "--radius-": "Border Radius",
        "--layout-": "Layout",
        "--weight-": "Font Weight",
        "--leading-": "Line Height",
        "--tracking-": "Letter Spacing",
        "--btn-": "Button Component",
        "--input-": "Input Component",
        "--card-": "Card Component",
        "--nav-": "Navigation",
        "--topbar-": "Topbar",
        "--table-": "Table",
        "--scrollbar-": "Scrollbar",
        "--role-": "User Role",
        "--surface-": "Surface Alias",
        "--action-": "Action Alias",
        "--status-": "Status Alias",
        "--workflow-": "Workflow",
        "--ai-": "AI",
        "--confidence-": "Confidence",
        "--focus-": "Focus Ring",
        "--glow-": "Glow Effect",
        "--glass-": "Glassmorphism",
        "--command-": "Command Palette",
        "--gradient-": "Gradient",
        "--z-": "Z-Index",
        "--motion-": "Motion/Timing",
        "--ease-": "Easing",
        "--density-": "Density",
        "--feedback-": "Feedback",
        "--spinner-": "Spinner",
        "--signal-": "Signal",
        "--success": "Status Alias",
        "--warning": "Status Alias",  
        "--danger": "Status Alias",
        "--accent-": "Accent Alias",
        "--divider-": "Divider",
        "--perspective-": "3D Effect",
        "--tilt-": "3D Effect",
        "--shell-": "Shell",
        "--badge-": "Badge",
        "--ocr-": "OCR",
        "--color-": "Semantic Color (FactoryNerve)",
        "--divider": "Divider",
        "--color-accent-": "Accent (FactoryNerve)",
        "--color-status-": "Status (FactoryNerve)",
        "--color-interactive-": "Interactive (FactoryNerve)",
        "--color-surface-": "Surface (FactoryNerve)",
        "--color-text-": "Text (FactoryNerve)",
        "--color-border-": "Border (FactoryNerve)",
    }

    for prefix, category in categories.items():
        if token_name.startswith(prefix):
            return (category, prefix)

    # General aliases
    alias_tokens = ["--bg", "--card", "--text", "--border", "--accent", "--shadow",
                    "--transition-", "--divider", "--signal", "--spinner", "--success",
                    "--warning", "--danger", "--stagger-", "--type-", "--layout-"]
    for alias in alias_tokens:
        if token_name.startswith(alias):
            return ("Alias/Utility", "Alias")
    
    return ("Uncategorized", "?")


def main():
    print("=" * 72)
    print("  Phase 0.3 — Token Usage Audit")
    print("=" * 72)

    # Step 1: Extract token definitions
    all_tokens = {}
    for tf in TOKEN_FILES:
        if tf.exists():
            tokens = extract_token_definitions(tf)
            all_tokens.update(tokens)
            rel = tf.relative_to(PROJECT_ROOT)
            print(f"  Extracted {len(tokens)} tokens from {rel}")
        else:
            print(f"  SKIP: {tf} not found")

    print(f"\n  Total unique tokens: {len(all_tokens)}")

    # Step 2: Collect all source files
    source_files = collect_all_source_files(SRC_DIR)
    print(f"  Source files scanned: {len(source_files)}")

    # Also scan the governed directory
    if OCR_GOVERNED_DIR.exists():
        gov_files = collect_all_source_files(OCR_GOVERNED_DIR)
        source_files.extend(gov_files)
        print(f"  Governed OCR files: {len(gov_files)}")

    # Step 3: Find references
    print("\n  Scanning for var(--token) references...")
    references = find_token_references(all_tokens, source_files)
    print(f"  Found references for {len(references)} tokens")

    # Step 4: Generate report
    report_lines = []
    report_lines.append("# Token Usage Audit Report — Phase 0.3\n")
    report_lines.append(f"Generated: automated scan\n")
    report_lines.append(f"Total tokens defined: {len(all_tokens)}\n")
    report_lines.append(f"Tokens with at least 1 reference: {len(references)}\n")
    report_lines.append(f"Total source files scanned: {len(source_files)}\n\n")

    # Unused tokens (defined but never referenced via var())
    unused = {t: src for t, src in all_tokens.items() if t not in references}
    
    # Tokens used ONLY in tokens.css itself (self-references like var(--iron-950))
    self_only = {}
    for token, refs in references.items():
        ref_paths = set(refs)
        token_src = all_tokens.get(token)
        # Check if all refs are within token CSS files themselves
        token_css_refs = {r for r in ref_paths if r.endswith("tokens.css")}
        other_refs = ref_paths - token_css_refs
        if not other_refs:
            self_only[token] = token_src
    
    # Used tokens
    used = {t: refs for t, refs in references.items() if t not in self_only}
    
    # Report: Unused tokens
    report_lines.append("---\n## Unused Tokens (0 references anywhere)\n")
    report_lines.append(f"Count: {len(unused)}\n\n")
    
    if unused:
        report_lines.append("| Token | Category | Source |\n")
        report_lines.append("|---|---|---|\n")
        for token in sorted(unused.keys()):
            src = unused[token]
            cat, prefix = categorize_token(token, src)
            src_name = str(src.relative_to(PROJECT_ROOT)) if src else "unknown"
            report_lines.append(f"| `{token}` | {cat} | {src_name} |\n")
    
    # Report: Self-referenced only
    report_lines.append("\n---\n## Self-Referenced Tokens (only referenced inside tokens.css)\n")
    report_lines.append(f"Count: {len(self_only)}\n")
    report_lines.append("These tokens are used as building blocks for other tokens but never directly in components.\n\n")
    
    if self_only:
        report_lines.append("| Token | Category | Source |\n")
        report_lines.append("|---|---|---|\n")
        for token in sorted(self_only.keys()):
            src = self_only[token]
            cat, prefix = categorize_token(token, src)
            src_name = str(src.relative_to(PROJECT_ROOT)) if src else "unknown"
            report_lines.append(f"| `{token}` | {cat} | {src_name} |\n")
    
    # Report: Used tokens summary by category
    report_lines.append("\n---\n## Used Tokens (referenced in components)\n")
    report_lines.append(f"Count: {len(used)}\n\n")
    
    # Group by category
    cat_groups = {}
    for token, refs in used.items():
        src = all_tokens.get(token)
        cat, prefix = categorize_token(token, src)
        if cat not in cat_groups:
            cat_groups[cat] = []
        cat_groups[cat].append((token, refs))
    
    for cat in sorted(cat_groups.keys()):
        items = cat_groups[cat]
        report_lines.append(f"### {cat} ({len(items)} tokens)\n\n")
        report_lines.append("| Token | References | Ref Count |\n")
        report_lines.append("|---|---|---|\n")
        for token, refs in sorted(items):
            report_lines.append(f"| `{token}` | {', '.join(sorted(set(refs))[:5])}{'...' if len(set(refs)) > 5 else ''} | {len(set(refs))} |\n")
        report_lines.append("\n")

    # Special section: Glassmorphism tokens
    glass_tokens = {t: src for t, src in all_tokens.items() if t.startswith("--glass-")}
    used_glass = {t: refs for t, refs in references.items() if t.startswith("--glass-") and t not in self_only}
    
    report_lines.append("---\n## Glassmorphism Tokens (targeted for removal)\n")
    report_lines.append(f"Total defined: {len(glass_tokens)}\n")
    report_lines.append(f"Used in components: {len(used_glass)}\n\n")
    
    if glass_tokens:
        report_lines.append("| Token | Used? | In Components? |\n")
        report_lines.append("|---|---|---|\n")
        for token in sorted(glass_tokens.keys()):
            in_components = token in used
            in_tokens = token in self_only
            is_unused = token not in references
            status = "❌ UNUSED" if is_unused else ("⚠️ Self-ref only" if in_tokens else "✅ Used in components")
            report_lines.append(f"| `{token}` | {status} | {'Yes' if in_components else ('No' if unused else 'Only in tokens.css')} |\n")

    # Special section: Duplicate/spacing tokens
    report_lines.append("\n---\n## Duplicate Token Values\n")
    report_lines.append("Tokens that are direct aliases of other tokens (e.g., --surface-app = --bg-canvas):\n\n")
    
    # Find tokens that are just var() references to other tokens
    alias_tokens = {}
    for token, src in all_tokens.items():
        content = src.read_text(encoding="utf-8")
        # Find the definition line for this token
        pattern = re.compile(rf"^\s+{re.escape(token)}:\s*var\(([^)]+)\)\s*;", re.MULTILINE)
        match = pattern.search(content)
        if match:
            alias_tokens[token] = match.group(1)
    
    if alias_tokens:
        report_lines.append("| Alias Token | Points To | Category |\n")
        report_lines.append("|---|---|---|\n")
        for token in sorted(alias_tokens.keys()):
            cat, _ = categorize_token(token, all_tokens.get(token))
            report_lines.append(f"| `{token}` | `{alias_tokens[token]}` | {cat} |\n")

    # Summary
    report_lines.append("\n---\n## Summary\n\n")
    report_lines.append(f"| Metric | Value |\n")
    report_lines.append("|---|---|\n")
    report_lines.append(f"| Total tokens defined | {len(all_tokens)} |\n")
    report_lines.append(f"| Tokens with references in components | {len(used)} |\n")
    report_lines.append(f"| Self-referenced only (in tokens.css) | {len(self_only)} |\n")
    report_lines.append(f"| Completely unused | {len(unused)} |\n")
    report_lines.append(f"| Glassmorphism tokens defined | {len(glass_tokens)} |\n")
    report_lines.append(f"| Glassmorphism tokens unused | {len([t for t in glass_tokens if t not in references])} |\n")
    report_lines.append(f"| Direct alias tokens | {len(alias_tokens)} |\n")

    # Write report
    report_path = PROJECT_ROOT / "TOKEN_AUDIT_REPORT.md"
    report_path.write_text("".join(report_lines), encoding="utf-8")
    print(f"\n  Report written to: TOKEN_AUDIT_REPORT.md")
    print(f"  Total tokens scanned: {len(all_tokens)}")
    print(f"  Unused: {len(unused)}")
    print(f"  Self-referenced only: {len(self_only)}")
    print(f"  Used in components: {len(used)}")
    print("=" * 72)

    # Return structured output for parent
    return {
        "total_tokens": len(all_tokens),
        "unused_count": len(unused),
        "self_referenced_count": len(self_only),
        "used_in_components_count": len(used),
        "glass_tokens_total": len(glass_tokens),
        "glass_tokens_unused": len([t for t in glass_tokens if t not in references]),
        "alias_count": len(alias_tokens),
        "report_file": "TOKEN_AUDIT_REPORT.md",
    }


if __name__ == "__main__":
    result = main()
    # Output a simple summary
    print(f"\nRESULT={result}")
