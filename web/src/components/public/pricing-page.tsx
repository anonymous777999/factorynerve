"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────
   PRICING MODEL
   Strategy notes (founder view):
   - Platform subscription = predictable base margin.
   - OCR + AI are usage-metered on top, sized so the
     included allowance is a hook and overage protects margin.
   - Prepaid packs discount overage to pull cash forward and
     lock in commitment without ever pricing below COGS.
   ─────────────────────────────────────────────── */

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n: number) => n.toLocaleString("en-IN");

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: string;
  badge: string;
  name: string;
  tagline: string;
  /** Monthly price in INR. null = custom */
  monthly: number | null;
  /** Effective monthly price when paid annually (2 months free) */
  annualMonthly: number | null;
  highlight: boolean;
  cta: string;
  ctaStyle: "primary" | "outline" | "ghost";
  subtext: string;
  /** Included monthly OCR pages */
  ocrIncluded: number;
  /** OCR overage rate (₹/page) */
  ocrRate: number;
  /** Included monthly AI actions */
  aiIncluded: number;
  /** AI overage rate (₹/action) */
  aiRate: number;
  /** Whether the plan appears in the estimator */
  estimable: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "pilot",
    badge: "Free Pilot",
    name: "Factory Pilot",
    tagline: "Run your real workflows for 14 days. No card required.",
    monthly: 0,
    annualMonthly: 0,
    highlight: false,
    cta: "Start Free Pilot",
    ctaStyle: "outline",
    subtext: "Verified business email required to activate",
    ocrIncluded: 150,
    ocrRate: 5,
    aiIncluded: 100,
    aiRate: 3,
    estimable: false,
    features: [
      "Up to 5 users · 1 workspace",
      "150 OCR pages included",
      "100 AI actions included",
      "Attendance, production & dispatch",
      "WhatsApp alerts · email summaries",
      "Personal onboarding session",
    ],
  },
  {
    id: "operator",
    badge: "Essential",
    name: "Operator",
    tagline: "One plant, one dispatch hub, a lean team.",
    monthly: 3999,
    annualMonthly: 3332,
    highlight: false,
    cta: "Start 14-Day Trial",
    ctaStyle: "outline",
    subtext: "No credit card required to start",
    ocrIncluded: 500,
    ocrRate: 4.5,
    aiIncluded: 500,
    aiRate: 2.5,
    estimable: true,
    features: [
      "Up to 10 users · 1 workspace",
      "500 OCR pages / month included",
      "500 AI actions / month included",
      "Overage: ₹4.50 / page · ₹2.50 / action",
      "Reports, exports & basic analytics",
      "99.5% uptime SLA",
    ],
  },
  {
    id: "factory",
    badge: "Most Popular",
    name: "Factory",
    tagline: "Multiple shifts and departments running in sync.",
    monthly: 9999,
    annualMonthly: 8332,
    highlight: true,
    cta: "Activate Factory",
    ctaStyle: "primary",
    subtext: "Best value for scaling operations",
    ocrIncluded: 2000,
    ocrRate: 3.5,
    aiIncluded: 2500,
    aiRate: 2,
    estimable: true,
    features: [
      "Up to 30 users · 3 workspaces",
      "2,000 OCR pages / month included",
      "2,500 AI actions / month included",
      "Overage: ₹3.50 / page · ₹2.00 / action",
      "Advanced dashboards & approval automation",
      "Anomaly detection · priority support",
      "99.9% uptime SLA",
    ],
  },
  {
    id: "operations",
    badge: "Scale",
    name: "Operations",
    tagline: "High-volume plants with heavy paperwork and AI use.",
    monthly: 21999,
    annualMonthly: 18332,
    highlight: false,
    cta: "Scale Operations",
    ctaStyle: "outline",
    subtext: "Built for department-scale volume",
    ocrIncluded: 6000,
    ocrRate: 2.75,
    aiIncluded: 8000,
    aiRate: 1.5,
    estimable: true,
    features: [
      "Up to 75 users · 8 workspaces",
      "6,000 OCR pages / month included",
      "8,000 AI actions / month included",
      "Overage: ₹2.75 / page · ₹1.50 / action",
      "Custom dashboards & advanced approvals",
      "Dedicated success manager",
      "99.9% uptime SLA",
    ],
  },
  {
    id: "enterprise",
    badge: "Custom",
    name: "Enterprise",
    tagline: "Multi-plant groups, on-prem, and custom usage pools.",
    monthly: null,
    annualMonthly: null,
    highlight: false,
    cta: "Talk to Sales",
    ctaStyle: "ghost",
    subtext: "From ₹1,50,000 / month",
    ocrIncluded: 0,
    ocrRate: 0,
    aiIncluded: 0,
    aiRate: 0,
    estimable: false,
    features: [
      "Unlimited users & workspaces",
      "Custom OCR & AI usage pools",
      "On-premise / private cloud option",
      "SSO / SAML · data residency (India)",
      "24×7 support · 99.99% custom SLA",
      "Dedicated infrastructure",
    ],
  },
];

const ocrPacks = [
  { name: "OCR 500", pages: 500, price: 1999 },
  { name: "OCR 2,000", pages: 2000, price: 6999 },
  { name: "OCR 5,000", pages: 5000, price: 14999 },
];

const aiPacks = [
  { name: "AI 1,000", actions: 1000, price: 1799 },
  { name: "AI 5,000", actions: 5000, price: 6999 },
  { name: "AI 20,000", actions: 20000, price: 19999 },
];

/* ───────────────────────────────────────────────
   SMALL UI PIECES
   ─────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrustItem({
  icon,
  label,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent-quiet)]">
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
        <div className="text-xs text-[var(--muted)]">{sublabel}</div>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ───────────────────────────────────────────────
   BILLING TOGGLE
   ─────────────────────────────────────────────── */

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
          "text-sm font-semibold transition-colors",
          cycle === "monthly" ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange(cycle === "monthly" ? "annual" : "monthly")}
        role="switch"
        aria-checked={cycle === "annual"}
        aria-label="Toggle annual billing"
        className={cn(
          "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          cycle === "annual" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] bg-[var(--card-strong)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full shadow-md transition",
            cycle === "annual" ? "translate-x-[1.35rem] bg-[var(--accent)]" : "translate-x-0.5 bg-[var(--muted)]",
          )}
        />
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange("annual")}
          className={cn(
            "text-sm font-semibold transition-colors",
            cycle === "annual" ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          Annual
        </button>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          2 months free
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   PLAN CARD
   ─────────────────────────────────────────────── */

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const price = cycle === "annual" ? plan.annualMonthly : plan.monthly;
  const isCustom = price === null;
  const isFree = price === 0;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[var(--radius-card)] border p-6 transition-all duration-300",
        plan.highlight
          ? "border-[var(--accent)] bg-[linear-gradient(180deg,var(--accent-quiet),var(--card))] shadow-[0_0_0_1px_var(--accent-soft),var(--shadow-lg)] lg:scale-[1.03] lg:z-10"
          : "border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] hover:border-[var(--border-strong)]",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text)]">{plan.name}</h3>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-caption",
            plan.highlight
              ? "bg-[var(--accent)] text-[#1a0e05]"
              : "border border-[var(--border-strong)] bg-[rgba(171,159,147,0.1)] text-[var(--muted)]",
          )}
        >
          {plan.badge}
        </span>
      </div>

      <p className="mb-5 min-h-[2.5rem] text-sm leading-5 text-[var(--muted)]">{plan.tagline}</p>

      <div key={cycle} className="content-fade-in mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("font-bold tracking-tight text-[var(--text)]", isCustom ? "text-3xl" : "text-4xl")}>
            {isCustom ? "Custom" : isFree ? "₹0" : inr(price as number)}
          </span>
          {!isCustom && <span className="text-sm text-[var(--muted)]">{isFree ? "/ 14 days" : "/ month"}</span>}
        </div>
        {isCustom ? (
          <div className="mt-1 text-xs text-[var(--muted)]">{plan.subtext}</div>
        ) : cycle === "annual" && !isFree ? (
          <div className="mt-1 text-xs text-[var(--accent)]">Billed {inr((price as number) * 12)} / year</div>
        ) : (
          <div className="mt-1 text-xs text-transparent" aria-hidden="true">
            placeholder
          </div>
        )}
      </div>

      <div className="mb-5 h-px bg-[var(--border)]" />

      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-sm leading-5 text-[var(--text)]">{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={cn(
          "w-full rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          plan.ctaStyle === "primary" &&
            "border border-[var(--accent-strong)] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[#fdf3ea] shadow-[0_14px_30px_rgba(197,109,45,0.32)] hover:-translate-y-0.5 hover:brightness-110",
          plan.ctaStyle === "outline" &&
            "border border-[var(--border-strong)] bg-white/[0.02] text-[var(--text)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-quiet)]",
          plan.ctaStyle === "ghost" &&
            "border border-transparent bg-transparent text-[var(--text)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-white/[0.03]",
        )}
      >
        {plan.cta}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-[var(--muted)]">{plan.subtext}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────
   USAGE METER EXPLAINER CARD
   ─────────────────────────────────────────────── */

function MeterCard({
  label,
  title,
  unit,
  description,
  bullets,
}: {
  label: string;
  title: string;
  unit: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-md)] sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-caption text-[var(--accent)]">{label}</div>
      <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">{title}</h3>
      <div className="mt-1 text-sm font-medium text-[var(--muted)]">Billed per {unit}</div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      <ul className="mt-5 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-sm leading-5 text-[var(--text)]">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────────────────────────
   INTERACTIVE COST ESTIMATOR
   ─────────────────────────────────────────────── */

const estimablePlans = plans.filter((p) => p.estimable);

function Slider({
  label,
  value,
  min,
  max,
  step,
  included,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  included: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const overage = Math.max(0, value - included);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-[var(--text)]">{label}</label>
        <span className="text-sm font-bold text-[var(--text)]">
          {compact(value)} <span className="font-normal text-[var(--muted)]">{unit}/mo</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--card-strong)]"
        style={{ accentColor: "var(--accent)" }}
        aria-label={label}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {compact(included)} included
        </span>
        <span className={cn(overage > 0 ? "text-[var(--accent)]" : "text-[var(--muted)]")}>
          {overage > 0 ? `${compact(overage)} ${unit} overage` : "within plan"}
        </span>
      </div>
    </div>
  );
}

function CostEstimator({ cycle }: { cycle: BillingCycle }) {
  const [planId, setPlanId] = useState("factory");
  const [ocrPages, setOcrPages] = useState(2200);
  const [aiActions, setAiActions] = useState(3000);

  const plan = estimablePlans.find((p) => p.id === planId) ?? estimablePlans[0];

  const calc = useMemo(() => {
    const evalPlan = (p: Plan) => {
      const base = (cycle === "annual" ? p.annualMonthly : p.monthly) ?? 0;
      const ocrOver = Math.max(0, ocrPages - p.ocrIncluded) * p.ocrRate;
      const aiOver = Math.max(0, aiActions - p.aiIncluded) * p.aiRate;
      return { base, ocrOver, aiOver, total: base + ocrOver + aiOver };
    };
    const current = evalPlan(plan);
    // Find the cheapest plan for this exact usage → upgrade nudge
    const best = estimablePlans
      .map((p) => ({ p, ...evalPlan(p) }))
      .sort((a, b) => a.total - b.total)[0];
    return { current, best };
  }, [plan, ocrPages, aiActions, cycle]);

  const showNudge = calc.best.p.id !== plan.id && calc.best.total < calc.current.total;

  return (
    <div className="grid gap-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-md)] sm:p-8 lg:grid-cols-[1.2fr_1fr]">
      {/* Controls */}
      <div className="space-y-7">
        <div>
          <div className="mb-3 text-sm font-semibold text-[var(--text)]">Choose a plan</div>
          <div className="flex flex-wrap gap-2">
            {estimablePlans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                  p.id === planId
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border-strong)] bg-white/[0.02] text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="OCR pages scanned"
          value={ocrPages}
          min={0}
          max={12000}
          step={100}
          included={plan.ocrIncluded}
          unit="pages"
          onChange={setOcrPages}
        />
        <Slider
          label="AI actions run"
          value={aiActions}
          min={0}
          max={20000}
          step={100}
          included={plan.aiIncluded}
          unit="actions"
          onChange={setAiActions}
        />

        <p className="text-xs leading-relaxed text-[var(--muted)]">
          An AI action is one insight, summary, anomaly scan, forecast, or reconciliation. Complex
          or handwritten pages count as 2 OCR pages. Prepaid packs below lower your per-unit rate.
        </p>
      </div>

      {/* Result */}
      <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-soft)] p-6">
        <div className="text-xs font-semibold uppercase tracking-caption text-[var(--muted)]">
          Estimated monthly total
        </div>
        <div className="mt-1 text-4xl font-bold tracking-tight text-[var(--text)]">
          {inr(calc.current.total)}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {plan.name} plan{cycle === "annual" ? " · annual billing" : ""}
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">{plan.name} base</span>
            <span className="font-medium text-[var(--text)]">{inr(calc.current.base)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">OCR overage</span>
            <span className="font-medium text-[var(--text)]">{inr(calc.current.ocrOver)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">AI overage</span>
            <span className="font-medium text-[var(--text)]">{inr(calc.current.aiOver)}</span>
          </div>
          <div className="h-px bg-[var(--border)]" />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text)]">Total</span>
            <span className="font-bold text-[var(--accent)]">{inr(calc.current.total)}</span>
          </div>
        </div>

        {showNudge && (
          <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--accent-quiet)] p-3 text-xs leading-relaxed text-[var(--text)]">
            At this usage, <span className="font-semibold">{calc.best.p.name}</span> would cost{" "}
            <span className="font-semibold text-[var(--accent)]">{inr(calc.best.total)}</span> — you
            save {inr(calc.current.total - calc.best.total)} / month.
          </div>
        )}

        <button
          type="button"
          className="mt-auto w-full rounded-full border border-[var(--accent-strong)] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-semibold text-[#fdf3ea] shadow-[0_14px_30px_rgba(197,109,45,0.32)] transition-all hover:-translate-y-0.5 hover:brightness-110"
          style={{ marginTop: showNudge ? "1.25rem" : "1.5rem" }}
        >
          Start with {plan.name}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   PREPAID PACK CARD
   ─────────────────────────────────────────────── */

function PackCard({
  name,
  qty,
  unit,
  price,
}: {
  name: string;
  qty: number;
  unit: string;
  price: number;
}) {
  const perUnit = price / qty;
  return (
    <div className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-[var(--shadow-md)] transition-all hover:border-[var(--border-strong)]">
      <div className="text-sm font-semibold text-[var(--text)]">{name}</div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">{inr(price)}</div>
      <div className="mt-1 text-sm font-medium text-[var(--accent)]">
        {compact(qty)} {unit}
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">
        ≈ ₹{perUnit.toFixed(2)} / {unit.replace(/s$/, "")}
      </div>
      <button
        type="button"
        className="mt-5 w-full rounded-full border border-[var(--border-strong)] bg-white/[0.02] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent-quiet)]"
      >
        Add pack
      </button>
    </div>
  );
}

/* ───────────────────────────────────────────────
   MAIN
   ─────────────────────────────────────────────── */

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <section className="text-center">
          <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
            Transparent, usage-based pricing
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--text)] text-balance sm:text-5xl lg:text-6xl">
            Pay for a plan. Pay for what you scan and analyse.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)] text-pretty">
            A predictable monthly base plus metered OCR and AI. Every plan includes a generous
            usage allowance — you only pay more when your factory does more.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-5 sm:grid-cols-4">
            <TrustItem icon={<ShieldIcon />} label="No lock-in" sublabel="Cancel anytime" />
            <TrustItem icon={<BoltIcon />} label="Live in 2–3 days" sublabel="Guided setup" />
            <TrustItem icon={<ChartIcon />} label="Usage you control" sublabel="See it before you pay" />
            <TrustItem icon={<LockIcon />} label="Secure hosting" sublabel="AWS Mumbai" />
          </div>
        </section>

        {/* Billing toggle */}
        <div className="mt-12 mb-10">
          <BillingToggle cycle={cycle} onChange={setCycle} />
        </div>

        {/* Plans */}
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} cycle={cycle} />
          ))}
        </section>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          All paid plans include the full workflow suite, role-based access, audit trail, daily
          backups, and a 99.5%+ uptime SLA.
        </p>

        {/* Usage model */}
        <section className="mt-24">
          <div className="mb-10 text-center">
            <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
              How usage billing works
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] text-balance sm:text-4xl">
              Two meters, no surprises
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)] text-pretty">
              OCR and AI are metered separately so you never subsidise capacity you do not use.
              Included allowances scale with your plan; overage is billed only on what you exceed.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <MeterCard
              label="OCR digitisation"
              title="Document scanning"
              unit="processed page"
              description="Turn challans, invoices, gate passes, and handwritten registers into structured data. Cheap engines run first; complex pages escalate to AI extraction."
              bullets={[
                "Every plan includes a monthly page allowance",
                "Overage from ₹2.75–₹5.00 per page by plan",
                "Complex / handwritten pages = 2 pages",
                "Prepaid packs cut the rate to ₹3.00 per page",
              ]}
            />
            <MeterCard
              label="AI intelligence"
              title="AI actions"
              unit="AI action"
              description="Anomaly scans, financial summaries, loss ranking, forecasts, and reconciliations. Priced per action so heavy analytics tenants pay their fair share."
              bullets={[
                "Every plan includes a monthly action pool",
                "Overage from ₹1.50–₹3.00 per action by plan",
                "Batch and scheduled actions are metered the same",
                "Prepaid packs cut the rate to ₹1.00 per action",
              ]}
            />
          </div>
        </section>

        {/* Estimator */}
        <section className="mt-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] text-balance sm:text-3xl">
              Estimate your monthly bill
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)] text-pretty">
              Drag to match your factory&apos;s volume. We&apos;ll show the true monthly cost and flag
              a cheaper plan if one fits better.
            </p>
          </div>
          <CostEstimator cycle={cycle} />
        </section>

        {/* Prepaid packs */}
        <section className="mt-24">
          <div className="mb-10 text-center">
            <div className="text-xs font-semibold uppercase tracking-prominent text-[var(--accent)]">
              Prepaid usage packs
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] text-balance sm:text-4xl">
              Buy ahead, pay less per unit
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)] text-pretty">
              Predictable high volume? Prepay OCR pages or AI actions at a lower rate than overage.
              Packs stack on any plan and roll into the same usage meter.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 text-sm font-semibold uppercase tracking-caption text-[var(--muted)]">
                OCR packs
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {ocrPacks.map((p) => (
                  <PackCard key={p.name} name={p.name} qty={p.pages} unit="pages" price={p.price} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-4 text-sm font-semibold uppercase tracking-caption text-[var(--muted)]">
                AI packs
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {aiPacks.map((p) => (
                  <PackCard key={p.name} name={p.name} qty={p.actions} unit="actions" price={p.price} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Fine print / trust */}
        <section className="mt-20 space-y-2.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] px-6 py-8 shadow-[var(--shadow-md)] sm:px-10">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Usage is metered in real time and shown on your billing dashboard before it is charged.
            You can set hard caps and alert thresholds per meter.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Included allowances reset monthly and do not roll over. Prepaid packs never expire while
            your subscription is active.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Annual plans are billed as 10 months for 12. GST is applied as per Indian tax law.
          </p>
        </section>
      </div>
    </main>
  );
}
