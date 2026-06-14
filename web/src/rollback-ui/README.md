# rollback-ui/ — OCR Verification Rollback Lane

This directory was renamed from `legacy-ui/` during Phase 0.2 to clarify its purpose.

## Purpose

This is the **production default** OCR verification experience. The "governed" OCR workspace
in `features/ocr/governed/` is feature-flagged (`USE_GOVERNED_OCR_WORKSPACE` + `?workspace=governed`).

This directory serves as the rollback lane: if the governed workspace has stability issues,
the route can revert to this page without code changes.

## Current contents

- `ocr/ocr-verification-v2-page.tsx`: Production OCR verification workspace (default for `/ocr/verify`)

## Removal criteria

This directory can be deleted once:
1. The governed OCR workspace (`features/ocr/governed/`) becomes the production default (flag removed)
2. The governed workspace has been stable in production for one release cycle
3. No rollback has been needed in that cycle