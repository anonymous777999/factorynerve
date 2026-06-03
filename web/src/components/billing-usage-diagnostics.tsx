"use client";

import { DisclosurePanel } from "@/shared/operational/disclosure-panel";

type UsageMeter = {
  label: string;
  value: string;
  widthPercent: number;
  barClassName: string;
};

type QuotaCard = {
  label: string;
  value: string;
  badge: string;
  badgeClassName: string;
  barClassName: string;
  widthPercent: number;
  detail: string;
};

type BillingUsageDiagnosticsProps = {
  activeAddonBadges: string[];
  creditsMeter: UsageMeter;
  emailQuota: QuotaCard;
  requestsMeter: UsageMeter;
  rateLimitLabel: string;
  smartQuota: QuotaCard;
  summaryQuota: QuotaCard;
};

export function BillingUsageDiagnostics({
  activeAddonBadges,
  creditsMeter,
  emailQuota,
  requestsMeter,
  rateLimitLabel,
  smartQuota,
  summaryQuota,
}: BillingUsageDiagnosticsProps) {
  return (
    <DisclosurePanel title="Usage summary" className="min-w-0">
      <div className="space-y-4 text-sm">
        {[requestsMeter, creditsMeter].map((meter) => (
          <div key={meter.label}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[var(--muted)]">{meter.label}</span>
              <span>{meter.value}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--card-strong)]">
              <div
                className={`h-2 rounded-full ${meter.barClassName}`}
                style={{ width: `${meter.widthPercent}%` }}
              />
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
          Rate limit: {rateLimitLabel}
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[rgba(8,14,24,0.72)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">AI Quota Usage</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">Live AI usage</div>
            </div>
            <span className="rounded-full border border-sky-400/30 bg-sky-400/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200">
              Live sync
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {[summaryQuota, emailQuota, smartQuota].map((quota) => (
              <div
                key={quota.label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[var(--muted)]">{quota.label}</span>
                  <div className="flex items-center gap-2">
                    <span>{quota.value}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${quota.badgeClassName}`}
                    >
                      {quota.badge}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div
                    className={`h-2 rounded-full ${quota.barClassName}`}
                    style={{ width: `${quota.widthPercent}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">{quota.detail}</div>
              </div>
            ))}
          </div>
        </div>
        {activeAddonBadges.length ? (
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
            {activeAddonBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-emerald-200"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </DisclosurePanel>
  );
}
