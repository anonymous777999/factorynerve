"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  cancelScheduledDowngrade,
  createBillingOrder,
  getBillingOrderStatus,
  getBillingConfig,
  getBillingStatus,
  listInvoices,
  scheduleDowngrade,
  updateOrganizationPlan,
  type BillingConfig,
  type InvoiceItem,
} from "@/lib/billing";
import { calculatePlanEstimate, sortAddons, type BillingCycle } from "@/lib/pricing";
import {
  getLastPlanUpgrade,
  getPlans,
  type PlanInfo,
  type PlansPayload,
} from "@/lib/plans";
import { getQuotaHealth, quotaLabel } from "@/lib/quota-health";
import type { BillingStatus } from "@/lib/settings";
import { useSession } from "@/lib/use-session";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function progressPercent(used?: number, max?: number) {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((used || 0) / max) * 100)));
}

function parseAddonQuantitiesParam(raw: string | null) {
  const quantities: Record<string, number> = {};
  if (!raw) return quantities;
  raw.split(",").forEach((part) => {
    const [addonId, quantityRaw] = part.split(":");
    const addon = (addonId || "").trim();
    const quantity = Number((quantityRaw || "1").trim());
    if (addon && quantity > 0) {
      quantities[addon] = Math.max(1, Math.floor(quantity));
    }
  });
  return quantities;
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

async function loadRazorpayScript() {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-razorpay-checkout="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "1";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function BillingPageInner() {
  const { user, loading, error: sessionError } = useSession();
  const searchParams = useSearchParams();
  const [plansPayload, setPlansPayload] = useState<PlansPayload | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [lastUpgrade, setLastUpgrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [downgradePlan, setDowngradePlan] = useState("free");
  const [overridePlan, setOverridePlan] = useState("free");
  const [checkoutPlan, setCheckoutPlan] = useState("starter");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedAddonQuantities, setSelectedAddonQuantities] = useState<Record<string, number>>({});
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const canViewBilling = useMemo(() => {
    const role = user?.org_role || user?.role || "";
    return role === "admin" || role === "owner";
  }, [user]);

  const canWriteBilling = useMemo(() => {
    return (user?.org_role || user?.role || "") === "owner";
  }, [user]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    const cycle = searchParams.get("cycle");
    const addons = searchParams.get("addons");
    const addonQuantities = searchParams.get("addon_quantities");
    if (plan) setCheckoutPlan(plan);
    if (cycle === "monthly" || cycle === "yearly") setBillingCycle(cycle);
    if (addonQuantities) {
      setSelectedAddonQuantities(parseAddonQuantitiesParam(addonQuantities));
      return;
    }
    if (addons) {
      const parsed: Record<string, number> = {};
      addons
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((addonId) => {
          parsed[addonId] = 1;
        });
      setSelectedAddonQuantities(parsed);
    }
  }, [searchParams]);

  const loadAll = async () => {
    const [billingResult, invoicesResult, plansResult, upgradeResult, configResult] =
      await Promise.allSettled([
        getBillingStatus(),
        listInvoices(),
        getPlans(),
        getLastPlanUpgrade(),
        getBillingConfig(),
      ]);

    if (billingResult.status === "fulfilled") {
      setBilling(billingResult.value);
      setDowngradePlan(billingResult.value.pending_plan || "free");
      setOverridePlan(billingResult.value.plan || "free");
    } else if (billingResult.reason instanceof Error) {
      setError(billingResult.reason.message);
    }

    if (invoicesResult.status === "fulfilled") {
      setInvoices(invoicesResult.value);
    }

    if (plansResult.status === "fulfilled") {
      setPlansPayload(plansResult.value);
      const firstPaidPlan = plansResult.value.plans.find(
        (plan) => plan.monthly_price > 0 && !plan.sales_only,
      );
      if (firstPaidPlan) {
        setCheckoutPlan((current) => current || firstPaidPlan.id);
      }
    }

    if (upgradeResult.status === "fulfilled" && upgradeResult.value.timestamp) {
      setLastUpgrade(upgradeResult.value.timestamp);
    }

    if (configResult.status === "fulfilled") {
      setBillingConfig(configResult.value);
    }
  };

  useEffect(() => {
    if (!canViewBilling) return;
    loadAll().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load billing.");
    });
  }, [canViewBilling]);

  const handleAction = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await work();
      if (canViewBilling) {
        await loadAll();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Billing action failed.");
      }
    } finally {
      setBusy(false);
    }
  };
  const planOptions = useMemo(
    () =>
      plansPayload?.plans?.length
        ? plansPayload.plans
        : ([
            {
              id: "free",
              name: "Free",
              monthly_price: 0,
              user_limit: 3,
              factory_limit: 1,
              limits: { ocr: 0, summary: 10, email: 0, smart: 30 },
              features: {},
            },
            {
              id: "starter",
              name: "Starter",
              monthly_price: 499,
              user_limit: 8,
              factory_limit: 1,
              limits: { ocr: 0, summary: 30, email: 0, smart: 100 },
              features: {},
            },
            {
              id: "growth",
              name: "Growth",
              monthly_price: 1299,
              user_limit: 20,
              factory_limit: 2,
              limits: { ocr: 0, summary: 150, email: 150, smart: 300 },
              features: { analytics: true, pdf: true, emailSummary: true },
            },
            {
              id: "factory",
              name: "Factory",
              monthly_price: 2999,
              user_limit: 60,
              factory_limit: 5,
              limits: { ocr: 100, summary: 600, email: 600, smart: 1500 },
              features: { analytics: true, pdf: true, emailSummary: true, templates: true },
            },
            {
              id: "business",
              name: "Business",
              monthly_price: 6999,
              user_limit: 150,
              factory_limit: 10,
              unlimited_limits: ["summary", "email", "smart"],
              limits: { ocr: 150, summary: 0, email: 0, smart: 0 },
              features: {
                analytics: true,
                pdf: true,
                emailSummary: true,
                templates: true,
                api: true,
                nlq: true,
              },
            },
            {
              id: "enterprise",
              name: "Enterprise",
              monthly_price: 0,
              sales_only: true,
              user_limit: 0,
              factory_limit: 0,
              unlimited_limits: ["ocr", "summary", "email", "smart"],
              limits: { ocr: 0, summary: 0, email: 0, smart: 0 },
              features: { analytics: true, pdf: true, emailSummary: true, templates: true, api: true, nlq: true },
            },
          ] as PlanInfo[]),
    [plansPayload?.plans],
  );

  const addonOptions = useMemo(() => sortAddons(plansPayload?.addons || []), [plansPayload?.addons]);
  const selectedAddonIds = useMemo(
    () =>
      Object.entries(selectedAddonQuantities)
        .filter(([, quantity]) => Number(quantity || 0) > 0)
        .map(([addonId]) => addonId),
    [selectedAddonQuantities],
  );
  const paidPlans = useMemo(
    () => planOptions.filter((plan) => Number(plan.monthly_price || 0) > 0 && !plan.sales_only),
    [planOptions],
  );
  const organizationUsers = Math.max(1, Number(billing?.footprint?.active_users || 1));
  const organizationFactories = Math.max(1, Number(billing?.footprint?.active_factories || 1));
  const checkoutPlanInfo = useMemo(
    () => paidPlans.find((plan) => plan.id === checkoutPlan) || paidPlans[0] || planOptions[0],
    [checkoutPlan, paidPlans, planOptions],
  );
  const activeAddonIds = useMemo(
    () => (billing?.active_addons || []).map((addon) => addon.id),
    [billing?.active_addons],
  );
  const activeAddonQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    (billing?.active_addons || []).forEach((addon) => {
      quantities[addon.id] = Math.max(1, Number(addon.quantity || 1));
    });
    return quantities;
  }, [billing?.active_addons]);

  useEffect(() => {
    if (!checkoutPlanInfo) return;
    setCheckoutPlan(checkoutPlanInfo.id);
  }, [checkoutPlanInfo]);

  const checkoutEstimate = useMemo(() => {
    if (!checkoutPlanInfo || !plansPayload?.pricing) return null;
    return calculatePlanEstimate(
      checkoutPlanInfo,
      plansPayload.pricing,
      addonOptions,
      {
        users: organizationUsers,
        factories: organizationFactories,
        selectedAddonQuantities,
        activeAddonIds,
        activeAddonQuantities,
      },
      billingCycle,
    );
  }, [
    activeAddonIds,
    activeAddonQuantities,
    addonOptions,
    billingCycle,
    checkoutPlanInfo,
    organizationFactories,
    organizationUsers,
    plansPayload?.pricing,
    selectedAddonQuantities,
  ]);
  const summaryHealth = getQuotaHealth(billing?.usage?.summary_used, billing?.usage?.summary_limit);
  const emailHealth = getQuotaHealth(billing?.usage?.email_used, billing?.usage?.email_limit);
  const smartHealth = getQuotaHealth(billing?.usage?.smart_used, billing?.usage?.smart_limit);
  const ocrRequestsLocked = Number(billing?.usage?.max_requests ?? 0) < 0;
  const ocrCreditsLocked = Number(billing?.usage?.max_credits ?? 0) < 0;

  const updateAddonQuantity = (addonId: string, quantity: number) => {
    setSelectedAddonQuantities((current) => {
      const next = { ...current };
      const normalized = Math.max(0, Math.floor(quantity));
      if (normalized <= 0) {
        delete next[addonId];
      } else {
        next[addonId] = normalized;
      }
      return next;
    });
  };

  const launchCheckout = async () => {
    if (!canWriteBilling) {
      setError("Only owners can start checkout or change the billing plan.");
      return;
    }
    if (!checkoutPlanInfo) {
      setError("Choose a paid plan before starting checkout.");
      return;
    }
    if (checkoutPlanInfo.sales_only) {
      setError("Enterprise is handled through contact sales. Use the manual override only for internal QA.");
      return;
    }
    if (!billingConfig?.configured || !billingConfig.key_id) {
      setError("Razorpay is not configured yet. Add the Razorpay keys on the backend first.");
      return;
    }
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Could not load Razorpay checkout script.");
      }
      const order = await createBillingOrder(
        checkoutPlanInfo.id,
        billingCycle,
        organizationUsers,
        organizationFactories,
        selectedAddonIds,
        selectedAddonQuantities,
      );
      const orderId = order.order.id;
      const checkout = new window.Razorpay({
        key: billingConfig.key_id,
        amount: order.order.amount,
        currency: order.order.currency,
        name: "DPR.ai",
        description: `${checkoutPlanInfo.name} plan (${billingCycle})`,
        order_id: order.order.id,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone_number || "",
        },
        notes: {
          plan: order.plan,
          billing_cycle: order.billing_cycle,
          requested_users: String(organizationUsers),
          requested_factories: String(organizationFactories),
          addon_ids: (order.quote?.chargeable_addon_ids || []).join(","),
        },
        handler: () => {
          setStatus("Payment received. Waiting for billing confirmation...");
          setPendingOrderId(orderId);
        },
        modal: {
          ondismiss: () => {
            setStatus("Checkout closed before payment confirmation.");
          },
        },
        theme: {
          color: "#3ea6ff",
        },
      });
      checkout.open();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not start checkout.");
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pendingOrderId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const order = await getBillingOrderStatus(pendingOrderId);
        if (cancelled) return;
        if (order.is_paid) {
          await loadAll();
          if (cancelled) return;
          if (order.is_plan_active) {
            setStatus("Payment confirmed. Billing is now active.");
            setPendingOrderId(null);
            return;
          }
          setStatus("Payment received. Finalizing the plan and add-ons...");
        } else if (order.is_terminal) {
          setError("Payment did not complete. Please try checkout again.");
          setPendingOrderId(null);
          return;
        } else {
          setStatus("Waiting for Razorpay confirmation...");
        }
      } catch {
        if (cancelled) return;
      }

      if (attempts >= 18) {
        setStatus("Billing confirmation is still in progress. Refresh this page in a moment.");
        setPendingOrderId(null);
        return;
      }
      timeoutId = setTimeout(() => {
        void poll();
      }, 2500);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pendingOrderId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading billing...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Login required."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canViewBilling) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Billing access is available to admins and owners. Owners handle plan changes and payments.
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/plans">
                <Button>View Plans</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Billing</div>
            <h1 className="mt-2 text-3xl font-semibold">Plan status and live checkout</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              The billing page stays focused on the real money path: current subscription state,
              invoice history, live Razorpay checkout, and explicit add-on pricing from the backend
              catalog.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/plans" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Plans</Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" variant="outline">Dashboard</Button>
            </Link>
          </div>
        </section>

        {status ? <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">{status}</div> : null}
        {error || sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error || sessionError}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Current Plan</div>
              <CardTitle>{billing?.plan || "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Status: {billing?.status || "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Active Add-ons</div>
              <CardTitle>{billing?.active_addons?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {(billing?.active_addons || [])
                .map((addon) =>
                  Number(addon.quantity || 0) > 1 ? `${addon.name} x${addon.quantity}` : addon.name,
                )
                .join(", ") ||
                "No paid add-ons yet."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Current Period End</div>
              <CardTitle>{billing?.current_period_end_at ? "Tracked" : "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {formatDateTime(billing?.current_period_end_at)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Last Upgrade</div>
              <CardTitle>{lastUpgrade ? "Recorded" : "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {lastUpgrade || "No upgrade audit log yet."}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="order-2 xl:order-1">
            <CardHeader>
              <CardTitle className="text-xl">Usage Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[var(--muted)]">Requests</span>
                  <span>
                    {ocrRequestsLocked
                      ? "Locked - add OCR pack"
                      : `${billing?.usage?.requests_used ?? 0}${billing?.usage?.max_requests ? ` / ${billing.usage.max_requests}` : " / Unlimited"}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--card-strong)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${progressPercent(
                        billing?.usage?.requests_used,
                        billing?.usage?.max_requests,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[var(--muted)]">Credits</span>
                  <span>
                    {ocrCreditsLocked
                      ? "Locked - add OCR pack"
                      : `${billing?.usage?.credits_used ?? 0}${billing?.usage?.max_credits ? ` / ${billing.usage.max_credits}` : " / Unlimited"}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--card-strong)]">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]"
                    style={{
                      width: `${progressPercent(
                        billing?.usage?.credits_used,
                        billing?.usage?.max_credits,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                Rate limit: {billing?.usage?.rate_limit_per_minute ?? "-"} / minute
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(8,14,24,0.72)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">AI Quota Usage</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Tracks smart suggestions, anomaly scans, executive summaries, and AI email drafting.
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClass("blue")}`}>
                    Live sync
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[var(--muted)]">AI Summary</span>
                      <div className="flex items-center gap-2">
                        <span>{quotaLabel(billing?.usage?.summary_used, billing?.usage?.summary_limit)}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${summaryHealth.badgeClass}`}>
                          {summaryHealth.badge}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className={`h-2 rounded-full ${summaryHealth.barClass}`}
                        style={{
                          width: `${summaryHealth.percent}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {summaryHealth.detail} ·
                      {" "}
                      Used by anomaly scans, natural-language queries, and executive report summaries.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[var(--muted)]">AI Email</span>
                      <div className="flex items-center gap-2">
                        <span>{quotaLabel(billing?.usage?.email_used, billing?.usage?.email_limit)}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${emailHealth.badgeClass}`}>
                          {emailHealth.badge}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className={`h-2 rounded-full ${emailHealth.barClass}`}
                        style={{
                          width: `${emailHealth.percent}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {emailHealth.detail} ·
                      {" "}
                      Used by AI-generated email summaries and outbound briefing drafts.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[var(--muted)]">AI Smart</span>
                      <div className="flex items-center gap-2">
                        <span>{quotaLabel(billing?.usage?.smart_used, billing?.usage?.smart_limit)}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${smartHealth.badgeClass}`}>
                          {smartHealth.badge}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className={`h-2 rounded-full ${smartHealth.barClass}`}
                        style={{
                          width: `${smartHealth.percent}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {smartHealth.detail} ·
                      {" "}
                      Used by smart DPR input and history-based production suggestions.
                    </div>
                  </div>
                </div>
              </div>
              {(billing?.active_addons || []).length ? (
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
                  {(billing?.active_addons || []).map((addon) => (
                    <span key={addon.id} className={`rounded-full px-3 py-1 ${badgeClass("green")}`}>
                      {addon.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="order-1 xl:order-2">
            <CardHeader>
              <CardTitle className="text-xl">Upgrade Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(8,14,24,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Checkout path</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ["1", "Choose plan", "Pick the plan, billing cycle, and factory size."],
                    ["2", "Add OCR packs", "Only add scan packs you actually need this cycle."],
                    ["3", "Review estimate", "Confirm what is billable before opening Razorpay."],
                  ].map(([step, title, detail]) => (
                    <div key={step} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Step {step}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{title}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Step 1</div>
                    <div className="mt-1 text-sm font-semibold text-white">Choose plan and billing cycle</div>
                  </div>
                  <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                    Razorpay {billingConfig?.configured ? "ready" : "not configured"}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-sm text-[var(--muted)]">Upgrade Plan</label>
                    <Select value={checkoutPlan} onChange={(event) => setCheckoutPlan(event.target.value)}>
                      {paidPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Billing Cycle</label>
                    <Select
                      value={billingCycle}
                      onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </Select>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.58)] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Current organization</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {organizationUsers} active users / {organizationFactories} active factories
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.58)] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Plan capacity</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {(checkoutPlanInfo?.user_limit || 0) > 0 ? checkoutPlanInfo?.user_limit : "Unlimited"} users / {(checkoutPlanInfo?.factory_limit || 0) > 0 ? checkoutPlanInfo?.factory_limit : "Unlimited"} factories
                    </div>
                    <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      Checkout uses the real active user and factory counts from this organization.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Step 2</div>
                    <div className="mt-1 text-sm font-semibold text-white">Add OCR scan packs</div>
                  </div>
                  <Link href="/plans" className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                    Compare on plans page
                  </Link>
                </div>
                <div className="text-xs leading-5 text-[var(--muted)]">
                  Add needed packs only.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addonOptions.map((addon) => {
                    const activeQuantity = activeAddonQuantities[addon.id] || 0;
                    const selectedQuantity = selectedAddonQuantities[addon.id] || 0;
                    return (
                      <div
                        key={addon.id}
                        className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.8)] p-3"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{addon.name}</div>
                              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">
                                {addon.description}
                              </div>
                              <div className="mt-2 text-xs text-[var(--muted)]">
                                {addon.scan_quota ? `${addon.scan_quota} scans per pack` : "Billable pack"}
                              </div>
                            </div>
                            <div className="text-xs font-semibold text-white">
                              {formatAmount(addon.price, billingConfig?.currency || "INR")}/mo
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
                            {activeQuantity > 0 ? (
                              <span className={`rounded-full px-3 py-1 ${badgeClass("green")}`}>
                                Active x{activeQuantity}
                              </span>
                            ) : null}
                            {selectedQuantity > activeQuantity ? (
                              <span className={`rounded-full px-3 py-1 ${badgeClass("blue")}`}>
                                New packs x{selectedQuantity - activeQuantity}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] px-3 py-2">
                            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                              Quantity
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="min-w-10 px-3 py-1"
                                type="button"
                                onClick={() => updateAddonQuantity(addon.id, selectedQuantity - 1)}
                              >
                                -
                              </Button>
                              <span className="min-w-8 text-center font-semibold text-white">
                                {selectedQuantity}
                              </span>
                              <Button
                                variant="outline"
                                className="min-w-10 px-3 py-1"
                                type="button"
                                onClick={() => updateAddonQuantity(addon.id, selectedQuantity + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Step 3</div>
                  <div className="mt-1 text-sm font-semibold text-white">Review estimate and open checkout</div>
                </div>
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.58)] p-4">
                  <div className="flex items-center justify-between">
                    <span>Base plan</span>
                    <span>{formatAmount(checkoutPlanInfo?.monthly_price || 0, billingConfig?.currency || "INR")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Billable OCR packs</span>
                    <span>{formatAmount(checkoutEstimate?.addonMonthlyCost || 0, billingConfig?.currency || "INR")}</span>
                  </div>
                  {checkoutEstimate?.chargeableAddons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>
                        {addon.name} x{addon.incrementalQuantity || addon.quantity || 0}
                      </span>
                      <span>
                        {formatAmount(
                          (addon.price || 0) * Math.max(0, addon.incrementalQuantity || addon.quantity || 0),
                          billingConfig?.currency || "INR",
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3 font-semibold">
                    <span>{billingCycle === "yearly" ? "Yearly total" : "Monthly total"}</span>
                    <span>{formatAmount(checkoutEstimate?.cycleTotal || 0, billingConfig?.currency || "INR")}</span>
                  </div>
                </div>

                {checkoutEstimate?.chargeableAddons.length ? (
                  <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 p-4 text-sm text-sky-100">
                    Charging for:{" "}
                    {checkoutEstimate.chargeableAddons
                      .map((addon) => `${addon.name} x${addon.incrementalQuantity || addon.quantity || 0}`)
                      .join(", ")}
                  </div>
                ) : null}
                {checkoutEstimate?.alreadyActiveAddons.length ? (
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    Already active:{" "}
                    {checkoutEstimate.alreadyActiveAddons
                      .map((addon) => `${addon.name} x${addon.activeQuantity || addon.quantity || 0}`)
                      .join(", ")}{" "}
                    will not be charged again.
                  </div>
                ) : null}
                {checkoutEstimate && !checkoutEstimate.isCompatible ? (
                  <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                    This selection exceeds the hard user or factory cap for {checkoutPlanInfo?.name}. Pick a higher tier before checkout.
                  </div>
                ) : null}
                {checkoutPlanInfo?.sales_only ? (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
                    Contact sales for Enterprise.
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.58)] p-4 text-sm text-[var(--muted)]">
                  Need Enterprise? Use the plans page for the sales-assisted tier. Self-serve checkout only shows instantly billable plans.
                </div>
                {!canWriteBilling ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.58)] p-4 text-sm text-[var(--muted)]">
                    Read-only mode: admins can review billing status and invoices, while owners handle checkout and plan changes.
                  </div>
                ) : null}

                <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={launchCheckout}
                    disabled={
                      busy ||
                      !canWriteBilling ||
                      !checkoutPlanInfo ||
                      !billingConfig?.configured ||
                      Boolean(checkoutPlanInfo.sales_only) ||
                      Boolean(checkoutEstimate && !checkoutEstimate.isCompatible) ||
                      Boolean(checkoutEstimate && checkoutEstimate.cycleTotal <= 0)
                    }
                  >
                    {busy
                      ? "Starting Checkout..."
                      : checkoutPlanInfo?.sales_only
                        ? "Sales-Assisted Plan"
                        : canWriteBilling
                          ? "Pay with Razorpay"
                          : "Owner Access Required"}
                  </Button>
                  <div className="text-xs text-[var(--muted)]">
                    This estimate uses the backend billing quote, active OCR-pack deductions, and the real active user and factory counts for this organization.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Plan Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="text-sm font-semibold">Scheduled Downgrade</div>
                {billing?.pending_plan ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      Pending plan: {billing.pending_plan} on {formatDateTime(billing.pending_plan_effective_at)}
                    </div>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() =>
                        handleAction(async () => {
                          await cancelScheduledDowngrade();
                          setStatus("Scheduled downgrade cancelled.");
                        })
                      }
                      disabled={busy || !canWriteBilling}
                    >
                      Cancel Downgrade
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Select value={downgradePlan} onChange={(event) => setDowngradePlan(event.target.value)}>
                      {planOptions.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() =>
                        handleAction(async () => {
                          await scheduleDowngrade(downgradePlan);
                          setStatus("Downgrade scheduled at the end of the current billing cycle.");
                        })
                      }
                      disabled={busy || !canWriteBilling}
                    >
                      Schedule Downgrade
                    </Button>
                  </div>
                )}
              </div>

              {billingConfig?.manual_plan_override_enabled ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Manual Org Plan Override</div>
                  <div className="text-sm text-[var(--muted)]">
                    This emergency control is enabled by environment flag. Keep it off for normal
                    billing so Razorpay stays the only upgrade path.
                  </div>
                  <Select value={overridePlan} onChange={(event) => setOverridePlan(event.target.value)}>
                    {planOptions.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      handleAction(async () => {
                        await updateOrganizationPlan(overridePlan);
                        setStatus(`Organization plan updated to ${overridePlan}.`);
                      })
                    }
                    disabled={busy || !canWriteBilling}
                  >
                    Update Organization Plan
                  </Button>
                </div>
              ) : null}
              {!canWriteBilling ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Owners are the only role allowed to schedule downgrades, start checkout, or use the emergency plan override.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{invoice.plan}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">Invoice #{invoice.id}</div>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {formatAmount(invoice.amount, invoice.currency || "INR")}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)]">
                          <div className="flex items-center justify-between gap-3">
                            <span>Status</span>
                            <span className="text-right text-white">{invoice.status}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Issued</span>
                            <span className="text-right text-white">{formatDateTime(invoice.issued_at)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Provider</span>
                            <span className="text-right text-white">{invoice.provider || "-"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">ID</th>
                        <th className="px-3 py-3 font-medium">Plan</th>
                        <th className="px-3 py-3 font-medium">Amount</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Issued At</th>
                        <th className="px-3 py-3 font-medium">Provider</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-3">{invoice.id}</td>
                          <td className="px-3 py-3">{invoice.plan}</td>
                          <td className="px-3 py-3">
                            {formatAmount(invoice.amount, invoice.currency || "INR")}
                          </td>
                          <td className="px-3 py-3">{invoice.status}</td>
                          <td className="px-3 py-3">{formatDateTime(invoice.issued_at)}</td>
                          <td className="px-3 py-3">{invoice.provider || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No invoices recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading billing...
        </main>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}
