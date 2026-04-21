"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { clearAuthShellArtifacts } from "@/lib/auth-shell-recovery";

const AUTH_FRESHNESS_KEY = "factorynerve-auth-shell-freshness-v1";
const AUTH_ROUTES = ["/access", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function AuthShellFreshnessAgent() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthRoute(pathname)) return;

    const freshnessKey = `${AUTH_FRESHNESS_KEY}:${pathname}`;
    if (window.sessionStorage.getItem(freshnessKey) === "1") return;
    window.sessionStorage.setItem(freshnessKey, "1");

    void clearAuthShellArtifacts();
  }, [pathname]);

  return null;
}
