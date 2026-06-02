"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ClipboardCheck,
  ClipboardPen,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Factory,
  Gem,
  type LucideProps,
  LayoutDashboard,
  ListChecks,
  Mail,
  Network,
  Package,
  Settings,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
} from "lucide-react";

import RoleGate from "@/shared/permissions/role-gate";
import { Select } from "@/components/ui/select";
import type { Permissions } from "@/lib/auth";
import type { AppLanguage } from "@/lib/i18n";
import { NAV_ITEMS } from "@/lib/navigation/registry";
import { NAV_ROLE_MAP } from "@/lib/navigation/role-registry";
import { getRoleMobileNavHrefs } from "@/lib/role-navigation";
import { cn } from "@/lib/utils";
import {
  type AppDensity,
  type AppTheme,
} from "@/providers/ui-preferences-provider";

export type NavBadgeKey = "approvals" | "alerts";
type NavIconName =
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

export type NavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  permission?: keyof Permissions;
  industryTypes?: readonly string[];
  badgeKey?: NavBadgeKey;
  match: (pathname: string) => boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export type TranslateFn = (key: string, fallback?: string) => string;

type NavItemMetadata = {
  description: string;
  permission?: keyof Permissions;
  industryTypes?: readonly string[];
  match: (pathname: string) => boolean;
};

type SidebarFactoryChoice = {
  factory_id: string;
  name: string;
};

const navItemMetadataById: Record<string, NavItemMetadata> = {
  "work-queue": {
    description: "Cross-app queue for daily work, review load, and unread alerts",
    match: (pathname) => pathname === "/work-queue" || pathname.startsWith("/work-queue/"),
  },
  attendance: {
    description: "Punch in, punch out, and keep live attendance visible for the active factory",
    match: (pathname) =>
      pathname === "/attendance" || pathname === "/attendance/live" || pathname.startsWith("/attendance/live/"),
  },
  "today-board": {
    description: "Start with live priorities, alerts, and the active factory context",
    match: (pathname) => pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
  },
  "my-day": {
    description: "Assigned work, handoffs, and follow-through for the current shift",
    match: (pathname) => pathname === "/tasks" || pathname.startsWith("/tasks/"),
  },
  "document-desk": {
    description: "Bring paper registers and plant documents into the workflow fast",
    match: (pathname) => pathname === "/ocr/scan" || pathname === "/ocr" || pathname.startsWith("/ocr/"),
  },
  "shift-entry": {
    description: "Capture shift production without hunting through screens",
    match: (pathname) => pathname === "/entry" || pathname.startsWith("/entry/"),
  },
  "steel-hub": {
    description: "Operational overview, KPI health, and top-priority action board",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel",
  },
  inventory: {
    description: "Live stock balance, material master, and yard control",
    industryTypes: ["steel"],
    match: (pathname) =>
      pathname === "/steel/inventory" ||
      (pathname.startsWith("/steel/inventory") && !pathname.includes("/transactions")),
  },
  "inventory-transactions": {
    description: "Manual stock adjustments, adjustments, and movement audit trail",
    industryTypes: ["steel"],
    match: (pathname) =>
      pathname === "/steel/inventory/transactions" || pathname.startsWith("/steel/inventory/transactions"),
  },
  "production-record": {
    description: "Capture manual batch production and variance signals",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/production/record" || pathname.startsWith("/steel/production/record"),
  },
  "steel-batches": {
    description: "Traceability list for production batches and output signals",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/batches" || pathname.startsWith("/steel/batches/"),
  },
  "steel-charts": {
    description: "Chart-first board for stock, production, dispatch, and revenue movement",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/charts" || pathname.startsWith("/steel/charts/"),
  },
  customers: {
    description: "Track customer ledger, payments, and outstanding exposure",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/customers" || pathname.startsWith("/steel/customers/"),
  },
  "sales-invoices": {
    description: "Weight-based invoicing and revenue control",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/invoices" || pathname.startsWith("/steel/invoices/"),
  },
  dispatch: {
    description: "Gate pass, truck movement, and dispatch follow-through",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/dispatches" || pathname.startsWith("/steel/dispatches/"),
  },
  "attendance-review": {
    description: "Close missed punches, regularizations, and attendance exceptions",
    match: (pathname) => pathname === "/attendance/review" || pathname.startsWith("/attendance/review/"),
  },
  approvals: {
    description: "One place for pending review, verification, and stock trust work",
    permission: "can_approve_entries",
    match: (pathname) => pathname === "/approvals" || pathname.startsWith("/approvals/"),
  },
  "review-documents": {
    description: "Approve OCR rows before they reach reports and exports",
    match: (pathname) => pathname === "/ocr/verify" || pathname.startsWith("/ocr/verify/"),
  },
  "ocr-history": {
    description: "Reopen OCR drafts, exports, and recent document runs",
    match: (pathname) => pathname === "/ocr/history" || pathname.startsWith("/ocr/history/"),
  },
  "stock-review": {
    description: "Review physical counts, confidence, and mismatch decisions",
    industryTypes: ["steel"],
    match: (pathname) => pathname === "/steel/reconciliations" || pathname.startsWith("/steel/reconciliations/"),
  },
  "attendance-reports": {
    description: "Daily manpower completion, late signals, and review load by date",
    match: (pathname) => pathname === "/attendance/reports" || pathname.startsWith("/attendance/reports/"),
  },
  "reports-exports": {
    description: "Review output, exports, and operating signals across the selected range",
    permission: "can_export_data",
    match: (pathname) => pathname === "/reports" || pathname.startsWith("/reports/"),
  },
  performance: {
    description: "Trends, comparisons, and drill-down performance insight",
    permission: "can_view_analytics",
    match: (pathname) => pathname === "/analytics" || pathname.startsWith("/analytics/"),
  },
  "owner-desk": {
    description: "High-density owner view for risk, performance, and factory comparison",
    match: (pathname) => pathname === "/premium/dashboard" || pathname.startsWith("/premium/"),
  },
  "factory-network": {
    description: "Compare factories and switch live operating context",
    match: (pathname) => pathname === "/control-tower" || pathname.startsWith("/control-tower/"),
  },
  "scheduled-updates": {
    description: "Automated summaries for managers and owners",
    match: (pathname) => pathname === "/email-summary" || pathname.startsWith("/email-summary/"),
  },
  "ai-insights": {
    description: "Advanced anomaly scans, suggestions, and KPI questions",
    match: (pathname) => pathname === "/ai" || pathname.startsWith("/ai/"),
  },
  "attendance-admin": {
    description: "Employee profile mapping, shift rules, and attendance operations setup",
    permission: "can_manage_users",
    match: (pathname) => pathname === "/settings/attendance" || pathname.startsWith("/settings/attendance/"),
  },
  "factory-admin": {
    description: "Factories, users, templates, and organization controls",
    permission: "can_manage_users",
    match: (pathname) =>
      pathname === "/settings" ||
      (pathname.startsWith("/settings/") && !pathname.startsWith("/settings/attendance")),
  },
  subscription: {
    description: "Review subscription tiers and available add-ons",
    permission: "can_view_billing",
    match: (pathname) => pathname === "/plans" || pathname.startsWith("/plans/"),
  },
  "billing-invoices": {
    description: "Checkout, invoices, and subscription management",
    permission: "can_view_billing",
    match: (pathname) => pathname === "/billing" || pathname.startsWith("/billing/"),
  },
  profile: {
    description: "Your identity, access, password, and account details",
    match: (pathname) => pathname === "/profile" || pathname.startsWith("/profile/"),
  },
};

const NAV_SECTION_ORDER = ["today", "operations", "review", "management", "admin", "account"] as const;

const NAV_SECTION_TITLES: Record<(typeof NAV_SECTION_ORDER)[number], string> = {
  today: "Today",
  operations: "Operations",
  review: "Review",
  management: "Management",
  admin: "Admin",
  account: "Account",
};

const navIconByHref = new Map(NAV_ITEMS.map((item) => [item.href, item.icon] as const));

const navSections: NavSection[] = NAV_SECTION_ORDER.map((domain) => ({
  title: NAV_SECTION_TITLES[domain],
  items: NAV_ITEMS.filter((item) => item.domain === domain).map((item) => {
    const metadata = navItemMetadataById[item.id];
    return {
      id: item.id,
      label: item.label,
      href: item.href,
      description: metadata.description,
      permission: metadata.permission,
      industryTypes: metadata.industryTypes,
      badgeKey: item.badge,
      match: metadata.match,
    };
  }),
}));

const MOBILE_NAV_LABELS: Record<string, string> = {
  "/dashboard": "Home",
  "/work-queue": "Queue",
  "/ocr/scan": "Scan",
  "/attendance": "Attendance",
  "/profile": "Profile",
};

const SECTION_LABEL_KEY: Record<string, string> = {
  Today: "nav.section.today",
  Operations: "nav.section.operations",
  Steel: "nav.section.steel",
  Review: "nav.section.review",
  Insights: "nav.section.insights",
  Management: "nav.section.management",
  Admin: "nav.section.admin",
  Account: "nav.section.account",
};

const ITEM_TRANSLATION_KEY: Record<string, { label: string; description: string }> = {
  "/work-queue": { label: "nav.work_queue.label", description: "nav.work_queue.description" },
  "/attendance": { label: "nav.attendance.label", description: "nav.attendance.description" },
  "/dashboard": { label: "nav.today_board.label", description: "nav.today_board.description" },
  "/tasks": { label: "nav.my_day.label", description: "nav.my_day.description" },
  "/entry": { label: "nav.shift_entry.label", description: "nav.shift_entry.description" },
  "/ocr/scan": { label: "nav.document_desk.label", description: "nav.document_desk.description" },
  "/steel": { label: "nav.steel_hub.label", description: "nav.steel_hub.description" },
  "/steel/inventory": { label: "nav.steel_inventory.label", description: "nav.steel_inventory.description" },
  "/steel/inventory/transactions": {
    label: "nav.steel_transactions.label",
    description: "nav.steel_transactions.description",
  },
  "/steel/production/record": {
    label: "nav.steel_production_record.label",
    description: "nav.steel_production_record.description",
  },
  "/steel/batches": { label: "nav.steel_batches.label", description: "nav.steel_batches.description" },
  "/steel/charts": { label: "nav.steel_charts.label", description: "nav.steel_charts.description" },
  "/steel/customers": { label: "nav.customers.label", description: "nav.customers.description" },
  "/steel/invoices": { label: "nav.sales_invoices.label", description: "nav.sales_invoices.description" },
  "/steel/dispatches": { label: "nav.dispatch.label", description: "nav.dispatch.description" },
  "/attendance/review": {
    label: "nav.attendance_review.label",
    description: "nav.attendance_review.description",
  },
  "/approvals": { label: "nav.approvals.label", description: "nav.approvals.description" },
  "/ocr/verify": {
    label: "nav.review_documents.label",
    description: "nav.review_documents.description",
  },
  "/ocr/history": { label: "nav.ocr_history.label", description: "nav.ocr_history.description" },
  "/steel/reconciliations": {
    label: "nav.stock_review.label",
    description: "nav.stock_review.description",
  },
  "/attendance/reports": {
    label: "nav.attendance_reports.label",
    description: "nav.attendance_reports.description",
  },
  "/reports": { label: "nav.reports_exports.label", description: "nav.reports_exports.description" },
  "/analytics": { label: "nav.performance.label", description: "nav.performance.description" },
  "/premium/dashboard": { label: "nav.owner_desk.label", description: "nav.owner_desk.description" },
  "/control-tower": {
    label: "nav.factory_network.label",
    description: "nav.factory_network.description",
  },
  "/email-summary": {
    label: "nav.scheduled_updates.label",
    description: "nav.scheduled_updates.description",
  },
  "/ai": { label: "nav.ai_insights.label", description: "nav.ai_insights.description" },
  "/settings/attendance": {
    label: "nav.attendance_admin.label",
    description: "nav.attendance_admin.description",
  },
  "/settings": { label: "nav.factory_admin.label", description: "nav.factory_admin.description" },
  "/plans": { label: "nav.subscription.label", description: "nav.subscription.description" },
  "/billing": { label: "nav.billing.label", description: "nav.billing.description" },
  "/profile": { label: "nav.profile.label", description: "nav.profile.description" },
};

const LANGUAGE_CHOICES: Array<{ value: AppLanguage; key: string; fallback: string }> = [
  { value: "en", key: "language.english", fallback: "English" },
  { value: "hi", key: "language.hindi", fallback: "Hindi" },
  { value: "mr", key: "language.marathi", fallback: "Marathi" },
  { value: "ta", key: "language.tamil", fallback: "Tamil" },
  { value: "gu", key: "language.gujarati", fallback: "Gujarati" },
];

const THEME_CHOICES: Array<{ value: AppTheme; key: string; fallback: string }> = [
  { value: "dark", key: "shell.theme_dark", fallback: "Dark" },
  { value: "light", key: "shell.theme_light", fallback: "Light" },
];

const DENSITY_CHOICES: Array<{ value: AppDensity; key: string; fallback: string }> = [
  { value: "compact", key: "shell.density_compact", fallback: "Compact" },
  { value: "default", key: "shell.density_default", fallback: "Default" },
  { value: "comfortable", key: "shell.density_comfortable", fallback: "Comfortable" },
];

function navLinkClasses(active: boolean) {
  return cn(
    "factory-nav-link ui-no-select ui-no-callout group block rounded-panel px-2.5 py-2 min-h-[44px] transition-colors duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
    active
      ? "factory-nav-link-active border border-border-subtle border-l-[3px] border-l-border-focus bg-accent-soft text-accent pl-[calc(var(--space-2-5)-2px)]"
      : "border border-transparent bg-transparent hover:bg-surface-panel/90",
  );
}

function localizedSectionTitle(title: string, translate?: TranslateFn) {
  if (!translate) return title;
  const key = SECTION_LABEL_KEY[title];
  return key ? translate(key, title) : title;
}

export function sectionStorageKey(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function localizedItemText(item: NavItem, translate?: TranslateFn) {
  const keys = ITEM_TRANSLATION_KEY[item.href];
  if (!translate || !keys) {
    return { label: item.label, description: item.description };
  }
  return {
    label: translate(keys.label, item.label),
    description: translate(keys.description, item.description),
  };
}

export function roleLabel(role?: string | null, translate?: TranslateFn) {
  if (!role) return translate ? translate("role.team_member", "Team member") : "Team member";
  const normalized = role.toLowerCase();
  if (normalized === "attendance") {
    return translate ? translate("role.attendance", "Attendance user") : "Attendance user";
  }
  if (normalized === "supervisor") {
    return translate ? translate("role.supervisor", "Shift Lead") : "Shift Lead";
  }
  if (normalized === "manager") {
    return translate ? translate("role.manager", "Plant Manager") : "Plant Manager";
  }
  if (!translate) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  return translate(`role.${normalized}`, role.charAt(0).toUpperCase() + role.slice(1));
}

export function getVisibleNavSections(
  roleOrAllowedHrefs: string | null | undefined | Set<string>,
  permissions: Permissions,
  industryType?: string | null,
) {
  const normalizedIndustry = (industryType || "").toLowerCase();
  const normalizedRole = typeof roleOrAllowedHrefs === "string" ? roleOrAllowedHrefs.toLowerCase() : "";
  const allowedHrefs = roleOrAllowedHrefs instanceof Set ? roleOrAllowedHrefs : null;

  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const allowedRoles = NAV_ROLE_MAP[item.id] || [];
        const roleAllowed = allowedHrefs
          ? allowedHrefs.has(item.href)
          : normalizedRole
            ? allowedRoles.includes(normalizedRole)
            : item.id === "today-board" || item.id === "profile";
        const permissionAllowed = item.permission ? permissions[item.permission] : roleAllowed;
        const industryAllowed =
          !item.industryTypes ||
          item.industryTypes.length === 0 ||
          (normalizedIndustry ? item.industryTypes.includes(normalizedIndustry) : false);
        return permissionAllowed && industryAllowed;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function getMobileNavItems(visibleNavMap: Map<string, NavItem>, role?: string | null) {
  const next: NavItem[] = [];
  const seen = new Set<string>();
  const preferredHrefs = [...getRoleMobileNavHrefs(role), "/profile"];

  preferredHrefs.forEach((href) => {
    if (seen.has(href)) {
      return;
    }
    const item = visibleNavMap.get(href);
    if (item) {
      seen.add(href);
      next.push(item);
    }
  });

  return next.slice(0, 5);
}

function getMobileNavLabel(item: NavItem, translate?: TranslateFn) {
  return MOBILE_NAV_LABELS[item.href] || localizedItemText(item, translate).label;
}

function getMobileNavBadgeCount(item: NavItem, badgeCounts: Record<NavBadgeKey, number>) {
  return item.badgeKey ? badgeCounts[item.badgeKey] : 0;
}

function formatBadgeCount(value: number) {
  return value > 99 ? "99+" : String(value);
}

function getNavIconName(href: string): NavIconName {
  return navIconByHref.get(href) ?? "profile";
}

// Navigation icons standardized on lucide-react. Each icon is always paired
// with a visible text label, so it is marked aria-hidden (WCAG 2.1 AA 1.1.1).
// Mapped to the closest lucide glyph by the nav item's semantic meaning.
const NAV_ICON_COMPONENTS: Record<NavIconName, ComponentType<LucideProps>> = {
  queue: ListChecks,
  attendance: CalendarCheck,
  board: LayoutDashboard,
  day: Sun,
  entry: ClipboardPen,
  docs: FileText,
  steel: Factory,
  customers: Users,
  invoice: FileSpreadsheet,
  dispatch: Truck,
  review: ClipboardCheck,
  verify: BadgeCheck,
  stock: Package,
  reports: BarChart3,
  performance: TrendingUp,
  owner: Gem,
  network: Network,
  updates: Mail,
  ai: Sparkles,
  settings: Settings,
  subscription: Wallet,
  billing: CreditCard,
  profile: User,
};

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const Icon = NAV_ICON_COMPONENTS[getNavIconName(href)];
  return (
    <Icon
      size={18}
      strokeWidth={1.5}
      className={active ? "text-action-primary" : "text-text-secondary"}
      aria-hidden="true"
      focusable="false"
    />
  );
}

function FavoriteIcon({ filled }: { filled: boolean }) {
  return (
    <Star
      size={18}
      strokeWidth={1.5}
      className={filled ? "fill-current" : undefined}
      aria-hidden="true"
      focusable="false"
    />
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <ChevronDown
      size={18}
      strokeWidth={1.5}
      className={cn("transition-transform", expanded ? "rotate-180" : "")}
      aria-hidden="true"
      focusable="false"
    />
  );
}

function NavContent({
  pathname,
  onWarm,
  onNavigate,
  sections,
  badgeCounts,
  favoriteHrefs,
  onToggleFavorite,
  translate,
  hideSectionTitles = false,
}: {
  pathname: string;
  onWarm: (href: string) => void;
  onNavigate?: () => void;
  sections: NavSection[];
  badgeCounts: Record<NavBadgeKey, number>;
  favoriteHrefs: string[];
  onToggleFavorite?: (href: string) => void;
  translate?: TranslateFn;
  hideSectionTitles?: boolean;
}) {
  return (
    <>
      {sections.map((section) => {
        const translatedSectionTitle = localizedSectionTitle(section.title, translate);
        return (
          <div key={section.title} className="space-y-0">
            {hideSectionTitles ? null : (
              <div className="ui-no-select ui-no-callout mb-[var(--space-1)] px-1 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-wider)] text-text-tertiary">
                {translatedSectionTitle}
              </div>
            )}
            <div className="space-y-2">
              {section.items.map((item) => {
                const active = item.match(pathname);
                const favorited = favoriteHrefs.includes(item.href);
                const translatedItem = localizedItemText(item, translate);
                return (
                  <RoleGate key={item.href} allowedRoles={NAV_ROLE_MAP[item.id] || []}>
                    <div className="group/navitem flex items-center gap-1.5">
                      <Link
                        href={item.href}
                        prefetch
                        className={cn(navLinkClasses(active), "min-w-0 flex-1")}
                        aria-current={active ? "page" : undefined}
                        onMouseEnter={() => onWarm(item.href)}
                        onFocus={() => onWarm(item.href)}
                        onClick={onNavigate}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-control border-[0.5px] transition-colors duration-100",
                              active
                                ? "border-border-focus bg-surface-selected"
                                : "border-border-default bg-surface-shell",
                            )}
                          >
                            <NavIcon href={item.href} active={active} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className={cn("text-sm", active ? "font-medium text-accent" : "font-semibold text-[var(--text)]/90")}>
                                {translatedItem.label}
                              </div>
                              {item.badgeKey && badgeCounts[item.badgeKey] > 0 ? (
                                <div className="inline-flex rounded-badge border-[0.5px] border-border-default bg-surface-shell px-2 py-0.5 font-mono text-[11px] font-semibold text-text-primary">
                                  {formatBadgeCount(badgeCounts[item.badgeKey])}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </Link>
                      {onToggleFavorite ? (
                        <button
                          type="button"
                          aria-label={favorited ? `Unpin ${translatedItem.label}` : `Pin ${translatedItem.label}`}
                          aria-pressed={favorited}
                          className={cn(
                            "ui-no-select ui-no-callout mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border-[0.5px] transition-colors duration-100",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                            favorited
                              ? "border-status-warning-border bg-status-warning-bg text-status-warning-fg opacity-100"
                              : "border-border-default bg-surface-shell text-text-secondary opacity-0 group-hover/navitem:opacity-100 group-focus-within/navitem:opacity-100 hover:border-border-strong hover:text-text-primary",
                          )}
                          onClick={() => onToggleFavorite(item.href)}
                        >
                          <FavoriteIcon filled={favorited} />
                        </button>
                      ) : null}
                    </div>
                  </RoleGate>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AppSidebar({
  navItems,
  currentPath,
  badgeCounts,
  sidebarOpen,
  immersiveScannerRoute,
  activeFactoryName,
  activeIndustryLabel,
  organizationPlan,
  resolvedRole,
  workflowTemplateLabel,
  organizationName,
  factoryChoices,
  activeFactoryId,
  onFactorySwitch,
  switchingFactory,
  switchError,
  favoriteItems,
  primarySections,
  collapsibleSections,
  resolvedExpandedSections,
  favoriteHrefs,
  onToggleFavorite,
  onToggleSectionGroup,
  onWarm,
  onNavigate,
  onClose,
  language,
  theme,
  density,
  onLanguageChange,
  onThemeChange,
  onDensityChange,
  showTips,
  onToggleTips,
  accountActionBusy,
  onLogout,
  onSwitchAccount,
  translate,
}: {
  navItems: NavItem[];
  currentPath: string;
  badgeCounts: Record<NavBadgeKey, number>;
  sidebarOpen: boolean;
  immersiveScannerRoute: boolean;
  activeFactoryName: string;
  activeIndustryLabel?: string | null;
  organizationPlan?: string | null;
  resolvedRole?: string | null;
  workflowTemplateLabel?: string | null;
  organizationName?: string | null;
  factoryChoices: SidebarFactoryChoice[];
  activeFactoryId?: string | null;
  onFactorySwitch: (factoryId: string) => void | Promise<void>;
  switchingFactory: boolean;
  switchError: string;
  favoriteItems: NavItem[];
  primarySections: NavSection[];
  collapsibleSections: NavSection[];
  resolvedExpandedSections: Record<string, boolean>;
  favoriteHrefs: string[];
  onToggleFavorite: (href: string) => void;
  onToggleSectionGroup: (sectionKey: string) => void;
  onWarm: (href: string) => void;
  onNavigate: () => void;
  onClose: () => void;
  language: AppLanguage;
  theme: AppTheme;
  density: AppDensity;
  onLanguageChange: (next: string) => void;
  onThemeChange: (next: AppTheme) => void;
  onDensityChange: (next: AppDensity) => void;
  showTips: boolean;
  onToggleTips: () => void;
  accountActionBusy: "logout" | "switch" | null;
  onLogout: () => void | Promise<void>;
  onSwitchAccount: () => void | Promise<void>;
  translate?: TranslateFn;
}) {
  const dashboardReferenceRoute = currentPath === "/dashboard";
  return (
    <aside
      className={cn(
        "factory-sidebar-shell fixed inset-y-0 left-0 z-40 w-[13.75rem] border-r border-border-subtle bg-surface-shell shadow-[var(--shadow-sm)] transition-transform duration-300 ease-out",
        immersiveScannerRoute ? "hidden lg:block lg:translate-x-0" : "",
        !immersiveScannerRoute && (sidebarOpen ? "translate-x-0" : "-translate-x-full"),
      )}
      data-nav-count={navItems.length}
    >
      <div className="flex h-full flex-col px-2.5 py-2.5">
        <div className="factory-sidebar-header rounded-panel border border-border-subtle bg-surface-panel p-3 shadow-[var(--shadow-xs)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--action-primary)]">DPR.ai</div>
              <div className="mt-1 truncate text-sm font-semibold leading-5 text-text-primary">
                {activeFactoryName}
              </div>
              <div className="mt-0.5 text-[11px] leading-4 uppercase tracking-[0.14em] text-text-secondary">
                {activeIndustryLabel || (translate ? translate("shell.factory_context", "Factory context") : "Factory context")}
                {organizationPlan ? ` • ${organizationPlan} ${translate ? translate("common.plan", "plan") : "plan"}` : ""}
              </div>
            </div>
            <button
              type="button"
              aria-label={translate ? translate("shell.close_sidebar", "Close sidebar") : "Close sidebar"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated text-base font-semibold text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset lg:hidden"
              onClick={onClose}
            >
              {"<"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-badge border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
              {roleLabel(resolvedRole, translate)}
            </span>
            {workflowTemplateLabel ? (
              <span className="rounded-badge border border-border-subtle bg-surface-shell px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                {workflowTemplateLabel}
              </span>
            ) : null}
            {organizationName ? (
              <span className="truncate rounded-badge border border-border-subtle bg-surface-shell px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                {organizationName}
              </span>
            ) : null}
          </div>

          {factoryChoices.length > 1 ? (
            <div className="mt-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {translate ? translate("shell.switch_factory", "Switch Factory") : "Switch Factory"}
              </label>
              <Select
                aria-label={translate ? translate("shell.switch_factory", "Switch Factory") : "Switch Factory"}
                className="mt-1.5 h-11 bg-surface-elevated text-xs"
                value={activeFactoryId || ""}
                onChange={(event) => void onFactorySwitch(event.target.value)}
                disabled={switchingFactory}
              >
                {factoryChoices.map((factory) => (
                  <option key={factory.factory_id} value={factory.factory_id}>
                    {factory.name}
                  </option>
                ))}
              </Select>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                {switchingFactory ? (translate ? translate("shell.switching_factory_context", "Switching factory context...") : "Switching factory context...") : `${factoryChoices.length} factories`}
              </div>
              {switchError ? <div className="mt-1 text-[11px] text-[var(--status-danger-fg)]">{switchError}</div> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {favoriteItems.length > 0 ? (
              <NavContent
                pathname={currentPath}
                onWarm={onWarm}
                onNavigate={onNavigate}
                sections={[{ title: translate ? translate("shell.pinned", "Pinned") : "Pinned", items: favoriteItems }]}
                badgeCounts={badgeCounts}
                favoriteHrefs={favoriteHrefs}
                onToggleFavorite={onToggleFavorite}
                translate={translate}
              />
            ) : null}

            {primarySections.length > 0 ? (
              <NavContent
                pathname={currentPath}
                onWarm={onWarm}
                onNavigate={onNavigate}
                sections={primarySections}
                badgeCounts={badgeCounts}
                favoriteHrefs={favoriteHrefs}
                onToggleFavorite={onToggleFavorite}
                translate={translate}
              />
            ) : null}

            {collapsibleSections.map((section) => {
              const storageKey = sectionStorageKey(section.title);
              const expanded = resolvedExpandedSections[storageKey] ?? false;
              const active = section.items.some((item) => item.match(currentPath));
              return (
                <div key={section.title} className="space-y-[var(--space-1)]">
                  <button
                    type="button"
                    className="flex w-full min-h-[44px] items-center justify-between rounded-panel border border-transparent bg-transparent px-2.5 py-2 text-left transition-colors duration-100 hover:bg-surface-panel/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                    onClick={() => onToggleSectionGroup(storageKey)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-wider)] text-text-tertiary">
                        {localizedSectionTitle(section.title, translate)}
                      </div>
                      {active ? <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
                    </div>
                    <div className="text-[var(--muted)]">
                      <ChevronIcon expanded={expanded} />
                    </div>
                  </button>
                  {expanded ? (
                    <NavContent
                      pathname={currentPath}
                      onWarm={onWarm}
                      onNavigate={onNavigate}
                      sections={[section]}
                      badgeCounts={badgeCounts}
                      favoriteHrefs={favoriteHrefs}
                      onToggleFavorite={onToggleFavorite}
                      translate={translate}
                      hideSectionTitles
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 border-t border-[var(--border)] pt-3">
          {dashboardReferenceRoute ? (
            <div className="space-y-4 px-1">
              <Link
                href="/profile"
                className="ui-no-select ui-no-callout inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm border border-border-default bg-surface-elevated px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                {translate ? translate("shell.account_subtitle", "Account Settings") : "Account Settings"}
              </Link>
              <button
                type="button"
                onClick={() => void onLogout()}
                disabled={accountActionBusy !== null}
                className="ui-no-select ui-no-callout inline-flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-text-secondary transition-colors duration-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accountActionBusy === "logout"
                  ? translate
                    ? translate("shell.logging_out", "Logging out...")
                    : "Logging out..."
                  : translate
                    ? translate("shell.profile_and_signout", "Profile & Sign-out")
                    : "Profile & Sign-out"}
              </button>
            </div>
          ) : (
            <details className="group rounded-panel border border-border-subtle bg-surface-panel px-3 py-3 shadow-[var(--shadow-xs)]">
              <summary className="ui-no-select ui-no-callout flex cursor-pointer list-none items-center justify-between gap-3 text-left">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {translate ? translate("shell.account_title", "Account") : "Account"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {translate ? translate("shell.account_subtitle", "Profile and display") : "Profile and display"}
                  </div>
                </div>
                <span className="text-[var(--muted)] transition group-open:rotate-180">
                  <ChevronIcon expanded={false} />
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="ui-no-select ui-no-callout block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {translate ? translate("language.label", "Language") : "Language"}
                    </label>
                    <Select
                      className="h-11 bg-surface-shell text-xs"
                      value={language}
                      onChange={(event) => onLanguageChange(event.target.value)}
                      aria-label={translate ? translate("language.label", "Language") : "Language"}
                    >
                      {LANGUAGE_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {translate ? translate(choice.key, choice.fallback) : choice.fallback}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ui-no-select ui-no-callout block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {translate ? translate("shell.theme", "Theme") : "Theme"}
                    </label>
                    <Select
                      className="h-11 bg-surface-shell text-xs"
                      value={theme}
                      onChange={(event) => onThemeChange(event.target.value as AppTheme)}
                      aria-label={translate ? translate("shell.theme", "Theme") : "Theme"}
                    >
                      {THEME_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {translate ? translate(choice.key, choice.fallback) : choice.fallback}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="ui-no-select ui-no-callout block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {translate ? translate("shell.density", "Density") : "Density"}
                  </label>
                  <Select
                    className="h-11 bg-surface-shell text-xs"
                    value={density}
                    onChange={(event) => onDensityChange(event.target.value as AppDensity)}
                    aria-label={translate ? translate("shell.density", "Density") : "Density"}
                  >
                    {DENSITY_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {translate ? translate(choice.key, choice.fallback) : choice.fallback}
                      </option>
                    ))}
                  </Select>
                  <div className="text-[11px] text-[var(--muted)]">
                    {translate
                      ? translate("shell.density_hint", "Compact keeps dense workflows tight; Default is the operational baseline.")
                      : "Compact keeps dense workflows tight; Default is the operational baseline."}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-panel bg-surface-shell px-3 py-2.5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {translate ? translate("shell.tips_title", "Tips") : "Tips"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text)]">
                      {translate ? translate("shell.tips_subtitle", "Show tips") : "Show tips"}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showTips}
                    onClick={onToggleTips}
                    className={cn(
                      "ui-no-select ui-no-callout inline-flex h-11 w-14 items-center rounded-full border px-1 transition-colors duration-100",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      showTips
                        ? "border-border-focus bg-surface-selected text-text-primary"
                        : "border-border-default bg-surface-elevated text-text-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-panel text-[11px] font-semibold text-text-primary transition",
                        showTips ? "translate-x-6" : "translate-x-0",
                      )}
                    >
                      {showTips ? "On" : "Off"}
                    </span>
                  </button>
                </div>

                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Link
                    href="/profile"
                    className="ui-no-select ui-no-callout inline-flex h-11 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated px-2 text-[11px] font-medium text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  >
                    {translate ? translate("nav.profile.label", "Profile") : "Profile"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    disabled={accountActionBusy !== null}
                    className="ui-no-select ui-no-callout inline-flex h-11 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated px-2 text-[11px] font-medium text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountActionBusy === "logout"
                      ? translate
                        ? translate("shell.logging_out", "Logging out...")
                        : "Logging out..."
                      : translate
                        ? translate("shell.logout", "Logout")
                        : "Logout"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSwitchAccount()}
                    disabled={accountActionBusy !== null}
                    className="ui-no-select ui-no-callout inline-flex h-11 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated px-2 text-[11px] font-medium text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountActionBusy === "switch"
                      ? translate
                        ? translate("shell.switching", "Switching...")
                        : "Switching..."
                      : translate
                        ? translate("shell.switch_account", "Switch")
                        : "Switch"}
                  </button>
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </aside>
  );
}

export function AppDesktopContextRail({
  visible,
  hidden,
  currentItem,
  badgeCounts,
  factoryName,
  organizationName,
  role,
  workflowHint,
  quickLinks,
  onWarm,
  onToggle,
  translate,
}: {
  visible: boolean;
  hidden: boolean;
  currentItem: { label: string; description: string };
  badgeCounts: Record<NavBadgeKey, number>;
  factoryName: string;
  organizationName?: string | null;
  role?: string | null;
  workflowHint: { title: string; detail: string };
  quickLinks: NavItem[];
  onWarm: (href: string) => void;
  onToggle: () => void;
  translate?: TranslateFn;
}) {
  return (
    <>
      {visible ? (
        <aside className="factory-context-rail hidden w-[16.5rem] shrink-0 xl:block">
          <div className="sticky top-4 space-y-3 px-3 py-3">
            <div className="factory-rail-card rounded-panel border border-border-subtle bg-surface-panel p-4 shadow-[var(--shadow-xs)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Workspace</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{currentItem.label}</div>
                </div>
                <button
                  type="button"
                  aria-label={translate ? translate("shell.hide_workspace", "Hide workspace") : "Hide workspace"}
                  title={translate ? translate("shell.hide_workspace", "Hide workspace") : "Hide workspace"}
                  className="ui-no-select ui-no-callout inline-flex h-11 shrink-0 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated px-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-primary transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  onClick={onToggle}
                >
                  Hide
                </button>
              </div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">{currentItem.description}</div>
            </div>

            <div className="factory-rail-card rounded-panel border border-border-subtle bg-surface-panel p-4 shadow-[var(--shadow-xs)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Factory Context</div>
              <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                <div className="rounded-panel bg-surface-shell px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Factory</div>
                  <div className="mt-1 font-semibold text-[var(--text)]">{factoryName}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-panel bg-surface-shell px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Role</div>
                    <div className="mt-1 font-semibold text-[var(--text)]">{roleLabel(role, translate)}</div>
                  </div>
                  <div className="rounded-panel bg-surface-shell px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Alerts</div>
                    <div className="mt-1 font-semibold text-[var(--text)]">{badgeCounts.alerts}</div>
                  </div>
                </div>
                <div className="rounded-panel bg-surface-shell px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Review Load</div>
                  <div className="mt-1 font-semibold text-[var(--text)]">{badgeCounts.approvals}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{organizationName || "Active organization context"}</div>
                </div>
              </div>
            </div>

            <div className="factory-rail-card rounded-panel border border-border-subtle bg-surface-panel p-4 shadow-[var(--shadow-xs)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Primary Flow</div>
              <div className="mt-3 rounded-panel bg-surface-shell px-3 py-3">
                <div className="text-sm font-semibold text-[var(--text)]">{workflowHint.title}</div>
              </div>
            </div>

            <div className="factory-rail-card rounded-panel border border-border-subtle bg-surface-panel p-4 shadow-[var(--shadow-xs)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Quick Jump</div>
              <div className="mt-4 space-y-2">
                {quickLinks.map((item) => {
                  const translatedItem = localizedItemText(item, translate);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      className="ui-no-select ui-no-callout flex items-start gap-3 rounded-panel bg-surface-shell px-3 py-3 transition-colors duration-100 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                      onMouseEnter={() => onWarm(item.href)}
                      onFocus={() => onWarm(item.href)}
                    >
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated">
                        <NavIcon href={item.href} active={false} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--text)]">{translatedItem.label}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {hidden ? (
        <button
          type="button"
          aria-label={translate ? translate("shell.show_workspace", "Show workspace") : "Show workspace"}
          title={translate ? translate("shell.show_workspace", "Show workspace") : "Show workspace"}
          className="ui-no-select ui-no-callout fixed right-6 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-sticky hidden min-h-[44px] items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-primary shadow-xs transition-colors duration-100 hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 xl:inline-flex"
          onClick={onToggle}
        >
          Workspace
        </button>
      ) : null}
    </>
  );
}

export function AppMobileBottomNav({
  pathname,
  items,
  badgeCounts,
  onWarm,
  onNavigate,
  translate,
}: {
  pathname: string;
  items: NavItem[];
  badgeCounts: Record<NavBadgeKey, number>;
  onWarm: (href: string) => void;
  onNavigate?: () => void;
  translate?: TranslateFn;
}) {
  return (
    <nav className="safe-x-inset fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-panel px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2 lg:hidden">
      <div className="mx-auto flex max-w-xl items-end justify-between gap-1">
        {items.map((item) => {
          const active = item.match(pathname);
          const badgeCount = getMobileNavBadgeCount(item, badgeCounts);
          const scanAction = item.href === "/ocr/scan";

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={cn(
                "ui-no-select ui-no-callout group relative flex min-w-0 flex-1 flex-col items-center justify-end px-2 text-[11px] font-medium transition",
                active ? "text-[var(--text)]" : "text-[var(--muted)]",
              )}
              onMouseEnter={() => onWarm(item.href)}
              onFocus={() => onWarm(item.href)}
              onClick={onNavigate}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center transition",
                  scanAction
                    ? "mb-1 h-12 w-12 -translate-y-2 rounded-panel border-[0.5px] border-border-focus bg-surface-selected text-text-primary"
                    : cn(
                      "h-11 w-11 rounded-control border-[0.5px]",
                      active
                        ? "border-border-focus bg-surface-selected"
                        : "border-border-default bg-surface-elevated",
                    ),
                )}
              >
                <NavIcon href={item.href} active={scanAction || active} />
                {badgeCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--status-danger-bg)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--text-inverse)]">
                    {formatBadgeCount(badgeCount)}
                  </span>
                ) : null}
              </span>
              <span className={cn("truncate", scanAction ? "-mt-2" : "mt-1")}>{getMobileNavLabel(item, translate)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
