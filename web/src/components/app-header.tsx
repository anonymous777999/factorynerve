"use client";

import { cn } from "@/lib/utils";

type TranslateFn = (key: string, fallback?: string) => string;

export function AppHeader({
  mobileTopBar,
  mobileTabActive,
  activeFactoryName,
  currentItemLabel,
  sidebarOpen,
  immersiveScannerRoute,
  onToggleSidebar,
  onMobileBack,
  translate,
}: {
  mobileTopBar: boolean;
  mobileTabActive: boolean;
  activeFactoryName: string;
  currentItemLabel: string;
  sidebarOpen: boolean;
  immersiveScannerRoute: boolean;
  onToggleSidebar: () => void;
  onMobileBack: () => void;
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
      <button
        type="button"
        aria-label={sidebarLabel}
        title={sidebarLabel}
        onClick={onToggleSidebar}
        className={cn(
          "fixed z-50 hidden h-11 w-11 items-center justify-center rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(12,16,26,0.96)] text-lg font-semibold text-[var(--text)] shadow-[0_12px_30px_rgba(3,8,20,0.35)] transition-all duration-300 hover:border-[rgba(62,166,255,0.48)] hover:bg-[rgba(20,24,36,0.98)] lg:flex",
          immersiveScannerRoute ? "lg:hidden" : "",
          sidebarOpen ? "left-[18.75rem] top-5" : "left-4 top-5",
        )}
      >
        {sidebarOpen ? "<" : ">"}
      </button>

      {mobileTopBar ? (
        <div className="safe-top-inset safe-x-inset sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(11,14,20,0.92)] py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            {mobileTabActive ? (
              <div className="h-10 w-10 shrink-0" />
            ) : (
              <button
                type="button"
                aria-label={translate ? translate("shell.go_back", "Go back") : "Go back"}
                className="ui-no-select ui-no-callout inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-base font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)]"
                onClick={onMobileBack}
              >
                {"<"}
              </button>
            )}

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(62,166,255,0.88)]">
                {activeFactoryName}
              </div>
              <div className="truncate text-sm font-semibold text-[var(--text)]">{currentItemLabel}</div>
            </div>

            <button
              type="button"
              aria-label={sidebarLabel}
              className="ui-no-select ui-no-callout inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-[var(--text)] transition hover:border-[rgba(62,166,255,0.35)]"
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
