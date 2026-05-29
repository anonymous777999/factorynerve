"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingStatus, UsageSummary } from "@/lib/settings";

type SettingsUsageTabProps = {
  billing: BillingStatus | null;
  usage: UsageSummary | null;
};

export function SettingsUsageTab({ billing, usage }: SettingsUsageTabProps) {
  return (
    <div className="control-center-workspace grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card className="bg-[#151b24] border-cyan-900/30">
        <CardHeader>
          <CardTitle className="text-xl font-mono text-cyan-400 uppercase tracking-wider">USAGE_SUMMARY</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
              <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">REQUESTS_USED</div>
              <div className="text-[22px] font-medium text-cyan-300 font-mono">{usage?.requests_used ?? 0}</div>
            </div>
            <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
              <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">CREDITS_USED</div>
              <div className="text-[22px] font-medium text-cyan-300 font-mono">{usage?.credits_used ?? 0}</div>
            </div>
            <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
              <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">REQUEST_LIMIT</div>
              <div className="text-[22px] font-medium text-cyan-300 font-mono">{usage?.max_requests || "UNLIMITED"}</div>
            </div>
            <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
              <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">RATE_LIMIT_/MIN</div>
              <div className="text-[22px] font-medium text-cyan-300 font-mono">{usage?.rate_limit_per_minute ?? "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#151b24] border-cyan-900/30">
        <CardHeader>
          <CardTitle className="text-xl font-mono text-cyan-400 uppercase tracking-wider">BILLING_STATUS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
            <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">PLAN</div>
            <div className="text-[22px] font-medium text-cyan-300 font-mono">{billing?.plan || "-"}</div>
          </div>
          <div className="rounded-[10px] bg-[#0a0e14] border border-cyan-900/30 p-4">
            <div className="mb-1 text-[12px] text-gray-500 font-mono uppercase tracking-wider">STATUS</div>
            <div className="text-[22px] font-medium text-green-400 font-mono">{billing?.status || "-"}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-gray-500 font-mono text-xs uppercase tracking-wider">TRIAL_ENDS</div>
              <div className="font-mono text-cyan-300">{billing?.trial_end_at || "-"}</div>
            </div>
            <div>
              <div className="text-gray-500 font-mono text-xs uppercase tracking-wider">PERIOD_END</div>
              <div className="font-mono text-cyan-300">{billing?.current_period_end_at || "-"}</div>
            </div>
          </div>
          {billing?.pending_plan ? (
            <div className="rounded-2xl border border-cyan-900/30 bg-[#0a0e14] p-4 font-mono text-sm text-gray-400">
              PENDING: {billing.pending_plan} EFFECTIVE_AT {billing.pending_plan_effective_at || "-"}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
