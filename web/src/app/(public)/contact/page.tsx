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
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, send the form data to the backend
    console.log("Contact form submitted:", formData);
    setSubmitted(true);
    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.1] text-sky-200">
            <MailIcon />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Get in Touch
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            We&rsquo;re here to help. Fill out the form below or choose a contact channel.
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
          <span className="text-xs text-white/10">&middot;</span>
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-slate-300 transition hover:border-sky-300/30 hover:text-white"
          >
            <DollarIcon />
            Pricing
          </Link>
        </div>

        {/* Contact Form + Info Grid */}
        <div className="mb-10 grid gap-8 lg:grid-cols-5">
          {/* Contact Form */}
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-8 lg:col-span-3">
            <h2 className="text-xl font-semibold tracking-tight text-white">Send us a message</h2>
            <p className="mt-1 text-sm text-slate-400">
              Fill in the details and we&rsquo;ll get back to you within 24 hours.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.1] text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-emerald-200">Message Sent!</h3>
                <p className="mt-2 text-sm text-slate-400">Thank you for reaching out. We&rsquo;ll respond shortly.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-caption text-slate-400">
                      Name *
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-sky-400/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-caption text-slate-400">
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@factory.com"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-sky-400/20"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-caption text-slate-400">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-sky-400/20"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-xs font-semibold uppercase tracking-caption text-slate-400">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us how we can help..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-400/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-sky-400/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-[linear-gradient(135deg,rgba(197,109,45,0.9),rgba(197,109,45,0.6))] px-6 py-3 text-sm font-semibold text-[#06111c] shadow-[0_8px_20px_rgba(197,109,45,0.25)] transition hover:brightness-110 hover:shadow-[0_12px_28px_rgba(197,109,45,0.35)]"
                >
                  Send Message
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>
            )}
          </div>

          {/* Contact Cards Sidebar */}
          <div className="space-y-4 lg:col-span-2">
            {/* General Support */}
            <ContactCard
              title="General Support"
              email="support@factorynerve.online"
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
            </ContactCard>

            {/* Sales */}
            <ContactCard
              title="Sales Inquiries"
              email="sales@factorynerve.online"
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

            {/* Support Hours */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                  <ClockIcon />
                </div>
                <h3 className="text-sm font-semibold text-white">Support Hours</h3>
              </div>
              <div className="mt-3 space-y-1 text-xs leading-6 text-slate-400">
                <div className="flex justify-between">
                  <span>Mon &ndash; Fri</span>
                  <span className="text-white">9:00 AM &ndash; 6:00 PM IST</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday</span>
                  <span className="text-white">9:00 AM &ndash; 1:00 PM IST</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday</span>
                  <span className="text-white">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Contact Cards Grid */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {/* Legal & Privacy */}
          <ContactCard
            title="Legal &amp; Privacy"
            email="legal@factorynerve.online"
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
            email="security@factorynerve.online"
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
          </ContactCard>

          {/* Business & Partnerships */}
          <ContactCard
            title="Business &amp; Partnerships"
            email="hello@factorynerve.online"
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
            email="billing@factorynerve.online"
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

        {/* Mailing Address + Emergency Support */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                <PinIcon />
              </div>
              <h3 className="text-base font-semibold text-white">Mailing Address</h3>
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Factory Nerve Technologies Pvt. Ltd.</p>
              <p>4th Floor, Tech Tower</p>
              <p>Industrial District</p>
              <p className="flex items-center gap-2">
                <span>Shillong, Meghalaya 793001, India</span>
                <CopyButton text="4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India" />
              </p>
            </div>
          </div>

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
                  Enterprise SLA customers have 24/7 access to our critical incident response team.
                  For all other customers, email{" "}
                  <a href="mailto:support@factorynerve.online" className="text-sky-300 hover:underline">support@factorynerve.online</a>{" "}
                  with <strong>[URGENT]</strong> in the subject line.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} Factory Nerve Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1 flex items-center justify-center gap-4">
            <Link href="/" className="text-sky-300 hover:underline">Return to Factory Nerve</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
