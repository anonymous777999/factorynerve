"use client";

import { cn } from "@/lib/utils";

import { useInViewOnce } from "./use-in-view-once";

type RevealOnViewProps = {
  children: React.ReactNode;
  className?: string;
};

export function RevealOnView({ children, className }: RevealOnViewProps) {
  const { ref, inView } = useInViewOnce();

  return (
    <div
      ref={ref}
      className={cn(
        inView && "shell-content-enter",
        className,
      )}
    >
      {children}
    </div>
  );
}
