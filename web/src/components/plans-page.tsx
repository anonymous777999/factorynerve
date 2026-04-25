"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getBillingStatus } from "@/lib/billing";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
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
import { ResponsiveScrollArea } from "./ui/responsive-scroll-area";

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

export default function PlansPage() {
  const { t } = useI18n();
  useI18nNamespaces(["billing", "common", "forms", "errors"]);
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
  const defaultPaidPlan = useMemo(
    () => plans.find((plan) => !plan.sales_only && plan.id !== "free") || plans.find((plan) => !plan.sales_only) || null,
    [plans],
  );

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
            <CardTitle>{t("billing.plans.title", "Plans")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            {/* AUDIT: FLOW_BROKEN - send signed-out users to the live auth entry instead of the stale login route */}
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">{t("billing.plans.title", "Plans")}</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
                Simple, customer-safe pricing for every factory stage
              </h1>
              {/* AUDIT: TEXT_NOISE - shorten the hero copy so plan choice stays more prominent than pricing narration */}
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">{t("billing.plans.description", "Pick a plan first, then add OCR packs only if you need more scans.")}</p>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move billing and dashboard jumps into a secondary tools tray so plan cards own the decision flow */}
            <details className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 sm:w-auto sm:min-w-[240px]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("billing.plans.tools", "Plan tools")}</summary>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/billing">
                  <Button>{canViewBilling ? t("billing.billing.title", "Billing") : t("billing.plans.access_help", "Access help")}</Button>
              </Link>
              <Link href="/dashboard">
                  <Button variant="outline">{t("billing.billing.dashboard", "Dashboard")}</Button>
              </Link>
            </div>
          </details>
          </div>

          {/* AUDIT: DENSITY_OVERLOAD - tuck billing context into a secondary summary so the hero stays focused on choosing a plan */}
          <details className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">Current billing context</summary>
            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
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
          </details>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a clear pricing sequence so the page leads users from plan choice into add-ons and billing */}
        <section className="grid gap-3 xl:grid-cols-3">
          {[
            { label: "Choose a plan", detail: plans.length ? `${plans.length} plans are available in this catalog.` : "Pricing catalog is loading." },
            { label: "Add OCR if needed", detail: addons.length ? `${addons.length} OCR packs are available after plan choice.` : "No OCR packs are available right now." },
            { label: "Continue to billing", detail: canViewBilling ? "Admins and owners can continue straight into checkout." : "Ask your admin or owner to complete billing." },
          ].map((step) => (
            <div key={step.label} className="rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{step.label}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
            </div>
          ))}
        </section>

        {/* AUDIT: DENSITY_OVERLOAD - keep usage health visible but secondary so it does not compete with plan cards */}
        <details className="rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-5 py-5">
          <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">Current AI usage</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          </div>
        </details>

        <section className="grid gap-6 xl:grid-cols-3">
          {plans.map((plan) => {
            const badge = planBadge(plan, currentPlan);
            const planHref = plan.sales_only
              ? "#sales-assisted"
              : canViewBilling
                ? `/billing?plan=${encodeURIComponent(plan.id)}`
                : "#billing-role";
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
                    {plan.subtitle ? <div className="mt-2 text-sm text-[var(--muted)]">{plan.subtitle}</div> : null}
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

                  {/* AUDIT: FLOW_BROKEN - keep each plan CTA valid by sending self-serve users to billing and everyone else to the right helper section */}
                  <Link href={planHref}>
                    <Button className="w-full" variant={plan.sales_only ? "outline" : "primary"}>
                      {plan.sales_only
                        ? "Contact Sales"
                        : canViewBilling
                          ? "Billing"
                          : "Ask admin"}
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
            {/* AUDIT: TEXT_NOISE - keep the add-on explanation compact so the pack actions stay easier to scan */}
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Add OCR when needed.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {addons.map((addon) => {
              const isFreePlan = (currentPlan || "free").toLowerCase() === "free";
              const canPurchasePack = !isFreePlan;
              const addonHref = canPurchasePack
                ? `/billing?plan=${encodeURIComponent(
                    currentPlan,
                  )}&addon_quantities=${encodeURIComponent(`${addon.id}:1`)}`
                : canViewBilling && defaultPaidPlan
                  ? `/billing?plan=${encodeURIComponent(
                      defaultPaidPlan.id,
                    )}&addon_quantities=${encodeURIComponent(`${addon.id}:1`)}`
                  : "#billing-role";
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
                    {/* AUDIT: DEAD_FEATURE - replace the disabled free-plan OCR button with a valid upgrade path into billing or admin handoff */}
                    <Link href={addonHref}>
                      <Button className="w-full" variant="outline">
                        {canPurchasePack ? "Add pack" : canViewBilling && defaultPaidPlan ? "Upgrade + pack" : "Ask admin"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {plans.length ? (
          <details className="rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-5 py-5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">Compare all plans</summary>
            <ResponsiveScrollArea
              className="mt-4 rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
              debugLabel="plans-compare-table"
            >
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
            </ResponsiveScrollArea>
          </details>
        ) : null}

        {!canViewBilling ? (
          <Card id="billing-role">
            <CardHeader>
              <CardTitle className="text-xl">Billing access</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Ask an admin or owner to continue to billing and complete plan or OCR pack changes for this factory.
            </CardContent>
          </Card>
        ) : null}

        <Card id="sales-assisted">
          <CardHeader>
            <CardTitle className="text-xl">Enterprise</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Enterprise is handled through a sales-assisted rollout. Use the current plan cards to compare fit, then have your billing owner continue the conversation outside self-serve checkout.
          </CardContent>
        </Card>

        {(error || sessionError) && !plansLoading ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
