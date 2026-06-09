"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingStatus, UsageSummary } from "@/lib/settings";

type SettingsUsageTabProps = {
  billing: BillingStatus | null;
  usage: UsageSummary | null;
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface-shell p-4">
      <div className="text-label-dense font-medium text-text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-text-primary">{value}</div>
    </div>
  );
}

export function SettingsUsageTab({ billing, usage }: SettingsUsageTabProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Usage summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard label="Requests used" value={usage?.requests_used ?? 0} />
            <StatCard label="Credits used" value={usage?.credits_used ?? 0} />
            <StatCard label="Request limit" value={usage?.max_requests || "Unlimited"} />
            <StatCard label="Rate limit / min" value={usage?.rate_limit_per_minute ?? "-"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard label="Plan" value={billing?.plan || "-"} />
            <StatCard label="Status" value={billing?.status || "-"} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-panel border border-border-subtle bg-surface-shell p-4">
              <div className="text-label-dense font-medium text-text-tertiary">Trial ends</div>
              <div className="mt-1 font-mono text-sm text-text-primary">{billing?.trial_end_at || "-"}</div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-shell p-4">
              <div className="text-label-dense font-medium text-text-tertiary">Period end</div>
              <div className="mt-1 font-mono text-sm text-text-primary">{billing?.current_period_end_at || "-"}</div>
            </div>
          </div>
          {billing?.pending_plan ? (
            <div className="rounded-panel border border-border-subtle bg-surface-shell p-4 text-sm text-text-secondary">
              Pending plan: <span className="font-medium text-text-primary">{billing.pending_plan}</span>
              {billing.pending_plan_effective_at ? (
                <span className="ml-2 text-text-tertiary">effective {billing.pending_plan_effective_at}</span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
