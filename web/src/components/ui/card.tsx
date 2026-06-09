import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Interactive cards opt in via the `group` class; only those get hover feedback
  // so non-interactive cards keep a flat, static appearance.
  const isInteractive = /(^|\s)group(\s|$)/.test(className ?? "");

  return (
    <div
      className={cn(
        "surface-panel rounded-panel text-text-primary",
        isInteractive &&
        "transition-all duration-150 hover:border-border-secondary hover:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-no-select ui-no-callout px-lg pt-lg", className)} {...props} />;
}

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4";
};

export function CardTitle({ className, as: Tag = "h2", ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn("ui-no-select ui-no-callout text-panel-title font-semibold tracking-[-0.02em] text-text-primary", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-lg pb-lg", className)} {...props} />;
}
