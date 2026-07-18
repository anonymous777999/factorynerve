"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown as ChevronDownIcon,
  Search,
  HelpCircle as HelpCircleIcon,
  ShieldCheck,
  Aperture,
  CreditCard,
  Bell,
  Mail,
} from "lucide-react";

function ChevronDown({ open }: { open: boolean }) {
  return (
    <ChevronDownIcon className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} strokeWidth={2} />
  );
}

function SearchIcon() {
  return <Search className="h-4 w-4 shrink-0" strokeWidth={2} />;
}

function HelpCircle() {
  return <HelpCircleIcon className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={1.8} />;
}

function AccordionItem({ question, answer, open, onToggle }: { question: string; answer: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-medium text-slate-200 transition hover:text-white"
      >
        <span>{question}</span>
        <ChevronDown open={open} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-4 pb-4 text-sm leading-7 text-slate-400">{answer}</div>
      </div>
    </div>
  );
}

function CategorySection({ title, icon, faqs }: { title: string; icon: React.ReactNode; faqs: Array<{ q: string; a: React.ReactNode }> }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        {icon}
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            question={faq.q}
            answer={faq.a}
            open={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState("");

  const categories = [
    {
      title: "Getting Started",
      icon: <HelpCircle />,
      faqs: [
        { q: "What is DPR.ai?", a: "DPR.ai is a B2B SaaS platform for manufacturing operations. It helps factories manage daily production reports, track quality metrics, monitor machine efficiency, and digitize their shop-floor workflows." },
        { q: "How do I create an account?", a: "Visit the registration page and sign up with your work email. You will receive a verification email. Once verified, you can set up your factory profile and invite team members." },
        { q: "Is there a free trial?", a: "We offer a 14-day free trial for new customers with full access to all features. No credit card is required during the trial period." },
        { q: "How do I invite my team?", a: "From your workspace settings, navigate to \"Team Members\" and use the invite option. You can invite users by email and assign roles (Admin, Editor, Viewer)." },
        { q: "What browsers are supported?", a: "We support the latest two major versions of Chrome, Firefox, Safari, and Edge." },
      ],
    },
    {
      title: "Security & Compliance",
      icon: (
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" strokeWidth={1.8} />
      ),
      faqs: [
        { q: "How is my data protected?", a: <span>All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Our infrastructure runs on AWS in the Mumbai region. See our <Link href="/security" className="text-[var(--accent)] hover:underline">Security page</Link> for full details.</span> },
        { q: "Does DPR.ai have SOC 2 certification?", a: "SOC 2 Type I audit is currently in progress, with completion expected in Q3 2026. Type II will follow in Q1 2027. We maintain rigorous security controls aligned with SOC 2 criteria." },
        { q: "Is DPR.ai GDPR compliant?", a: "Yes. We have GDPR-compliant data processing terms available through our Data Processing Addendum (DPA). Data is processed in accordance with GDPR requirements, and we support Data Subject Access Requests." },
        { q: "Where is my data stored?", a: "Primary data storage is in AWS Mumbai (ap-south-1). Cache and CDN data may be processed on Cloudflare's global edge network. No customer data is stored outside India without explicit contractual agreement." },
        { q: "How do you handle security incidents?", a: "We have a NIST-aligned Incident Response Plan with defined severity levels. Critical incidents are escalated within 15 minutes. We commit to notifying affected customers within 24 hours of confirmed breaches." },
        { q: "Can I get a copy of your DPA?", a: <span>Yes. You can request our DPA by emailing <a href="mailto:dpo@dpr.ai" className="text-[var(--accent)] hover:underline">dpo@dpr.ai</a> or view it on our <Link href="/dpa" className="text-[var(--accent)] hover:underline">DPA page</Link>.</span> },
      ],
    },
    {
      title: "Data & Privacy",
      icon: (
        <Aperture className="h-5 w-5 shrink-0 text-violet-300" strokeWidth={1.8} />
      ),
      faqs: [
        { q: "What personal data does DPR.ai collect?", a: <span>We collect account information (name, email, company), usage data (logins, features used), and production data you upload. See our <Link href="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</Link> for the full list.</span> },
        { q: "How long do you retain my data?", a: <span>Retention periods vary by data category. Account data is retained for the duration of your subscription plus 60 days. See our <Link href="/data-retention" className="text-[var(--accent)] hover:underline">Data Retention Policy</Link> for detailed schedules.</span> },
        { q: "Can I export my data?", a: "Yes. You can export your data at any time in CSV, XLSX, or JSON formats. After account cancellation, data is available for export for 60 days." },
        { q: "Do you sell my personal data?", a: "No. We never sell personal data. Data is processed solely to provide and improve our Platform services." },
        { q: "How do I delete my account?", a: "Account deletion requests can be submitted through workspace settings or by contacting support@dpr.ai. We will process the deletion within 30 days, subject to legal retention obligations." },
        { q: "What are my privacy rights?", a: <span>Depending on your jurisdiction, you may have rights including access, rectification, erasure, portability, and objection. See our <Link href="/privacy#rights" className="text-[var(--accent)] hover:underline">Privacy Rights section</Link> for more information.</span> },
      ],
    },
    {
      title: "Billing & Plans",
      icon: (
        <CreditCard className="h-5 w-5 shrink-0 text-amber-300" strokeWidth={1.8} />
      ),
      faqs: [
        { q: "What plans do you offer?", a: "We offer Monthly and Annual subscription plans. The Annual plan includes a discount and additional features. Contact our sales team for enterprise pricing." },
        { q: "Can I switch from monthly to annual?", a: "Yes. You can upgrade from Monthly to Annual at any time. The prorated amount will be applied to your new billing cycle." },
        { q: "What payment methods do you accept?", a: "We accept major credit cards (Visa, Mastercard, Amex), UPI, and bank transfers for annual plans. All payments are processed securely through Stripe." },
        { q: "How does the refund policy work?", a: <span>Monthly subscriptions are non-refundable. Annual subscriptions are eligible for a prorated refund within 30 days of renewal. New customers have a 14-day satisfaction guarantee. See our <Link href="/refunds" className="text-[var(--accent)] hover:underline">Refund Policy</Link> for details.</span> },
        { q: "Do you offer discounts for non-profits?", a: "Yes, we offer discounted pricing for registered non-profit organizations and educational institutions. Contact our sales team for more information." },
      ],
    },
    {
      title: "Platform & Support",
      icon: (
        <Bell className="h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={1.8} />
      ),
      faqs: [
        { q: "What is your uptime guarantee?", a: <span>We guarantee 99.5% monthly uptime for the Platform. See our <Link href="/sla" className="text-[var(--accent)] hover:underline">Service Level Agreement</Link> for details on service credits and exclusions.</span> },
        { q: "How do I get support?", a: <span>Email <a href="mailto:support@dpr.ai" className="text-[var(--accent)] hover:underline">support@dpr.ai</a> for standard support. Enterprise customers have access to 24/7 priority support with a 2-hour response time for critical issues.</span> },
        { q: "Is there a status page?", a: "Yes. Visit status.dpr.ai for real-time platform status, incident history, and scheduled maintenance notifications." },
        { q: "Do you have an API?", a: "Yes. We provide a RESTful API with comprehensive documentation. API keys can be generated from your workspace settings. Rate limits apply based on your plan." },
        { q: "How do I report a bug?", a: "Report bugs through the in-app feedback tool or email support@dpr.ai. Critical security vulnerabilities should be reported to security@dpr.ai." },
        { q: "Do you offer onboarding assistance?", a: "Yes. All plans include self-service onboarding with guides and tutorials. Enterprise plans include dedicated onboarding assistance from our customer success team." },
      ],
    },
  ];

  const filtered = search.trim()
    ? categories.map((cat) => ({
        ...cat,
        faqs: cat.faqs.filter((f) => f.q.toLowerCase().includes(search.toLowerCase())),
      })).filter((cat) => cat.faqs.length > 0)
    : categories;

  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">FAQ</h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: June 17, 2026</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Find answers to common questions about DPR.ai, our platform, security, data practices, and support.
          </p>

          {/* Search */}
          <div className="relative mt-6">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[var(--accent-soft)] focus:bg-white/[0.06]"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {filtered.map((cat) => (
            <CategorySection key={cat.title} title={cat.title} icon={cat.icon} faqs={cat.faqs} />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-400">
              No results found for &ldquo;{search}&rdquo;. Try a different search term or browse the categories above.
            </div>
          )}
        </div>

        {/* Still have questions */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 text-center shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-8">
          <h2 className="text-base font-semibold text-white">Still have questions?</h2>
          <p className="mt-2 text-sm text-slate-400">
            We are here to help. Reach out to our team and we will get back to you promptly.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <a href="mailto:support@dpr.ai" className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">
              <Mail className="h-4 w-4" strokeWidth={2} />
              support@dpr.ai
            </a>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white">
              Contact Page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
