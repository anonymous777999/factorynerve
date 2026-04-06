import * as React from "react";

import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full min-h-24 px-4 py-2 rounded-md border border-border bg-bg-secondary text-base text-text-primary placeholder:text-text-muted transition-all duration-fast focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-bg disabled:text-text-muted disabled:cursor-not-allowed resize-none",
        className,
      )}
      {...props}
    />
  );
}
