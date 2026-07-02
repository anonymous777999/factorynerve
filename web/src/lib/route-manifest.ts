// ─── Route Manifest ──────────────────────────────────────────────────────────
// Single source of truth for all route classifications used by middleware
// and the rest of the application. Mirrors the Next.js route groups:
//   (public)  → PUBLIC_ROUTES
//   (private) → PRIVATE_ROUTES
//   (workflow)→ WORKFLOW_ROUTES
//   (system)  → SYSTEM_ROUTES

// ─── Public Routes ───────────────────────────────────────────────────────────
// Accessible without authentication. Includes auth pages, marketing, legal.

export const PUBLIC_ROUTES = [
  "/access",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/plans",
  "/privacy",
  "/terms",
  "/cookies",
  "/eula",
  "/dpa",
  "/disclosure",
  "/acceptable-use",
  "/data-retention",
  "/refunds",
  "/sla",
  "/subprocessors",
  "/compliance",
  "/contact",
  "/faq",
] as const;

// ─── Private Routes ──────────────────────────────────────────────────────────
// Require authentication. Business management pages.

export const PRIVATE_ROUTES = [
  "/dashboard",
  "/analytics",
  "/reports",
  "/alerts",
  "/billing",
  "/admin-billing",
  "/premium",
  "/profile",
  "/settings",
  "/onboarding",
  "/ai",
  "/email-summary",
] as const;

// ─── Workflow Routes ─────────────────────────────────────────────────────────
// Require authentication. Day-to-day factory operations.

export const WORKFLOW_ROUTES = [
  "/entry",
  "/attendance",
  "/approvals",
  "/tasks",
  "/work-queue",
  "/ocr",
  "/steel",
  "/control-tower",
] as const;

// ─── System Routes ───────────────────────────────────────────────────────────
// Error pages and fallback routes.

export const SYSTEM_ROUTES = [
  "/403",
  "/offline",
] as const;

// ─── Auth Guards ─────────────────────────────────────────────────────────────

/** Combined list of all routes that require authentication */
export const PROTECTED_PREFIXES: readonly string[] = [
  ...PRIVATE_ROUTES,
  ...WORKFLOW_ROUTES,
];

/** Prefix-based paths that bypass all middleware checks (system paths) */
export const MIDDLEWARE_BYPASS_PREFIXES = [
  "/api",
  "/_next",
] as const;

/** Exact-match paths that bypass all middleware checks */
export const MIDDLEWARE_BYPASS_EXACT = [
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
] as const;

// ─── Canonical Redirect ──────────────────────────────────────────────────────

/** Paths that should bypass the canonical hostname redirect */
export const CANONICAL_REDIRECT_BYPASS_PATHS = new Set([
  "/.well-known/assetlinks.json",
  "/.well-known/apple-app-site-association",
]);

// ─── Role-Based Access Control ───────────────────────────────────────────────

export const ROLE_ROUTES = {
  "/billing": ["admin", "owner"],
  "/settings": ["manager", "admin", "owner"],
  "/admin-billing": ["superadmin"],
  "/analytics": ["supervisor", "manager", "admin", "owner"],
  "/settings/users": ["manager", "admin", "owner"],
} as const satisfies Record<string, readonly string[]>;

export type RoleRouteKey = keyof typeof ROLE_ROUTES;

// ─── Helper Functions ────────────────────────────────────────────────────────

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMiddlewareBypassPath(pathname: string): boolean {
  if ((MIDDLEWARE_BYPASS_EXACT as readonly string[]).includes(pathname)) {
    return true;
  }
  return MIDDLEWARE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getAllowedRoles(
  pathname: string,
): readonly string[] | null {
  const match = (Object.keys(ROLE_ROUTES) as string[])
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!match) return null;
  return ROLE_ROUTES[match as RoleRouteKey];
}
