import assert from "node:assert/strict";
import test from "node:test";

import type { NextRequest } from "next/server";

import { middleware } from "../../middleware";
import { getVisibleNavSections } from "../../src/components/layout/app-shell";
import { resolveApiError } from "../../src/components/shared/api-error-boundary";
import { resolveAccessReasonMessage } from "../../src/lib/access-reason";
import { resolveWorkspaceRecoveryPlan, type Permissions, DEFAULT_PERMISSIONS } from "../../src/lib/auth";

function createJwt(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `${header}.${payload}.signature`;
}

function createRequest(pathname: string, token?: string): NextRequest {
  const url = new URL(`https://example.com${pathname}`);
  return {
    nextUrl: {
      pathname: url.pathname,
      hostname: url.hostname,
      clone: () => new URL(url.toString()),
    },
    cookies: {
      get: (name: string) =>
        name === "dpr_access" && token ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

function makePermissions(overrides: Partial<Permissions>): Permissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...overrides,
  };
}

test("Flow 1 - operator trying billing is redirected to /403 by middleware", async () => {
  const response = await middleware(createRequest("/billing", createJwt("operator")));
  assert.equal(response.headers.get("location"), "https://example.com/403");
});

test("Flow 2 - admin demoted mid-session gets redirected with a clear access message", () => {
  const resolution = resolveApiError({
    path: "/reports",
    method: "GET",
    status: 403,
    detail: { code: "SESSION_UPDATED" },
  });
  assert.deepEqual(resolution, {
    action: "redirect",
    href: "/access?reason=permissions_updated",
  });

  const banner = resolveAccessReasonMessage("permissions_updated", (_key, fallback) => fallback || "");
  assert.equal(
    banner?.message,
    "Your account permissions have been updated by an administrator. Please sign in again to continue.",
  );
});

test("Flow 3 - factory removed mid-session auto-switches to the next workspace", () => {
  const plan = resolveWorkspaceRecoveryPlan(
    {
      activeFactoryId: "factory-a",
      factories: [
        { factory_id: "factory-a", name: "Factory A", role: "manager" },
        { factory_id: "factory-b", name: "Factory B", role: "manager" },
      ],
    },
    404,
  );
  assert.deepEqual(plan, {
    action: "switch",
    factoryId: "factory-b",
    factoryName: "Factory B",
  });
});

test("Flow 4 - active workspace context does not force onboarding redirect on transient auth errors", () => {
  const plan = resolveWorkspaceRecoveryPlan(
    {
      activeFactoryId: "factory-a",
      factories: [
        { factory_id: "factory-a", name: "Factory A", role: "manager" },
      ],
    },
    404,
  );
  assert.deepEqual(plan, { action: "ignore" });
});

test("Flow 5 - manager does not receive admin-only panel navigation affordances", () => {
  const labels = getVisibleNavSections(
    new Set(["/dashboard", "/settings", "/plans", "/billing", "/profile"]),
    makePermissions({
      can_manage_users: true,
      can_view_billing: true,
      can_view_admin_panel: false,
    }),
    null,
  )
    .flatMap((section) => section.items)
    .map((item) => item.label);

  assert.equal(labels.includes("Billing & Invoices"), true);
  assert.equal(labels.includes("Admin Billing"), false);
});
