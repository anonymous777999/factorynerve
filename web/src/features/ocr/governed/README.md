# features/ocr/governed — Governed OCR Workspace

This directory contains the governed OCR verification workspace (feature-flagged,
used by `/ocr/verify` with `?workspace=governed`).

## Migration status

This was merged from `src-v2/` during Phase 0.1 source tree reconciliation.
The `@/v2` import alias still works but is deprecated — use `@/features/ocr/governed`
for new imports.

## Structure

- `_governed/`: transplanted governed design substrate (to be migrated to Iron & Teal
  tokens in Phase 2 — Theme Unification).
- `adapters/`: backend-to-frontend contract mapping.
- `contracts/`: stable workspace-facing types.
- `engine/`, `primitives/`, `systems/`: governed exports for route use.
- `workspaces/`: feature-gated operational entry points.
- `utils/`: governed OCR business logic helpers.
