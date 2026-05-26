// Explicit opt-in: only ON when value is exactly "true"
export const USE_TANSTACK_TABLE =
    process.env.NEXT_PUBLIC_USE_TANSTACK_TABLE === "true";

// OCR verification v2 is now the default migrated experience.
export const NEW_OCR_VERIFY = true;

// Explicit opt-in for governed OCR execution workspace migration.
export const USE_GOVERNED_OCR_WORKSPACE =
    process.env.NEXT_PUBLIC_USE_GOVERNED_OCR_WORKSPACE === "true";

// Explicit opt-in for URL param guard redirects on auth token routes.
export const AUTH_ROUTE_PARAM_GUARDS =
    process.env.NEXT_PUBLIC_AUTH_ROUTE_PARAM_GUARDS === "true";
