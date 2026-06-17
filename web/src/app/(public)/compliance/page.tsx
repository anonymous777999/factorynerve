"use client";

import Link from "next/link";

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l7 3v7c0 4.5-3.5 8-7 9-3.5-1-7-4.5-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BadgeCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ExternalLink() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const policyLinks = [
  { href: "/privacy", label: "Privacy Policy", desc: "How we collect, use, and protect your personal data" },
  { href: "/terms", label: "Terms of Service", desc: "Rules and conditions governing platform use" },
  { href: "/cookies", label: "Cookie Policy", desc: "How cookies and similar technologies are used" },
  { href: "/refunds", label: "Refund & Cancellation", desc: "Our refund and cancellation terms" },
  { href: "/security", label: "Security", desc: "Infrastructure, encryption, and security practices" },
  { href: "/data-retention", label: "Data Retention", desc: "Data retention schedules and deletion practices" },
  { href: "/sla", label: "Service Level Agreement", desc: "Uptime guarantees and service credits" },
  { href: "/dpa", label: "Data Processing Addendum", desc: "GDPR-compliant data processing terms" },
  { href: "/acceptable-use", label: "Acceptable Use Policy", desc: "Prohibited activities and enforcement" },
  { href: "/subprocessors", label: "Sub-processors", desc: "Third-party data sub-processors we engage" },
];

const roadmapItems = [
  { quarter: "Q3 2026", items: ["SOC 2 Type I audit commencement", "ISO 27001 Stage 1 certification", "Bug bounty program launch"] },
  { quarter: "Q4 2026", items: ["SOC 2 Type I report delivery", "ISO 27001 certification completion", "HIPAA readiness assessment"] },
  { quarter: "Q1 2027", items: ["SOC 2 Type II audit initiation", "PCI DSS self-assessment", "Data residency expansion — EU region"] },
  { quarter: "Q2 2027", items: ["SOC 2 Type II report", "ISO 27701 (PIMS) certification", "FedRAMP readiness assessment"] },
];

export default function CompliancePage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-8 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Trust Center</h1>
              <p className="mt-1 text-sm text-slate-400">Last updated: June 17, 2026</p>
            </div>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-300">
            At DPR.ai, trust is the foundation of everything we build. We maintain industry-standard
            certifications, follow regulatory frameworks, and continuously invest in the security
            and privacy of your data. This Trust Center provides a single source of truth for our
            compliance posture, certifications, and policies.
          </p>
        </div>

        {/* Badges grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "SOC 2", sub: "Type I — In Progress", status: "audit", color: "text-amber-300 border-amber-500/20 bg-amber-500/5" },
            { label: "ISO 27001", sub: "Certification — In Progress", status: "audit", color: "text-amber-300 border-amber-500/20 bg-amber-500/5" },
            { label: "GDPR", sub: "Compliant", status: "active", color: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5" },
            { label: "DPA", sub: "Available on request", status: "active", color: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5" },
          ].map((badge) => (
            <div key={badge.label} className={`rounded-xl border ${badge.color} p-4`}>
              <BadgeCheck />
              <div className="mt-3 text-sm font-semibold text-white">{badge.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{badge.sub}</div>
            </div>
          ))}
        </div>

        {/* Policy Quick Links */}
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-10">
          <h2 className="mb-6 text-xl font-semibold tracking-[-0.02em] text-white">Policies & Legal Documents</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-sky-300/20 hover:bg-white/[0.04]">
                <span className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-sky-300">
                  <ArrowRight />
                </span>
                <div>
                  <div className="text-sm font-medium text-white transition group-hover:text-sky-200">{link.label}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{link.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Compliance Roadmap */}
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-10">
          <h2 className="mb-2 text-xl font-semibold tracking-[-0.02em] text-white">Compliance Roadmap</h2>
          <p className="mb-6 text-sm text-slate-400">Our planned certifications and audit milestones.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {roadmapItems.map((r) => (
              <div key={r.quarter} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">{r.quarter}</div>
                <ul className="mt-3 space-y-2">
                  {r.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Resources */}
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-10">
          <h2 className="mb-6 text-xl font-semibold tracking-[-0.02em] text-white">Additional Resources</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { title: "Report a Vulnerability", desc: "Submit security concerns to our team", href: "mailto:security@dpr.ai" },
              { title: "Request a DPA", desc: "Execute our Data Processing Addendum", href: "mailto:dpo@dpr.ai" },
              { title: "Data Subject Request", desc: "Exercise your GDPR privacy rights", href: "mailto:privacy@dpr.ai" },
              { title: "Security Questionnaire", desc: "Access our security documentation", href: "mailto:security@dpr.ai" },
            ].map((resource) => (
              <a key={resource.title} href={resource.href} className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-sky-300/20 hover:bg-white/[0.04]">
                <span className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-sky-300">
                  <ExternalLink />
                </span>
                <div>
                  <div className="text-sm font-medium text-white transition group-hover:text-sky-200">{resource.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{resource.desc}</div>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-slate-400">
            Questions about our compliance posture? Email{" "}
            <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a>{" "}
            or contact your account manager.
          </div>
        </div>
      </div>
    </main>
  );
}
