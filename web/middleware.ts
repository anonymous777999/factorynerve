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

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withBuildVersionHeader(response: NextResponse) {
  response.headers.set("x-dpr-build-version", BUILD_VERSION);
  return response;
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
    const hasAccess = request.cookies.get("dpr_access");
    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return withBuildVersionHeader(NextResponse.redirect(url));
    }
  }

  return withBuildVersionHeader(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
