import { preloadApiGet } from "@/lib/api";

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function tryPreload(path: string, cacheTtlMs = 15000, cacheKey?: string) {
  void preloadApiGet(path, { cacheTtlMs, cacheKey }).catch(() => undefined);
}

export function warmRouteData(pathname: string) {
  const normalized =
    pathname === "/" ? "/dashboard" : pathname.replace(/\/+$/, "") || "/dashboard";

  tryPreload("/auth/me", 30_000, "session:me");

  if (normalized === "/dashboard") {
    tryPreload("/entries/today", 10_000);
    tryPreload("/entries?page=1&page_size=50", 12_000, "entries:recent:dashboard");
    tryPreload("/settings/usage", 20_000);
    tryPreload("/alerts", 10_000);
    tryPreload("/analytics/weekly", 20_000);
    tryPreload("/ai/anomalies/preview?days=14", 20_000);
    tryPreload("/ocr/verifications/summary", 15_000, "ocr:summary");
    return;
  }

  if (normalized === "/tasks") {
    tryPreload("/entries/today", 10_000, "tasks:today");
    tryPreload("/alerts", 10_000, "tasks:alerts");
    tryPreload("/auth/active-workflow-template", 20_000, "session:active-template");
    return;
  }

  if (normalized === "/attendance") {
    tryPreload("/attendance/me/today", 10_000, "attendance:me:today");
    tryPreload("/attendance/live", 10_000, "attendance:live:today");
    tryPreload("/attendance/review?lookback_days=14", 10_000, "attendance:review:today:14");
    return;
  }

  if (normalized === "/attendance/live") {
    tryPreload("/attendance/live", 10_000, "attendance:live:today");
    tryPreload("/attendance/me/today", 10_000, "attendance:me:today");
    return;
  }

  if (normalized === "/attendance/review") {
    tryPreload("/attendance/review?lookback_days=14", 10_000, "attendance:review:today:14");
    tryPreload("/attendance/live", 10_000, "attendance:live:today");
    return;
  }

  if (normalized === "/attendance/reports") {
    const endDate = todayValue();
    const startDate = daysAgo(7);
    tryPreload(`/attendance/reports/summary?date_from=${startDate}&date_to=${endDate}`, 10_000, `attendance:reports:${startDate}:${endDate}`);
    return;
  }

  if (normalized === "/control-tower") {
    tryPreload("/settings/control-tower", 15_000, "control-tower");
    return;
  }

  if (normalized === "/approvals") {
    tryPreload("/entries?status=pending&page=1&page_size=6", 10_000, "approvals:entries");
    tryPreload("/ocr/verifications?verification_status=pending", 10_000, "approvals:ocr");
    tryPreload("/alerts", 10_000, "approvals:alerts");
    tryPreload("/steel/inventory/reconciliations?status=pending&limit=6", 10_000, "approvals:reconciliations");
    tryPreload("/steel/overview", 10_000, "steel:overview");
    return;
  }

  if (normalized === "/work-queue") {
    tryPreload("/alerts", 10_000, "queue:alerts");
    tryPreload("/attendance/me/today", 10_000, "queue:attendance:today");
    tryPreload("/entries/today", 10_000, "queue:entries:today");
    tryPreload("/entries?status=pending&page=1&page_size=6", 10_000, "queue:entries:pending");
    tryPreload("/ocr/verifications?verification_status=pending", 10_000, "queue:ocr:pending");
    tryPreload("/steel/inventory/reconciliations?status=pending&limit=6", 10_000, "queue:reconciliations:pending");
    return;
  }

  if (normalized === "/steel") {
    tryPreload("/steel/overview", 10_000, "steel:overview");
    tryPreload("/steel/inventory/stock", 10_000, "steel:stock");
    tryPreload("/steel/batches?limit=12", 10_000, "steel:batches:12");
    return;
  }

  if (normalized === "/steel/invoices") {
    tryPreload("/steel/invoices?limit=20", 10_000, "steel:invoices:20");
    tryPreload("/steel/inventory/items", 10_000, "steel:items");
    tryPreload("/steel/batches?limit=50", 10_000, "steel:batches:50");
    return;
  }

  if (normalized === "/steel/dispatches") {
    tryPreload("/steel/dispatches?limit=20", 10_000, "steel:dispatches:20");
    tryPreload("/steel/invoices?limit=30", 10_000, "steel:invoices:30");
    return;
  }

  if (normalized === "/steel/customers") {
    tryPreload("/steel/customers?limit=50", 10_000, "steel:customers:50");
    return;
  }

  if (normalized === "/entry") {
    tryPreload("/entries?date=" + todayValue() + "&page=1&page_size=50", 10_000, `entries:by-date:${todayValue()}`);
    return;
  }

  if (normalized === "/ocr/scan" || normalized === "/ocr") {
    tryPreload("/ocr/status", 10_000, "ocr:status");
    tryPreload("/ocr/templates", 15_000, "ocr:templates");
    return;
  }

  if (normalized === "/ocr/verify") {
    tryPreload("/ocr/verifications?verification_status=pending", 10_000, "ocr:verify:pending");
    return;
  }

  if (normalized === "/steel/reconciliations") {
    tryPreload("/steel/inventory/reconciliations?status=pending&limit=20", 10_000, "steel:reconciliations:pending:20");
    tryPreload("/steel/overview", 10_000, "steel:overview");
    return;
  }

  if (normalized === "/reports") {
    const startDate = daysAgo(7);
    const endDate = todayValue();
    tryPreload(
      `/entries?start_date=${startDate}&end_date=${endDate}&page=1&page_size=10`,
      15_000,
      `reports:default:${startDate}:${endDate}`,
    );
    tryPreload("/ocr/verifications/summary", 15_000, "ocr:summary");
    return;
  }

  if (normalized === "/plans") {
    tryPreload("/plans", 60_000);
    tryPreload("/billing/status", 20_000);
    return;
  }

  if (normalized === "/billing") {
    tryPreload("/plans", 60_000);
    tryPreload("/billing/status", 20_000);
    tryPreload("/billing/config", 60_000);
    tryPreload("/billing/invoices", 20_000);
    return;
  }

  if (normalized === "/ai") {
    tryPreload("/ai/usage", 15_000);
    tryPreload("/ai/anomalies?days=14", 15_000, "ai:anomalies:14");
    return;
  }

  if (normalized === "/analytics") {
    tryPreload("/analytics/weekly", 15_000, "analytics:weekly");
    tryPreload("/analytics/monthly", 15_000, "analytics:monthly");
    tryPreload("/analytics/trends", 15_000, "analytics:trends");
    return;
  }

  if (normalized === "/email-summary") {
    const endDate = todayValue();
    const startDate = daysAgo(7);
    tryPreload(`/emails/summary?start_date=${startDate}&end_date=${endDate}`, 15_000, `emails:summary:${startDate}:${endDate}`);
    return;
  }

  if (normalized === "/premium/dashboard") {
    tryPreload("/premium/dashboard?days=14", 20_000, "premium:dashboard:14");
    tryPreload("/premium/audit-trail?days=14&limit=80", 20_000, "premium:audit:14:80");
    return;
  }

  if (normalized === "/profile") {
    tryPreload("/auth/me", 30_000, "session:me");
    return;
  }

  if (normalized === "/settings") {
    tryPreload("/settings/factory", 20_000);
    tryPreload("/settings/usage", 20_000);
    return;
  }

  if (normalized === "/settings/attendance") {
    tryPreload("/attendance/settings/employees", 15_000, "attendance:settings:employees");
    tryPreload("/attendance/settings/shifts", 15_000, "attendance:settings:shifts");
    return;
  }
}
