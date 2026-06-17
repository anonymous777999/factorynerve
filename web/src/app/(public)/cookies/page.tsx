"use client";

import Link from "next/link";

function CookieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="14" cy="8" r="1" fill="currentColor" />
      <circle cx="10" cy="15" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
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

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
      <line x1="4" y1="12" x2="14" y2="12" strokeLinecap="round" />
      <line x1="4" y1="18" x2="18" y2="18" strokeLinecap="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" />
      <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      <circle cx="21" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="12 7 12 12 15 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

function Section({ id, title, children, icon }: { id: string; title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] text-white">
        {icon && <span className="text-sky-300">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-sm leading-7 text-slate-300">{children}</div>;
}

function CookieTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-white/5 px-4 py-3 text-slate-300">{children}</td>;
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "green" | "amber" | "blue" | "slate" }) {
  const colors = {
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    amber: "bg-amber-400/10 text-amber-200 border-amber-400/20",
    blue: "bg-sky-400/10 text-sky-200 border-sky-400/20",
    slate: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${colors[variant]}`}>
      {children}
    </span>
  );
}

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.1] text-amber-200">
                <CookieIcon />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Cookie Policy
                </h1>
                <p className="mt-1 text-sm text-slate-400">Last updated: June 17, 2026</p>
              </div>
            </div>
          </div>
        </div>

        {/* Intro block */}
        <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm leading-7 text-slate-300">
            This Cookie Policy explains what cookies are, which ones DPR.ai uses, and how you can
            control them. We believe in being straightforward about data &mdash; no hidden trackers,
            no unnecessary profiling. If you have questions after reading this, reach out to{" "}
            <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">privacy@dpr.ai</a>.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            In this policy
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "what-are-cookies", label: "1. What Are Cookies?" },
              { id: "cookies-we-use", label: "2. Cookies We Use" },
              { id: "cookie-table", label: "3. Cookie Reference Table" },
              { id: "duration", label: "4. How Long Do Cookies Last?" },
              { id: "control", label: "5. How to Control Cookies" },
              { id: "changes", label: "6. Changes to This Policy" },
              { id: "contact", label: "7. Contact Us" },
            ].map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-sm text-slate-300 transition-colors hover:text-white hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. What Are Cookies */}
        <Section id="what-are-cookies" title="1. What Are Cookies?" icon={<CookieIcon />}>
          <Body>
            <p>
              Cookies are small text files that websites store on your browser or device when you visit.
              Think of them as a short-term memory for the web &mdash; they help a site remember who you
              are, what preferences you have, and whether you&rsquo;ve been there before.
            </p>
            <p>
              Cookies can&rsquo;t run programs, deliver viruses, or access your hard drive. They&rsquo;re
              just text files, and you can delete or block them at any time (more on that in Section 5).
            </p>
            <p>
              We also use similar technologies like local storage and session storage for the same
              purposes. For simplicity, we refer to all of these as &ldquo;cookies&rdquo; in this policy.
            </p>
          </Body>
        </Section>

        {/* 2. Cookies We Use */}
        <Section id="cookies-we-use" title="2. Cookies We Use" icon={<SlidersIcon />}>
          <Body>
            <p>
              We group cookies into four categories based on what they do. Some are essential for the
              platform to work at all; others make your experience better but aren&rsquo;t strictly
              necessary.
            </p>

            {/* Strictly Necessary */}
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.1] text-emerald-300">
                  <ShieldIcon />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-emerald-200">Strictly Necessary Cookies</h3>
                    <Badge variant="green">Always active</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    These cookies are essential for the platform to function. Without them, you
                    couldn&rsquo;t log in, navigate between pages, or keep your session secure. They
                    are automatically set when you use DPR.ai and cannot be disabled.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                      Authentication tokens that verify your identity
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                      Session management to keep you logged in
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                      Security tokens to prevent CSRF attacks
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                      Load balancing cookies to route your requests correctly
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Functional */}
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/[0.1] text-sky-200">
                  <GearIcon />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-sky-200">Functional Cookies</h3>
                    <Badge variant="blue">Optional</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    These cookies remember your preferences so the platform feels tailored to you.
                    They&rsquo;re not essential, but they make your experience better.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60" />
                      Language preference (e.g., English, Hindi)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60" />
                      UI theme and layout preferences
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60" />
                      Dashboard widget configuration
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60" />
                      Sidebar collapsed/expanded state
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.1] text-amber-200">
                  <ClockIcon />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-amber-200">Analytics Cookies</h3>
                    <Badge variant="amber">Optional</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    These help us understand how people use DPR.ai &mdash; which features are popular,
                    where users get stuck, and how we can improve. The data is anonymized and never
                    tied to individual identities.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                      Page views and feature usage statistics (PostHog)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                      Performance monitoring and error tracking (Sentry)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                      Session replays for UX improvement (PostHog)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
                      Feature adoption and flow analysis
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Third-Party */}
            <div className="mt-4 rounded-xl border border-slate-400/20 bg-slate-400/[0.05] p-5">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-400/20 bg-slate-400/[0.1] text-slate-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8M12 8v8" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-200">Third-Party Cookies</h3>
                    <Badge variant="slate">Optional / Integration-dependent</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    These are set by services we integrate with, such as payment gateways or embedded
                    tools. They only appear if the relevant feature is used and are governed by the
                    third party&rsquo;s own cookie policies.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/60" />
                      Payment processing cookies (Stripe / Razorpay)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400/60" />
                      Embedded help widget or chat
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Body>
        </Section>

        {/* 3. Cookie Reference Table */}
        <Section id="cookie-table" title="3. Cookie Reference Table" icon={<ClockIcon />}>
          <Body>
            <p>
              Here is the full list of cookies we set on DPR.ai, organized by name. We review and
              update this table regularly.
            </p>

            <CookieTable>
              <thead>
                <tr>
                  <Th>Cookie Name</Th>
                  <Th>Purpose</Th>
                  <Th>Type</Th>
                  <Th>Duration</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_session</span></Td>
                  <Td>Session token to keep you logged in</Td>
                  <Td><Badge variant="green">Necessary</Badge></Td>
                  <Td>Session</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_auth</span></Td>
                  <Td>Authentication token for API requests</Td>
                  <Td><Badge variant="green">Necessary</Badge></Td>
                  <Td>7 days (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_csrf</span></Td>
                  <Td>CSRF protection token</Td>
                  <Td><Badge variant="green">Necessary</Badge></Td>
                  <Td>Session</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_lb</span></Td>
                  <Td>Load balancing affinity</Td>
                  <Td><Badge variant="green">Necessary</Badge></Td>
                  <Td>Session</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_lang</span></Td>
                  <Td>Language preference</Td>
                  <Td><Badge variant="blue">Functional</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_theme</span></Td>
                  <Td>UI theme preference</Td>
                  <Td><Badge variant="blue">Functional</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_sidebar</span></Td>
                  <Td>Sidebar collapsed/expanded state</Td>
                  <Td><Badge variant="blue">Functional</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_factory</span></Td>
                  <Td>Last selected factory</Td>
                  <Td><Badge variant="blue">Functional</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">dpr_consent</span></Td>
                  <Td>Cookie consent preference record</Td>
                  <Td><Badge variant="green">Necessary</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">ph_*</span></Td>
                  <Td>Product analytics (PostHog)</Td>
                  <Td><Badge variant="amber">Analytics</Badge></Td>
                  <Td>1 year (persistent)</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">sentry_*</span></Td>
                  <Td>Error monitoring (Sentry)</Td>
                  <Td><Badge variant="amber">Analytics</Badge></Td>
                  <Td>Session</Td>
                </tr>
                <tr>
                  <Td><span className="font-mono text-xs">__stripe_*</span></Td>
                  <Td>Payment session (Stripe)</Td>
                  <Td><Badge variant="slate">Third-Party</Badge></Td>
                  <Td>Session</Td>
                </tr>
              </tbody>
            </CookieTable>
          </Body>
        </Section>

        {/* 4. Cookie Duration */}
        <Section id="duration" title="4. How Long Do Cookies Last?" icon={<ClockIcon />}>
          <Body>
            <p>
              Cookies on DPR.ai fall into two lifespan categories:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">Session Cookies</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  These are temporary and last only until you close your browser. They help us
                  remember what you did during a single visit. Once you close the tab or browser,
                  they&rsquo;re gone.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Examples: <span className="font-mono">dpr_session</span>,{" "}
                  <span className="font-mono">dpr_csrf</span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">Persistent Cookies</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  These stay on your device for a set period (or until you delete them). They
                  remember your preferences across visits so you don&rsquo;t have to set them
                  again each time.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Examples: <span className="font-mono">dpr_auth</span> (7 days),{" "}
                  <span className="font-mono">dpr_lang</span> (1 year)
                </p>
              </div>
            </div>

            <p>
              Specific retention periods for each cookie are listed in the reference table above.
              We never set cookies with expiration periods longer than 1 year.
            </p>
          </Body>
        </Section>

        {/* 5. How to Control Cookies */}
        <Section id="control" title="5. How to Control Cookies" icon={<GearIcon />}>
          <Body>
            <p>
              You have full control over which cookies are stored on your device. There are two
              ways to manage them:
            </p>

            <div>
              <h3 className="text-base font-semibold text-white">A. DPR.ai Cookie Preference Center</h3>
              <p>
                When you first visit DPR.ai, a cookie consent banner appears giving you the choice
                to accept or decline non-essential cookies (functional and analytics). You can change
                your preferences at any time by clicking the &ldquo;Cookie Settings&rdquo; link in the
                platform footer or by reopening the consent banner.
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-slate-300">
                  <strong>What happens if you disable cookies?</strong> Strictly necessary cookies
                  cannot be disabled &mdash; they&rsquo;re required for the platform to work. If you
                  block functional cookies, your preferences won&rsquo;t be remembered (you&rsquo;ll
                  need to set them each visit). Blocking analytics cookies won&rsquo;t affect
                  functionality at all.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">B. Browser Settings</h3>
              <p>
                You can also control cookies directly from your browser settings. Most browsers let
                you view, block, or delete cookies for individual sites. Here are guides for the
                most popular browsers:
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Google Chrome guide
                  <span className="ml-auto text-xs text-slate-500">&rarr;</span>
                </a>
                <a
                  href="https://support.mozilla.org/en-US/kb/delete-cookies-remove-info-websites-stored"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Firefox guide
                  <span className="ml-auto text-xs text-slate-500">&rarr;</span>
                </a>
                <a
                  href="https://support.apple.com/en-in/guide/safari/sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Safari guide
                  <span className="ml-auto text-xs text-slate-500">&rarr;</span>
                </a>
                <a
                  href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Edge guide
                  <span className="ml-auto text-xs text-slate-500">&rarr;</span>
                </a>
              </div>
            </div>
          </Body>
        </Section>

        {/* 6. Changes */}
        <Section id="changes" title="6. Changes to This Policy" icon={<GearIcon />}>
          <Body>
            <p>
              We may update this Cookie Policy to reflect changes in the cookies we use, new legal
              requirements, or product updates. If we make material changes, we&rsquo;ll let you know
              through the platform or via email.
            </p>
            <p>
              Check the &ldquo;Last updated&rdquo; date at the top of this page to see when it was
              last reviewed. Continued use of DPR.ai after changes take effect means you accept the
              updated policy.
            </p>
          </Body>
        </Section>

        {/* 7. Contact */}
        <Section id="contact" title="7. Contact Us" icon={<CookieIcon />}>
          <Body>
            <p>
              If you have questions about this Cookie Policy or how we use cookies, reach out to us:
            </p>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Email:</strong>{" "}
                <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">
                  privacy@dpr.ai
                </a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Postal:</strong> DPR.ai Technologies Pvt. Ltd.,
                4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India
              </p>
            </div>

            <p className="text-xs text-slate-500">
              For full details on how we process personal data, see our{" "}
              <Link href="/privacy" className="text-sky-300 hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </Body>
        </Section>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} DPR.ai Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-sky-300 hover:underline">
              Privacy Policy
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/terms" className="text-sky-300 hover:underline">
              Terms of Service
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="text-sky-300 hover:underline">
              Return to DPR.ai
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
