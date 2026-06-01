"use client";

import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

type TranslateFn = (key: string, fallback?: string) => string;

export function AppHeader({
  mobileTopBar,
  mobileTabActive,
  activeFactoryName,
  currentItemLabel,
  sidebarOpen,
  onToggleSidebar,
  onMobileBack,
  onOpenCommandPalette,
  translate,
}: {
  mobileTopBar: boolean;
  mobileTabActive: boolean;
  activeFactoryName: string;
  currentItemLabel: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onMobileBack: () => void;
  onOpenCommandPalette: () => void;
  translate?: TranslateFn;
}) {
  const sidebarLabel = sidebarOpen
    ? translate
      ? translate("shell.hide_sidebar", "Hide sidebar")
      : "Hide sidebar"
    : translate
      ? translate("shell.show_sidebar", "Show sidebar")
      : "Show sidebar";

  return (
    <>
      {mobileTopBar ? (
        <div className="safe-top-inset safe-x-inset sticky top-0 z-sticky border-b border-border-default bg-surface-panel py-sm lg:hidden">
          <div className="flex items-center gap-sm">
            {mobileTabActive ? (
              <div className="h-10 w-10 shrink-0" />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={translate ? translate("shell.go_back", "Go back") : "Go back"}
                className="h-input w-input shrink-0 text-[var(--color-text-primary)]"
                onClick={onMobileBack}
              >
                {"<"}
              </Button>
            )}

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                {activeFactoryName}
              </div>
              <div className="truncate text-label-dense font-semibold uppercase tracking-wide text-text-primary">{currentItemLabel}</div>
            </div>

            <Button
              variant="ghost"
              size="compact"
              aria-label={translate ? translate("shell.command_palette", "Open command palette") : "Open command palette"}
              className="h-input min-w-[3rem] shrink-0 px-2.5"
              onClick={onOpenCommandPalette}
            >
              K
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={sidebarLabel}
              className="h-input w-input shrink-0 text-[var(--color-text-primary)]"
              onClick={onToggleSidebar}
            >
              <Menu size={16} strokeWidth={1.5} className="text-text-secondary" aria-hidden="true" focusable="false" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
