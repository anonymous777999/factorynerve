"use client";

export type PwaRouteMode = "browser" | "standalone";

export type PwaTrackedRoute = {
  key: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

export type PwaRouteVisit = {
  href: string;
  label: string;
  lastVisitedAt: string;
  mode: PwaRouteMode;
};

export const PWA_ROUTE_COVERAGE_STORAGE_KEY = "factorynerve:pwa-route-coverage:v1";
export const PWA_ROUTE_COVERAGE_EVENT = "factorynerve:pwa-route-coverage-updated";

export const PWA_PRIORITY_ROUTES: PwaTrackedRoute[] = [
  {
    key: "login",
    label: "Login",
    href: "/login",
    match: (pathname) => pathname === "/login" || pathname.startsWith("/login/"),
  },
  {
    key: "dashboard",
    label: "Today Board",
    href: "/dashboard",
    match: (pathname) => pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
  },
  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    match: (pathname) => pathname === "/attendance" || pathname.startsWith("/attendance/"),
  },
  {
    key: "entry",
    label: "Shift Entry",
    href: "/entry",
    match: (pathname) => pathname === "/entry" || pathname.startsWith("/entry/"),
  },
  {
    key: "ocr_scan",
    label: "OCR Scan",
    href: "/ocr/scan",
    match: (pathname) => pathname === "/ocr/scan" || pathname.startsWith("/ocr/scan/"),
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/approvals",
    match: (pathname) => pathname === "/approvals" || pathname.startsWith("/approvals/"),
  },
  {
    key: "work_queue",
    label: "Work Queue",
    href: "/work-queue",
    match: (pathname) => pathname === "/work-queue" || pathname.startsWith("/work-queue/"),
  },
  {
    key: "reports",
    label: "Reports",
    href: "/reports",
    match: (pathname) => pathname === "/reports" || pathname.startsWith("/reports/"),
  },
];

function readCoverageStore(): Record<string, PwaRouteVisit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PWA_ROUTE_COVERAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PwaRouteVisit>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCoverageStore(next: Record<string, PwaRouteVisit>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_ROUTE_COVERAGE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PWA_ROUTE_COVERAGE_EVENT));
}

export function loadPwaRouteCoverage() {
  return readCoverageStore();
}

export function clearPwaRouteCoverage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PWA_ROUTE_COVERAGE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PWA_ROUTE_COVERAGE_EVENT));
}

export function recordPwaRouteVisit(pathname: string, mode: PwaRouteMode) {
  if (typeof window === "undefined") return;

  const matched = PWA_PRIORITY_ROUTES.find((route) => route.match(pathname));
  if (!matched) return;

  const next = {
    ...readCoverageStore(),
    [matched.key]: {
      href: matched.href,
      label: matched.label,
      lastVisitedAt: new Date().toISOString(),
      mode,
    },
  };

  writeCoverageStore(next);
}

export function subscribeToPwaRouteCoverage(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === PWA_ROUTE_COVERAGE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PWA_ROUTE_COVERAGE_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PWA_ROUTE_COVERAGE_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
