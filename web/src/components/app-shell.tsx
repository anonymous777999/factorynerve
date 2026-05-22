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
import { WorkflowReminderStrip } from "@/components/workflow-reminder-strip";
import {
  isShellHiddenRoute,
  useAppShellState,
} from "@/hooks/use-app-shell-state";
import { cn } from "@/lib/utils";

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
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
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
        group: "Workspace",
        label: shell.sidebarOpen ? "Collapse navigation rail" : "Open navigation rail",
        description: "Use bracket shortcuts to keep navigation available without leaving the keyboard flow.",
        shortcut: shell.sidebarOpen ? "[" : "]",
        status: "paused",
        onSelect: () => shell.toggleSidebar(),
      },
      {
        id: "shell-toggle-context",
        group: "Workspace",
        label: shell.desktopContextRailHidden ? "Show workspace rail" : "Hide workspace rail",
        description: "Adjust the desktop workspace rail to match the current review or scanning density.",
        status: "draft",
        onSelect: () => shell.toggleDesktopContextRail(),
      },
      {
        id: "shell-profile",
        group: "Account",
        label: "Open profile",
        description: "Review your account, access, and display preferences.",
        shortcut: "P",
        onSelect: () => {
          shell.warmRoute("/profile");
          router.push("/profile");
        },
      },
    ];

    return [...quickActions, ...navigationItems];
  }, [
    pathname,
    router,
    shell,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleShellKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        shell.closeSidebar();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        shell.toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleShellKeyDown);
    return () => window.removeEventListener("keydown", handleShellKeyDown);
  }, [shell]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-surface-app text-text-primary" data-component="app-shell">
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
          "flex min-h-screen min-w-0 flex-1 flex-col bg-surface-shell transition-[padding-left] duration-300 ease-out",
          shell.immersiveScannerRoute ? "lg:pl-[18rem]" : shell.sidebarOpen ? "lg:pl-[18rem]" : "lg:pl-0",
        )}
      >
        <div className={cn("min-w-0 flex-1 bg-surface-shell", shell.shellLayout.mobileBottomNav ? "pb-24 lg:pb-0" : "")}>
          {!shell.immersiveScannerRoute ? (
            <div className="sticky top-0 z-sticky hidden border-b border-border-subtle bg-surface-panel/95 backdrop-blur lg:block">
              <div className="flex items-center justify-between gap-md px-lg py-sm">
                <div className="flex min-w-0 items-center gap-sm">
                  <Button
                    size="compact"
                    variant="outline"
                    onClick={shell.toggleSidebar}
                    aria-label={shell.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                  >
                    {shell.sidebarOpen ? "Hide Nav" : "Show Nav"}
                  </Button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                        {factoryName}
                      </span>
                      <Badge status="processing">{shell.currentItem.label}</Badge>
                    </div>
                    <p className="truncate text-label-dense text-text-secondary">
                      {shell.currentItem.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-sm">
                  <div className="hidden items-center gap-sm xl:flex">
                    <span className="text-label-dense text-text-secondary">Alerts {shell.navBadgeCounts.alerts}</span>
                    <span className="text-label-dense text-text-secondary">Review {shell.navBadgeCounts.approvals}</span>
                  </div>
                  <Button size="compact" variant="outline" onClick={() => setCommandPaletteOpen(true)}>
                    Command Palette (Ctrl/Cmd+K)
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {!shell.immersiveScannerRoute ? <WorkflowReminderStrip /> : null}
          {shell.shellLayout.desktopRail === "context" ? (
            <div className={cn("min-h-full", shell.showDesktopContextRail ? "xl:grid xl:grid-cols-[minmax(0,1fr)_19rem]" : "")}>
              <div className="min-w-0 bg-surface-shell">{children}</div>
              <AppDesktopContextRail
                visible={shell.showDesktopContextRail}
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
