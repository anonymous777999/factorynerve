# Handling External UI Drafts (v0 / Lovable / Bolt / Magic Patterns / Figma)

The human may bring drafts generated elsewhere. These are **references, not final code.**

## Rule of thumb
- **Structure & hierarchy:** adopt (layout, order, what's grouped with what).
- **Spacing & sizing:** adopt as intent, then snap to our `--space-*` scale.
- **Colors, fonts, shadows, radii:** REPLACE with our tokens. Drafts ship generic themes.
- **Component library:** REPLACE their primitives with our shadcn `@/components/ui/*`.
- **`cn`/utils:** REPLACE with our `@/lib/utils`.

## Workflow when given a draft
1. Identify the target route/component in `web/src`.
2. Extract the layout skeleton (grid/flex structure, breakpoints).
3. Rebuild it with our primitives + tokens (use shadcn/Magic MCP to fill component gaps).
4. Run the per-change checklist in `CONVENTIONS.md`.
5. Screenshot at 360/768/1024/1440; compare intent, not pixel-for-pixel.

## Figma / Relume / Subframe / TeleportHQ mockups
- Treat as source of truth for **layout, spacing, hierarchy** only.
- Still translate visuals into our tokens. Don't import their exported CSS/hex.
