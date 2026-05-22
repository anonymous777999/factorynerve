"use client";

import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AppMobileMenu } from "@/components/app-mobile-menu";
import {
  AppDesktopContextRail,
  AppMobileBottomNav,
  AppSidebar,
  getVisibleNavSections,
} from "@/components/app-sidebar";
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
  const shell = useAppShellState(pathname);
  const factoryName =
    shell.activeFactory?.name ||
    shell.user?.factory_name ||
    shell.t("common.not_selected", "Factory not selected");

  return (
    <div className="relative flex min-h-screen overflow-hidden" data-component="app-shell">
      <FeedbackActivityTracker pathname={pathname} />
      <AppMobileMenu isOpen={shell.sidebarOpen} onClose={shell.closeSidebar} translate={shell.t} />
      <AppHeader
        mobileTopBar={shell.shellLayout.mobileTopBar}
        mobileTabActive={shell.mobileTabActive}
        activeFactoryName={shell.activeFactory?.name || shell.user?.factory_name || "DPR.ai"}
        currentItemLabel={shell.currentItem.label}
        sidebarOpen={shell.sidebarOpen}
        immersiveScannerRoute={shell.immersiveScannerRoute}
        onToggleSidebar={shell.toggleSidebar}
        onMobileBack={shell.handleMobileBack}
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
        onLanguageChange={shell.handleLanguageChange}
        showTips={shell.showTips}
        onToggleTips={() => shell.setShowTips(!shell.showTips)}
        accountActionBusy={shell.accountActionBusy}
        onLogout={shell.handleLogout}
        onSwitchAccount={shell.handleSwitchAccount}
        translate={shell.t}
      />

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding-left] duration-300 ease-out",
          shell.immersiveScannerRoute ? "lg:pl-[18rem]" : shell.sidebarOpen ? "lg:pl-[18rem]" : "lg:pl-0",
        )}
      >
        <div className={cn("min-w-0 flex-1", shell.shellLayout.mobileBottomNav ? "pb-24 lg:pb-0" : "")}>
          {!shell.immersiveScannerRoute ? <WorkflowReminderStrip /> : null}
          {shell.shellLayout.desktopRail === "context" ? (
            <div className={cn("min-h-full", shell.showDesktopContextRail ? "xl:grid xl:grid-cols-[minmax(0,1fr)_19rem]" : "")}>
              <div className="min-w-0">{children}</div>
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
            <div className="min-w-0 flex-1">{children}</div>
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
    </div>
  );
}
