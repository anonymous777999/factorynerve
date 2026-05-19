import assert from "node:assert/strict";
import test from "node:test";

import type { NextRequest } from "next/server";

import { middleware } from "../middleware";

function createJwt(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `${header}.${payload}.signature`;
}

function createRequest(
  pathname: string,
  cookies?: { dpr_access?: string; auth_session?: string },
): NextRequest {
  const url = new URL(`https://example.com${pathname}`);
  const rawCookie = Object.entries(cookies || {})
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  return {
    url: url.toString(),
    nextUrl: {
      pathname: url.pathname,
      hostname: url.hostname,
      clone: () => new URL(url.toString()),
    },
    headers: {
      get: (name: string) => (name.toLowerCase() === "cookie" ? rawCookie || null : null),
    },
    cookies: {
      get: (name: string) => {
        const value = cookies?.[name as keyof typeof cookies];
        return value ? { value } : undefined;
      },
    },
  } as unknown as NextRequest;
}

test("operator cookie -> /billing -> redirects to /403", async () => {
  const response = await middleware(createRequest("/billing", { dpr_access: createJwt("operator") }));
  assert.equal(response.headers.get("location"), "https://example.com/403");
});

test("admin cookie -> /billing -> passes through", async () => {
  const response = await middleware(createRequest("/billing", { dpr_access: createJwt("admin") }));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("auth_session cookie -> /dashboard -> passes through", async () => {
  const response = await middleware(createRequest("/dashboard", { auth_session: "session-token" }));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("auth_session cookie -> /billing -> resolves owner role from /auth/me", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { role: "owner", org_id: "org_123" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const response = await middleware(createRequest("/billing", { auth_session: "session-token" }));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("auth_session cookie -> /billing -> rejects operator role from /auth/me", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { role: "operator", org_id: "org_123" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const response = await middleware(createRequest("/billing", { auth_session: "session-token" }));
    assert.equal(response.headers.get("location"), "https://example.com/403");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no cookie -> /billing -> redirects to /access", async () => {
  const response = await middleware(createRequest("/billing"));
  assert.equal(response.headers.get("location"), "https://example.com/access?next=%2Fbilling");
});

test("any role -> /dashboard -> passes through", async () => {
  const response = await middleware(createRequest("/dashboard", { dpr_access: createJwt("operator") }));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});
