// Explicit opt-in: only ON when value is exactly "true"
export const USE_TANSTACK_TABLE =
    process.env.NEXT_PUBLIC_USE_TANSTACK_TABLE === "true";

// Explicit opt-in for the deterministic OCR verify workflow migration.
export const NEW_OCR_VERIFY =
    process.env.NEXT_PUBLIC_NEW_OCR_VERIFY === "true";

// Explicit opt-in for URL param guard redirects on auth token routes.
export const AUTH_ROUTE_PARAM_GUARDS =
    process.env.NEXT_PUBLIC_AUTH_ROUTE_PARAM_GUARDS === "true";
