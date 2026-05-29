"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AppHeader } from "@/components/app-header";
import { AppMobileMenu } from "@/components/app-mobile-menu";
import {
  AppDesktopContextRail,
  AppMobileBottomNav,
  AppSidebar,
  getVisibleNavSections,
} from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import type { BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandPalette,
  type CommandPaletteItem,
} from "@/components/ui/command-palette";
import { FeedbackActivityTracker } from "@/components/feedback-activity-tracker";
import { ErrorFeedbackPrompt } from "@/components/error-feedback-prompt";
import { FeedbackWidget } from "@/components/feedback-widget";
import { JobsDrawer } from "@/components/jobs-drawer";
import { MicroFeedbackPrompt } from "@/components/micro-feedback-prompt";
import { NotificationCenter } from "@/components/notification-center";
import {
  isShellHiddenRoute,
  useAppShellState,
} from "@/hooks/use-app-shell-state";
import { cn } from "@/lib/utils";
import { useCommandRegistry } from "@/providers/command-registry-provider";

export { getVisibleNavSections };
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
    ),
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  if (isShellHiddenRoute(pathname)) {
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
  const router = useRouter();
  const shell = useAppShellState(pathname);
  const commandRegistry = useCommandRegistry();
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const focusMode = shell.shellLayout.mode === "focus";
  const dashboardReferenceRoute = pathname === "/dashboard";
  const factoryName =
    shell.activeFactory?.name ||
    shell.user?.factory_name ||
    shell.t("common.not_selected", "Factory not selected");
  const commandItems = React.useMemo<CommandPaletteItem[]>(() => {
    const navigationItems = shell.visibleNavItems.map(
      (item): CommandPaletteItem => {
        const isCurrentItem = item.match(pathname);
        const status: BadgeStatus | undefined = isCurrentItem
          ? "processing"
          : undefined;

        return {
          id: `nav-${item.href}`,
          group: "Navigation",
          label: item.label,
          description: item.description,
          keywords: [item.href],
          shortcut: isCurrentItem ? "Active" : undefined,
          status,
          meta: isCurrentItem ? "Current workspace" : undefined,
          onSelect: () => {
            shell.warmRoute(item.href);
            router.push(item.href);
            shell.handleNavNavigate();
          },
        };
      },
    );

    const quickActions: CommandPaletteItem[] = [
      {
        id: "shell-toggle-sidebar",
        group: "Actions",
        label: shell.sidebarOpen ? "Collapse navigation rail" : "Open navigation rail",
        description: "Use bracket shortcuts to keep navigation available without leaving the keyboard flow.",
        shortcut: shell.sidebarOpen ? "[" : "]",
        status: "secondary",
        onSelect: () => shell.toggleSidebar(),
      },
      {
        id: "shell-toggle-context",
        group: "Actions",
        label: shell.desktopContextRailHidden ? "Show workspace rail" : "Hide workspace rail",
        description: "Adjust the desktop workspace rail to match the current review or scanning density.",
        status: "secondary",
        onSelect: () => shell.toggleDesktopContextRail(),
      },
      {
        id: "shell-profile",
        group: "Actions",
        label: "Open profile",
        description: "Review your account, access, and display preferences.",
        shortcut: "P",
        onSelect: () => {
          shell.warmRoute("/profile");
          router.push("/profile");
        },
      },
      {
        id: "nav-steel-batches-shortcut",
        group: "Steel",
        label: "Open steel batches",
        description: "Go to steel batches.",
        shortcut: "G O",
        onSelect: () => {
          shell.warmRoute("/steel/batches");
          router.push("/steel/batches");
          shell.handleNavNavigate();
        },
      },
      {
        id: "nav-steel-inventory-shortcut",
        group: "Steel",
        label: "Open steel inventory",
        description: "Go to steel inventory.",
        shortcut: "G I",
        onSelect: () => {
          shell.warmRoute("/steel/inventory");
          router.push("/steel/inventory");
          shell.handleNavNavigate();
        },
      },
    ];

    return [...quickActions, ...navigationItems, ...commandRegistry.commands];
  }, [
    commandRegistry.commands,
    pathname,
    router,
    shell,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let pendingChord: "g" | null = null;
    let chordTimer: number | null = null;

    function clearChord() {
      pendingChord = null;
      if (chordTimer != null) {
        window.clearTimeout(chordTimer);
        chordTimer = null;
      }
    }

    function handleShellKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (pendingChord === "g") {
        if (event.key.toLowerCase() === "o") {
          event.preventDefault();
          clearChord();
          shell.warmRoute("/steel/batches");
          router.push("/steel/batches");
          shell.handleNavNavigate();
          return;
        }

        if (event.key.toLowerCase() === "i") {
          event.preventDefault();
          clearChord();
          shell.warmRoute("/steel/inventory");
          router.push("/steel/inventory");
          shell.handleNavNavigate();
          return;
        }

        clearChord();
      }

      if (event.key === "[") {
        event.preventDefault();
        shell.closeSidebar();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        shell.toggleSidebar();
        return;
      }

      if (event.key.toLowerCase() === "g") {
        pendingChord = "g";
        chordTimer = window.setTimeout(clearChord, 800);
        return;
      }

      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        shell.toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleShellKeyDown);
    return () => {
      clearChord();
      window.removeEventListener("keydown", handleShellKeyDown);
    };
  }, [router, shell]);

  return (
    <div
      className="factory-workstation-scope relative flex min-h-screen overflow-hidden bg-surface-app text-text-primary"
      data-component="app-shell"
    >
      <FeedbackActivityTracker pathname={pathname} />
      <AppMobileMenu isOpen={shell.sidebarOpen} onClose={shell.closeSidebar} translate={shell.t} />
      <AppHeader
        mobileTopBar={shell.shellLayout.mobileTopBar}
        mobileTabActive={shell.mobileTabActive}
        activeFactoryName={shell.activeFactory?.name || shell.user?.factory_name || "DPR.ai"}
        currentItemLabel={shell.currentItem.label}
        sidebarOpen={shell.sidebarOpen}
        onToggleSidebar={shell.toggleSidebar}
        onMobileBack={shell.handleMobileBack}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        translate={shell.t}
      />
      <AppSidebar
        navItems={shell.visibleNavItems}
        currentPath={pathname}
        badgeCounts={shell.navBadgeCounts}
        sidebarOpen={shell.sidebarOpen}
        immersiveScannerRoute={shell.immersiveScannerRoute}
        activeFactoryName={factoryName}
        activeIndustryLabel={shell.activeFactory?.industry_label}
        organizationPlan={shell.organization?.plan}
        resolvedRole={shell.resolvedRole}
        workflowTemplateLabel={shell.activeFactory?.workflow_template_label}
        organizationName={shell.organization?.name}
        factoryChoices={shell.factoryChoices}
        activeFactoryId={shell.activeFactoryId}
        onFactorySwitch={shell.handleFactorySwitch}
        switchingFactory={shell.switchingFactory}
        switchError={shell.switchError}
        favoriteItems={shell.favoriteItems}
        primarySections={shell.primarySections}
        collapsibleSections={shell.collapsibleSections}
        resolvedExpandedSections={shell.resolvedExpandedSections}
        favoriteHrefs={shell.favoriteHrefs}
        onToggleFavorite={shell.toggleFavorite}
        onToggleSectionGroup={shell.toggleSectionGroup}
        onWarm={shell.warmRoute}
        onNavigate={shell.handleNavNavigate}
        onClose={shell.closeSidebar}
        language={shell.language}
        theme={shell.theme}
        density={shell.density}
        onLanguageChange={shell.handleLanguageChange}
        onThemeChange={shell.setTheme}
        onDensityChange={shell.setDensity}
        showTips={shell.showTips}
        onToggleTips={() => shell.setShowTips(!shell.showTips)}
        accountActionBusy={shell.accountActionBusy}
        onLogout={shell.handleLogout}
        onSwitchAccount={shell.handleSwitchAccount}
        translate={shell.t}
      />

      <div
        className={cn(
          "factory-workstation-frame flex min-h-screen min-w-0 flex-1 flex-col bg-surface-shell transition-[padding-left] duration-300 ease-out",
          shell.immersiveScannerRoute ? "lg:pl-[13.75rem]" : shell.sidebarOpen ? "lg:pl-[13.75rem]" : "lg:pl-0",
        )}
      >
        <div className={cn("factory-workstation-shell min-w-0 flex-1 bg-surface-shell", shell.shellLayout.mobileBottomNav ? "pb-24 lg:pb-0" : "")}>
          {!shell.immersiveScannerRoute ? (
            <div className="factory-workstation-topbar sticky top-0 z-sticky hidden lg:block">
              {dashboardReferenceRoute ? (
                <div className="flex min-h-[48px] items-center justify-between gap-4 px-10">
                  <div className="flex min-w-0 items-center gap-5">
                    <button
                      type="button"
                      onClick={shell.toggleSidebar}
                      aria-label={shell.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                      className="font-body text-[15px] font-bold text-[var(--action-primary)] transition hover:opacity-90"
                    >
                      DPR.ai
                    </button>
                    <div className="h-4 w-px bg-border-default" />
                    <nav className="flex items-center gap-5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                        {shell.organization?.name || "Resource Org"}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                        Profile
                      </span>
                    </nav>
                  </div>
                  <div className="flex items-center gap-3 text-text-tertiary">
                    <NotificationCenter />
                    <button
                      type="button"
                      aria-label="Workspace tools"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm transition hover:bg-surface-hover hover:text-text-primary"
                      onClick={() => setCommandPaletteOpen(true)}
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4.5 w-4.5">
                        <path d="M4.5 6.5h11v8h-11z" strokeLinejoin="round" />
                        <path d="M7 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={cn("flex min-h-[48px] flex-wrap items-center justify-between gap-3 px-6", focusMode ? "py-2" : "py-2.5")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      size="compact"
                      variant="outline"
                      onClick={shell.toggleSidebar}
                      aria-label={shell.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                      className="h-8 border-border-default bg-surface-elevated px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-primary hover:border-border-strong hover:bg-surface-hover"
                    >
                      {shell.sidebarOpen ? "Hide Nav" : "Show Nav"}
                    </Button>
                    <div className="h-4 w-px bg-border-default" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--action-primary)]">
                          DPR.ai
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary">
                          {factoryName}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary">
                          {shell.currentItem.label}
                        </span>
                        <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary xl:inline">
                          {shell.currentItem.description}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!focusMode ? (
                      <div className="hidden items-center gap-2 xl:flex">
                        <Badge status="draft">Alerts {shell.navBadgeCounts.alerts}</Badge>
                        <Badge status="draft">Review {shell.navBadgeCounts.approvals}</Badge>
                      </div>
                    ) : null}
                    <Button
                      size="compact"
                      variant="outline"
                      onClick={() => setCommandPaletteOpen(true)}
                      className="h-8 border-border-default bg-surface-elevated px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-primary hover:border-border-strong hover:bg-surface-hover"
                    >
                      {focusMode ? "Workspace Commands" : "Commands"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {shell.shellLayout.desktopRail === "context" ? (
            <div
              className={cn(
                "min-h-full",
                shell.showDesktopContextRail && !dashboardReferenceRoute ? "xl:grid xl:grid-cols-[minmax(0,1fr)_16.5rem]" : "",
              )}
            >
              <div className="min-w-0 bg-surface-shell">{children}</div>
              <AppDesktopContextRail
                visible={shell.showDesktopContextRail && !dashboardReferenceRoute}
                hidden={shell.desktopContextRailHidden}
                currentItem={shell.currentItem}
                badgeCounts={shell.navBadgeCounts}
                factoryName={factoryName}
                organizationName={shell.organization?.name}
                role={shell.resolvedRole}
                workflowHint={shell.workflowHint}
                quickLinks={shell.desktopRailQuickLinks}
                onWarm={shell.warmRoute}
                onToggle={shell.toggleDesktopContextRail}
                translate={shell.t}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1 bg-surface-shell">{children}</div>
          )}
        </div>
      </div>

      {shell.shellLayout.mobileBottomNav ? (
        <AppMobileBottomNav
          pathname={pathname}
          items={shell.mobileNavItems}
          badgeCounts={shell.navBadgeCounts}
          onWarm={shell.warmRoute}
          onNavigate={shell.handleNavNavigate}
          translate={shell.t}
        />
      ) : null}

      <div
        className={cn(
          "safe-fixed-right fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 w-[calc(100%_-_2rem)] max-w-[22rem] lg:bottom-4 lg:right-6",
          shell.immersiveScannerRoute ? "hidden" : "",
        )}
        data-overflow-debug-ignore="true"
      >
        <JobsDrawer />
      </div>
      <FeedbackWidget
        pathname={pathname}
        immersiveScannerRoute={shell.immersiveScannerRoute}
        userId={shell.user?.id ?? null}
        activeFactoryName={shell.activeFactory?.name || shell.user?.factory_name || null}
        organizationName={shell.organization?.name || null}
        role={shell.resolvedRole}
        appLanguage={shell.language}
      />
      <MicroFeedbackPrompt
        pathname={pathname}
        userId={shell.user?.id ?? null}
        activeFactoryName={shell.activeFactory?.name || shell.user?.factory_name || null}
        organizationName={shell.organization?.name || null}
        role={shell.resolvedRole}
        appLanguage={shell.language}
      />
      <ErrorFeedbackPrompt
        pathname={pathname}
        userId={shell.user?.id ?? null}
        activeFactoryName={shell.activeFactory?.name || shell.user?.factory_name || null}
        organizationName={shell.organization?.name || null}
        role={shell.resolvedRole}
        appLanguage={shell.language}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        items={commandItems}
        enableGlobalShortcut
        title="Workspace Commands"
        searchPlaceholder="Search routes, workflow tools, and workspace actions"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-sm text-label-dense text-text-secondary">
            <span>`[` hides navigation, `]` reopens it, and `Cmd/Ctrl + K` jumps anywhere.</span>
            <span>{factoryName}</span>
          </div>
        }
      />
    </div>
  );
}
