import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CANONICAL_HOST = "www.factorynerve.online";
const BUILD_VERSION = (
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_RELEASE_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev"
).trim();
const CANONICAL_REDIRECT_BYPASS_PATHS = new Set([
  "/.well-known/assetlinks.json",
  "/.well-known/apple-app-site-association",
]);

const PROTECTED_PREFIXES = [
  "/entry",
  "/tasks",
  "/approvals",
  "/steel",
  "/control-tower",
  "/dashboard",
  "/settings",
  "/reports",
  "/analytics",
  "/billing",
  "/alerts",
  "/profile",
  "/plans",
  "/ocr",
  "/email-summary",
  "/premium",
  "/attendance",
  "/work-queue",
  "/ai",
];

const ROLE_ROUTES = {
  "/billing": ["admin", "owner"],
  "/settings": ["manager", "admin", "owner"],
  "/admin-billing": ["superadmin"],
  "/analytics": ["supervisor", "manager", "admin", "owner"],
  "/settings/users": ["manager", "admin", "owner"],
} as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

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

function getAllowedRoles(pathname: string) {
  const match = Object.keys(ROLE_ROUTES)
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  return match ? ROLE_ROUTES[match as keyof typeof ROLE_ROUTES] : null;
}

export function middleware(request: NextRequest) {
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

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return withBuildVersionHeader(NextResponse.next());
  }

  if (isProtectedPath(pathname)) {
    const accessCookie = request.cookies.get("dpr_access");
    if (!accessCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/access";
      url.searchParams.set("next", pathname);
      return withBuildVersionHeader(NextResponse.redirect(url));
    }

    const allowedRoles = getAllowedRoles(pathname);
    if (allowedRoles) {
      const payload = decodeJwtPayload(accessCookie.value);
      const role = typeof payload?.role === "string" ? payload.role : null;
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
