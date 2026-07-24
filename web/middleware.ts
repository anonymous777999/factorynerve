import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CANONICAL_REDIRECT_BYPASS_PATHS,
  getAllowedRoles,
  isMiddlewareBypassPath,
  isProtectedPath,
} from "@/lib/route-manifest";

const CANONICAL_HOST = "www.factorynerve.online";
const BUILD_VERSION = (
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_RELEASE_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev"
).trim();

type NormalizedTokenPayload = {
  role: string | null;
  orgId: string | null;
  source: "auth_session" | "dpr_access" | null;
};

function withBuildVersionHeader(response: NextResponse) {
  response.headers.set("x-dpr-build-version", BUILD_VERSION);
  return response;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readSessionAuthContext(
  request: NextRequest,
  sessionToken: string,
): Promise<NormalizedTokenPayload> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader || !sessionToken) {
    return { role: null, orgId: null, source: "auth_session" };
  }

  try {
    const authUrl = new URL("/api/auth/v2/me", request.url);
    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return { role: null, orgId: null, source: "auth_session" };
    }

    const rawPayload = (await response.json()) as Record<string, unknown> | null;
    // Unwrap the response envelope ({ success, data }) if present.
    // Backend endpoints like /auth/v2/me and /auth/v2/context wrap the response
    // in a { success: true, data: {...} } envelope via middleware.
    const innerPayload =
      rawPayload &&
      typeof rawPayload === "object" &&
      "data" in rawPayload
        ? (rawPayload.data as Record<string, unknown> | null)
        : rawPayload;
    const user =
      innerPayload && typeof innerPayload === "object" && "user" in innerPayload
        ? (innerPayload.user as Record<string, unknown> | null)
        : null;
    const rawRole =
      typeof user?.role === "string"
        ? user.role
        : typeof innerPayload?.role === "string"
          ? innerPayload.role
          : null;
    const rawOrgId =
      typeof user?.org_id === "string"
        ? user.org_id
        : typeof innerPayload?.org_id === "string"
          ? innerPayload.org_id
          : null;

    return {
      role: rawRole ? rawRole.toLowerCase() : null,
      orgId: rawOrgId,
      source: "auth_session",
    };
  } catch {
    return { role: null, orgId: null, source: "auth_session" };
  }
}

async function normalizeTokenPayload(
  request: NextRequest,
  {
    sessionToken,
    legacyToken,
  }: {
    sessionToken?: string;
    legacyToken?: string;
  },
): Promise<NormalizedTokenPayload> {
  if (sessionToken) {
    const sessionPayload = await readSessionAuthContext(request, sessionToken);
    if (sessionPayload.role || sessionPayload.orgId) {
      return sessionPayload;
    }
  }

  if (legacyToken) {
    const payload = decodeJwtPayload(legacyToken);
    const rawRole = typeof payload?.role === "string" ? payload.role : null;
    const rawOrgId = typeof payload?.org_id === "string" ? payload.org_id : null;
    return {
      role: rawRole ? rawRole.toLowerCase() : null,
      orgId: rawOrgId,
      source: "dpr_access",
    };
  }

  return {
    role: null,
    orgId: null,
    source: sessionToken ? "auth_session" : null,
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  if (process.env.NODE_ENV !== "production" && hostname === "localhost") {
    const url = request.nextUrl.clone();
    url.hostname = "127.0.0.1";
    return withBuildVersionHeader(NextResponse.redirect(url));
  }

  if (
    process.env.NODE_ENV === "production" &&
    hostname === "factorynerve.online" &&
    !CANONICAL_REDIRECT_BYPASS_PATHS.has(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    return withBuildVersionHeader(NextResponse.redirect(url, 308));
  }

  if (isMiddlewareBypassPath(pathname)) {
    return withBuildVersionHeader(NextResponse.next());
  }

  if (isProtectedPath(pathname)) {
    const sessionCookie = request.cookies.get("auth_session")?.value;
    const legacyCookie = request.cookies.get("dpr_access")?.value;
    const token = sessionCookie ?? legacyCookie;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/access";
      url.searchParams.set("next", pathname);
      return withBuildVersionHeader(NextResponse.redirect(url));
    }

    const allowedRoles = getAllowedRoles(pathname);
    if (allowedRoles) {
      const payload = await normalizeTokenPayload(request, {
        sessionToken: sessionCookie,
        legacyToken: legacyCookie,
      });
      const role = payload.role;
      if (!role && payload.source === "auth_session") {
        const url = request.nextUrl.clone();
        url.pathname = "/access";
        url.searchParams.set("next", pathname);
        url.searchParams.set("reason", "session_unresolved");
        return withBuildVersionHeader(NextResponse.redirect(url));
      }
      if (!role || !(allowedRoles as readonly string[]).includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/403";
        return withBuildVersionHeader(NextResponse.redirect(url));
      }
    }
  }

  return withBuildVersionHeader(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
