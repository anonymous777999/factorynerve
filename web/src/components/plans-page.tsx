"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getBillingStatus } from "@/lib/billing";
import { sortAddons, sortPlans } from "@/lib/pricing";
import {
  getLastPlanUpgrade,
  getPlans,
  type PlanInfo,
  type PlansPayload,
} from "@/lib/plans";
import { getQuotaHealth, quotaLabel } from "@/lib/quota-health";
import type { BillingStatus } from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const CUSTOMER_FEATURES: Array<{ key: string; label: string }> = [
  { key: "pdf", label: "PDF export" },
  { key: "analytics", label: "Analytics" },
  { key: "emailSummary", label: "Email summaries" },
  { key: "templates", label: "OCR templates" },
  { key: "api", label: "API access" },
  { key: "nlq", label: "Natural-language query" },
  { key: "priority", label: "Priority support" },
  { key: "onPremise", label: "On-premise" },
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function badgeClass(tone: "blue" | "green" | "amber" | "slate") {
  if (tone === "blue") {
    return "border border-sky-400/30 bg-sky-400/15 text-sky-200";
  }
  if (tone === "green") {
    return "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  }
  if (tone === "amber") {
    return "border border-amber-400/30 bg-amber-400/15 text-amber-200";
  }
  return "border border-[var(--border)] bg-[rgba(148,163,184,0.14)] text-slate-200";
}

function hasUnlimited(plan: PlanInfo, key: keyof PlanInfo["limits"]) {
  return Boolean(plan.unlimited_limits?.includes(key));
}

function describeLimit(plan: PlanInfo, key: keyof PlanInfo["limits"]) {
  if (hasUnlimited(plan, key)) {
    return key === "ocr" && plan.sales_only ? "Bulk pool" : "Unlimited";
  }

  const value = Number(plan.limits[key] || 0);
  if (key === "ocr") {
    if (value > 0) return `${formatInteger(value)} included`;
    return plan.id === "free" ? "None" : "Add-on only";
  }

  return value > 0 ? formatInteger(value) : "Locked";
}

function formatActiveAddons(addons?: BillingStatus["active_addons"]) {
  const items = (addons || []).map((addon) => {
    const quantity = Number(addon.quantity || 0);
    return quantity > 1 ? `${addon.name} x${quantity}` : addon.name;
  });
  return items.length ? items.join(", ") : "No OCR packs active yet.";
}

function planBadge(plan: PlanInfo, activePlanId: string) {
  if (plan.id === activePlanId) return { label: "Active", tone: "blue" as const };
  if (plan.badge === "popular") return { label: "Most popular", tone: "green" as const };
  if (plan.badge === "new") return { label: "New tier", tone: "amber" as const };
  if (plan.sales_only) return { label: "Contact sales", tone: "slate" as const };
  return null;
}

function compareRowLabel(value: boolean | string) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "-";
  }
  return value;
}

export default function PlansPage() {
  const { user, loading, error: sessionError } = useSession();
  const [plansPayload, setPlansPayload] = useState<PlansPayload | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingStatus | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [lastUpgrade, setLastUpgrade] = useState("");
  const [error, setError] = useState("");

  const canViewBilling = useMemo(() => {
    const role = user?.role || "";
    return role === "admin" || role === "owner";
  }, [user]);

  useEffect(() => {
    let alive = true;
    getPlans()
      .then((payload) => {
        if (!alive) return;
        setPlansPayload(payload);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(reason instanceof Error ? reason.message : "Could not load pricing data.");
      })
      .finally(() => {
        if (alive) setPlansLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!canViewBilling) return;
    let alive = true;
    Promise.allSettled([getBillingStatus(), getLastPlanUpgrade()]).then(
      ([billingResult, upgradeResult]) => {
        if (!alive) return;
        if (billingResult.status === "fulfilled") {
          setBillingSnapshot(billingResult.value);
          setCurrentPlan((billingResult.value.plan || "free").toLowerCase());
        }
        if (upgradeResult.status === "fulfilled" && upgradeResult.value.timestamp) {
          setLastUpgrade(upgradeResult.value.timestamp);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [canViewBilling, user]);

  const plans = useMemo(() => sortPlans(plansPayload?.plans || []), [plansPayload?.plans]);
  const addons = useMemo(() => sortAddons(plansPayload?.addons || []), [plansPayload?.addons]);

  const aiUsage = billingSnapshot?.usage;
  const summaryHealth = getQuotaHealth(aiUsage?.summary_used, aiUsage?.summary_limit);
  const emailHealth = getQuotaHealth(aiUsage?.email_used, aiUsage?.email_limit);
  const smartHealth = getQuotaHealth(aiUsage?.smart_used, aiUsage?.smart_limit);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading plans...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Plans</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
                Simple, customer-safe pricing for every factory stage
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Compare plans, included limits, and OCR packs without exposing any internal pricing math or business-side margin logic.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/billing" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">{canViewBilling ? "Open Billing" : "Billing Access"}</Button>
              </Link>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto" variant="outline">Dashboard</Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)] sm:flex sm:flex-wrap">
            <span className={`rounded-full px-3 py-1 ${badgeClass("blue")}`}>
              Current plan: {currentPlan || "free"}
            </span>
            <span className={`rounded-full px-3 py-1 ${badgeClass("slate")}`}>
              OCR packs: {formatActiveAddons(billingSnapshot?.active_addons)}
            </span>
            <span className={`rounded-full px-3 py-1 ${badgeClass("slate")}`}>
              Last upgrade: {lastUpgrade || "Not recorded"}
            </span>
          </div>
        </section>

        {(error || sessionError) && !plansLoading ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {error || sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">AI Summary Quota</div>
                  <CardTitle>{quotaLabel(aiUsage?.summary_used, aiUsage?.summary_limit)}</CardTitle>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${summaryHealth.badgeClass}`}>
                  {summaryHealth.badge}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                <div className={`h-2 rounded-full ${summaryHealth.barClass}`} style={{ width: `${summaryHealth.percent}%` }} />
              </div>
              <div>{summaryHealth.detail}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">AI Email Quota</div>
                  <CardTitle>{quotaLabel(aiUsage?.email_used, aiUsage?.email_limit)}</CardTitle>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${emailHealth.badgeClass}`}>
                  {emailHealth.badge}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                <div className={`h-2 rounded-full ${emailHealth.barClass}`} style={{ width: `${emailHealth.percent}%` }} />
              </div>
              <div>{emailHealth.detail}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">AI Smart Quota</div>
                  <CardTitle>{quotaLabel(aiUsage?.smart_used, aiUsage?.smart_limit)}</CardTitle>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${smartHealth.badgeClass}`}>
                  {smartHealth.badge}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                <div className={`h-2 rounded-full ${smartHealth.barClass}`} style={{ width: `${smartHealth.percent}%` }} />
              </div>
              <div>{smartHealth.detail}</div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const badge = planBadge(plan, currentPlan);
            return (
              <Card
                key={plan.id}
                className={
                  plan.id === currentPlan
                    ? "border-sky-400/60 shadow-[0_0_0_1px_rgba(62,166,255,0.3)]"
                    : plan.badge === "popular"
                      ? "border-emerald-400/40"
                      : undefined
                }
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {badge ? (
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClass(badge.tone)}`}>
                        {badge.label}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-white">
                      {plan.display_price || (plan.sales_only ? "Custom" : `${formatMoney(plan.monthly_price || 0)}/mo`)}
                    </div>
                    <div className="mt-2 text-sm text-[var(--muted)]">{plan.subtitle || "Factory operations plan"}</div>
                    {plan.custom_price_hint ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">{plan.custom_price_hint}</div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2 text-[var(--muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Users</span>
                      <span className="font-semibold text-white">
                        {plan.user_limit > 0 ? formatInteger(plan.user_limit) : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Factories</span>
                      <span className="font-semibold text-white">
                        {plan.factory_limit > 0 ? formatInteger(plan.factory_limit) : "Unlimited"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Smart inputs</span>
                      <span className="font-semibold text-white">{describeLimit(plan, "smart")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>AI summaries</span>
                      <span className="font-semibold text-white">{describeLimit(plan, "summary")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>OCR</span>
                      <span className="font-semibold text-white">{describeLimit(plan, "ocr")}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {CUSTOMER_FEATURES.map((feature) => (
                      <div key={feature.key} className="flex items-center justify-between gap-3">
                        <span className="text-[var(--muted)]">{feature.label}</span>
                        <span className="font-semibold text-white">{plan.features?.[feature.key] ? "Yes" : "-"}</span>
                      </div>
                    ))}
                  </div>

                  <Link href={`/billing?plan=${encodeURIComponent(plan.id)}`}>
                    <Button className="w-full" variant={plan.sales_only ? "outline" : "primary"}>
                      {plan.sales_only
                        ? "Talk to Sales"
                        : canViewBilling
                          ? "Use This Plan"
                          : "Review This Plan"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">OCR Packs</div>
            <h2 className="mt-2 text-2xl font-semibold">Add extra OCR only when you need it</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              OCR packs stay customer-visible because they are purchasable product features, but the internal cost model behind them is no longer exposed anywhere in the web UI.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {addons.map((addon) => {
              const isFreePlan = (currentPlan || "free").toLowerCase() === "free";
              const canPurchasePack = !isFreePlan;
              return (
                <Card key={addon.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{addon.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                    <div className="text-2xl font-semibold text-white">{formatMoney(addon.price)}/mo</div>
                    <div>
                      {addon.scan_quota
                        ? `${formatInteger(addon.scan_quota)} scans per pack`
                        : "Billable OCR pack"}
                    </div>
                    <div>{addon.description}</div>
                    {canPurchasePack ? (
                      <Link
                        href={`/billing?plan=${encodeURIComponent(
                          currentPlan,
                        )}&addon_quantities=${encodeURIComponent(`${addon.id}:1`)}`}
                      >
                        <Button className="w-full" variant="outline">
                          Add In Billing
                        </Button>
                      </Link>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        OCR not available on Free
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {plans.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Compare all plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm text-[var(--muted)]">
                  Scroll the plan cards above for the main offer. This compact compare view keeps the biggest differences visible on phones.
                </div>
                {[
                  {
                    label: "Users included",
                    values: plans.map((plan) => compareRowLabel(plan.user_limit > 0 ? formatInteger(plan.user_limit) : "Unlimited")),
                  },
                  {
                    label: "Factories included",
                    values: plans.map((plan) => compareRowLabel(plan.factory_limit > 0 ? formatInteger(plan.factory_limit) : "Unlimited")),
                  },
                  {
                    label: "OCR",
                    values: plans.map((plan) => compareRowLabel(describeLimit(plan, "ocr"))),
                  },
                  {
                    label: "Smart inputs",
                    values: plans.map((plan) => compareRowLabel(describeLimit(plan, "smart"))),
                  },
                  {
                    label: "AI summaries",
                    values: plans.map((plan) => compareRowLabel(describeLimit(plan, "summary"))),
                  },
                  ...CUSTOMER_FEATURES.map((feature) => ({
                    label: feature.label,
                    values: plans.map((plan) => compareRowLabel(Boolean(plan.features?.[feature.key]))),
                  })),
                ].map((row) => (
                  <div key={row.label} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                    <div className="text-sm font-semibold text-white">{row.label}</div>
                    <div className="mt-3 grid gap-2">
                      {plans.map((plan, index) => (
                        <div key={`${row.label}-${plan.id}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-[var(--muted)]">{plan.name}</span>
                          <span className="text-right font-medium text-white">{row.values[index]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-3 font-medium">Feature</th>
                      {plans.map((plan) => (
                        <th key={plan.id} className="px-3 py-3 font-medium">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="px-3 py-3">Users included</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-users`} className="px-3 py-3">
                          {plan.user_limit > 0 ? formatInteger(plan.user_limit) : "Unlimited"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="px-3 py-3">Factories included</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-factories`} className="px-3 py-3">
                          {plan.factory_limit > 0 ? formatInteger(plan.factory_limit) : "Unlimited"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="px-3 py-3">OCR</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-ocr`} className="px-3 py-3">
                          {describeLimit(plan, "ocr")}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="px-3 py-3">Smart inputs</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-smart`} className="px-3 py-3">
                          {describeLimit(plan, "smart")}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="px-3 py-3">AI summaries</td>
                      {plans.map((plan) => (
                        <td key={`${plan.id}-summary`} className="px-3 py-3">
                          {describeLimit(plan, "summary")}
                        </td>
                      ))}
                    </tr>
                    {CUSTOMER_FEATURES.map((feature) => (
                      <tr key={feature.key} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">{feature.label}</td>
                        {plans.map((plan) => (
                          <td key={`${plan.id}-${feature.key}`} className="px-3 py-3">
                            {plan.features?.[feature.key] ? "Yes" : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
