import { cn } from "@/lib/utils";

type PageMainProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  maxWidth?: "7xl" | "6xl" | "5xl" | "4xl" | "3xl" | "full";
};

const maxWidthClass = {
  "7xl": "max-w-7xl",
  "6xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  "4xl": "max-w-4xl",
  "3xl": "max-w-3xl",
  full: "max-w-full",
};

/**
 * Legacy page wrapper — prefer OperationalPageShell for new work.
 * Adds operational layout + stagger enter inside factory-workstation-scope.
 */
export function PageMain({
  children,
  className,
  innerClassName,
  maxWidth = "7xl",
}: PageMainProps) {
  return (
    <main className={cn("operational-page", className)}>
      <div
        className={cn(
          "operational-page__inner mx-auto w-full stagger-children shell-content-enter",
          maxWidthClass[maxWidth],
          innerClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
