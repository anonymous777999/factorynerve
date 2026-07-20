"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Minus, Shield, Zap, BarChart3, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getPlans, type AddonInfo } from "@/lib/plans";

/* ───────────────────────────────────────────────
   DATA
   ─────────────────────────────────────────────── */

const plans = [
  {
    id: "pilot",
    badge: "FREE PILOT",
    name: "Factory Pilot",
    tagline: "Use everything. Test real workflows. No card required.",
    price: "₹0",
    priceSuffix: "/ 14 days",
    highlight: false,
    cta: "Start Your Pilot",
    ctaStyle: "outline" as const,
    subtext: "Verified business email required to activate pilot",
    limits: {
      users: "Up to 7",
      workspace: "1",
      ocrScans: "150 pages",
      aiOperations: "100 actions",
      dispatchWorkflows: "Included",
      reportsExports: "Limited",
      whatsappAlerts: "100 messages",
      emailSummaries: "50",
      operationalDashboards: "Limited",
      workflowApprovals: "Limited",
      analytics: "Limited",
      anomalyDetection: "Limited",
      sla: "None",
    },
  },
  {
    id: "operator",
    badge: "ESSENTIAL",
    name: "Operator",
    tagline: "For small teams running a single plant or dispatch hub.",
    price: "₹3,499",
    priceSuffix: "/ month",
    annualPrice: "₹34,999 / year",
    annualSaving: "Save 17%",
    highlight: false,
    cta: "Start Free Trial",
    ctaStyle: "outline" as const,
    subtext: "14-day free trial, no credit card required",
    limits: {
      users: "Up to 10",
      workspace: "1",
      ocrScans: "Via add-on",
      aiOperations: "300 actions",
      dispatchWorkflows: "Included",
      reportsExports: "Yes",
      whatsappAlerts: "500 messages",
      emailSummaries: "Yes",
      analytics: "Basic",
      sla: "99.5% uptime",
    },
  },
  {
    id: "factory",
    badge: "MOST POPULAR",
    name: "Factory",
    tagline: "For growing factories managing multiple shifts and departments.",
    price: "₹8,999",
    priceSuffix: "/ month",
    annualPrice: "₹89,999 / year",
    annualSaving: "Save 17%",
    highlight: true,
    cta: "Activate Factory",
    ctaStyle: "primary" as const,
    subtext: "Best for scaling operational businesses",
    limits: {
      users: "Up to 30",
      workspace: "Up to 3",
      ocrScans: "Via add-on",
      aiOperations: "1,200 actions",
      dispatchWorkflows: "Included",
      reportsExports: "Yes",
      whatsappAlerts: "1,500 messages",
      emailSummaries: "Yes",
      operationalDashboards: "Advanced",
      workflowApprovals: "Automation",
      analytics: "Yes",
      prioritySupport: "Yes",
      sla: "99.9% uptime",
    },
  },
  {
    id: "operations",
    badge: "SCALE OPERATIONS",
    name: "Operations",
    tagline: "For large factories with multiple departments and high volume.",
    price: "₹19,999",
    priceSuffix: "/ month",
    annualPrice: "₹1,99,999 / year",
    annualSaving: "Save 17%",
    highlight: false,
    cta: "Scale Operations",
    ctaStyle: "outline" as const,
    subtext: "Built for department-scale operations",
    limits: {
      users: "Up to 75",
      workspace: "Up to 8",
      ocrScans: "Via add-on",
      aiOperations: "5,000 actions",
      dispatchWorkflows: "Included",
      reportsExports: "Yes",
      whatsappAlerts: "3,000 messages",
      emailSummaries: "Yes",
      operationalDashboards: "Advanced + Custom",
      workflowApprovals: "Advanced",
      anomalyDetection: "Yes",
      analytics: "Yes",
      prioritySupport: "Yes",
      sla: "99.9% uptime",
    },
  },
  {
    id: "group",
    badge: "ENTERPRISE READY",
    name: "Group",
    tagline: "For factory groups managing complex workflows across multiple plants.",
    price: "₹44,999",
    priceSuffix: "/ month",
    annualPrice: "₹4,49,999 / year",
    annualSaving: "Save 17%",
    highlight: false,
    cta: "Go Multi-Plant",
    ctaStyle: "outline" as const,
    subtext: "For large-scale operational organisations",
    limits: {
      users: "Up to 200",
      workspace: "20",
      ocrScans: "Via add-on",
      aiOperations: "20,000 actions",
      dispatchWorkflows: "Included",
      reportsExports: "Unlimited",
      whatsappAlerts: "5,000 messages",
      emailSummaries: "Yes",
      operationalDashboards: "Advanced + Custom",
      workflowApprovals: "Full Automation",
      dedicatedAccountManager: "Yes",
      slaSupport: "Yes",
      anomalyDetection: "Yes",
      analytics: "Yes",
      prioritySupport: "Yes",
      sla: "99.95% uptime",
    },
  },
  {
    id: "enterprise",
    badge: "CUSTOM SOLUTION",
    name: "Enterprise",
    tagline: "Custom infrastructure for industrial groups, multi-plant operations and conglomerates.",
    price: "Custom",
    priceSuffix: "/ Contact Sales",
    priceNote: "From ₹1,50,000 / month",
    highlight: false,
    cta: "Talk to Sales",
    ctaStyle: "ghost" as const,
    subtext: "Tailored for enterprise-grade deployments",
    limits: {
      users: "Unlimited",
      factories: "Unlimited",
      ocrScans: "Custom Pool",
      aiOperations: "Unlimited",
      dispatchWorkflows: "Unlimited",
      reportsExports: "Unlimited",
      whatsappAlerts: "Unlimited",
      onPremiseDeployment: "Available",
      dedicatedInfrastructure: "Yes",
      support247sla: "Yes",
      ssoSaml: "Yes",
      dataResidencyIndia: "Yes",
      sla: "99.99% + custom SLA",
    },
  },
];

const ocrPacks = [
  {
    badge: "BEST FOR SMALL TEAMS",
    name: "Starter Digitization",
    price: "₹999",
    priceSuffix: "/ month",
    volume: "200 processed documents per month",
    description:
      "Ideal for small teams digitising gate passes, invoices, inspection sheets, and daily operational reports.",
    features: [
      "200 processed documents per month",
      "Document OCR & text extraction",
      "Structured data conversion",
      "Excel-ready output",
      "Priority processing queue",
    ],
    cta: "Add Starter Pack",
  },
  {
    badge: "POPULAR",
    name: "Production Digitization",
    price: "₹2,499",
    priceSuffix: "/ month",
    volume: "500 processed documents per month",
    description:
      "Built for production environments handling recurring paperwork, dispatch logs, inventory records, and operational forms.",
    features: [
      "500 processed documents per month",
      "Advanced document extraction",
      "Bulk document processing",
      "Template-based workflows",
      "Faster processing priority",
    ],
    cta: "Add Production Pack",
  },
  {
    badge: "HIGH VOLUME",
    name: "Operations Digitization",
    price: "₹4,999",
    priceSuffix: "/ month",
    volume: "1,200 processed documents per month",
    description:
      "Designed for factories with continuous paper-to-digital workflows and operational reporting requirements.",
    features: [
      "1,200 processed documents per month",
      "High-volume document processing",
      "Advanced extraction workflows",
      "Template intelligence",
      "Operational reporting support",
      "Highest priority queue",
    ],
    cta: "Add Operations Pack",
  },
  {
    badge: "PLANT SCALE",
    name: "Plant Digitization",
    price: "₹8,999",
    priceSuffix: "/ month",
    volume: "2,500 processed documents per month",
    description:
      "For factories and industrial groups digitising large volumes of operational paperwork across multiple departments.",
    features: [
      "2,500 processed documents per month",
      "Advanced document intelligence",
      "Complex document support",
      "Bulk & template processing",
      "Large-scale digitization workflows",
      "Highest processing priority",
    ],
    cta: "Add Plant Pack",
  },
];

const whatsappPacks = [
  {
    name: "WhatsApp Boost",
    price: "₹1,499",
    priceSuffix: "/ month",
    volume: "2,500 extra messages",
    cta: "Add WhatsApp Boost",
  },
  {
    name: "WhatsApp Scale",
    price: "₹4,999",
    priceSuffix: "/ month",
    volume: "10,000 extra messages",
    cta: "Add WhatsApp Scale",
  },
  {
    name: "WhatsApp Operations",
    price: "₹18,999",
    priceSuffix: "/ month",
    volume: "50,000 extra messages",
    cta: "Add WhatsApp Operations",
  },
];

/* ───────────────────────────────────────────────
   LIVE CATALOG BRIDGE
   The pricing/quota numbers are owned by the backend (plans.py ->
   GET /plans). We fetch that catalog and render the add-on packs from it so
   the marketing page can never drift from what Razorpay actually charges.
   The hardcoded arrays above stay as a graceful fallback (anonymous visitors
   still see packs if the API is briefly unreachable), and the overlays below
   supply pure decoration the backend does not store — badge label and the
   feature bullet list — keyed by the stable addon id.
   Adding a new pack in plans.py makes it appear here automatically.
   ─────────────────────────────────────────────── */

/** Presentation-only decoration for OCR packs, keyed by backend addon id. */
const ocrPackOverlay: Record<string, { badge: string; features: string[] }> = {
  ocr_light: {
    badge: "BEST FOR SMALL TEAMS",
    features: [
      "Document OCR & text extraction",
      "Structured data conversion",
      "Excel-ready output",
      "Priority processing queue",
    ],
  },
  ocr_standard: {
    badge: "POPULAR",
    features: [
      "Advanced document extraction",
      "Bulk document processing",
      "Template-based workflows",
      "Faster processing priority",
    ],
  },
  ocr_heavy: {
    badge: "HIGH VOLUME",
    features: [
      "High-volume document processing",
      "Advanced extraction workflows",
      "Template intelligence",
      "Operational reporting support",
      "Highest priority queue",
    ],
  },
  ocr_plant: {
    badge: "PLANT SCALE",
    features: [
      "Advanced document intelligence",
      "Complex document support",
      "Bulk & template processing",
      "Large-scale digitization workflows",
      "Highest processing priority",
    ],
  },
};

const OCR_PACK_FALLBACK_BADGE = "OCR PACK";
const OCR_PACK_FALLBACK_FEATURES = [
  "Document OCR & text extraction",
  "Structured data conversion",
  "Excel-ready output",
];

/** Format an integer rupee amount as the marketing pages do (₹1,499). */
function formatRupees(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN").format(Math.round(amount))}`;
}

/** Map a live OCR add-on into OcrPackCard props, layering decoration on top. */
function ocrCardFromAddon(addon: AddonInfo): OcrPackCardProps {
  const overlay = ocrPackOverlay[addon.id];
  const quota = Number(addon.scan_quota || 0);
  const volume = quota > 0
    ? `${new Intl.NumberFormat("en-IN").format(quota)} processed documents per month`
    : "Document processing pack";
  return {
    badge: overlay?.badge ?? OCR_PACK_FALLBACK_BADGE,
    name: addon.name,
    price: formatRupees(addon.price),
    priceSuffix: "/ month",
    volume,
    description: addon.description ?? "",
    features: [volume, ...(overlay?.features ?? OCR_PACK_FALLBACK_FEATURES)],
    cta: `Add ${addon.name}`,
  };
}

/** Map a live WhatsApp add-on into WhatsAppPack props. */
function whatsappCardFromAddon(addon: AddonInfo): WhatsAppPackProps {
  const quota = Number(addon.message_quota || 0);
  const volume = quota > 0
    ? `${new Intl.NumberFormat("en-IN").format(quota)} extra messages`
    : "Extra messaging capacity";
  return {
    name: addon.name,
    price: formatRupees(addon.price),
    priceSuffix: "/ month",
    volume,
    cta: `Add ${addon.name}`,
  };
}

/* ───────────────────────────────────────────────
   FEATURE ROW DEFINITION
   ─────────────────────────────────────────────── */

/** 14 feature rows that appear on every plan card. */
const featureRows: Array<{
  key: string;
  label: string;
  /** If set, also checks this alternate key for a value */
  altKey?: string;
}> = [
  { key: "users", label: "Users" },
  { key: "workspace", label: "Factories", altKey: "factories" },
  { key: "ocrScans", label: "OCR Scans" },
  { key: "aiOperations", label: "AI Operations" },
  { key: "dispatchWorkflows", label: "Dispatch Workflows" },
  { key: "reportsExports", label: "Reports & Exports" },
  { key: "whatsappAlerts", label: "WhatsApp Alerts" },
  { key: "emailSummaries", label: "Email Summaries" },
  { key: "operationalDashboards", label: "Operational Dashboards" },
  { key: "workflowApprovals", label: "Workflow Approvals" },
  { key: "analytics", label: "Analytics" },
  { key: "anomalyDetection", label: "Anomaly Detection" },
  { key: "prioritySupport", label: "Priority Support" },
  { key: "sla", label: "Uptime SLA" },
];

/** Resolve the value for a feature row, checking altKey if primary is missing. */
function resolveFeatureValue(
  limits: Record<string, string | undefined>,
  feature: (typeof featureRows)[number],
): string | undefined {
  return limits[feature.key] ?? (feature.altKey ? limits[feature.altKey] : undefined);
}

/* ───────────────────────────────────────────────
   SUB-COMPONENTS
   ─────────────────────────────────────────────── */

function CheckIcon() {
  return <Check className="h-4 w-4 flex-shrink-0 text-[var(--accent)]" strokeWidth={2.5} />;
}

function DashIcon() {
  return <Minus className="h-4 w-4 flex-shrink-0 text-[var(--muted)] opacity-40" strokeWidth={2} />;
}

function ShieldIcon() {
  return <Shield className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />;
}

function BoltIcon() {
  return <Zap className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />;
}

function ChartIcon() {
  return <BarChart3 className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />;
}

function LockIcon() {
  return <Lock className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />;
}

type TrustItemProps = {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
};

function TrustItem({ icon, label, sublabel }: TrustItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
        <div className="text-xs text-[var(--muted)]">{sublabel}</div>
      </div>
    </div>
  );
}

type FeatureValueProps = {
  value: string | undefined;
};

function FeatureValue({ value }: FeatureValueProps) {
  if (!value) {
    return (
      <span className="flex items-center gap-2">
        <DashIcon />
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <CheckIcon />
      <span className="text-sm text-[var(--text)]">{value}</span>
    </span>
  );
}

/* ───────────────────────────────────────────────
   BILLING TOGGLE
   ─────────────────────────────────────────────── */

type BillingCycle = "monthly" | "annual";

function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "text-sm font-semibold transition-colors duration-200",
          cycle === "monthly" ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange(cycle === "monthly" ? "annual" : "monthly")}
        className={cn(
          "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          cycle === "annual"
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border-strong)] bg-[var(--card-strong)]",
        )}
        role="switch"
        aria-checked={cycle === "annual"}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full shadow-md ring-0 transition duration-200 ease-in-out",
            cycle === "annual"
              ? "translate-x-[1.35rem] bg-[var(--accent)]"
              : "translate-x-0.5 bg-[var(--muted)]",
          )}
        />
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange("annual")}
          className={cn(
            "text-sm font-semibold transition-colors duration-200",
            cycle === "annual" ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          Annual
        </button>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          Save 17%
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   PLAN CTA DESTINATIONS
   ─────────────────────────────────────────────── */

/**
 * Resolve where a plan-tier CTA should take the user.
 * - Free pilot -> account signup (nothing to pay).
 * - Sales-only enterprise -> contact sales.
 * - Paid tiers -> authenticated billing page, pre-selecting the plan and
 *   billing cycle. The billing page reads ?plan= and ?cycle= from the URL
 *   (see billing-page.tsx) and pre-fills the Razorpay checkout.
 *
 * The pricing toggle uses "annual"; the billing page expects "yearly".
 */
function planCtaHref(planId: string, billingCycle: BillingCycle): string {
  if (planId === "pilot") return "/signup";
  if (planId === "enterprise") return "/contact";
  const cycle = billingCycle === "annual" ? "yearly" : "monthly";
  return `/billing?plan=${encodeURIComponent(planId)}&cycle=${cycle}`;
}

/* ───────────────────────────────────────────────
   PLAN CARD
   ─────────────────────────────────────────────── */

type PlanCardProps = {
  id: string;
  badge: string;
  name: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  annualPrice?: string;
  annualSaving?: string;
  priceNote?: string;
  highlight: boolean;
  cta: string;
  ctaStyle: "primary" | "outline" | "ghost";
  subtext: string;
  limits: Record<string, string | undefined>;
  billingCycle: BillingCycle;
};

function PlanCard({
  id,
  badge,
  name,
  tagline,
  price,
  priceSuffix,
  annualPrice,
  annualSaving,
  priceNote,
  highlight,
  cta,
  ctaStyle,
  subtext,
  limits,
  billingCycle,
}: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[1.7rem] border p-6 sm:p-8 transition-all duration-300",
        highlight
          ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(197,109,45,0.06),rgba(18,27,41,0.98))] shadow-[0_0_40px_rgba(197,109,45,0.12),0_0_0_1px_rgba(197,109,45,0.2)] scale-[1.02] sm:scale-105 z-10"
          : "border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,27,41,0.96),rgba(13,20,32,0.98))] shadow-[var(--shadow-md)]",
      )}
    >
      {/* Badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1" />
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-caption",
            highlight
              ? "bg-[var(--accent)] text-[#06111c]"
              : "border border-[var(--border-strong)] bg-[rgba(148,163,184,0.1)] text-[var(--muted)]",
          )}
        >
          {badge}
        </span>
      </div>

      {/* Name & Tagline */}
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-[var(--text)]">{name}</h3>
        <p className="mt-1.5 text-sm leading-5 text-[var(--muted)]">{tagline}</p>
      </div>

      {/* Price — crossfade on billing toggle */}
      <div className="mb-5">
        <div
          key={billingCycle}
          className="animate-[fadeIn_0.3s_ease-in-out]"
        >
          <div className="flex items-baseline gap-1.5">
            <span className={cn("font-bold tracking-tight text-[var(--text)]", price === "Custom" ? "text-3xl" : "text-4xl")}>
              {price}
            </span>
            <span className="text-sm text-[var(--muted)]">{priceSuffix}</span>
          </div>
          {priceNote && (
            <div className="mt-1 text-xs text-[var(--muted)]">{priceNote}</div>
          )}
          {billingCycle === "annual" && annualPrice && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">{annualPrice}</span>
              {annualSaving && (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  {annualSaving}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-[var(--border)]" />

      {/* Feature rows — all 14 rows are always visible on every card */}
      <div className="flex-1 space-y-3 mb-6">
        {featureRows.map((feature) => {
          const value = resolveFeatureValue(limits, feature);
          return (
            <div key={feature.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--muted)]">{feature.label}</span>
              <FeatureValue value={value} />
            </div>
          );
        })}
      </div>

      {/* CTA Button */}
      <Button
        asChild
        variant={ctaStyle === "primary" ? "primary" : ctaStyle === "outline" ? "outline" : "ghost"}
        className="w-full rounded-full"
      >
        <Link href={planCtaHref(id, billingCycle)}>{cta}</Link>
      </Button>

      {/* Subtext */}
      <p className="mt-3 text-center text-xs leading-relaxed text-[var(--muted)]">
        {subtext}
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────
   OCR PACK CARD
   ─────────────────────────────────────────────── */

type OcrPackCardProps = {
  badge: string;
  name: string;
  price: string;
  priceSuffix: string;
  volume: string;
  description: string;
  features: string[];
  cta: string;
};

function OcrPackCard({
  badge,
  name,
  price,
  priceSuffix,
  volume,
  description,
  features,
  cta,
}: OcrPackCardProps) {
  return (
    <div className="flex flex-col rounded-[1.7rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,27,41,0.96),rgba(13,20,32,0.98))] p-6 shadow-[var(--shadow-md)] transition-all duration-200 hover:border-[var(--border-strong)]">
      <span className="mb-3 inline-flex items-center self-start rounded-full border border-[var(--border-strong)] bg-[rgba(148,163,184,0.1)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-caption text-[var(--muted)]">
        {badge}
      </span>

      <h3 className="text-lg font-semibold text-[var(--text)]">{name}</h3>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-[var(--text)]">{price}</span>
        <span className="text-sm text-[var(--muted)]">{priceSuffix}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--accent)]">{volume}</p>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{description}</p>

      <div className="mt-5 flex-1 space-y-2.5">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-sm text-[var(--text)]">{feature}</span>
          </div>
        ))}
      </div>

      {/* Add-on packs are purchased on the billing page, which renders the
          live backend add-on catalog with authoritative pricing. NOTE: the
          marketing prices/quantities above do not yet match plans.py — reconcile
          before deep-linking a specific pack via ?addons=. */}
      <Button asChild variant="outline" className="mt-6 w-full rounded-full">
        <Link href="/billing">{cta}</Link>
      </Button>
    </div>
  );
}

/* ───────────────────────────────────────────────
   WHATSAPP PACK
   ─────────────────────────────────────────────── */

type WhatsAppPackProps = {
  name: string;
  price: string;
  priceSuffix: string;
  volume: string;
  cta: string;
};

function WhatsAppPack({ name, price, priceSuffix, volume, cta }: WhatsAppPackProps) {
  return (
    <div className="flex flex-col items-center rounded-[1.7rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,27,41,0.96),rgba(13,20,32,0.98))] p-6 shadow-[var(--shadow-md)] text-center transition-all duration-200 hover:border-[var(--border-strong)]">
      <h3 className="text-lg font-semibold text-[var(--text)]">{name}</h3>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-[var(--text)]">{price}</span>
        <span className="text-sm text-[var(--muted)]">{priceSuffix}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--accent)]">{volume}</p>

      {/* Purchased on the billing page (live catalog / authoritative pricing). */}
      <Button asChild variant="outline" className="mt-6 w-full rounded-full">
        <Link href="/billing">{cta}</Link>
      </Button>
    </div>
  );
}

/* ───────────────────────────────────────────────
   MAIN PAGE COMPONENT
   ─────────────────────────────────────────────── */

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  // Live add-on catalog from the backend (single source of truth for pricing).
  // Starts null; falls back to the hardcoded arrays until/unless it loads.
  const [liveAddons, setLiveAddons] = useState<AddonInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlans()
      .then((payload) => {
        if (!cancelled) setLiveAddons(payload.addons ?? []);
      })
      .catch(() => {
        // Anonymous visitor or API briefly down: keep the hardcoded fallback.
        if (!cancelled) setLiveAddons(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer the live catalog; fall back to the static marketing arrays.
  const liveOcrPacks = (liveAddons ?? []).filter((a) => a.kind === "ocr_pack");
  const liveWhatsappPacks = (liveAddons ?? []).filter((a) => a.kind === "whatsapp_pack");
  const ocrPacksToRender = liveOcrPacks.length
    ? liveOcrPacks.map(ocrCardFromAddon)
    : ocrPacks;
  const whatsappPacksToRender = liveWhatsappPacks.length
    ? liveWhatsappPacks.map(whatsappCardFromAddon)
    : whatsappPacks;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Page Header ── */}
        <section className="mb-12 text-center">
          <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
            AI-NATIVE OPERATIONAL INFRASTRUCTURE
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
            Plans built for real factory operations
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Start free for 14 days. Upgrade only when you see operational impact.
          </p>

          {/* Trust icons */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            <TrustItem icon={<ShieldIcon />} label="No long-term lock-in" sublabel="Cancel anytime" />
            <TrustItem icon={<BoltIcon />} label="Setup in minutes" sublabel="Go live in 2–3 days" />
            <TrustItem icon={<ChartIcon />} label="Scale as you grow" sublabel="Upgrade in 1 click" />
            <TrustItem icon={<LockIcon />} label="Secure & compliant" sublabel="Enterprise-grade security" />
          </div>
        </section>

        {/* ── Billing Toggle ── */}
        <div className="mb-10">
          <BillingToggle cycle={billingCycle} onChange={setBillingCycle} />
        </div>

        {/* ── Plan Grid ── */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              {...plan}
              billingCycle={billingCycle}
            />
          ))}
        </section>

        {/* ── OCR Packs Section ── */}
        <section className="mt-20">
          <div className="mb-10 text-center">
            <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
              OCR PACKS
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Add more scanning power when you need it
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              Flexible add-ons to scale your document digitisation. Use with any active plan.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ocrPacksToRender.map((pack) => (
              <OcrPackCard key={pack.name} {...pack} />
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-[var(--muted)]">
            Fair usage policies apply to advanced document intelligence workflows. Additional processing capacity can be added as your operational requirements grow.
          </p>
        </section>

        {/* ── WhatsApp Packs Section ── */}
        <section className="mt-20">
          <div className="mb-10 text-center">
            <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
              WHATSAPP PACKS
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
              Add messaging capacity when you need it
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              Extra WhatsApp alerts beyond your plan&apos;s monthly inclusion. ₹0.75 per message on demand, or save with a pack.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {whatsappPacksToRender.map((pack) => (
              <WhatsAppPack key={pack.name} {...pack} />
            ))}
          </div>
        </section>

        {/* ── Footer Trust Bar ── */}
        <section className="mt-20 space-y-3 rounded-[1.7rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,27,41,0.96),rgba(13,20,32,0.98))] px-6 py-8 sm:px-10 sm:py-10 shadow-[var(--shadow-md)]">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            All plans include 99.9%+ uptime SLA, daily backups, secure hosting, and continuous platform updates.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Complex documents (handwritten forms, multi-column layouts) consume 2 OCR credits per page.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            WhatsApp messages above your monthly inclusion are billed at ₹0.75 per message.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            AI operations above your monthly limit are billed at ₹3.00 per 100 operations.
          </p>
        </section>
      </div>
    </main>
  );
}
