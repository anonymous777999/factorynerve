"use client";

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
        <div className="safe-top-inset safe-x-inset sticky top-0 z-sticky border-b border-border-default bg-surface-panel/95 py-sm backdrop-blur lg:hidden">
          <div className="flex items-center gap-sm">
            {mobileTabActive ? (
              <div className="h-10 w-10 shrink-0" />
            ) : (
              <button
                type="button"
                aria-label={translate ? translate("shell.go_back", "Go back") : "Go back"}
                className="ui-no-select ui-no-callout inline-flex h-input w-input shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-shell text-label font-semibold text-text-primary transition-[background-color,border-color,color] duration-fast ease-standard hover:border-border-strong hover:bg-surface-hover"
                onClick={onMobileBack}
              >
                {"<"}
              </button>
            )}

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                {activeFactoryName}
              </div>
              <div className="truncate text-label font-semibold text-text-primary">{currentItemLabel}</div>
            </div>

            <button
              type="button"
              aria-label={translate ? translate("shell.command_palette", "Open command palette") : "Open command palette"}
              className="ui-no-select ui-no-callout inline-flex h-input min-w-[3.5rem] shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-shell px-sm text-label-dense font-semibold text-text-secondary transition-[background-color,border-color,color] duration-fast ease-standard hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
              onClick={onOpenCommandPalette}
            >
              K
            </button>

            <button
              type="button"
              aria-label={sidebarLabel}
              className="ui-no-select ui-no-callout inline-flex h-input w-input shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-shell text-text-primary transition-[background-color,border-color,color] duration-fast ease-standard hover:border-border-strong hover:bg-surface-hover"
              onClick={onToggleSidebar}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
