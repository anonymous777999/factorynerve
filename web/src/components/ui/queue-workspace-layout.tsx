import * as React from "react";

import { cn } from "@/lib/utils";

export type QueueWorkspaceLayoutProps = {
  queue: React.ReactNode;
  workspace: React.ReactNode;
  queueTitle?: string;
  workspaceTitle?: string;
  className?: string;
};

export function QueueWorkspaceLayout({
  className,
  queue,
  queueTitle,
  workspace,
  workspaceTitle,
}: QueueWorkspaceLayoutProps) {
  return (
    <div className={cn("grid gap-md xl:grid-cols-[minmax(0,0.92fr)_minmax(20rem,1.08fr)]", className)}>
      <section className="min-w-0 space-y-sm">
        {queueTitle ? (
          <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
            {queueTitle}
          </p>
        ) : null}
        {queue}
      </section>
      <section className="min-w-0 space-y-sm xl:sticky xl:top-lg xl:self-start">
        {workspaceTitle ? (
          <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
            {workspaceTitle}
          </p>
        ) : null}
        {workspace}
      </section>
    </div>
  );
}
