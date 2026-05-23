"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingStatus, UsageSummary } from "@/lib/settings";

type SettingsUsageTabProps = {
  billing: BillingStatus | null;
  usage: UsageSummary | null;
};

export function SettingsUsageTab({ billing, usage }: SettingsUsageTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Usage Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
              <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Requests Used</div>
              <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{usage?.requests_used ?? 0}</div>
            </div>
            <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
              <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Credits Used</div>
              <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{usage?.credits_used ?? 0}</div>
            </div>
            <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
              <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Request Limit</div>
              <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{usage?.max_requests || "Unlimited"}</div>
            </div>
            <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
              <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Rate Limit / min</div>
              <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{usage?.rate_limit_per_minute ?? "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Billing Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
            <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Plan</div>
            <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{billing?.plan || "-"}</div>
          </div>
          <div className="rounded-[10px] bg-[var(--color-background-secondary)] p-4">
            <div className="mb-1 text-[12px] text-[var(--color-text-tertiary)]">Status</div>
            <div className="text-[22px] font-medium text-[var(--color-text-primary)]">{billing?.status || "-"}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[var(--muted)]">Trial Ends</div>
              <div>{billing?.trial_end_at || "-"}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Current Period End</div>
              <div>{billing?.current_period_end_at || "-"}</div>
            </div>
          </div>
          {billing?.pending_plan ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
              Pending plan: {billing.pending_plan} effective at {billing.pending_plan_effective_at || "-"}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
