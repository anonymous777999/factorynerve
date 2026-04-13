"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type AiActivationAction = {
  href: string;
  label: string;
  variant?: "primary" | "outline" | "ghost";
};

export function AiActivationNotice({
  eyebrow = "AI activation",
  title = "AI Insights \u2014 coming soon",
  detail = "We are training your factory's intelligence model. You will be notified when insights are ready.",
  support,
  primaryAction,
  secondaryAction,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  detail?: string;
  support?: string;
  primaryAction?: AiActivationAction;
  secondaryAction?: AiActivationAction;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.8rem] border border-[rgba(62,166,255,0.24)] bg-[linear-gradient(145deg,rgba(62,166,255,0.14),rgba(12,16,26,0.94))] p-5 text-[var(--text)] shadow-[0_24px_80px_rgba(3,8,20,0.32)] ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(62,166,255,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(191,225,255,0.96)]">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white sm:text-2xl">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(224,231,255,0.82)]">{detail}</p>
          </div>
          {support ? (
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{support}</p>
          ) : null}
        </div>
        {primaryAction || secondaryAction ? (
          <div className="grid gap-3 sm:min-w-[14rem]">
            {primaryAction ? (
              <Link href={primaryAction.href}>
                <Button className="w-full" variant={primaryAction.variant ?? "primary"}>
                  {primaryAction.label}
                </Button>
              </Link>
            ) : null}
            {secondaryAction ? (
              <Link href={secondaryAction.href}>
                <Button className="w-full" variant={secondaryAction.variant ?? "outline"}>
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
