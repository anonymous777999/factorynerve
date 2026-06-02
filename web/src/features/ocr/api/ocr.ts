/**
 * features/ocr/api — server contract for OCR pipeline.
 *
 * Migration shim: wildcard re-exports from `@/lib/ocr`. The OCR API
 * surface is large; we use `export *` here and tighten later if a
 * stricter public contract is needed.
 */

export * from "@/lib/ocr";
