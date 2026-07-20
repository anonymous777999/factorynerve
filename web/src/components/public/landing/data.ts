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
  { value: "Zero lock-in", label: "Your data stays yours. Export anytime." },
  { value: "2–3", suffix: " days", label: "To go live with your factory" },
  { value: "14", suffix: " days", label: "Free pilot — no card required" },
  { value: "Mobile-first", label: "Works on the phone your team already has" },
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
    id: "intelligence",
    title: "Intelligence Engine",
    tagline: "Find loss before it finds you",
    description: "Anomaly detection, AI summaries, risk ranking, and responsibility analytics highlight where money is at risk and what deserves attention first.",
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
    period: "",
    tagline: "Full access. Your real data. No time limit during pilot.",
    features: ["Up to 7 users", "1 factory workspace", "OCR scanning & extraction", "Attendance tracking", "Production reporting", "Inventory & dispatch tracking", "AI-powered insights", "WhatsApp alerts", "Personal onboarding support"],
    cta: "Start your pilot",
    highlight: true,
  },
];

export const faqs: FAQ[] = [
  {
    question: "How fast can we get started?",
    answer: "We can set you up in a single session. Share your factory details, we configure your workspace, invite your team, and you start capturing data immediately — often the same day.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Infrastructure runs on AWS Mumbai. Access is role-based — you control who sees what.",
  },
  {
    question: "Does it work without internet?",
    answer: "Yes. The mobile app works offline — entries are queued locally and sync automatically when connectivity returns. Your team never stops working.",
  },
  {
    question: "We already have existing data in registers. Can we start fresh?",
    answer: "Absolutely. You can start fresh from today, or we can help you digitize historical records through OCR scanning. Most factories go live with current data first.",
  },
  {
    question: "What happens after the pilot?",
    answer: "You keep using the product. We'll discuss a plan that fits your factory size and usage. There's no lock-in — your data stays yours, and you can export it anytime.",
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
