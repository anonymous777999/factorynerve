import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,27,41,0.96),rgba(13,20,32,0.98))] text-[var(--text)] shadow-[var(--shadow-md)] transition-all duration-200 hover:border-[var(--accent)]/20 hover:shadow-[var(--shadow-lg)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-no-select ui-no-callout px-6 pt-6 sm:px-7 sm:pt-7", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("ui-no-select ui-no-callout text-2xl font-semibold tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6 sm:px-7 sm:pb-7", className)} {...props} />;
}
