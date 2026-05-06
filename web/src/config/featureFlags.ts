// Explicit opt-in: only ON when value is exactly "true"
// @ts-ignore - Next.js injects process.env at build time
export const USE_TANSTACK_TABLE =
    typeof process !== "undefined" && process?.env?.NEXT_PUBLIC_USE_TANSTACK_TABLE === "true";
