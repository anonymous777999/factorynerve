# DPR.ai MCP Governance System

This directory contains **reference-driven MCP systems** that preserve product taste, visual consistency, and operational UX philosophy for DPR.ai.

## Purpose

These governance files prevent AI agents from:
- Generating generic admin dashboards
- Introducing cyberpunk aesthetics
- Breaking scroll architecture
- Violating typography rules
- Adding gradient backgrounds
- Creating layout instability

## Structure

```
.mcp/
├── governance/
│   ├── product-memory/          # Visual doctrine, emotional direction
│   ├── frontend-architecture/   # AppShell, scroll ownership, layout
│   ├── design-system/           # Typography, color, surfaces, spacing
│   ├── ai-workspace/            # AI panel behavior, intelligence patterns
│   └── engineering/             # Debugging workflow, implementation rules
├── memory/                      # Reference index, decision log
├── agents/                      # Agent configurations
└── tools/                       # Validation and indexing scripts
```

## Target Feeling

DPR.ai should feel like:
- ✅ Linear, Arc Browser, Attio, Stripe Dashboard, Notion, Vercel, Perplexity
- ✅ Calm, intelligent, breathable, operational, trustworthy, elegant, premium
- ✅ Modern AI-native operational software

NOT like:
- ❌ SOC dashboards, SIEM systems, cyberpunk, hacker UI
- ❌ Bootstrap admin panels, old enterprise software
- ❌ Dark-bootstrap-like, visually exhausting, operationally cluttered

## Visual Rules (Permanent)

✅ **DO:**
- Sentence case everywhere
- Inter font family
- 14px body text
- Single indigo accent (#6366f1)
- Surface differentiation over borders
- Calm, breathable spacing

❌ **DON'T:**
- Uppercase labels
- Monospace for UI text
- Gradient backgrounds
- Glow effects
- Multiple accent colors
- Cyberpunk aesthetics

## Architecture Rules

- Page does NOT scroll, content area scrolls
- AppShell is architecture-critical (changes require approval)
- Scroll containers must have explicit height containment
- Flex children that scroll need `min-h-0`

## Usage

AI agents should:
1. Read relevant governance files before making changes
2. Validate changes against anti-patterns
3. Reference decision log for context
4. Update memory when making architectural decisions
