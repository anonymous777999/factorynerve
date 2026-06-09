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
      return "/attendance";
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
      return ["/dashboard", "/work-queue", "/entry", "/ocr/scan", "/attendance"];
    case "supervisor":
      return ["/approvals", "/work-queue", "/ocr/verify", "/attendance/review", "/steel/reconciliations", "/steel/dispatches", "/reports"];
    case "accountant":
      return ["/reports", "/attendance/reports", "/email-summary", "/steel/customers", "/steel/invoices"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics", "/work-queue"];
    case "admin":
      return ["/settings", "/settings/attendance", "/reports", "/approvals", "/analytics", "/dashboard"];
    case "owner":
      return ["/premium/dashboard", "/control-tower", "/reports", "/ai", "/email-summary", "/steel/charts", "/steel/dispatches"];
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
      return ["/approvals", "/ocr/verify", "/attendance/review", "/steel/dispatches", "/steel/reconciliations", "/reports"];
    case "accountant":
      return ["/reports", "/attendance/reports", "/email-summary", "/steel/customers", "/steel/invoices"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics"];
    case "admin":
      return ["/settings", "/settings/attendance", "/reports", "/approvals", "/analytics"];
    case "owner":
      return ["/premium/dashboard", "/control-tower", "/reports", "/email-summary", "/ai", "/steel/dispatches"];
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
      return ["/approvals", "/work-queue", "/ocr/verify", "/steel/dispatches", "/steel/reconciliations", "/reports"];
    case "accountant":
      return ["/reports", "/attendance/reports", "/email-summary", "/steel/customers", "/profile"];
    case "manager":
      return ["/dashboard", "/approvals", "/reports", "/steel", "/steel/dispatches", "/analytics"];
    case "admin":
      return ["/settings", "/reports", "/approvals", "/analytics", "/profile"];
    case "owner":
      return ["/premium/dashboard", "/reports", "/control-tower", "/ai", "/email-summary", "/steel/dispatches"];
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
      return ["/approvals", "/ocr/verify", "/reports"];
    case "accountant":
      return ["/reports", "/attendance/reports", "/email-summary"];
    case "manager":
      return ["/approvals", "/reports", "/analytics"];
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
      ].forEach((href) => base.add(href));
      break;
    case "supervisor":
      [
        "/work-queue",
        "/attendance/review",
        "/ocr/verify",
        "/ocr/history",
        "/steel/dispatches",
      ].forEach((href) => base.add(href));
      if (normalizedIndustry === "steel") {
        base.add("/steel/reconciliations");
      }
      break;
    case "accountant":
      [
        "/reports",
        "/attendance/reports",
        "/steel/customers",
        "/steel/invoices",
        "/email-summary",
      ].forEach((href) => base.add(href));
      break;
    case "manager":
      [
        "/dashboard",
        "/work-queue",
        "/ocr/history",
        "/attendance/review",
        "/steel",
        "/steel/inventory",
        "/steel/inventory/transactions",
        "/steel/production/record",
        "/steel/customers",
        "/steel/invoices",
        "/steel/dispatches",
        "/email-summary",
      ].forEach((href) => base.add(href));
      break;
    case "admin":
      [
        "/dashboard",
        "/settings",
        "/settings/attendance",
        "/ocr/history",
        "/reports",
        "/approvals",
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
        "/email-summary",
        "/ai",
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
