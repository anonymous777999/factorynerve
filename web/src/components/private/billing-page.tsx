"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { BillingCheckoutSequence } from "@/components/private/billing-checkout-sequence";
import { BillingInvoiceHistory } from "@/components/private/billing-invoice-history";
import { BillingHeader } from "@/components/private/billing-header";
import { BillingOwnerControls } from "@/components/private/billing-owner-controls";
import { BillingPlanSummaryCards } from "@/components/private/billing-plan-summary-cards";
import { BillingUsageDiagnostics } from "@/components/private/billing-usage-diagnostics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  cancelScheduledDowngrade,
  createBillingOrder,
  getBillingConfig,
  getBillingStatus,
  listInvoices,
  scheduleDowngrade,
  syncBillingOrder,
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
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
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
  const { t } = useI18n();
  useI18nNamespaces(["billing", "common", "forms", "errors"]);
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
  const [downgradePlan, setDowngradePlan] = useState("pilot");
  const [overridePlan, setOverridePlan] = useState("pilot");
  const [checkoutPlan, setCheckoutPlan] = useState("operator");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [requestedUsers, setRequestedUsers] = useState(20);
  const [requestedFactories, setRequestedFactories] = useState(1);
  const [selectedAddonQuantities, setSelectedAddonQuantities] = useState<Record<string, number>>({});

  const canViewBilling = useMemo(() => {
    const role = user?.role || "";
    return role === "admin" || role === "owner";
  }, [user]);

  const canWriteBilling = useMemo(() => {
    return (user?.role || "") === "owner";
  }, [user]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    const cycle = searchParams.get("cycle");
    const users = searchParams.get("users");
    const factories = searchParams.get("factories");
    const addons = searchParams.get("addons");
    const addonQuantities = searchParams.get("addon_quantities");
    if (plan) setCheckoutPlan(plan);
    if (cycle === "monthly" || cycle === "yearly") setBillingCycle(cycle);
    if (users && Number(users) > 0) setRequestedUsers(Number(users));
    if (factories && Number(factories) > 0) setRequestedFactories(Number(factories));
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
      setDowngradePlan(billingResult.value.pending_plan || "pilot");
      setOverridePlan(billingResult.value.plan || "pilot");
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
              id: "pilot",
              name: "Factory Pilot",
              monthly_price: 0,
              user_limit: 7,
              factory_limit: 1,
              limits: { ocr: 0, summary: 10, email: 0, smart: 30 },
              features: {},
            },
            {
              id: "operator",
              name: "Operator",
              monthly_price: 3499,
              user_limit: 10,
              factory_limit: 1,
              limits: { ocr: 0, summary: 30, email: 30, smart: 100 },
              features: { emailSummary: true, pdf: true, excel: true },
            },
            {
              id: "factory",
              name: "Factory",
              monthly_price: 8999,
              user_limit: 30,
              factory_limit: 3,
              limits: { ocr: 0, summary: 150, email: 150, smart: 600 },
              features: { analytics: true, emailSummary: true, pdf: true, excel: true, templates: true },
            },
            {
              id: "operations",
              name: "Operations",
              monthly_price: 19999,
              user_limit: 75,
              factory_limit: 8,
              limits: { ocr: 0, summary: 500, email: 500, smart: 2000 },
              features: { analytics: true, emailSummary: true, pdf: true, excel: true, templates: true, api: true, nlq: true },
            },
            {
              id: "group",
              name: "Group",
              monthly_price: 44999,
              user_limit: 200,
              factory_limit: 20,
              unlimited_limits: ["summary", "email", "smart"],
              limits: { ocr: 0, summary: 0, email: 0, smart: 0 },
              features: {
                analytics: true,
                emailSummary: true,
                pdf: true,
                excel: true,
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
              features: { analytics: true, emailSummary: true, pdf: true, excel: true, templates: true, api: true, nlq: true },
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
  const checkoutPlanInfo = useMemo(
    () => planOptions.find((plan) => plan.id === checkoutPlan) || paidPlans[0] || planOptions[0],
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
        users: requestedUsers,
        factories: requestedFactories,
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
    plansPayload?.pricing,
    requestedFactories,
    requestedUsers,
    selectedAddonQuantities,
  ]);
  const summaryHealth = getQuotaHealth(billing?.usage?.summary_used, billing?.usage?.summary_limit);
  const emailHealth = getQuotaHealth(billing?.usage?.email_used, billing?.usage?.email_limit);
  const smartHealth = getQuotaHealth(billing?.usage?.smart_used, billing?.usage?.smart_limit);
  const ocrRequestsLocked = Number(billing?.usage?.max_requests ?? 0) < 0;
  const ocrCreditsLocked = Number(billing?.usage?.max_credits ?? 0) < 0;
  const summaryCards = useMemo(
    () => [
      {
        title: "Current Plan",
        value: billing?.plan || "-",
        detail: `Status: ${billing?.status || "-"}`,
      },
      {
        title: "Active Add-ons",
        value: billing?.active_addons?.length || 0,
        detail:
          (billing?.active_addons || [])
            .map((addon) =>
              Number(addon.quantity || 0) > 1 ? `${addon.name} x${addon.quantity}` : addon.name,
            )
            .join(", ") || "No paid add-ons yet.",
      },
      {
        title: "Current Period End",
        value: billing?.current_period_end_at ? "Tracked" : "-",
        detail: formatDateTime(billing?.current_period_end_at),
      },
      {
        title: "Last Upgrade",
        value: lastUpgrade ? "Recorded" : "-",
        detail: lastUpgrade || "No upgrade audit log yet.",
      },
    ],
    [billing?.active_addons, billing?.current_period_end_at, billing?.plan, billing?.status, lastUpgrade],
  );
  const usageDiagnosticsProps = {
    requestsMeter: {
      label: "Requests",
      value: ocrRequestsLocked
        ? "Locked - add OCR pack"
        : `${billing?.usage?.requests_used ?? 0}${billing?.usage?.max_requests ? ` / ${billing.usage.max_requests}` : " / Unlimited"}`,
      widthPercent: progressPercent(billing?.usage?.requests_used, billing?.usage?.max_requests),
      barClassName: "bg-[var(--accent)]",
    },
    creditsMeter: {
      label: "Credits",
      value: ocrCreditsLocked
        ? "Locked - add OCR pack"
        : `${billing?.usage?.credits_used ?? 0}${billing?.usage?.max_credits ? ` / ${billing.usage.max_credits}` : " / Unlimited"}`,
      widthPercent: progressPercent(billing?.usage?.credits_used, billing?.usage?.max_credits),
      barClassName: "bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]",
    },
    rateLimitLabel: `${billing?.usage?.rate_limit_per_minute ?? "-"} / minute`,
    summaryQuota: {
      label: "AI Summary",
      value: quotaLabel(billing?.usage?.summary_used, billing?.usage?.summary_limit),
      badge: summaryHealth.badge,
      badgeClassName: summaryHealth.badgeClass,
      barClassName: summaryHealth.barClass,
      widthPercent: summaryHealth.percent,
      detail: summaryHealth.detail,
    },
    emailQuota: {
      label: "AI Email",
      value: quotaLabel(billing?.usage?.email_used, billing?.usage?.email_limit),
      badge: emailHealth.badge,
      badgeClassName: emailHealth.badgeClass,
      barClassName: emailHealth.barClass,
      widthPercent: emailHealth.percent,
      detail: emailHealth.detail,
    },
    smartQuota: {
      label: "AI Smart",
      value: quotaLabel(billing?.usage?.smart_used, billing?.usage?.smart_limit),
      badge: smartHealth.badge,
      badgeClassName: smartHealth.badgeClass,
      barClassName: smartHealth.barClass,
      widthPercent: smartHealth.percent,
      detail: `${smartHealth.detail} · Used by smart DPR input and history-based production suggestions.`,
    },
    activeAddonBadges: (billing?.active_addons || []).map((addon) => addon.name),
  };
  const ownerPlanOptions = useMemo(
    () => planOptions.map((plan) => ({ id: plan.id, name: plan.name })),
    [planOptions],
  );
  const invoiceRows = useMemo(
    () =>
      invoices.map((invoice) => ({
        id: invoice.id,
        plan: invoice.plan,
        amountLabel: formatAmount(invoice.amount, invoice.currency || "INR"),
        status: invoice.status,
        issuedAtLabel: formatDateTime(invoice.issued_at),
        provider: invoice.provider || "-",
      })),
    [invoices],
  );
  const checkoutSequenceSteps = [
    {
      label: "Check billing access",
      detail: canWriteBilling
        ? "Owner access can start checkout and plan changes."
        : "Admins can review, but owners complete checkout.",
    },
    {
      label: "Confirm the fit",
      detail:
        checkoutEstimate?.isCompatible === false
          ? `Current selection exceeds the ${checkoutPlanInfo?.name || "chosen"} plan cap.`
          : `Users ${requestedUsers}, factories ${requestedFactories}, plan ${checkoutPlanInfo?.name || "-"}.`,
    },
    {
      label: "Start checkout",
      detail: billingConfig?.configured
        ? "Razorpay is ready when the plan and add-ons look right."
        : "Razorpay must be configured before checkout can start.",
    },
  ];

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
        requestedUsers,
        requestedFactories,
        selectedAddonIds,
        selectedAddonQuantities,
      );
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
          requested_users: String(requestedUsers),
          requested_factories: String(requestedFactories),
          addon_ids: (order.quote?.chargeable_addon_ids || []).join(","),
        },
        handler: async () => {
          try {
            const sync = await syncBillingOrder(order.order.id);
            setStatus(sync.message);
            await loadAll();
          } catch (syncError) {
            if (syncError instanceof ApiError) {
              setStatus(
                `${syncError.message} We will keep waiting for the Razorpay webhook and refresh billing again shortly.`,
              );
            } else {
              setStatus("Payment submitted to Razorpay. Billing will refresh after confirmation arrives.");
            }
            window.setTimeout(() => {
              void loadAll();
            }, 2500);
          }
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
            <CardTitle>{t("billing.billing.title", "Billing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>

            <Link href="/access">
              <Button>Open Access</Button>
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
            <CardTitle>{t("billing.billing.title", "Billing")}</CardTitle>
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
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <BillingHeader
          dashboardLabel={t("billing.billing.dashboard", "Dashboard")}
          description={t(
            "billing.billing.description",
            "Review plan status, confirm the checkout fit, then pay through Razorpay.",
          )}
          plansLabel={t("billing.plans.title", "Plans")}
          title={t("billing.billing.heading", "Plan status and live checkout")}
          toolsTitle={t("billing.billing.tools", "Billing tools")}
        />

        <BillingCheckoutSequence steps={checkoutSequenceSteps} />

        <BillingPlanSummaryCards cards={summaryCards} />

        <section className="min-w-0 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <BillingUsageDiagnostics {...usageDiagnosticsProps} />

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-xl">Checkout</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                Provider: Razorpay {billingConfig?.configured ? "configured" : "not configured"}
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Upgrade Plan</label>
                <Select value={checkoutPlan} onChange={(event) => setCheckoutPlan(event.target.value)}>
                  {planOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.sales_only ? " - contact sales" : ""}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Users</label>
                  <Input
                    type="number"
                    min={1}
                    value={requestedUsers}
                    onChange={(event) => setRequestedUsers(Math.max(1, Number(event.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Factories</label>
                  <Input
                    type="number"
                    min={1}
                    value={requestedFactories}
                    onChange={(event) =>
                      setRequestedFactories(Math.max(1, Number(event.target.value) || 1))
                    }
                  />
                </div>
              </div>

              {/* OCR Packs Section */}
              {addonOptions.filter((a) => a.kind === "ocr_pack").length > 0 ? (
              <div className="min-w-0 space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-semibold">OCR Scan Packs</span>
                  <Link href="/plans" className="overflow-safe-text text-xs uppercase tracking-caption text-[var(--accent)]">
                    Compare on plans page
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {addonOptions.filter((a) => a.kind === "ocr_pack").map((addon) => {
                    const activeQuantity = activeAddonQuantities[addon.id] || 0;
                    const selectedQuantity = selectedAddonQuantities[addon.id] || 0;
                    return (
                      <div
                        key={addon.id}
                        className="min-w-0 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.8)] p-3"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white">{addon.name}</div>
                              <div className="overflow-safe-text mt-1 text-xs leading-5 text-[var(--muted)]">
                                {addon.description}
                              </div>
                              <div className="mt-2 text-xs text-[var(--muted)]">
                                {addon.scan_quota ? `${addon.scan_quota} scans per pack` : "Billable pack"}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs font-semibold text-white">
                              {formatAmount(addon.price, billingConfig?.currency || "INR")}/mo
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-caption">
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
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] px-3 py-2">
                            <span className="text-xs uppercase tracking-caption text-[var(--muted)]">
                              Quantity
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="px-3 py-1"
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
                                className="px-3 py-1"
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
              ) : null}

              {/* WhatsApp Packs Section */}
              {addonOptions.filter((a) => a.kind === "whatsapp_pack").length > 0 ? (
              <div className="min-w-0 space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-semibold">WhatsApp Alert Packs</span>
                  <div className="overflow-safe-text text-xs uppercase tracking-caption text-[var(--muted)]">
                    Messages per org for ops alerts
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {addonOptions.filter((a) => a.kind === "whatsapp_pack").map((addon) => {
                    const activeQuantity = activeAddonQuantities[addon.id] || 0;
                    const selectedQuantity = selectedAddonQuantities[addon.id] || 0;
                    return (
                      <div
                        key={addon.id}
                        className="min-w-0 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.8)] p-3"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white">{addon.name}</div>
                              <div className="overflow-safe-text mt-1 text-xs leading-5 text-[var(--muted)]">
                                {addon.description}
                              </div>
                              <div className="mt-2 text-xs text-[var(--muted)]">
                                Messages per month per pack
                              </div>
                            </div>
                            <div className="shrink-0 text-xs font-semibold text-white">
                              {formatAmount(addon.price, billingConfig?.currency || "INR")}/mo
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-caption">
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
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] px-3 py-2">
                            <span className="text-xs uppercase tracking-caption text-[var(--muted)]">
                              Quantity
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="px-3 py-1"
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
                                className="px-3 py-1"
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
              ) : null}
              <div className="min-w-0 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Base plan</span>
                  <span>{formatAmount(checkoutPlanInfo?.monthly_price || 0, billingConfig?.currency || "INR")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Included users / factories</span>
                  <span>
                    {(checkoutPlanInfo?.user_limit || 0) > 0 ? checkoutPlanInfo?.user_limit : "Unlimited"}
                    {" / "}
                    {(checkoutPlanInfo?.factory_limit || 0) > 0 ? checkoutPlanInfo?.factory_limit : "Unlimited"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Billable add-ons</span>
                  <span>{formatAmount(checkoutEstimate?.addonMonthlyCost || 0, billingConfig?.currency || "INR")}</span>
                </div>
                {checkoutEstimate?.chargeableAddons.map((addon) => (
                  <div key={addon.id} className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                    <span className="overflow-safe-text">
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--border)] pt-3 font-semibold">
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
                  Enterprise plans use contact sales. Internal QA can still review the structure here.
                </div>
              ) : null}
              {!canWriteBilling ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Read-only mode: admins can review billing status and invoices, while owners handle checkout and plan changes.
                </div>
              ) : null}

              <Button
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
                This checkout uses the same backend pricing logic as the plans catalog, including hard caps, OCR pack quantities, and active-pack deductions.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          <BillingOwnerControls
            busy={busy}
            canWriteBilling={canWriteBilling}
            downgradePlan={downgradePlan}
            manualOverrideEnabled={Boolean(billingConfig?.manual_plan_override_enabled)}
            overridePlan={overridePlan}
            pendingDowngradeDetail={
              billing?.pending_plan
                ? `Pending plan: ${billing.pending_plan} on ${formatDateTime(billing.pending_plan_effective_at)}`
                : null
            }
            planOptions={ownerPlanOptions}
            readOnlyMessage="Owners are the only role allowed to schedule downgrades, start checkout, or use the emergency plan override."
            onCancelDowngrade={() =>
              void handleAction(async () => {
                await cancelScheduledDowngrade();
                setStatus("Scheduled downgrade cancelled.");
              })
            }
            onDowngradePlanChange={setDowngradePlan}
            onOverridePlanChange={setOverridePlan}
            onScheduleDowngrade={() =>
              void handleAction(async () => {
                await scheduleDowngrade(downgradePlan);
                setStatus("Downgrade scheduled at the end of the current billing cycle.");
              })
            }
            onUpdatePlan={() =>
              void handleAction(async () => {
                await updateOrganizationPlan(overridePlan);
                setStatus(`Organization plan updated to ${overridePlan}.`);
              })
            }
          />

          <BillingInvoiceHistory
            emptyLabel="No invoices recorded yet."
            invoices={invoiceRows}
          />
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
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
