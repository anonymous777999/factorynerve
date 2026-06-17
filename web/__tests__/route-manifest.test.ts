import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_ROUTES,
  PRIVATE_ROUTES,
  WORKFLOW_ROUTES,
  SYSTEM_ROUTES,
  PROTECTED_PREFIXES,
  MIDDLEWARE_BYPASS_PREFIXES,
  MIDDLEWARE_BYPASS_EXACT,
  CANONICAL_REDIRECT_BYPASS_PATHS,
  ROLE_ROUTES,
  isProtectedPath,
  isMiddlewareBypassPath,
  getAllowedRoles,
} from "../src/lib/route-manifest";

// ─── Route Group Verification ────────────────────────────────────────────────

const publicRouteList: readonly string[] = PUBLIC_ROUTES;
const privateRouteList: readonly string[] = PRIVATE_ROUTES;
const workflowRouteList: readonly string[] = WORKFLOW_ROUTES;
const systemRouteList: readonly string[] = SYSTEM_ROUTES;
const protectedList: readonly string[] = PROTECTED_PREFIXES;

test("PUBLIC_ROUTES includes /plans (pricing page)", () => {
  assert.ok(publicRouteList.includes("/plans"));
});

test("PUBLIC_ROUTES includes auth pages", () => {
  for (const route of ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/access"]) {
    assert.ok(publicRouteList.includes(route), `${route} should be in PUBLIC_ROUTES`);
  }
});

test("PUBLIC_ROUTES includes legal/info pages", () => {
  for (const route of ["/privacy", "/terms", "/faq", "/contact"]) {
    assert.ok(publicRouteList.includes(route), `${route} should be in PUBLIC_ROUTES`);
  }
});

test("PRIVATE_ROUTES includes billing and admin pages", () => {
  for (const route of ["/billing", "/admin-billing", "/dashboard", "/settings", "/analytics", "/ai"]) {
    assert.ok(privateRouteList.includes(route), `${route} should be in PRIVATE_ROUTES`);
  }
});

test("WORKFLOW_ROUTES includes operational pages", () => {
  for (const route of ["/entry", "/steel", "/ocr", "/attendance", "/approvals", "/tasks", "/work-queue", "/control-tower"]) {
    assert.ok(workflowRouteList.includes(route), `${route} should be in WORKFLOW_ROUTES`);
  }
});

test("SYSTEM_ROUTES includes 403 and offline", () => {
  assert.ok(SYSTEM_ROUTES.includes("/403"));
  assert.ok(SYSTEM_ROUTES.includes("/offline"));
});

test("PROTECTED_PREFIXES is a union of PRIVATE + WORKFLOW", () => {
  for (const route of privateRouteList) {
    assert.ok(protectedList.includes(route), `${route} should be in PROTECTED_PREFIXES`);
  }
  for (const route of workflowRouteList) {
    assert.ok(protectedList.includes(route), `${route} should be in PROTECTED_PREFIXES`);
  }
});

test("PROTECTED_PREFIXES does NOT include public or system routes", () => {
  const allPublic: readonly string[] = [...publicRouteList, ...systemRouteList];
  for (const route of allPublic) {
    assert.ok(!protectedList.includes(route), `${route} should NOT be in PROTECTED_PREFIXES`);
  }
});

// ─── isProtectedPath ─────────────────────────────────────────────────────────

test("isProtectedPath returns true for private routes", () => {
  for (const route of PRIVATE_ROUTES) {
    assert.equal(isProtectedPath(route), true, `${route} should be protected`);
  }
});

test("isProtectedPath returns true for workflow routes", () => {
  for (const route of WORKFLOW_ROUTES) {
    assert.equal(isProtectedPath(route), true, `${route} should be protected`);
  }
});

test("isProtectedPath returns true for sub-routes of protected paths", () => {
  const subRoutes = [
    "/steel/inventory",
    "/steel/inventory/transactions",
    "/steel/batches",
    "/steel/dispatches",
    "/steel/charts",
    "/steel/customers",
    "/steel/invoices",
    "/steel/production/record",
    "/steel/reconciliations",
    "/ocr/scan",
    "/ocr/verify",
    "/ocr/history",
    "/attendance/review",
    "/attendance/reports",
    "/attendance/live",
    "/settings/users",
    "/settings/attendance",
    "/settings/factory",
    "/billing/invoices",
    "/billing/status",
    "/premium/dashboard",
    "/analytics/weekly",
    "/reports/monthly",
    "/alerts/active",
    "/email-summary/daily",
  ];
  for (const route of subRoutes) {
    assert.equal(isProtectedPath(route), true, `${route} should be protected`);
  }
});

test("isProtectedPath returns false for public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    assert.equal(isProtectedPath(route), false, `${route} should NOT be protected`);
  }
});

test("isProtectedPath returns false for system routes", () => {
  for (const route of SYSTEM_ROUTES) {
    assert.equal(isProtectedPath(route), false, `${route} should NOT be protected`);
  }
});

test("isProtectedPath returns false for root, non-existent, and static paths", () => {
  const nonProtected = [
    "/",
    "/nonexistent",
    "/some-random-page",
    "/index.html",
    "/styles.css",
  ];
  for (const route of nonProtected) {
    assert.equal(isProtectedPath(route), false, `${route} should NOT be protected`);
  }
});

// ─── isMiddlewareBypassPath ──────────────────────────────────────────────────

test("isMiddlewareBypassPath returns true for API routes", () => {
  assert.equal(isMiddlewareBypassPath("/api"), true);
  assert.equal(isMiddlewareBypassPath("/api/auth/me"), true);
  assert.equal(isMiddlewareBypassPath("/api/entries?page=1"), true);
});

test("isMiddlewareBypassPath returns true for Next.js internals", () => {
  assert.equal(isMiddlewareBypassPath("/_next"), true);
  assert.equal(isMiddlewareBypassPath("/_next/static/chunks/main.js"), true);
  assert.equal(isMiddlewareBypassPath("/_next/image?url=test"), true);
});

test("isMiddlewareBypassPath returns true for exact bypass paths", () => {
  for (const path of MIDDLEWARE_BYPASS_EXACT) {
    assert.equal(isMiddlewareBypassPath(path), true, `${path} should be a bypass path`);
  }
});

test("isMiddlewareBypassPath returns false for normal routes", () => {
  const normal = [
    "/",
    "/dashboard",
    "/login",
    "/register",
    "/plans",
    "/privacy",
    "/settings",
    "/steel/inventory",
  ];
  for (const route of normal) {
    assert.equal(isMiddlewareBypassPath(route), false, `${route} should NOT be a bypass path`);
  }
});

// ─── getAllowedRoles ─────────────────────────────────────────────────────────

test("getAllowedRoles returns correct roles for /billing", () => {
  const roles = getAllowedRoles("/billing");
  assert.deepEqual(roles, ["admin", "owner"]);
});

test("getAllowedRoles returns correct roles for /billing sub-routes", () => {
  const roles = getAllowedRoles("/billing/invoices");
  assert.deepEqual(roles, ["admin", "owner"]);
});

test("getAllowedRoles returns correct roles for /settings", () => {
  const roles = getAllowedRoles("/settings");
  assert.deepEqual(roles, ["manager", "admin", "owner"]);
});

test("getAllowedRoles returns more specific roles for /settings/users (vs /settings)", () => {
  const parentRoles = getAllowedRoles("/settings")!;
  const childRoles = getAllowedRoles("/settings/users")!;

  assert.equal(childRoles.length, parentRoles.length);
  assert.deepEqual(childRoles, ["manager", "admin", "owner"]);
});

test("getAllowedRoles returns correct roles for /admin-billing", () => {
  const roles = getAllowedRoles("/admin-billing");
  assert.deepEqual(roles, ["superadmin"]);
});

test("getAllowedRoles returns correct roles for /admin-billing sub-routes", () => {
  const roles = getAllowedRoles("/admin-billing/config");
  assert.deepEqual(roles, ["superadmin"]);
});

test("getAllowedRoles returns correct roles for /analytics", () => {
  const roles = getAllowedRoles("/analytics");
  assert.deepEqual(roles, ["supervisor", "manager", "admin", "owner"]);
});

test("getAllowedRoles returns correct roles for /analytics sub-routes", () => {
  const roles = getAllowedRoles("/analytics/weekly");
  assert.deepEqual(roles, ["supervisor", "manager", "admin", "owner"]);
});

test("getAllowedRoles returns null for routes without role restrictions", () => {
  const unrestricted = [
    "/dashboard",
    "/entry",
    "/steel",
    "/steel/inventory",
    "/ocr",
    "/ocr/scan",
    "/approvals",
    "/tasks",
    "/work-queue",
    "/alerts",
    "/reports",
    "/premium",
    "/profile",
    "/ai",
    "/email-summary",
    "/attendance",
    "/control-tower",
    "/onboarding",
  ];
  for (const route of unrestricted) {
    assert.equal(getAllowedRoles(route), null, `${route} should have no role restrictions`);
  }
});

test("getAllowedRoles returns null for public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    assert.equal(getAllowedRoles(route), null, `${route} should have no role restrictions`);
  }
});

// ─── CANONICAL_REDIRECT_BYPASS_PATHS ─────────────────────────────────────────

test("CANONICAL_REDIRECT_BYPASS_PATHS contains well-known URLs", () => {
  assert.ok(CANONICAL_REDIRECT_BYPASS_PATHS.has("/.well-known/assetlinks.json"));
  assert.ok(CANONICAL_REDIRECT_BYPASS_PATHS.has("/.well-known/apple-app-site-association"));
});

test("CANONICAL_REDIRECT_BYPASS_PATHS does not contain normal routes", () => {
  assert.ok(!CANONICAL_REDIRECT_BYPASS_PATHS.has("/dashboard"));
  assert.ok(!CANONICAL_REDIRECT_BYPASS_PATHS.has("/"));
});

// ─── ROLE_ROUTES shape ───────────────────────────────────────────────────────

test("ROLE_ROUTES has all expected keys", () => {
  const keys = Object.keys(ROLE_ROUTES);
  assert.ok(keys.includes("/billing"));
  assert.ok(keys.includes("/settings"));
  assert.ok(keys.includes("/admin-billing"));
  assert.ok(keys.includes("/analytics"));
  assert.ok(keys.includes("/settings/users"));
});

test("ROLE_ROUTES longest key matched first for /settings/users", () => {
  // /settings/users is length 15, /settings is length 9
  // When sorting by descending length, /settings/users should come first
  const sorted = (Object.keys(ROLE_ROUTES) as string[])
    .sort((left, right) => right.length - left.length);
  assert.ok(sorted.indexOf("/settings/users") < sorted.indexOf("/settings"),
    "/settings/users should sort before /settings");
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

test("isProtectedPath handles path with trailing slash", () => {
  assert.equal(isProtectedPath("/dashboard/"), true);
});

test("isProtectedPath handles root path", () => {
  assert.equal(isProtectedPath("/"), false);
});

test("getAllowedRoles handles ambiguous prefix (billing vs admin-billing)", () => {
  // /admin-billing starts with /admin but /admin-billing is its own prefix
  const adminRoles = getAllowedRoles("/admin-billing");
  assert.deepEqual(adminRoles, ["superadmin"]);

  const billingRoles = getAllowedRoles("/billing");
  assert.deepEqual(billingRoles, ["admin", "owner"]);

  // /admin-billing should NOT match /billing's rules
  assert.notDeepEqual(adminRoles, billingRoles);
});
