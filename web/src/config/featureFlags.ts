// Explicit opt-in: only ON when value is exactly "true"
export const USE_TANSTACK_TABLE =
    process.env.NEXT_PUBLIC_USE_TANSTACK_TABLE === "true";

// OCR verification v2 is now the default migrated experience.
export const NEW_OCR_VERIFY = true;

// Governed OCR execution workspace — disabled until the infinite-loop bugs
// in useOCRExecutionWorkspace and useGovernedOcrVerificationController are
// fully resolved. Falls back to the stable OcrVerificationV2Page.
export const USE_GOVERNED_OCR_WORKSPACE = false;

// Explicit opt-in for URL param guard redirects on auth token routes.
export const AUTH_ROUTE_PARAM_GUARDS =
    process.env.NEXT_PUBLIC_AUTH_ROUTE_PARAM_GUARDS === "true";
