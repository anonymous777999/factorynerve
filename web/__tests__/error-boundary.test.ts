import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiError } from "../src/components/api-error-boundary";

test("403 with SESSION_UPDATED redirects to /access", () => {
  const resolution = resolveApiError({
    path: "/entries",
    method: "GET",
    status: 403,
    detail: { code: "SESSION_UPDATED" },
  });
  assert.deepEqual(resolution, {
    action: "redirect",
    href: "/access?reason=permissions_updated",
  });
});

test("403 with INSUFFICIENT_RANK shows toast and does not redirect", () => {
  const resolution = resolveApiError({
    path: "/settings/users/2/role",
    method: "PUT",
    status: 403,
    detail: { code: "INSUFFICIENT_RANK" },
  });
  assert.deepEqual(resolution, {
    action: "toast",
    title: "Action not permitted",
    description: "Action not permitted for your role",
  });
});

test("generic 403 redirects to /403", () => {
  const resolution = resolveApiError({
    path: "/billing",
    method: "GET",
    status: 403,
    detail: { detail: "Access denied." },
  });
  assert.deepEqual(resolution, {
    action: "redirect",
    href: "/403",
  });
});

test("404 does not redirect", () => {
  const resolution = resolveApiError({
    path: "/entries/99",
    method: "GET",
    status: 404,
    detail: { detail: "Not found" },
  });
  assert.deepEqual(resolution, { action: "ignore" });
});
