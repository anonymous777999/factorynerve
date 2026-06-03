# DPR.ai Frontend Redesign Specs

This folder is the planning source of truth for the DPR.ai frontend modernization work.

## Primary Blueprint

- `DPR_MODERNIZATION_MASTER_BLUEPRINT.md` defines the global visual language, token direction, component behavior, and page-by-page modernization intent.
- `PRODUCT_WORKSPACE_TOPOLOGY.md` maps routes, domains, backend ownership, permissions, and workspace classifications.
- `WORKSPACE_SKELETON_*.md` files are route-level implementation references. Use them to guide layout, density, information hierarchy, and acceptance criteria for each workspace.

## Implementation Rule

When continuing frontend work, prefer the active app under `web/src`. Treat `web/src-v2` as archived/governed reference material unless a future task explicitly migrates it into the active application.

## Hygiene Notes

- Keep generated previews, local screenshots, build output, and runtime logs out of source control.
- Keep authored specs in this folder tracked so frontend decisions stay reproducible.
- Fix encoding issues before committing generated or imported Markdown.
