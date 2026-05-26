Governed frontend boundary for phased OCR migration.

Structure:
- `_governed/`: transplanted governed design substrate copied from the external source.
- `adapters/`: backend-to-frontend contract mapping.
- `contracts/`: stable workspace-facing types.
- `engine/`, `primitives/`, `systems/`: governed exports for route use.
- `workspaces/`: feature-gated operational entry points.
