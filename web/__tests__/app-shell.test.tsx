import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PERMISSIONS, type Permissions } from "../src/lib/auth";
import { getVisibleNavSections } from "../src/components/layout/app-shell";

function makePermissions(overrides: Partial<Permissions>): Permissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...overrides,
  };
}

function getLabels(permissions: Permissions) {
  return getVisibleNavSections(
    new Set([
      "/dashboard",
      "/work-queue",
      "/tasks",
      "/entry",
      "/ocr/scan",
      "/ocr/history",
      "/attendance",
      "/profile",
    ]),
    permissions,
    null,
  )
    .flatMap((section) => section.items)
    .map((item) => item.label);
}

test("operator role - billing nav item not rendered", () => {
  const labels = getLabels(makePermissions({ can_view_billing: false }));
  assert.equal(labels.includes("Billing & Invoices"), false);
});

test("admin role - billing nav item rendered", () => {
  const labels = getLabels(makePermissions({ can_view_billing: true }));
  assert.equal(labels.includes("Billing & Invoices"), true);
});

test("supervisor role - analytics nav item rendered", () => {
  const labels = getLabels(makePermissions({ can_view_analytics: true }));
  assert.equal(labels.includes("Performance"), true);
});

test("operator role - analytics nav item not rendered", () => {
  const labels = getLabels(makePermissions({ can_view_analytics: false }));
  assert.equal(labels.includes("Performance"), false);
});
