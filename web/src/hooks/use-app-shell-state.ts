"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getMobileNavItems, getVisibleNavSections, localizedItemText, sectionStorageKey, type NavBadgeKey, type NavItem } from "@/components/app-sidebar";
import { logout, selectFactory } from "@/lib/auth";
import { useGuidancePreferences } from "@/lib/guidance";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { NAV_ROLE_MAP } from "@/lib/navigation/role-registry";
import { logOverflowIssues } from "@/lib/overflow-debug";
import {
  getHomeDestination,
  getRoleDefaultFavoriteHrefs,
  getRoleDesktopQuickLinkHrefs,
  getRoleMobileNavHrefs,
  getRolePrimaryHrefs,
  getRoleWorkflowHint,
} from "@/lib/role-navigation";
import { warmRouteData } from "@/lib/route-warmup";
import { useAuth } from "@/lib/use-session";
import { useBadges } from "@/providers/badge-provider";

const SIDEBAR_OPEN_STORAGE_KEY = "dpr:web:shell-sidebar-open";
const NAV_FAVORITES_STORAGE_KEY = "dpr:web:shell-favorites";
const NAV_SECTION_STATE_STORAGE_KEY = "dpr:web:shell-section-state";
const DESKTOP_CONTEXT_RAIL_HIDDEN_STORAGE_KEY = "dpr:web:shell-desktop-context-rail-hidden";
const EMPTY_BADGE_COUNTS: Record<NavBadgeKey, number> = { approvals: 0, alerts: 0 };

type ShellMode = "standard" | "focus" | "camera";
type DesktopRailMode = "none" | "context";

export type ShellRouteLayout = {
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

const shellHiddenRoutes = new Set([
  "/",
  "/403",
  "/login",
  "/access",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/onboarding/factory-required",
]);

function getShellLayout(pathname: string): ShellRouteLayout {
  const matched = shellRouteRules.find((rule) => rule.match(pathname));
  return matched ? { ...DEFAULT_SHELL_LAYOUT, ...matched.layout } : DEFAULT_SHELL_LAYOUT;
}

export function isShellHiddenRoute(pathname: string) {
  return shellHiddenRoutes.has(pathname);
}

export function useAppShellState(pathname: string) {
  const shellLayout = useMemo(() => getShellLayout(pathname), [pathname]);
  const immersiveScannerRoute = shellLayout.mode === "camera";
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const { showTips, setShowTips } = useGuidancePreferences();
  useI18nNamespaces(["common", "navigation"]);

  const { activeFactory, activeFactoryId, factories, organization, permissions, user } = useAuth();
  const badgeCounts = useBadges();
  const [hydrated, setHydrated] = useState(false);
  const [switchingFactory, setSwitchingFactory] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [accountActionBusy, setAccountActionBusy] = useState<"logout" | "switch" | null>(null);
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
    () => getVisibleNavSections(resolvedRole, permissions, activeIndustryType),
    [activeIndustryType, permissions, resolvedRole],
  );
  const visibleNavItems = useMemo(
    () => visibleNavSections.flatMap((section) => section.items),
    [visibleNavSections],
  );
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
          items: section.title === "Operations" ? [] : section.items.filter((item) => primarySectionHrefs.has(item.href)),
        }))
        .filter((section) => section.items.length > 0),
    [primarySectionHrefs, visibleNavSections],
  );
  const collapsibleSections = useMemo(
    () =>
      visibleNavSections
        .map((section) => ({
          ...section,
          items:
            section.title === "Operations"
              ? section.items
              : section.items.filter((item) => !primarySectionHrefs.has(item.href)),
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
      next[sectionKey] = typeof stored === "boolean" ? stored : hasActiveRoute || index === 0;
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
      const next = window.innerWidth >= 1024 ? (stored != null ? stored === "true" : true) : false;
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
    if (immersiveScannerRoute && typeof window !== "undefined" && window.innerWidth >= 1024) {
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
      const nextFavorites = (parsedFavorites.length > 0 ? parsedFavorites : fallbackFavorites).filter(
        (href, index, all) => visibleHrefs.has(href) && all.indexOf(href) === index,
      );
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
            Object.entries(decoded).filter(
              (entry): entry is [string, boolean] =>
                typeof entry[0] === "string" && typeof entry[1] === "boolean",
            ),
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

  const toggleDesktopContextRail = useCallback(() => {
    const next = !desktopContextRailHidden;
    setDesktopContextRailHidden(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DESKTOP_CONTEXT_RAIL_HIDDEN_STORAGE_KEY, next ? "true" : "false");
    }
  }, [desktopContextRailHidden]);

  const toggleSectionGroup = useCallback(
    (sectionKey: string) => {
      persistSectionExpanded({
        ...sectionExpanded,
        [sectionKey]: !(resolvedExpandedSections[sectionKey] ?? true),
      });
    },
    [persistSectionExpanded, resolvedExpandedSections, sectionExpanded],
  );

  const handleFactorySwitch = useCallback(
    async (nextFactoryId: string) => {
      if (!nextFactoryId || nextFactoryId === activeFactoryId) {
        return;
      }
      setSwitchingFactory(true);
      setSwitchError("");
      try {
        await selectFactory(nextFactoryId);
        router.refresh();
        setSwitchingFactory(false);
      } catch (error) {
        setSwitchError(error instanceof Error ? error.message : "Could not switch factory.");
        setSwitchingFactory(false);
      }
    },
    [activeFactoryId, router],
  );

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

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
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

  const navBadgeCounts = user ? badgeCounts : EMPTY_BADGE_COUNTS;
  const showDesktopContextRail = shellLayout.desktopRail === "context" && !desktopContextRailHidden;

  return {
    t,
    user,
    language,
    showTips,
    setShowTips,
    activeFactory,
    activeFactoryId,
    factories,
    organization,
    resolvedRole,
    sidebarOpen,
    immersiveScannerRoute,
    shellLayout,
    visibleNavItems,
    navBadgeCounts,
    currentItem,
    favoriteItems,
    primarySections,
    collapsibleSections,
    resolvedExpandedSections,
    favoriteHrefs,
    workflowHint,
    desktopRailQuickLinks,
    mobileNavItems,
    mobileTabActive,
    desktopContextRailHidden,
    showDesktopContextRail,
    factoryChoices,
    switchingFactory,
    switchError,
    accountActionBusy,
    warmRoute,
    toggleSidebar,
    closeSidebar: () => setSidebarState(false),
    handleNavNavigate,
    toggleFavorite,
    toggleSectionGroup,
    handleFactorySwitch,
    handleLanguageChange,
    handleLogout,
    handleSwitchAccount,
    handleMobileBack,
    toggleDesktopContextRail,
  };
}
