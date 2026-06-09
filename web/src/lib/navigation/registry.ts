export type NavDomain = "today" | "operations" | "review" | "management" | "admin" | "account";

export type NavIcon =
  | "queue"
  | "attendance"
  | "board"
  | "day"
  | "entry"
  | "docs"
  | "steel"
  | "customers"
  | "invoice"
  | "dispatch"
  | "review"
  | "verify"
  | "stock"
  | "reports"
  | "performance"
  | "owner"
  | "network"
  | "updates"
  | "ai"
  | "settings"
  | "subscription"
  | "billing"
  | "profile";

export type NavBadge = "approvals" | "alerts";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIcon;
  domain: NavDomain;
  badge?: NavBadge;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "work-queue", label: "Work Queue", href: "/work-queue", icon: "queue", domain: "today", badge: "alerts" },
  { id: "attendance", label: "Attendance", href: "/attendance", icon: "attendance", domain: "today" },
  { id: "today-board", label: "Today Board", href: "/dashboard", icon: "board", domain: "today", badge: "alerts" },
  { id: "my-day", label: "My Day", href: "/tasks", icon: "day", domain: "today" },
  { id: "document-desk", label: "Document Desk", href: "/ocr/scan", icon: "docs", domain: "today" },
  { id: "shift-entry", label: "Shift Entry", href: "/entry", icon: "entry", domain: "operations" },
  { id: "steel-hub", label: "Steel Hub", href: "/steel", icon: "steel", domain: "operations" },
  { id: "inventory", label: "Inventory", href: "/steel/inventory", icon: "stock", domain: "operations" },
  { id: "inventory-transactions", label: "Inventory Transactions", href: "/steel/inventory/transactions", icon: "reports", domain: "operations" },
  { id: "production-record", label: "Production Record", href: "/steel/production/record", icon: "entry", domain: "operations" },
  { id: "steel-batches", label: "Steel Batches", href: "/steel/batches", icon: "steel", domain: "operations" },
  { id: "steel-charts", label: "Steel Charts", href: "/steel/charts", icon: "performance", domain: "operations" },
  { id: "customers", label: "Customers", href: "/steel/customers", icon: "customers", domain: "operations" },
  { id: "sales-invoices", label: "Sales Invoices", href: "/steel/invoices", icon: "invoice", domain: "operations" },
  { id: "dispatch", label: "Dispatch", href: "/steel/dispatches", icon: "dispatch", domain: "operations" },
  { id: "attendance-review", label: "Attendance Review", href: "/attendance/review", icon: "review", domain: "review" },
  { id: "approvals", label: "Approvals", href: "/approvals", icon: "review", domain: "review", badge: "approvals" },
  { id: "review-documents", label: "Review Documents", href: "/ocr/verify", icon: "verify", domain: "review" },
  { id: "ocr-history", label: "OCR History", href: "/ocr/history", icon: "docs", domain: "review" },
  { id: "stock-review", label: "Stock Review", href: "/steel/reconciliations", icon: "stock", domain: "review" },
  { id: "attendance-reports", label: "Attendance Reports", href: "/attendance/reports", icon: "reports", domain: "management" },
  { id: "reports-exports", label: "Reports & Exports", href: "/reports", icon: "reports", domain: "management" },
  { id: "performance", label: "Performance", href: "/analytics", icon: "performance", domain: "management" },
  { id: "owner-desk", label: "Owner Desk", href: "/premium/dashboard", icon: "owner", domain: "management" },
  { id: "factory-network", label: "Factory Network", href: "/control-tower", icon: "network", domain: "management" },
  { id: "scheduled-updates", label: "Scheduled Updates", href: "/email-summary", icon: "updates", domain: "management" },
  { id: "ai-insights", label: "AI Insights", href: "/ai", icon: "ai", domain: "management" },
  { id: "attendance-admin", label: "Attendance Admin", href: "/settings/attendance", icon: "settings", domain: "admin" },
  { id: "factory-admin", label: "Factory Admin", href: "/settings", icon: "settings", domain: "admin" },
  { id: "subscription", label: "Subscription", href: "/plans", icon: "subscription", domain: "admin" },
  { id: "billing-invoices", label: "Billing & Invoices", href: "/billing", icon: "billing", domain: "admin" },
  { id: "profile", label: "Profile", href: "/profile", icon: "profile", domain: "account" },
];
