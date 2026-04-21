import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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

const ACCESS_COOKIE_NAMES = [
  process.env.NEXT_PUBLIC_JWT_ACCESS_COOKIE,
  process.env.JWT_ACCESS_COOKIE,
  "dpr_access",
].filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  if (process.env.NODE_ENV !== "production" && hostname === "localhost") {
    const url = request.nextUrl.clone();
    url.hostname = "127.0.0.1";
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/access" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  if (isProtectedPath(pathname)) {
    const hasAccess = ACCESS_COOKIE_NAMES.some((cookieName) => request.cookies.get(cookieName));
    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/access";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
