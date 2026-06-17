"use client";

import Link from "next/link";
import { useState } from "react";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22,8 12,14 2,8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 16v2a3 3 0 0 1-3 3h-1a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16v2a3 3 0 0 0 3 3h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3a7 7 0 0 0-7 7v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10a7 7 0 0 0-7-7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="19" y1="10" x2="19" y2="16" strokeLinecap="round" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l7 3v7c0 4.5-3.5 8-7 9-3.5-1-7-4.5-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function HandshakeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l3 5-3 3-3-3 3-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9l-3 5 9 8 9-8-3-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="3" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <polyline points="12 7 12 12 15 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-sky-300/30 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

type ContactCardProps = {
  title: string;
  email: string;
  subtitle: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  border: string;
  badge: string;
  badgeBg: string;
};

function ContactCard({ title, email, subtitle, children, icon, border, badge, badgeBg }: ContactCardProps) {
  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.03] p-6`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${badgeBg} ${badge}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="mt-2 flex items-center">
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 transition hover:text-white"
            >
              <MailIcon />
              {email}
            </a>
            <CopyButton text={email} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          <div className="mt-3 text-sm leading-7 text-slate-300">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.1] text-sky-200">
            <MailIcon />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Get in Touch
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            We&rsquo;re here to help. Choose the best way to reach us below.
          </p>
        </div>

        {/* Quick links bar */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-300 transition hover:border-sky-300/30 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
            </svg>
            FAQ
          </Link>
          <a
            href="https://status.dpr.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-300 transition hover:border-sky-300/30 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            Status Page
          </a>
          <a
            href="https://docs.dpr.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-300 transition hover:border-sky-300/30 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Documentation
          </a>
        </div>

        {/* Contact cards grid */}
        <div className="space-y-5">
          {/* General Support */}
          <ContactCard
            title="General Support"
            email="support@dpr.ai"
            subtitle="Response within 24 hours on business days"
            icon={<HeadsetIcon />}
            border="border-sky-400/20"
            badge="bg-sky-400/[0.1] text-sky-200"
            badgeBg="border-sky-400/20"
          >
            <p>
              <strong className="text-slate-200">Best for:</strong> Technical issues, account help,
              feature questions, onboarding assistance.
            </p>
            <p className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-sky-200">
                <ClockIcon />
                Business hours
              </span>
            </p>
          </ContactCard>

          {/* Sales */}
          <ContactCard
            title="Sales Inquiries"
            email="sales@dpr.ai"
            subtitle="We typically respond within 4 hours"
            icon={<DollarIcon />}
            border="border-emerald-400/20"
            badge="bg-emerald-400/[0.1] text-emerald-200"
            badgeBg="border-emerald-400/20"
          >
            <p>
              <strong className="text-slate-200">Best for:</strong> Product demos, pricing questions,
              enterprise plans, multi-factory deployments.
            </p>
            <a
              href="#"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/[0.14]"
            >
              Schedule a demo
              <ExternalIcon />
            </a>
          </ContactCard>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Legal & Privacy */}
            <ContactCard
              title="Legal &amp; Privacy"
              email="legal@dpr.ai"
              subtitle="Legal inquiries handled within 2 business days"
              icon={<ShieldIcon />}
              border="border-amber-400/20"
              badge="bg-amber-400/[0.1] text-amber-200"
              badgeBg="border-amber-400/20"
            >
              <p>
                <strong className="text-slate-200">Best for:</strong> Privacy requests, data deletion,
                legal inquiries, DPA requests.
              </p>
            </ContactCard>

            {/* Security */}
            <ContactCard
              title="Security &amp; Vulnerabilities"
              email="security@dpr.ai"
              subtitle="For responsible disclosure of security issues"
              icon={<LockIcon />}
              border="border-red-400/20"
              badge="bg-red-400/[0.1] text-red-200"
              badgeBg="border-red-400/20"
            >
              <p>
                <strong className="text-slate-200">Best for:</strong> Security issues, vulnerability
                disclosure, penetration testing inquiries.
              </p>
              <p className="mt-2">
                <Link href="/security" className="text-sm text-sky-300 hover:underline">
                  View our security practices &rarr;
                </Link>
              </p>
            </ContactCard>

            {/* Business & Partnerships */}
            <ContactCard
              title="Business &amp; Partnerships"
              email="hello@dpr.ai"
              subtitle="We reply to partnership inquiries within 3 business days"
              icon={<HandshakeIcon />}
              border="border-purple-400/20"
              badge="bg-purple-400/[0.1] text-purple-200"
              badgeBg="border-purple-400/20"
            >
              <p>
                <strong className="text-slate-200">Best for:</strong> Partnership opportunities,
                media inquiries, integrations.
              </p>
            </ContactCard>

            {/* Billing */}
            <ContactCard
              title="Billing"
              email="billing@dpr.ai"
              subtitle="Payment and invoice questions answered quickly"
              icon={<DollarIcon />}
              border="border-cyan-400/20"
              badge="bg-cyan-400/[0.1] text-cyan-200"
              badgeBg="border-cyan-400/20"
            >
              <p>
                <strong className="text-slate-200">Best for:</strong> Payment issues, invoice
                questions, refund requests, plan changes.
              </p>
            </ContactCard>
          </div>

          {/* Support Hours + Address row */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Support Hours */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                  <ClockIcon />
                </div>
                <h3 className="text-base font-semibold text-white">Support Hours</h3>
              </div>
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-slate-400">Monday &ndash; Friday</span>
                  <span className="font-medium text-white">9:00 AM &ndash; 6:00 PM IST</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-slate-400">Saturday</span>
                  <span className="font-medium text-white">9:00 AM &ndash; 1:00 PM IST</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span className="text-slate-400">Sunday</span>
                  <span className="font-medium text-white">Closed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Emergency (Critical issues)</span>
                  <span className="font-medium text-emerald-300">24/7 for Enterprise SLA</span>
                </div>
              </div>
            </div>

            {/* Mailing Address */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                  <PinIcon />
                </div>
                <h3 className="text-base font-semibold text-white">Mailing Address</h3>
              </div>
              <div className="mt-4 text-sm leading-7 text-slate-300">
                <p className="font-medium text-white">DPR.ai Technologies Pvt. Ltd.</p>
                <p>4th Floor, Tech Tower</p>
                <p>Industrial District</p>
                <p className="flex items-center gap-2">
                  <span>Shillong, Meghalaya 793001, India</span>
                  <CopyButton text="4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India" />
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Support */}
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.1] text-emerald-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-emerald-200">Emergency Support</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Enterprise SLA customers have 24/7 access to our critical incident response team
                  for service outages and data emergencies. If you have an active enterprise plan,
                  contact your account manager for the emergency hotline number.
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  For all other customers, email{" "}
                  <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">support@dpr.ai</a>{" "}
                  with <strong>[URGENT]</strong> in the subject line, and we will prioritize your
                  ticket.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-14 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} DPR.ai Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-sky-300 hover:underline">Privacy Policy</Link>
            <span className="text-white/20">|</span>
            <Link href="/terms" className="text-sky-300 hover:underline">Terms of Service</Link>
            <span className="text-white/20">|</span>
            <Link href="/cookies" className="text-sky-300 hover:underline">Cookie Policy</Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="text-sky-300 hover:underline">Return to DPR.ai</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
