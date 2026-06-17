import type { NavItem, Stat, PainPoint, Engine, Persona, FAQ } from "./types";

export const navItems: NavItem[] = [
  { id: "problem", label: "Problem" },
  { id: "engines", label: "Capabilities" },
  { id: "roles", label: "For Your Role" },
  { id: "how-it-works", label: "How It Works" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export const stats: Stat[] = [
  { value: "45,000+", label: "Hours of production data processed" },
  { value: "₹280", suffix: "Cr+", label: "Dispatch value tracked" },
  { value: "99.9", suffix: "%", label: "Platform uptime" },
  { value: "14", suffix: " days", label: "Free trial — no card required" },
];

export const painPoints: PainPoint[] = [
  {
    title: "Paper registers vanish",
    description: "Daily production reports get lost, damaged, or buried in stacks. By the time you need them, the data is gone.",
    icon: "file",
  },
  {
    title: "WhatsApp data is scattered",
    description: "Photos, voice notes, and messages across multiple groups. No structure, no audit trail, no single source of truth.",
    icon: "message",
  },
  {
    title: "Decisions arrive too late",
    description: "Approvals get stuck. Reports take days to compile. By the time you see a problem, it has already cost you.",
    icon: "clock",
  },
];

export const engines: Engine[] = [
  {
    id: "capture",
    title: "Capture Engine",
    tagline: "Turn paper into data in seconds",
    description: "Mobile camera scan, gallery upload, and OCR extraction transform handwritten registers and printed documents into structured digital records with confidence scoring.",
  },
  {
    id: "execution",
    title: "Daily Execution Engine",
    tagline: "Run the factory floor, not spreadsheets",
    description: "Today Board, Work Queue, attendance punch-in/out, shift entry, and offline draft queue — everything your team needs to log the day without leaving the floor.",
  },
  {
    id: "trust",
    title: "Trust Engine",
    tagline: "Make data safe to act on",
    description: "Verification drafts, approve/reject flows, bulk review, SLA aging lanes, and a full audit trail ensure every number is reliable before it reaches a report.",
  },
  {
    id: "reporting",
    title: "Reporting Engine",
    tagline: "From trusted data to business output",
    description: "Excel and PDF exports, scheduled email summaries, attendance reports, and custom operational dashboards that turn clean data into actionable insights.",
  },
  {
    id: "intelligence",
    title: "Intelligence Engine",
    tagline: "Find loss before it finds you",
    description: "Anomaly detection, AI summaries, risk ranking, and responsibility analytics highlight where money is at risk and what deserves attention first.",
  },
  {
    id: "steel",
    title: "Steel Operations Engine",
    tagline: "Weight, batch, dispatch — end to end",
    description: "Stock reconciliation, batch production tracking, customer ledger, sales invoices, and dispatch workflow from planned to delivered.",
  },
  {
    id: "platform",
    title: "Platform & Control Engine",
    tagline: "Secure, scalable, multi-plant",
    description: "RBAC with 7 roles, factory switching, multi-language support, WhatsApp alerts, usage quotas, and enterprise-grade security keep the platform running.",
  },
];

export const personas: Persona[] = [
  {
    role: "Owner",
    headline: "See where money is at risk",
    value: "Multi-plant overview, anomaly alerts, risk ranking by financial impact, and an owner desk that surfaces what needs attention — not just what happened.",
    icon: "user",
  },
  {
    role: "Manager",
    headline: "Stop chasing paper",
    value: "Real-time dashboards, bottleneck detection, dispatch tracking, and role-based views that let you manage without walking the floor every hour.",
    icon: "users",
  },
  {
    role: "Supervisor",
    headline: "Clean handovers, every shift",
    value: "Quick review queues, attendance verification, bulk approve/reject for OCR and stock, and SLA aging so nothing falls through the gap between shifts.",
    icon: "clipboard",
  },
  {
    role: "Operator",
    headline: "Works on your phone, not a manual",
    value: "Mobile-first punch in/out, camera-based DPR entry, offline queue that syncs when connected, and a work queue that tells you what to do next.",
    icon: "smartphone",
  },
];

export const pricingTiers = [
  {
    name: "Factory Pilot",
    price: "₹0",
    period: "/ 14 days",
    tagline: "Use everything. Test real workflows.",
    features: ["Up to 7 users", "1 workspace", "150 OCR pages", "100 AI actions", "WhatsApp alerts"],
    cta: "Start free trial",
  },
  {
    name: "Factory",
    price: "₹8,999",
    period: "/ month",
    tagline: "Best for growing factories with multiple shifts.",
    features: ["Up to 30 users", "Up to 3 workspaces", "1,200 AI actions", "Automated approvals", "Advanced dashboards", "Priority support"],
    cta: "Activate Factory",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For industrial groups and multi-plant operations.",
    features: ["Unlimited users", "Up to 20 workspaces", "Dedicated account manager", "Custom integrations", "99.95% uptime SLA", "On-premise option"],
    cta: "Talk to sales",
  },
];

export const faqs: FAQ[] = [
  {
    question: "How fast can we get started?",
    answer: "Most factories go live in 2–3 days. Onboarding takes a single session — we set up your factory profile, invite your team, and you start capturing data immediately.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Infrastructure runs on AWS Mumbai. We follow SOC 2 controls and have a GDPR-compliant Data Processing Addendum available.",
  },
  {
    question: "Does it work without internet?",
    answer: "Yes. The mobile app works offline — entries are queued locally and sync automatically when connectivity returns. Your team never stops working.",
  },
  {
    question: "Can I integrate DPR.ai with my existing systems?",
    answer: "We offer a REST API for custom integrations. Our Enterprise plan includes dedicated support for connecting with your existing ERP, accounting, or inventory systems.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer: "Yes. Annual plans save 17% compared to monthly billing. All plans are available monthly or annually with no long-term lock-in.",
  },
];

export const sectionIds = {
  problem: "problem",
  engines: "engines",
  roles: "roles",
  howItWorks: "how-it-works",
  pricing: "pricing",
  faq: "faq",
} as const;

export const COMPANY_NAME = "DPR.ai Technologies Pvt. Ltd.";
