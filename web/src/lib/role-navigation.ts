export type AppNavRole =
  | "attendance"
  | "operator"
  | "supervisor"
  | "accountant"
  | "manager"
  | "admin"
  | "owner";

function normalizedRole(role?: string | null): AppNavRole | "" {
  const value = (role || "").toLowerCase();
  if (
    value === "attendance" ||
    value === "operator" ||
    value === "supervisor" ||
    value === "accountant" ||
    value === "manager" ||
    value === "admin" ||
    value === "owner"
  ) {
    return value;
  }
  return "";
}

export function getHomeDestination(role?: string | null, accessibleFactories = 0) {
  switch (normalizedRole(role)) {
    case "attendance":
      return "/dashboard";
    case "operator":
      return "/dashboard";
    case "supervisor":
      return "/approvals";
    case "accountant":
      return "/reports";
    case "manager":
      return "/dashboard";
    case "admin":
      return "/settings";
    case "owner":
      return accessibleFactories > 1 ? "/control-tower" : "/premium/dashboard";
    default:
      return "/dashboard";
  }
}

export function getRolePrimaryHrefs(role?: string | null) {
  switch (normalizedRole(role)) {
    case "attendance":
      return ["/attendance", "/profile"];
    case "operator":
      return ["/dashboard", "/work-queue", "/entry", "/ocr/scan", "/attendance", "/reports"];
    case "supervisor":
      return ["/dashboard", "/approvals", "/work-queue", "/ocr/verify", "/attendance/review", "/steel/reconciliations", "/steel/dispatches", "/reports", "/workforce", "/ai", "/email-summary"];
    case "accountant":
      return ["/dashboard", "/reports", "/analytics", "/attendance/reports", "/email-summary", "/ai", "/steel/customers", "/steel/invoices", "/steel/dispatches", "/workforce"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics", "/workforce", "/ai", "/work-queue"];
    case "admin":
      return ["/settings", "/settings/attendance", "/reports", "/approvals", "/analytics", "/dashboard", "/steel/production/machines", "/workforce", "/ai"];
    case "owner":
      return ["/premium/dashboard", "/control-tower", "/reports", "/ai", "/email-summary", "/steel/charts", "/steel/dispatches", "/steel/production/machines", "/steel/financial-intelligence", "/workforce"];
    default:
      return ["/dashboard", "/work-queue", "/profile"];
  }
}

export function getRoleDefaultFavoriteHrefs(role?: string | null) {
  switch (normalizedRole(role)) {
    case "attendance":
      return ["/attendance", "/profile"];
    case "operator":
      return ["/dashboard", "/entry", "/ocr/scan", "/attendance", "/work-queue"];
    case "supervisor":
      return ["/dashboard", "/approvals", "/ocr/verify", "/attendance/review", "/steel/dispatches", "/steel/reconciliations", "/reports", "/workforce", "/ai"];
    case "accountant":
      return ["/dashboard", "/reports", "/analytics", "/attendance/reports", "/email-summary", "/ai", "/steel/customers", "/steel/invoices", "/workforce"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics", "/workforce", "/ai"];
    case "admin":
      return ["/settings", "/settings/attendance", "/reports", "/approvals", "/analytics", "/dashboard", "/steel/production/machines", "/workforce", "/ai"];
    case "owner":
      return ["/premium/dashboard", "/control-tower", "/reports", "/email-summary", "/ai", "/steel/dispatches", "/steel/production/machines", "/workforce"];
    default:
      return ["/dashboard", "/work-queue", "/profile"];
  }
}

export function getRoleMobileNavHrefs(role?: string | null) {
  switch (normalizedRole(role)) {
    case "attendance":
      return ["/attendance", "/profile"];
    case "operator":
      return ["/dashboard", "/work-queue", "/ocr/scan", "/entry", "/attendance"];
    case "supervisor":
      return ["/dashboard", "/approvals", "/work-queue", "/ocr/verify", "/steel/dispatches", "/steel/reconciliations", "/reports"];
    case "accountant":
      return ["/dashboard", "/reports", "/attendance/reports", "/email-summary", "/ai", "/profile"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics", "/workforce", "/ai"];
    case "admin":
      return ["/settings", "/reports", "/approvals", "/analytics", "/profile", "/ai"];
    case "owner":
      return ["/premium/dashboard", "/reports", "/control-tower", "/ai", "/email-summary", "/steel/dispatches", "/workforce"];
    default:
      return ["/dashboard", "/work-queue", "/ocr/scan", "/attendance", "/profile"];
  }
}

export function getRoleDesktopQuickLinkHrefs(role?: string | null) {
  switch (normalizedRole(role)) {
    case "attendance":
      return ["/profile"];
    case "operator":
      return ["/work-queue", "/ocr/scan", "/attendance"];
    case "supervisor":
      return ["/approvals", "/ocr/verify", "/reports", "/workforce", "/ai"];
    case "accountant":
      return ["/reports", "/attendance/reports", "/email-summary", "/ai", "/analytics"];
    case "manager":
      return ["/approvals", "/reports", "/analytics", "/workforce", "/ai"];
    case "admin":
      return ["/settings", "/settings/attendance", "/reports"];
    case "owner":
      return ["/premium/dashboard", "/control-tower", "/email-summary"];
    default:
      return ["/dashboard", "/work-queue", "/profile"];
  }
}

export function getRoleAllowedNavHrefs(role?: string | null, industryType?: string | null) {
  const normalizedIndustry = (industryType || "").toLowerCase();
  const base = new Set<string>(["/profile"]);

  switch (normalizedRole(role)) {
    case "attendance":
      base.add("/attendance");
      break;
    case "operator":
      [
        "/dashboard",
        "/work-queue",
        "/tasks",
        "/entry",
        "/ocr/scan",
        "/ocr/history",
        "/attendance",
        "/notifications",
      ].forEach((href) => base.add(href));
      break;
    case "supervisor":
      [
        "/dashboard",
        "/work-queue",
        "/attendance",
        "/attendance/review",
        "/attendance/reports",
        "/ocr/verify",
        "/ocr/history",
        "/notifications",
        "/tasks",
        "/steel",
        "/steel/inventory",
        "/steel/dispatches",
        "/steel/batches",
        "/steel/production/record",
        "/steel/production/lines",
        "/steel/production/machines",
        "/email-summary",
        "/workforce",
        "/ai",
      ].forEach((href) => base.add(href));
      if (normalizedIndustry === "steel") {
        base.add("/steel/reconciliations");
      }
      break;
    case "accountant":
      [
        "/dashboard",
        "/work-queue",
        "/attendance",
        "/attendance/reports",
        "/ocr/history",
        "/notifications",
        "/tasks",
        "/steel",
        "/steel/inventory",
        "/steel/customers",
        "/steel/invoices",
        "/steel/dispatches",
        "/steel/vendors",
        "/steel/expenses",
        "/steel/batches",
        "/steel/charts",
        "/steel/reconciliations",
        "/email-summary",
        "/workforce",
        "/ai",
      ].forEach((href) => base.add(href));
      break;
    case "manager":
      [
        "/dashboard",
        "/work-queue",
        "/attendance",
        "/attendance/review",
        "/attendance/reports",
        "/ocr/history",
        "/notifications",
        "/tasks",
        "/steel",
        "/steel/inventory",
        "/steel/inventory/transactions",
        "/steel/production/record",
        "/steel/production/machines",
        "/steel/production/lines",
        "/steel/production-intelligence",
        "/steel/machine-alerts",
        "/steel/batches",
        "/steel/charts",
        "/steel/quality",
        "/steel/anomalies",
        "/steel/inventory-intelligence",
        "/steel/sales-intelligence",
        "/steel/financial-intelligence",
        "/steel/vendors",
        "/steel/expenses",
        "/steel/customers",
        "/steel/invoices",
        "/steel/dispatches",
        "/steel/reconciliations",
        "/email-summary",
        "/workforce",
        "/ai",
      ].forEach((href) => base.add(href));
      break;
    case "admin":
      [
        "/dashboard",
        "/work-queue",
        "/attendance",
        "/attendance/review",
        "/attendance/reports",
        "/ocr/scan",
        "/ocr/verify",
        "/ocr/history",
        "/notifications",
        "/tasks",
        "/steel",
        "/steel/inventory",
        "/steel/inventory/transactions",
        "/steel/production/record",
        "/steel/production/machines",
        "/steel/production/lines",
        "/steel/production-intelligence",
        "/steel/machine-alerts",
        "/steel/batches",
        "/steel/charts",
        "/steel/quality",
        "/steel/anomalies",
        "/steel/inventory-intelligence",
        "/steel/sales-intelligence",
        "/steel/financial-intelligence",
        "/steel/vendors",
        "/steel/expenses",
        "/steel/customers",
        "/steel/invoices",
        "/steel/dispatches",
        "/steel/reconciliations",
        "/email-summary",
        "/workforce",
        "/ai",
      ].forEach((href) => base.add(href));
      break;
    case "owner":
      [
        "/premium/dashboard",
        "/control-tower",
        "/ocr/history",
        "/steel/batches",
        "/steel/charts",
        "/steel/customers",
        "/steel/dispatches",
        "/steel/production/machines",
        "/email-summary",
        "/ai",
        "/workforce",
      ].forEach((href) => base.add(href));
      break;
    default:
      base.add("/dashboard");
      break;
  }

  return [...base];
}

export function getRoleWorkflowHint(role?: string | null, industryType?: string | null) {
  switch (normalizedRole(role)) {
    case "attendance":
      return {
        title: "Daily attendance flow",
        detail: "Punch status first, then check your own attendance record.",
      };
    case "operator":
      return {
        title: "Worker flow",
        detail: "Open today board, complete the next shift task, and scan paper only when the floor needs it.",
      };
    case "supervisor":
      return {
        title: "Supervisor flow",
        detail:
          industryType === "steel"
            ? "Clear the review queue, verify OCR and stock issues, then move dispatch and batch follow-through."
            : "Clear the review queue, fix risky documents, and keep exceptions from piling up.",
      };
    case "accountant":
      return {
        title: "Accounts flow",
        detail: "Start from reports, then move into customer, invoice, and outbound summary work.",
      };
    case "manager":
      return {
        title: "Manager flow",
        detail: "Use the operations board for the next decision, then move into reports and the review queue.",
      };
    case "admin":
      return {
        title: "Admin flow",
        detail: "Start from settings, access, and workflow health. Move into reports or approvals when troubleshooting live issues.",
      };
    case "owner":
      return {
        title: "Owner flow",
        detail: "Start from risk, summary, and money exposure. Drill into AI or factory comparison only when a signal needs proof.",
      };
    default:
      return {
        title: "Factory flow",
        detail: "Start with the main workspace, then move into the next action for your role.",
      };
  }
}
