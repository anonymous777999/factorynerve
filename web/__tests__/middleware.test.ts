import assert from "node:assert/strict";
import test from "node:test";

import type { NextRequest } from "next/server";

import { middleware } from "../middleware";

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

test("operator cookie -> /billing -> redirects to /403", () => {
  const response = middleware(createRequest("/billing", createJwt("operator")));
  assert.equal(response.headers.get("location"), "https://example.com/403");
});

test("admin cookie -> /billing -> passes through", () => {
  const response = middleware(createRequest("/billing", createJwt("admin")));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("no cookie -> /billing -> redirects to /access", () => {
  const response = middleware(createRequest("/billing"));
  assert.equal(response.headers.get("location"), "https://example.com/access?next=%2Fbilling");
});

test("any role -> /dashboard -> passes through", () => {
  const response = middleware(createRequest("/dashboard", createJwt("operator")));
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});
