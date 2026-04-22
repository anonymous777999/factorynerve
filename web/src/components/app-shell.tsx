"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { JobsDrawer } from "@/components/jobs-drawer";
import { WorkflowReminderStrip } from "@/components/workflow-reminder-strip";
import { Select } from "@/components/ui/select";
import { logout, selectFactory } from "@/lib/auth";
import { listUnreadAlerts } from "@/lib/dashboard";
import { listEntries } from "@/lib/entries";
import type { AppLanguage } from "@/lib/i18n";
import { listOcrVerifications } from "@/lib/ocr";
import {
  getHomeDestination,
  getRoleDefaultFavoriteHrefs,
  getRoleDesktopQuickLinkHrefs,
  getRoleMobileNavHrefs,
  getRolePrimaryHrefs,
  getRoleWorkflowHint,
} from "@/lib/role-navigation";
import { logOverflowIssues } from "@/lib/overflow-debug";
import { warmRouteData } from "@/lib/route-warmup";
import { listSteelReconciliations } from "@/lib/steel";
import { subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

const REVIEW_ROLES = ["supervisor", "manager", "admin", "owner"] as const;
const MANAGEMENT_ROLES = ["manager", "admin", "owner"] as const;
const LEADERSHIP_ROLES = ["admin", "owner"] as const;
const CORE_WORK_ROLES = ["operator", "supervisor", "manager"] as const;
const REPORTING_ROLES = ["accountant", "supervisor", "manager", "admin", "owner"] as const;
const ATTENDANCE_VIEW_ROLES = ["attendance", "operator"] as const;
const ENTRY_WORK_ROLES = ["operator"] as const;
const DOCUMENT_CAPTURE_ROLES = ["operator"] as const;
const STEEL_CONTROL_ROLES = ["manager"] as const;
const STEEL_CHART_ROLES = ["manager", "owner"] as const;
const STEEL_COMMERCIAL_ROLES = ["accountant", "manager"] as const;
const DISPATCH_WORK_ROLES = ["manager"] as const;
const ATTENDANCE_REVIEW_NAV_ROLES = ["supervisor"] as const;
const REVIEW_QUEUE_NAV_ROLES = ["supervisor", "manager", "admin"] as const;
const OCR_VERIFY_NAV_ROLES = ["supervisor"] as const;
const STOCK_REVIEW_NAV_ROLES = ["supervisor"] as const;
const ATTENDANCE_REPORT_NAV_ROLES = ["accountant"] as const;
const OWNER_DESK_NAV_ROLES = ["owner"] as const;
const FACTORY_NETWORK_NAV_ROLES = ["owner"] as const;
const EMAIL_SUMMARY_NAV_ROLES = ["accountant", "manager", "owner"] as const;
const AI_INSIGHTS_NAV_ROLES = ["owner"] as const;
const ATTENDANCE_ADMIN_NAV_ROLES = ["admin"] as const;
const FACTORY_ADMIN_NAV_ROLES = ["admin"] as const;
const TASK_ROLES = ["operator", "supervisor"] as const;
const RAIL_COUNT_REFRESH_EVENT = "dpr:rail-counts-refresh";
const SIDEBAR_OPEN_STORAGE_KEY = "dpr:web:shell-sidebar-open";
const NAV_FAVORITES_STORAGE_KEY = "dpr:web:shell-favorites";
const NAV_SECTION_STATE_STORAGE_KEY = "dpr:web:shell-section-state";
const DESKTOP_CONTEXT_RAIL_HIDDEN_STORAGE_KEY = "dpr:web:shell-desktop-context-rail-hidden";

type NavBadgeKey = "approvals" | "alerts";
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

type NavItem = {
  label: string;
  href: string;
  description: string;
  roles?: readonly string[];
  industryTypes?: readonly string[];
  badgeKey?: NavBadgeKey;
  match: (pathname: string) => boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type ShellMode = "standard" | "focus" | "camera";
type DesktopRailMode = "none" | "context";

type ShellRouteLayout = {
  mode: ShellMode;
  desktopRail: DesktopRailMode;
  mobileTopBar: boolean;
  mobileBottomNav: boolean;
  fallbackHref: string;
};

type ShellRouteRule = {
  match: (pathname: string) => boolean;
  layout: Partial<ShellRouteLayout>;
};

const navSections: NavSection[] = [
  {
    title: "Today",
    items: [
      {
        label: "Work Queue",
        href: "/work-queue",
        description: "Cross-app queue for daily work, review load, and unread alerts",
        badgeKey: "alerts",
        roles: CORE_WORK_ROLES,
        match: (pathname) => pathname === "/work-queue" || pathname.startsWith("/work-queue/"),
      },
      {
        label: "Attendance",
        href: "/attendance",
        description: "Punch in, punch out, and keep live attendance visible for the active factory",
        roles: ATTENDANCE_VIEW_ROLES,
        match: (pathname) =>
          pathname === "/attendance" ||
          pathname === "/attendance/live" ||
          pathname.startsWith("/attendance/live/"),
      },
      {
        label: "Today Board",
        href: "/dashboard",
        description: "Start with live priorities, alerts, and the active factory context",
        badgeKey: "alerts",
        roles: ["operator", "supervisor", "manager", "admin"],
        match: (pathname) => pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
      },
      {
        label: "My Day",
        href: "/tasks",
        description: "Assigned work, handoffs, and follow-through for the current shift",
        roles: TASK_ROLES,
        match: (pathname) => pathname === "/tasks" || pathname.startsWith("/tasks/"),
      },
      {
        label: "Shift Entry",
        href: "/entry",
        description: "Capture shift production without hunting through screens",
        roles: ENTRY_WORK_ROLES,
        match: (pathname) => pathname === "/entry" || pathname.startsWith("/entry/"),
      },
      {
        label: "Document Desk",
        href: "/ocr/scan",
        description: "Bring paper registers and plant documents into the workflow fast",
        roles: DOCUMENT_CAPTURE_ROLES,
        match: (pathname) => pathname === "/ocr/scan" || pathname === "/ocr" || pathname.startsWith("/ocr/"),
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Steel Operations",
        href: "/steel",
        description: "Trusted stock, production, dispatch, and loss control",
        roles: STEEL_CONTROL_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel",
      },
      {
        label: "Steel Charts",
        href: "/steel/charts",
        description: "Chart-first board for stock, production, dispatch, and revenue movement",
        roles: STEEL_CHART_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel/charts" || pathname.startsWith("/steel/charts/"),
      },
      {
        label: "Customers",
        href: "/steel/customers",
        description: "Track customer ledger, payments, and outstanding exposure",
        roles: STEEL_COMMERCIAL_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel/customers" || pathname.startsWith("/steel/customers/"),
      },
      {
        label: "Sales Invoices",
        href: "/steel/invoices",
        description: "Weight-based invoicing and revenue control",
        roles: STEEL_COMMERCIAL_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel/invoices" || pathname.startsWith("/steel/invoices/"),
      },
      {
        label: "Dispatch",
        href: "/steel/dispatches",
        description: "Gate pass, truck movement, and dispatch follow-through",
        roles: DISPATCH_WORK_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel/dispatches" || pathname.startsWith("/steel/dispatches/"),
      },
    ],
  },
  {
    title: "Review",
    items: [
      {
        label: "Attendance Review",
        href: "/attendance/review",
        description: "Close missed punches, regularizations, and attendance exceptions",
        roles: ATTENDANCE_REVIEW_NAV_ROLES,
        match: (pathname) => pathname === "/attendance/review" || pathname.startsWith("/attendance/review/"),
      },
      {
        label: "Review Queue",
        href: "/approvals",
        description: "One place for pending review, verification, and stock trust work",
        roles: REVIEW_QUEUE_NAV_ROLES,
        badgeKey: "approvals",
        match: (pathname) => pathname === "/approvals" || pathname.startsWith("/approvals/"),
      },
      {
        label: "Review Documents",
        href: "/ocr/verify",
        description: "Approve OCR rows before they reach reports and exports",
        roles: OCR_VERIFY_NAV_ROLES,
        match: (pathname) => pathname === "/ocr/verify" || pathname.startsWith("/ocr/verify/"),
      },
      {
        label: "Stock Review",
        href: "/steel/reconciliations",
        description: "Review physical counts, confidence, and mismatch decisions",
        roles: STOCK_REVIEW_NAV_ROLES,
        industryTypes: ["steel"],
        match: (pathname) => pathname === "/steel/reconciliations" || pathname.startsWith("/steel/reconciliations/"),
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Attendance Reports",
        href: "/attendance/reports",
        description: "Daily manpower completion, late signals, and review load by date",
        roles: ATTENDANCE_REPORT_NAV_ROLES,
        match: (pathname) => pathname === "/attendance/reports" || pathname.startsWith("/attendance/reports/"),
      },
      {
        label: "Reports & Exports",
        href: "/reports",
        description: "Review output, exports, and operating signals across the selected range",
        roles: REPORTING_ROLES,
        match: (pathname) => pathname === "/reports" || pathname.startsWith("/reports/"),
      },
      {
        label: "Performance",
        href: "/analytics",
        description: "Trends, comparisons, and drill-down performance insight",
        roles: MANAGEMENT_ROLES,
        match: (pathname) => pathname === "/analytics" || pathname.startsWith("/analytics/"),
      },
      {
        label: "Owner Desk",
        href: "/premium/dashboard",
        description: "High-density owner view for risk, performance, and factory comparison",
        roles: OWNER_DESK_NAV_ROLES,
        match: (pathname) => pathname === "/premium/dashboard" || pathname.startsWith("/premium/"),
      },
      {
        label: "Factory Network",
        href: "/control-tower",
        description: "Compare factories and switch live operating context",
        roles: FACTORY_NETWORK_NAV_ROLES,
        match: (pathname) => pathname === "/control-tower" || pathname.startsWith("/control-tower/"),
      },
      {
        label: "Scheduled Updates",
        href: "/email-summary",
        description: "Automated summaries for managers and owners",
        roles: EMAIL_SUMMARY_NAV_ROLES,
        match: (pathname) => pathname === "/email-summary" || pathname.startsWith("/email-summary/"),
      },
      {
        label: "AI Insights",
        href: "/ai",
        description: "Advanced anomaly scans, suggestions, and KPI questions",
        roles: AI_INSIGHTS_NAV_ROLES,
        match: (pathname) => pathname === "/ai" || pathname.startsWith("/ai/"),
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        label: "Attendance Admin",
        href: "/settings/attendance",
        description: "Employee profile mapping, shift rules, and attendance operations setup",
        roles: ATTENDANCE_ADMIN_NAV_ROLES,
        match: (pathname) => pathname === "/settings/attendance" || pathname.startsWith("/settings/attendance/"),
      },
      {
        label: "Factory Admin",
        href: "/settings",
        description: "Factories, users, templates, and organization controls",
        roles: FACTORY_ADMIN_NAV_ROLES,
        match: (pathname) =>
          pathname === "/settings" ||
          (pathname.startsWith("/settings/") && !pathname.startsWith("/settings/attendance")),
      },
      {
        label: "Subscription",
        href: "/plans",
        description: "Review subscription tiers and available add-ons",
        roles: LEADERSHIP_ROLES,
        match: (pathname) => pathname === "/plans" || pathname.startsWith("/plans/"),
      },
      {
        label: "Billing & Invoices",
        href: "/billing",
        description: "Checkout, invoices, and subscription management",
        roles: LEADERSHIP_ROLES,
        match: (pathname) => pathname === "/billing" || pathname.startsWith("/billing/"),
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Profile",
        href: "/profile",
        description: "Your identity, access, password, and account details",
        match: (pathname) => pathname === "/profile" || pathname.startsWith("/profile/"),
      },
    ],
  },
];

const DEFAULT_SHELL_LAYOUT: ShellRouteLayout = {
  mode: "standard",
  desktopRail: "context",
  mobileTopBar: true,
  mobileBottomNav: true,
  fallbackHref: "/dashboard",
};

const shellRouteRules: ShellRouteRule[] = [
  {
    match: (pathname) => pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
    layout: { desktopRail: "none", fallbackHref: "/work-queue" },
  },
  {
    match: (pathname) => pathname === "/work-queue" || pathname.startsWith("/work-queue/"),
    layout: { mode: "focus", desktopRail: "none" },
  },
  {
    match: (pathname) => pathname === "/attendance" || pathname.startsWith("/attendance/"),
    layout: { mode: "focus", desktopRail: "none" },
  },
  {
    match: (pathname) => pathname === "/tasks" || pathname.startsWith("/tasks/"),
    layout: { mode: "focus", desktopRail: "none" },
  },
  {
    match: (pathname) => pathname === "/entry" || pathname.startsWith("/entry/"),
    layout: { mode: "focus", desktopRail: "none", mobileBottomNav: false },
  },
  {
    match: (pathname) => pathname === "/ocr/verify" || pathname.startsWith("/ocr/verify/"),
    layout: { mode: "focus", desktopRail: "none", mobileBottomNav: false },
  },
  {
    match: (pathname) => pathname === "/ocr/scan",
    layout: { mode: "camera", desktopRail: "none", mobileTopBar: false, mobileBottomNav: false },
  },
];

const MOBILE_NAV_LABELS: Record<string, string> = {
  "/dashboard": "Home",
  "/work-queue": "Queue",
  "/ocr/scan": "Scan",
  "/attendance": "Attendance",
  "/profile": "Profile",
};

type TranslateFn = (key: string, fallback?: string) => string;

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
  "/work-queue": {
    label: "nav.work_queue.label",
    description: "nav.work_queue.description",
  },
  "/attendance": {
    label: "nav.attendance.label",
    description: "nav.attendance.description",
  },
  "/dashboard": {
    label: "nav.today_board.label",
    description: "nav.today_board.description",
  },
  "/tasks": {
    label: "nav.my_day.label",
    description: "nav.my_day.description",
  },
  "/entry": {
    label: "nav.shift_entry.label",
    description: "nav.shift_entry.description",
  },
  "/ocr/scan": {
    label: "nav.document_desk.label",
    description: "nav.document_desk.description",
  },
  "/steel": {
    label: "nav.steel_operations.label",
    description: "nav.steel_operations.description",
  },
  "/steel/charts": {
    label: "nav.steel_charts.label",
    description: "nav.steel_charts.description",
  },
  "/steel/customers": {
    label: "nav.customers.label",
    description: "nav.customers.description",
  },
  "/steel/invoices": {
    label: "nav.sales_invoices.label",
    description: "nav.sales_invoices.description",
  },
  "/steel/dispatches": {
    label: "nav.dispatch.label",
    description: "nav.dispatch.description",
  },
  "/attendance/review": {
    label: "nav.attendance_review.label",
    description: "nav.attendance_review.description",
  },
  "/approvals": {
    label: "nav.review_queue.label",
    description: "nav.review_queue.description",
  },
  "/ocr/verify": {
    label: "nav.review_documents.label",
    description: "nav.review_documents.description",
  },
  "/steel/reconciliations": {
    label: "nav.stock_review.label",
    description: "nav.stock_review.description",
  },
  "/attendance/reports": {
    label: "nav.attendance_reports.label",
    description: "nav.attendance_reports.description",
  },
  "/reports": {
    label: "nav.reports_exports.label",
    description: "nav.reports_exports.description",
  },
  "/analytics": {
    label: "nav.performance.label",
    description: "nav.performance.description",
  },
  "/premium/dashboard": {
    label: "nav.owner_desk.label",
    description: "nav.owner_desk.description",
  },
  "/control-tower": {
    label: "nav.factory_network.label",
    description: "nav.factory_network.description",
  },
  "/email-summary": {
    label: "nav.scheduled_updates.label",
    description: "nav.scheduled_updates.description",
  },
  "/ai": {
    label: "nav.ai_insights.label",
    description: "nav.ai_insights.description",
  },
  "/settings/attendance": {
    label: "nav.attendance_admin.label",
    description: "nav.attendance_admin.description",
  },
  "/settings": {
    label: "nav.factory_admin.label",
    description: "nav.factory_admin.description",
  },
  "/plans": {
    label: "nav.subscription.label",
    description: "nav.subscription.description",
  },
  "/billing": {
    label: "nav.billing.label",
    description: "nav.billing.description",
  },
  "/profile": {
    label: "nav.profile.label",
    description: "nav.profile.description",
  },
};

const LANGUAGE_CHOICES: Array<{ value: AppLanguage; key: string; fallback: string }> = [
  { value: "en", key: "language.english", fallback: "English" },
  { value: "hi", key: "language.hindi", fallback: "Hindi" },
  { value: "mr", key: "language.marathi", fallback: "Marathi" },
  { value: "ta", key: "language.tamil", fallback: "Tamil" },
  { value: "gu", key: "language.gujarati", fallback: "Gujarati" },
];

const shellHiddenRoutes = new Set(["/", "/login", "/access", "/register", "/forgot-password", "/reset-password"]);

function navLinkClasses(active: boolean) {
  return cn(
    "group block rounded-xl border px-3.5 py-2.5 transition",
    active
      ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)] shadow-[0_0_0_1px_rgba(62,166,255,0.15)]"
      : "border-[var(--border)] bg-[rgba(20,24,36,0.7)] hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(28,34,51,0.82)]",
  );
}

function localizedSectionTitle(title: string, translate?: TranslateFn) {
  if (!translate) return title;
  const key = SECTION_LABEL_KEY[title];
  return key ? translate(key, title) : title;
}

function sectionStorageKey(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function localizedItemText(item: NavItem, translate?: TranslateFn) {
  const keys = ITEM_TRANSLATION_KEY[item.href];
  if (!translate || !keys) {
    return {
      label: item.label,
      description: item.description,
    };
  }
  return {
    label: translate(keys.label, item.label),
    description: translate(keys.description, item.description),
  };
}

function roleLabel(role?: string | null, translate?: TranslateFn) {
  if (!role) return translate ? translate("role.team_member", "Team member") : "Team member";
  if (role.toLowerCase() === "attendance") {
    return translate ? translate("role.attendance", "Attendance user") : "Attendance user";
  }
  if (!translate) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }
  return translate(`role.${role.toLowerCase()}`, role.charAt(0).toUpperCase() + role.slice(1));
}

function getVisibleNavSections(role?: string | null, industryType?: string | null) {
  const normalizedIndustry = (industryType || "").toLowerCase();
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const roleAllowed = !item.roles || (role ? item.roles.includes(role) : false);
        const industryAllowed =
          !item.industryTypes ||
          item.industryTypes.length === 0 ||
          (normalizedIndustry ? item.industryTypes.includes(normalizedIndustry) : false);
        return roleAllowed && industryAllowed;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

function getShellLayout(pathname: string): ShellRouteLayout {
  const matched = shellRouteRules.find((rule) => rule.match(pathname));
  return matched ? { ...DEFAULT_SHELL_LAYOUT, ...matched.layout } : DEFAULT_SHELL_LAYOUT;
}

function getMobileNavItems(visibleNavMap: Map<string, NavItem>, role?: string | null) {
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
  const fallback = MOBILE_NAV_LABELS[item.href];
  if (fallback) {
    return fallback;
  }
  return localizedItemText(item, translate).label;
}

function getMobileNavBadgeCount(item: NavItem, badgeCounts: Record<NavBadgeKey, number>) {
  if (item.href === "/work-queue") {
    return badgeCounts.alerts + badgeCounts.approvals;
  }
  if (item.badgeKey) {
    return badgeCounts[item.badgeKey];
  }
  return 0;
}

function formatBadgeCount(value: number) {
  return value > 99 ? "99+" : String(value);
}

function getNavIconName(href: string): NavIconName {
  switch (href) {
    case "/work-queue":
      return "queue";
    case "/attendance":
      return "attendance";
    case "/dashboard":
      return "board";
    case "/tasks":
      return "day";
    case "/entry":
      return "entry";
    case "/ocr":
    case "/ocr/scan":
      return "docs";
    case "/steel":
      return "steel";
    case "/steel/charts":
      return "performance";
    case "/steel/customers":
      return "customers";
    case "/steel/invoices":
      return "invoice";
    case "/steel/dispatches":
      return "dispatch";
    case "/approvals":
      return "review";
    case "/attendance/review":
      return "review";
    case "/ocr/verify":
      return "verify";
    case "/steel/reconciliations":
      return "stock";
    case "/attendance/reports":
      return "reports";
    case "/reports":
      return "reports";
    case "/analytics":
      return "performance";
    case "/premium/dashboard":
      return "owner";
    case "/control-tower":
      return "network";
    case "/email-summary":
      return "updates";
    case "/ai":
      return "ai";
    case "/settings":
      return "settings";
    case "/settings/attendance":
      return "settings";
    case "/plans":
      return "subscription";
    case "/billing":
      return "billing";
    default:
      return "profile";
  }
}

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const iconName = getNavIconName(href);
  const iconClassName = cn(
    "h-[18px] w-[18px] shrink-0",
    active ? "text-sky-100" : "text-[var(--muted)] group-hover:text-[var(--text)]",
  );

  switch (iconName) {
    case "queue":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M4 5h12" strokeLinecap="round" />
          <path d="M4 10h9" strokeLinecap="round" />
          <path d="M4 15h7" strokeLinecap="round" />
          <circle cx="15.5" cy="10" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "attendance":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <circle cx="10" cy="10" r="6.2" />
          <path d="M10 6.5v3.9l2.5 1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "board":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="3.2" y="4" width="13.6" height="12" rx="2.2" />
          <path d="M7 8h6M7 12h3.5" strokeLinecap="round" />
        </svg>
      );
    case "day":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="3.2" y="3.6" width="13.6" height="12.8" rx="2.2" />
          <path d="M6.7 8.7l1.7 1.7 4.7-4.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "entry":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="4" y="3.2" width="12" height="13.6" rx="2" />
          <path d="M7 7.2h6M7 10.4h6M7 13.6h4" strokeLinecap="round" />
        </svg>
      );
    case "docs":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M6 3.5h5.8L15.5 7v9.1a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4V4.9A1.4 1.4 0 0 1 6 3.5Z" />
          <path d="M11.5 3.8V7h3.2M7.4 10h5.2M7.4 13h4" strokeLinecap="round" />
        </svg>
      );
    case "steel":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M3.8 13.8 10 4.2l6.2 9.6H3.8Z" strokeLinejoin="round" />
          <path d="M6.4 13.8h7.2" strokeLinecap="round" />
        </svg>
      );
    case "customers":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <circle cx="7" cy="7.4" r="2.2" />
          <circle cx="13.5" cy="8.3" r="1.9" />
          <path d="M3.8 15.8c.7-2 2.4-3 5-3s4.3 1 5 3M12.3 15.8c.4-1.4 1.6-2.1 3.5-2.1" strokeLinecap="round" />
        </svg>
      );
    case "invoice":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M6 3.5h8a1.4 1.4 0 0 1 1.4 1.4v10.2L13 13.8l-2 1.3-2-1.3-2 1.3V4.9A1.4 1.4 0 0 1 6 3.5Z" />
          <path d="M8 7.3h5M8 10.2h5M8 13.1h3.3" strokeLinecap="round" />
        </svg>
      );
    case "dispatch":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M3.8 6h8.5v6.1H3.8z" />
          <path d="M12.3 8.1h2.3l1.6 2v2H12.3z" />
          <circle cx="7.1" cy="14.5" r="1.6" />
          <circle cx="14.4" cy="14.5" r="1.6" />
        </svg>
      );
    case "review":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M4.4 4.6h11.2v7.7H9.8l-3.6 3v-3H4.4z" strokeLinejoin="round" />
          <path d="M7 8.3h6" strokeLinecap="round" />
        </svg>
      );
    case "verify":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="3.7" y="3.7" width="12.6" height="12.6" rx="2.2" />
          <path d="m7.2 10 1.8 1.9 3.9-4.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "stock":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M5.1 6.1 10 3.8l4.9 2.3L10 8.4 5.1 6.1Z" strokeLinejoin="round" />
          <path d="M5.1 9.5 10 11.8l4.9-2.3M5.1 13 10 15.3l4.9-2.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.1 6.1V13M14.9 6.1V13" strokeLinecap="round" />
        </svg>
      );
    case "reports":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M4.2 15.5V4.5M9.1 15.5V8.4M14 15.5V6.2" strokeLinecap="round" />
          <path d="M3.8 15.5h12.4" strokeLinecap="round" />
        </svg>
      );
    case "performance":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M4.2 14.9 8.1 11l2.7 2.7 5-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.6 8.7h4v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "owner":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M10 4.1 11.8 7.7l4 .6-2.9 2.9.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.9 4-.6L10 4.1Z" strokeLinejoin="round" />
        </svg>
      );
    case "network":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="2.9" y="4.4" width="5" height="4.4" rx="1" />
          <rect x="12.1" y="4.4" width="5" height="4.4" rx="1" />
          <rect x="7.5" y="11.4" width="5" height="4.4" rx="1" />
          <path d="M7.9 6.6h4.2M10 8.8v2.2" strokeLinecap="round" />
        </svg>
      );
    case "updates":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="3.5" y="4.5" width="13" height="11.5" rx="2.2" />
          <path d="M6.7 3.6v2M13.3 3.6v2M6.6 9h6.8M6.6 12.2h4.2" strokeLinecap="round" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <path d="M10 3.8 11.3 7l3.4 1.3-3.4 1.3L10 12.8 8.7 9.6 5.3 8.3 8.7 7 10 3.8Z" strokeLinejoin="round" />
          <path d="M14.7 11.9 15.5 14l2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <circle cx="10" cy="10" r="2.3" />
          <path d="M10 3.8v1.6M10 14.6v1.6M15.4 10h1.6M3 10h1.6M14.3 5.7l1.1-1.1M4.6 15.4l1.1-1.1M14.3 14.3l1.1 1.1M4.6 4.6l1.1 1.1" strokeLinecap="round" />
        </svg>
      );
    case "subscription":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="4.2" y="4.2" width="11.6" height="11.6" rx="2.2" />
          <path d="M7.2 7.2h5.6v5.6H7.2z" />
        </svg>
      );
    case "billing":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <rect x="3.2" y="5.1" width="13.6" height="9.8" rx="2.2" />
          <path d="M3.8 8.1h12.4M7 12.1h2.7" strokeLinecap="round" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className={iconClassName}>
          <circle cx="10" cy="7.2" r="2.6" />
          <path d="M5.2 15.3c.8-2.2 2.5-3.3 4.8-3.3s4 1.1 4.8 3.3" strokeLinecap="round" />
        </svg>
      );
  }
}

function FavoriteIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
    >
      <path
        d="M10 3.9 11.9 7.7l4.2.6-3 2.9.7 4.2-3.8-2-3.8 2 .7-4.2-3-2.9 4.2-.6L10 3.9Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={cn("h-4 w-4 transition-transform duration-200", expanded ? "rotate-90" : "")}
    >
      <path d="m7.5 5.8 4.2 4.2-4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
          <div key={section.title} className="space-y-3">
            {hideSectionTitles ? null : (
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                {translatedSectionTitle}
              </div>
            )}
            <div className="space-y-2">
              {section.items.map((item) => {
                const active = item.match(pathname);
                const favorited = favoriteHrefs.includes(item.href);
                const translatedItem = localizedItemText(item, translate);
                return (
                  <div key={item.href} className="group/navitem flex items-center gap-2">
                  <Link
                    href={item.href}
                    prefetch
                    className={cn(navLinkClasses(active), "min-w-0 flex-1")}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => onWarm(item.href)}
                    onFocus={() => onWarm(item.href)}
                    onClick={onNavigate}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                          active
                            ? "border-[rgba(62,166,255,0.34)] bg-[rgba(62,166,255,0.16)]"
                            : "border-[var(--border)] bg-[rgba(8,12,20,0.56)]",
                        )}
                      >
                        <NavIcon href={item.href} active={active} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={cn(
                              "text-sm font-semibold",
                              active ? "text-[var(--text)]" : "text-[var(--text)]/90",
                            )}
                          >
                            {translatedItem.label}
                          </div>
                          {item.badgeKey && badgeCounts[item.badgeKey] > 0 ? (
                            <div className="inline-flex rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(62,166,255,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text)]">
                              {formatBadgeCount(badgeCounts[item.badgeKey])}
                            </div>
                          ) : null}
                        </div>
                        {/* AUDIT: TEXT_NOISE — The sidebar now stays label-first and leaves route explanation to the workspace rail instead of repeating it under each active item. */}
                      </div>
                    </div>
                  </Link>
                  {onToggleFavorite ? (
                    <button
                      type="button"
                      aria-label={favorited ? `Unpin ${translatedItem.label}` : `Pin ${translatedItem.label}`}
                      aria-pressed={favorited}
                      className={cn(
                        "mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition",
                        favorited
                          ? "border-[rgba(255,218,102,0.3)] bg-[rgba(255,218,102,0.12)] text-amber-200 opacity-100"
                          : "border-[var(--border)] bg-[rgba(8,12,20,0.56)] text-[var(--muted)] opacity-0 group-hover/navitem:opacity-100 group-focus-within/navitem:opacity-100 hover:border-[rgba(62,166,255,0.28)] hover:text-[var(--text)]",
                      )}
                      onClick={() => onToggleFavorite(item.href)}
                    >
                      <FavoriteIcon filled={favorited} />
                    </button>
                  ) : null}
                </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function DesktopContextRail({
  currentItem,
  badgeCounts,
  factoryName,
  organizationName,
  role,
  workflowHint,
  quickLinks,
  onWarm,
  onHide,
  translate,
}: {
  currentItem: { label: string; description: string };
  badgeCounts: Record<NavBadgeKey, number>;
  factoryName: string;
  organizationName?: string | null;
  role?: string | null;
  workflowHint: { title: string; detail: string };
  quickLinks: NavItem[];
  onWarm: (href: string) => void;
  onHide: () => void;
  translate?: TranslateFn;
}) {
  return (
    <aside className="hidden w-[19rem] shrink-0 xl:block">
      <div className="sticky top-6 space-y-4 px-6 py-6">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-[0_16px_44px_rgba(3,8,20,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(62,166,255,0.82)]">
                Workspace
              </div>
              <div className="mt-3 text-lg font-semibold text-[var(--text)]">{currentItem.label}</div>
            </div>
              <button
                type="button"
                aria-label={translate ? translate("shell.hide_workspace", "Hide workspace") : "Hide workspace"}
                title={translate ? translate("shell.hide_workspace", "Hide workspace") : "Hide workspace"}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.62)] px-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)] hover:bg-[rgba(20,24,36,0.85)]"
                onClick={onHide}
              >
                Hide
              </button>
          </div>
          <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{currentItem.description}</div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Factory Context
          </div>
          <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Factory</div>
              <div className="mt-1 font-semibold text-[var(--text)]">{factoryName}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Role</div>
                <div className="mt-1 font-semibold text-[var(--text)]">{roleLabel(role, translate)}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Alerts</div>
                <div className="mt-1 font-semibold text-[var(--text)]">{badgeCounts.alerts}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Review Load</div>
              <div className="mt-1 font-semibold text-[var(--text)]">{badgeCounts.approvals}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {organizationName || "Active organization context"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Primary Flow
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-4">
            <div className="text-sm font-semibold text-[var(--text)]">{workflowHint.title}</div>
            <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{workflowHint.detail}</div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Quick Jump
          </div>
          <div className="mt-4 space-y-2">
            {quickLinks.map((item) => {
              const translatedItem = localizedItemText(item, translate);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] px-4 py-3 transition hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(20,24,36,0.82)]"
                  onMouseEnter={() => onWarm(item.href)}
                  onFocus={() => onWarm(item.href)}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(20,24,36,0.86)]">
                    <NavIcon href={item.href} active={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{translatedItem.label}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{translatedItem.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(11,14,20,0.95)] px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
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
                "group relative flex min-w-0 flex-1 flex-col items-center justify-end px-2 text-[11px] font-medium transition",
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
                    ? "mb-1 h-14 w-14 -translate-y-4 rounded-[1.35rem] bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] text-[#08101D] shadow-[0_18px_36px_rgba(34,211,238,0.28)]"
                    : cn(
                        "h-10 w-10 rounded-2xl border",
                        active
                          ? "border-[rgba(62,166,255,0.34)] bg-[rgba(62,166,255,0.14)]"
                          : "border-[var(--border)] bg-[rgba(20,24,36,0.86)]",
                      ),
                )}
              >
                <NavIcon href={item.href} active={scanAction || active} />
                {badgeCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (shellHiddenRoutes.has(pathname)) {
    return <>{children}</>;
  }

  return <AppShellFrame pathname={pathname}>{children}</AppShellFrame>;
}

function AppShellFrame({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const shellLayout = useMemo(() => getShellLayout(pathname), [pathname]);
  const immersiveScannerRoute = shellLayout.mode === "camera";
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  useI18nNamespaces(["common", "navigation"]);
  const { activeFactory, activeFactoryId, factories, organization, user } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const [switchingFactory, setSwitchingFactory] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [accountActionBusy, setAccountActionBusy] = useState<"logout" | "switch" | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<Record<"approvals" | "alerts", number>>({
    approvals: 0,
    alerts: 0,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [favoriteHrefs, setFavoriteHrefs] = useState<string[]>([]);
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({});
  const [desktopContextRailHidden, setDesktopContextRailHidden] = useState(false);
  const factoryChoices = useMemo(
    () => factories.filter((factory) => Boolean(factory.factory_id)),
    [factories],
  );
  const resolvedRole = hydrated ? user?.role : null;
  const activeIndustryType = hydrated ? activeFactory?.industry_type || null : null;
  const visibleNavSections = useMemo(
    () => getVisibleNavSections(resolvedRole, activeIndustryType),
    [activeIndustryType, resolvedRole],
  );
  const visibleNavItems = useMemo(() => visibleNavSections.flatMap((section) => section.items), [visibleNavSections]);
  const visibleNavMap = useMemo(
    () => new Map(visibleNavItems.map((item) => [item.href, item])),
    [visibleNavItems],
  );
  const activeNavItem = useMemo(
    () => visibleNavItems.find((item) => item.match(pathname)) || null,
    [pathname, visibleNavItems],
  );
  const currentItem = useMemo(() => {
    if (activeNavItem) {
      return localizedItemText(activeNavItem, t);
    }
    return {
      label: t("shell.workspace.label", "Workspace"),
      description: t(
        "shell.workspace.description",
        "Move between factory work, reviews, and reports without losing context.",
      ),
    };
  }, [activeNavItem, t]);
  const primarySectionHrefs = useMemo(() => new Set(getRolePrimaryHrefs(resolvedRole)), [resolvedRole]);
  const primarySections = useMemo(
    () =>
      visibleNavSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => primarySectionHrefs.has(item.href)),
        }))
        .filter((section) => section.items.length > 0),
    [primarySectionHrefs, visibleNavSections],
  );
  const collapsibleSections = useMemo(
    () =>
      visibleNavSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => !primarySectionHrefs.has(item.href)),
        }))
        .filter((section) => section.items.length > 0),
    [primarySectionHrefs, visibleNavSections],
  );
  const favoriteItems = useMemo(
    () => visibleNavItems.filter((item) => favoriteHrefs.includes(item.href)),
    [favoriteHrefs, visibleNavItems],
  );
  const mobileNavItems = useMemo(
    () => getMobileNavItems(visibleNavMap, resolvedRole),
    [resolvedRole, visibleNavMap],
  );
  const mobileTabActive = useMemo(
    () => mobileNavItems.some((item) => item.match(pathname)),
    [mobileNavItems, pathname],
  );
  const workflowHint = useMemo(
    () => getRoleWorkflowHint(resolvedRole, activeIndustryType),
    [activeIndustryType, resolvedRole],
  );
  const desktopRailQuickLinks = useMemo(() => {
    const preferredHrefs = getRoleDesktopQuickLinkHrefs(resolvedRole);
    const next: NavItem[] = [];
    preferredHrefs.forEach((href) => {
      const item = visibleNavMap.get(href);
      if (!item || item.match(pathname)) {
        return;
      }
      next.push(item);
    });
      return next.slice(0, 3);
  }, [pathname, resolvedRole, visibleNavMap]);
  const resolvedExpandedSections = useMemo(() => {
    const next: Record<string, boolean> = {};
    collapsibleSections.forEach((section, index) => {
      const sectionKey = sectionStorageKey(section.title);
      const hasActiveRoute = section.items.some((item) => item.match(pathname));
      const stored = sectionExpanded[sectionKey];
      if (typeof stored === "boolean") {
        next[sectionKey] = stored;
      } else {
        next[sectionKey] = hasActiveRoute || index === 0;
      }
    });
    return next;
  }, [collapsibleSections, pathname, sectionExpanded]);

  const warmRoute = useCallback(
    (href: string) => {
      router.prefetch(href);
      warmRouteData(href);
    },
    [router],
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const primaryRoutes = [
      ...getRolePrimaryHrefs(resolvedRole),
      ...getRoleMobileNavHrefs(resolvedRole),
      ...getRoleDesktopQuickLinkHrefs(resolvedRole),
    ];
    const dedupedRoutes = primaryRoutes.filter((href, index, all) => all.indexOf(href) === index);
    const timer = window.setTimeout(() => {
      dedupedRoutes.forEach((href) => warmRoute(href));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [resolvedRole, warmRoute]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    const canReview = REVIEW_ROLES.includes((user.role || "") as (typeof REVIEW_ROLES)[number]);
    const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";

    const loadCounts = async () => {
      const [alertsResult, entryResult, verificationResult, reconciliationResult] = await Promise.allSettled([
        listUnreadAlerts(),
        canReview ? listEntries({ status: ["pending"], page: 1, page_size: 1 }) : Promise.resolve(null),
        canReview ? listOcrVerifications("pending") : Promise.resolve([]),
        canReview && steelMode ? listSteelReconciliations({ status: "pending", limit: 100 }) : Promise.resolve({ items: [] }),
      ]);

      if (cancelled) {
        return;
      }

      const alerts =
        alertsResult.status === "fulfilled" && Array.isArray(alertsResult.value)
          ? alertsResult.value.length
          : 0;
      const pendingEntries =
        entryResult.status === "fulfilled" && entryResult.value && typeof entryResult.value === "object" && "total" in entryResult.value
          ? Number((entryResult.value as { total?: number }).total || 0)
          : 0;
      const pendingVerifications =
        verificationResult.status === "fulfilled" && Array.isArray(verificationResult.value)
          ? verificationResult.value.length
          : 0;
      const pendingReconciliations =
        reconciliationResult.status === "fulfilled" && reconciliationResult.value && typeof reconciliationResult.value === "object" && "items" in reconciliationResult.value
          ? ((reconciliationResult.value as { items?: unknown[] }).items || []).length
          : 0;

      setBadgeCounts({
        alerts,
        approvals: pendingEntries + pendingVerifications + pendingReconciliations,
      });
    };

    void loadCounts();
    const timer = window.setInterval(() => {
      void loadCounts();
    }, 20000);
    const onRefresh = () => {
      void loadCounts();
    };
    const onVisibility = () => {
      if (!document.hidden) {
        void loadCounts();
      }
    };
    window.addEventListener(RAIL_COUNT_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    const stopWorkflowRefresh = subscribeToWorkflowRefresh(() => {
      void loadCounts();
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(RAIL_COUNT_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      stopWorkflowRefresh();
    };
  }, [activeFactory?.industry_type, user]);

  const setSidebarState = useCallback((next: boolean) => {
    setSidebarOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, next ? "true" : "false");
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, next ? "true" : "false");
      }
      return next;
    });
  }, []);

  const handleNavNavigate = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarState(false);
    }
  }, [setSidebarState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
      const next =
        window.innerWidth >= 1024 ? (stored != null ? stored === "true" : true) : false;
      setSidebarState(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setSidebarState]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
        return;
      }
      const stored = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
      setSidebarState(stored != null ? stored === "true" : true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarState]);

  useEffect(() => {
    if (!immersiveScannerRoute) {
      return;
    }
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarState(true);
    }
  }, [immersiveScannerRoute, setSidebarState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const visibleHrefs = new Set(visibleNavItems.map((item) => item.href));
      const raw = window.localStorage.getItem(NAV_FAVORITES_STORAGE_KEY);
      let parsedFavorites: string[] = [];
      if (raw) {
        try {
          const decoded = JSON.parse(raw);
          if (Array.isArray(decoded)) {
            parsedFavorites = decoded.filter((value): value is string => typeof value === "string");
          }
        } catch {
          parsedFavorites = [];
        }
      }

      const fallbackFavorites = getRoleDefaultFavoriteHrefs(resolvedRole);
      const nextFavorites = (parsedFavorites.length > 0 ? parsedFavorites : fallbackFavorites).filter((href, index, all) => {
        return visibleHrefs.has(href) && all.indexOf(href) === index;
      });

      setFavoriteHrefs(nextFavorites);
      window.localStorage.setItem(NAV_FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedRole, visibleNavItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(NAV_SECTION_STATE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      try {
        const decoded = JSON.parse(raw);
        if (decoded && typeof decoded === "object") {
          const next = Object.fromEntries(
            Object.entries(decoded).filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"),
          );
          setSectionExpanded(next);
        }
      } catch {
        setSectionExpanded({});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(DESKTOP_CONTEXT_RAIL_HIDDEN_STORAGE_KEY);
      setDesktopContextRailHidden(stored === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persistFavoriteHrefs = useCallback((next: string[]) => {
    const deduped = next.filter((href, index, all) => all.indexOf(href) === index);
    setFavoriteHrefs(deduped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAV_FAVORITES_STORAGE_KEY, JSON.stringify(deduped));
    }
  }, []);

  const toggleFavorite = useCallback(
    (href: string) => {
      if (!visibleNavMap.has(href)) {
        return;
      }

      persistFavoriteHrefs(
        favoriteHrefs.includes(href)
          ? favoriteHrefs.filter((itemHref) => itemHref !== href)
          : [...favoriteHrefs, href],
      );
    },
    [favoriteHrefs, persistFavoriteHrefs, visibleNavMap],
  );

  const persistSectionExpanded = useCallback((next: Record<string, boolean>) => {
    setSectionExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAV_SECTION_STATE_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const setDesktopContextRailHiddenState = useCallback((next: boolean) => {
    setDesktopContextRailHidden(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DESKTOP_CONTEXT_RAIL_HIDDEN_STORAGE_KEY, next ? "true" : "false");
    }
  }, []);

  const toggleDesktopContextRail = useCallback(() => {
    setDesktopContextRailHiddenState(!desktopContextRailHidden);
  }, [desktopContextRailHidden, setDesktopContextRailHiddenState]);

  const toggleSectionGroup = useCallback(
    (sectionKey: string) => {
      const nextValue = !(resolvedExpandedSections[sectionKey] ?? true);
      persistSectionExpanded({
        ...sectionExpanded,
        [sectionKey]: nextValue,
      });
    },
    [persistSectionExpanded, resolvedExpandedSections, sectionExpanded],
  );

  const handleFactorySwitch = async (nextFactoryId: string) => {
    if (!nextFactoryId || nextFactoryId === activeFactoryId) {
      return;
    }
    setSwitchingFactory(true);
    setSwitchError("");
    try {
      await selectFactory(nextFactoryId);
      window.location.reload();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Could not switch factory.");
      setSwitchingFactory(false);
    }
  };

  const handleLanguageChange = useCallback(
    (next: string) => {
      if (next === "en" || next === "hi" || next === "mr" || next === "ta" || next === "gu") {
        setLanguage(next);
      }
    },
    [setLanguage],
  );

  const handleLogout = useCallback(async () => {
    setAccountActionBusy("logout");
    try {
      await logout();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/access";
      }
    }
  }, []);

  const handleSwitchAccount = useCallback(async () => {
    setAccountActionBusy("switch");
    try {
      await logout();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/access?switch_account=1";
      }
    }
  }, []);

  const handleMobileBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const roleHomeHref = getHomeDestination(resolvedRole, organization?.accessible_factories || 0);
    router.push(shellLayout.fallbackHref === "/dashboard" ? roleHomeHref : shellLayout.fallbackHref);
  }, [organization?.accessible_factories, resolvedRole, router, shellLayout.fallbackHref]);

  const showDesktopContextRail =
    shellLayout.desktopRail === "context" && !desktopContextRailHidden;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const runAudit = () => {
      window.requestAnimationFrame(() => {
        logOverflowIssues(pathname);
      });
    };
    runAudit();
    window.addEventListener("resize", runAudit);
    window.addEventListener("orientationchange", runAudit);
    return () => {
      window.removeEventListener("resize", runAudit);
      window.removeEventListener("orientationchange", runAudit);
    };
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen overflow-hidden" data-component="app-shell">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label={t("shell.close_sidebar_overlay", "Close sidebar overlay")}
          className="fixed inset-0 z-30 bg-[rgba(3,8,20,0.55)] lg:hidden"
          onClick={() => setSidebarState(false)}
        />
      ) : null}

      <button
        type="button"
        aria-label={
          sidebarOpen
            ? t("shell.hide_sidebar", "Hide sidebar")
            : t("shell.show_sidebar", "Show sidebar")
        }
        title={
          sidebarOpen
            ? t("shell.hide_sidebar", "Hide sidebar")
            : t("shell.show_sidebar", "Show sidebar")
        }
        onClick={toggleSidebar}
        className={cn(
          "fixed z-50 hidden h-11 w-11 items-center justify-center rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(12,16,26,0.96)] text-lg font-semibold text-[var(--text)] shadow-[0_12px_30px_rgba(3,8,20,0.35)] transition-all duration-300 hover:border-[rgba(62,166,255,0.48)] hover:bg-[rgba(20,24,36,0.98)] lg:flex",
          immersiveScannerRoute ? "lg:hidden" : "",
          sidebarOpen ? "left-[18.75rem] top-5" : "left-4 top-5",
        )}
      >
        {sidebarOpen ? "<" : ">"}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[18rem] border-r border-[var(--border)] bg-[rgba(12,16,26,0.96)] shadow-[0_26px_80px_rgba(3,8,20,0.45)] transition-transform duration-300 ease-out",
          immersiveScannerRoute ? "hidden lg:block lg:translate-x-0" : "",
          !immersiveScannerRoute && (sidebarOpen ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        <div className="flex h-full flex-col px-4 py-4">
          <div className="rounded-[1.25rem] border border-[rgba(62,166,255,0.18)] bg-[linear-gradient(180deg,rgba(62,166,255,0.1),rgba(12,16,26,0.94))] p-3 shadow-[0_14px_38px_rgba(3,8,20,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(62,166,255,0.88)]">
                  DPR.ai
                </div>
                <div className="mt-1 truncate text-[15px] font-semibold leading-5 text-[var(--text)]">
                  {activeFactory?.name || user?.factory_name || t("common.not_selected", "Factory not selected")}
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                  {activeFactory?.industry_label || t("shell.factory_context", "Factory context")}
                  {organization?.plan ? ` • ${organization.plan} ${t("common.plan", "plan")}` : ""}
                </div>
              </div>
              <button
                type="button"
                aria-label={t("shell.close_sidebar", "Close sidebar")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-base font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)] hover:bg-[rgba(20,24,36,0.85)] lg:hidden"
                onClick={() => setSidebarState(false)}
              >
                {"<"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100">
                {roleLabel(resolvedRole, t)}
              </span>
              {activeFactory?.workflow_template_label ? (
                <span className="rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.52)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {activeFactory.workflow_template_label}
                </span>
              ) : null}
              {organization?.name ? (
                <span className="truncate rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.52)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {organization.name}
                </span>
              ) : null}
            </div>

            {factoryChoices.length > 1 ? (
              <div className="mt-3">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t("shell.switch_factory", "Switch Factory")}
                </label>
                <Select
                  className="mt-1.5 h-8 bg-[rgba(8,12,20,0.55)] text-xs"
                  value={activeFactoryId || ""}
                  onChange={(event) => void handleFactorySwitch(event.target.value)}
                  disabled={switchingFactory}
                >
                  {factoryChoices.map((factory) => (
                    <option key={factory.factory_id} value={factory.factory_id}>
                      {factory.name}
                    </option>
                  ))}
                </Select>
                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  {/* AUDIT: TEXT_NOISE — The factory helper now shows only the scope needed to confirm how many contexts are available. */}
                  {switchingFactory
                    ? t("shell.switching_factory_context", "Switching factory context...")
                    : `${organization?.accessible_factories || factoryChoices.length} factories`}
                </div>
                {switchError ? <div className="mt-1 text-[11px] text-red-300">{switchError}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-4">
              {favoriteItems.length > 0 ? (
                <NavContent
                  pathname={pathname}
                  onWarm={warmRoute}
                  onNavigate={handleNavNavigate}
                  sections={[{ title: t("shell.pinned", "Pinned"), items: favoriteItems }]}
                  badgeCounts={user ? badgeCounts : { approvals: 0, alerts: 0 }}
                  favoriteHrefs={favoriteHrefs}
                  onToggleFavorite={toggleFavorite}
                  translate={t}
                />
              ) : null}

              {primarySections.length > 0 ? (
                <NavContent
                  pathname={pathname}
                  onWarm={warmRoute}
                  onNavigate={handleNavNavigate}
                  sections={primarySections}
                  badgeCounts={user ? badgeCounts : { approvals: 0, alerts: 0 }}
                  favoriteHrefs={favoriteHrefs}
                  onToggleFavorite={toggleFavorite}
                  translate={t}
                />
              ) : null}

              {collapsibleSections.map((section) => {
                const storageKey = sectionStorageKey(section.title);
                const expanded = resolvedExpandedSections[storageKey] ?? false;
                const active = section.items.some((item) => item.match(pathname));
                return (
                  <div key={section.title} className="space-y-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[rgba(8,12,20,0.45)] px-3 py-2 text-left transition hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(20,24,36,0.8)]"
                      onClick={() => toggleSectionGroup(storageKey)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                          {localizedSectionTitle(section.title, t)}
                        </div>
                        {active ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                        ) : null}
                      </div>
                      <div className="text-[var(--muted)]">
                        <ChevronIcon expanded={expanded} />
                      </div>
                    </button>
                    {expanded ? (
                      <NavContent
                        pathname={pathname}
                        onWarm={warmRoute}
                        onNavigate={handleNavNavigate}
                        sections={[section]}
                        badgeCounts={user ? badgeCounts : { approvals: 0, alerts: 0 }}
                        favoriteHrefs={favoriteHrefs}
                        onToggleFavorite={toggleFavorite}
                        translate={t}
                        hideSectionTitles
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            {/* AUDIT: BUTTON_CLUTTER — Moved language and account utilities into a collapsible tray so the shell stays focused on navigation first. */}
            <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.45)] px-3 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("shell.account_title", "Account")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {t("shell.account_subtitle", "Profile, language, and sign-out tools")}
                  </div>
                </div>
                <span className="text-[var(--muted)] transition group-open:rotate-180">
                  <ChevronIcon expanded={false} />
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {t("language.label", "Language")}
                  </label>
                  <Select
                    className="h-8 min-w-0 flex-1 bg-[rgba(20,24,36,0.86)] text-xs"
                    value={language}
                    onChange={(event) => handleLanguageChange(event.target.value)}
                    aria-label={t("language.label", "Language")}
                  >
                    {LANGUAGE_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {t(choice.key, choice.fallback)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Link
                    href="/profile"
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(12,16,24,0.62)] px-2 text-[11px] font-medium text-[var(--text)] transition hover:border-[rgba(62,166,255,0.34)] hover:bg-[rgba(20,24,36,0.86)]"
                  >
                    {t("nav.profile.label", "Profile")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={accountActionBusy !== null}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(12,16,24,0.62)] px-2 text-[11px] font-medium text-[var(--text)] transition hover:border-[rgba(62,166,255,0.34)] hover:bg-[rgba(20,24,36,0.86)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountActionBusy === "logout"
                      ? t("shell.logging_out", "Logging out...")
                      : t("shell.logout", "Logout")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSwitchAccount()}
                    disabled={accountActionBusy !== null}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(12,16,24,0.62)] px-2 text-[11px] font-medium text-[var(--text)] transition hover:border-[rgba(62,166,255,0.34)] hover:bg-[rgba(20,24,36,0.86)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountActionBusy === "switch"
                      ? t("shell.switching", "Switching...")
                      : t("shell.switch_account", "Switch")}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding-left] duration-300 ease-out",
          immersiveScannerRoute ? "lg:pl-[18rem]" : sidebarOpen ? "lg:pl-[18rem]" : "lg:pl-0",
        )}
      >
        {shellLayout.mobileTopBar ? (
          <div className="safe-top-inset safe-x-inset sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(11,14,20,0.92)] py-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              {mobileTabActive ? (
                <div className="h-10 w-10 shrink-0" />
              ) : (
                <button
                  type="button"
                  aria-label={t("shell.go_back", "Go back")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-base font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)]"
                  onClick={handleMobileBack}
                >
                  {"<"}
                </button>
              )}

              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(62,166,255,0.88)]">
                  {activeFactory?.name || user?.factory_name || "DPR.ai"}
                </div>
                <div className="truncate text-sm font-semibold text-[var(--text)]">{currentItem.label}</div>
              </div>

              <button
                type="button"
                aria-label={
                  sidebarOpen
                    ? t("shell.hide_sidebar", "Hide sidebar")
                    : t("shell.show_sidebar", "Show sidebar")
                }
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)]"
                onClick={toggleSidebar}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}

        <div className={cn("min-w-0 flex-1", shellLayout.mobileBottomNav ? "pb-24 lg:pb-0" : "")}>
          {!immersiveScannerRoute ? <WorkflowReminderStrip /> : null}
          {shellLayout.desktopRail === "context" ? (
            <div className={cn("min-h-full", showDesktopContextRail ? "xl:grid xl:grid-cols-[minmax(0,1fr)_19rem]" : "")}>
              <div className="min-w-0">{children}</div>
              {showDesktopContextRail ? (
                <DesktopContextRail
                  currentItem={currentItem}
                  badgeCounts={badgeCounts}
                  factoryName={activeFactory?.name || user?.factory_name || t("common.not_selected", "Factory not selected")}
                  organizationName={organization?.name}
                  role={resolvedRole}
                  workflowHint={workflowHint}
                  quickLinks={desktopRailQuickLinks}
                  onWarm={warmRoute}
                  onHide={toggleDesktopContextRail}
                  translate={t}
                />
              ) : null}
              {desktopContextRailHidden ? (
                <button
                  type="button"
                  aria-label={t("shell.show_workspace", "Show workspace")}
                  title={t("shell.show_workspace", "Show workspace")}
                  className="fixed right-6 top-6 z-30 hidden items-center justify-center rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(12,16,26,0.96)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text)] shadow-[0_12px_30px_rgba(3,8,20,0.35)] transition hover:border-[rgba(62,166,255,0.48)] hover:bg-[rgba(20,24,36,0.98)] xl:inline-flex"
                  onClick={toggleDesktopContextRail}
                >
                  Workspace
                </button>
              ) : null}
            </div>
          ) : (
            <div className="min-w-0 flex-1">{children}</div>
          )}
        </div>
      </div>
      {shellLayout.mobileBottomNav ? (
        <MobileBottomNav
          pathname={pathname}
          items={mobileNavItems}
          badgeCounts={badgeCounts}
          onWarm={warmRoute}
          onNavigate={handleNavNavigate}
          translate={t}
        />
      ) : null}
      <div
        className={cn(
          "safe-fixed-right fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 w-[calc(100%_-_2rem)] max-w-[22rem] lg:bottom-4 lg:right-6",
          immersiveScannerRoute ? "hidden" : "",
        )}
        data-overflow-debug-ignore="true"
      >
        <JobsDrawer />
      </div>
    </div>
  );
}
