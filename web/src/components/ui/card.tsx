import * as React from "react";

import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "elevated" | "interactive";
};

function Card({ className, variant = "default", ...props }: CardProps) {
  const variants: Record<string, string> = {
    default: "surface-panel rounded-[1.5rem]",
    elevated: "surface-panel-strong rounded-[1.75rem]",
    interactive:
      "surface-panel rounded-[1.5rem] cursor-pointer transition-all duration-fast hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_28px_60px_rgba(3,8,18,0.28)]",
  };

  return (
    <div
      className={cn(variants[variant], className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5 sm:px-6 sm:pt-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("type-card-title tracking-[-0.02em] text-text-primary", className)}
      {...props}
    />
  );
}

function CardSubtitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("type-body-secondary mt-1 text-text-secondary", className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-t border-border px-5 py-4 sm:px-6 flex gap-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter };
