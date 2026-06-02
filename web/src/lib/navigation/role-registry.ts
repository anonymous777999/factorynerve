import type { NavItem } from "@/lib/navigation/registry";
import type { AppNavRole } from "@/lib/role-navigation";

const ALL_ROLES: AppNavRole[] = ["attendance", "operator", "supervisor", "accountant", "manager", "admin", "owner"];

export const NAV_ROLE_MAP: Record<NavItem["id"], string[]> = {
  "work-queue": ["operator", "supervisor", "manager"],
  attendance: ["attendance", "operator"],
  "today-board": ["operator", "manager", "admin"],
  "my-day": ["operator"],
  "document-desk": ["operator"],
  "shift-entry": ["operator"],
  "steel-hub": ["manager"],
  inventory: ["manager"],
  "inventory-transactions": ["manager"],
  "production-record": ["manager"],
  "steel-batches": ["owner"],
  "steel-charts": ["owner"],
  customers: ["accountant", "manager", "owner"],
  "sales-invoices": ["accountant", "manager"],
  dispatch: ["supervisor", "manager", "owner"],
  "attendance-review": ["supervisor", "manager"],
  approvals: ALL_ROLES,
  "review-documents": ["supervisor"],
  "ocr-history": ["operator", "supervisor", "manager", "admin", "owner"],
  "stock-review": ["supervisor"],
  "attendance-reports": ["accountant"],
  "reports-exports": ALL_ROLES,
  performance: ALL_ROLES,
  "owner-desk": ["owner"],
  "factory-network": ["owner"],
  "scheduled-updates": ["accountant", "manager", "owner"],
  "ai-insights": ["owner"],
  "attendance-admin": ["supervisor", "manager", "admin", "owner"],
  "factory-admin": ["manager", "admin", "owner"],
  subscription: ALL_ROLES,
  "billing-invoices": ALL_ROLES,
  profile: ALL_ROLES,
};
