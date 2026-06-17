"use client";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">{title}</h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-sm leading-7 text-slate-300">{children}</div>;
}

function DataTable({ children }: { children: React.ReactNode }) {
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

const subprocessors = [
  { name: "Amazon Web Services (AWS)", jurisdiction: "India (ap-south-1)", service: "Cloud infrastructure (compute, storage, networking)", data: "All customer data at rest", engagement: "2019" },
  { name: "Microsoft Azure OpenAI", jurisdiction: "United States", service: "AI/ML inference APIs", data: "Processed content (no training retention)", engagement: "2023" },
  { name: "PostgreSQL (via AWS RDS)", jurisdiction: "India (ap-south-1)", service: "Relational database hosting", data: "Structured customer data", engagement: "2019" },
  { name: "Redis (via AWS ElastiCache)", jurisdiction: "India (ap-south-1)", service: "Caching and session management", data: "Session tokens, cached queries", engagement: "2019" },
  { name: "SendGrid (Twilio)", jurisdiction: "United States", service: "Transactional email delivery", data: "Email addresses, notification content", engagement: "2021" },
  { name: "Cloudflare", jurisdiction: "Global (edge network)", service: "CDN, DDoS protection, DNS", data: "Request metadata, cached assets", engagement: "2020" },
  { name: "Datadog", jurisdiction: "United States", service: "Application performance monitoring, logging", data: "Anonymised telemetry, log metadata", engagement: "2021" },
  { name: "Auth0 (Okta)", jurisdiction: "United States", service: "Authentication and identity management", data: "User identities, MFA metadata", engagement: "2021" },
  { name: "Stripe", jurisdiction: "United States", service: "Payment processing and billing", data: "Payment tokens, invoice metadata", engagement: "2022" },
  { name: "Slack (DPR.ai workspace)", jurisdiction: "United States", service: "Internal support ticketing notifications", data: "Anonymised issue references", engagement: "2021" },
  { name: "HubSpot", jurisdiction: "United States", service: "CRM, customer communications", data: "Contact details, account history", engagement: "2021" },
  { name: "Sentry (Functional Software)", jurisdiction: "United States", service: "Error tracking and crash reporting", data: "Error stack traces, anonymised request data", engagement: "2020" },
];

const changeHistory = [
  { date: "June 17, 2026", change: "Initial publication", process: "—", notice: "—" },
];

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Sub-processors
              </h1>
              <p className="mt-1 text-sm text-slate-400">Version 1.0 &mdash; Last updated: June 17, 2026</p>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.print(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download PDF
            </a>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            DPR.ai engages third-party sub-processors to deliver, support, and improve our Platform.
            This page lists all sub-processors authorised to process customer data. We update this
            list as our sub-processor relationships change, in accordance with our Data Processing
            Addendum (DPA).
          </p>
        </div>

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-caption text-slate-300">On this page</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "current-subprocessors", label: "1. Current Sub-processors" },
              { id: "engagement", label: "2. Engagement Process" },
              { id: "objection", label: "3. Objection Mechanism" },
              { id: "notification", label: "4. Notification of Changes" },
              { id: "change-history", label: "5. Change History" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 hover:text-white hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Current Sub-processors */}
        <Section id="current-subprocessors" title="1. Current Sub-processors">
          <Body>
            <p>
              The following table identifies each authorised sub-processor, its jurisdiction, the
              service it provides, the categories of data processed, and the year engagement began.
            </p>
          </Body>
          <div className="mt-4">
            <DataTable>
              <thead>
                <tr>
                  <Th>Sub-processor</Th>
                  <Th>Jurisdiction</Th>
                  <Th>Service Description</Th>
                  <Th>Data Categories</Th>
                  <Th>Since</Th>
                </tr>
              </thead>
              <tbody>
                {subprocessors.map((sp) => (
                  <tr key={sp.name}>
                    <Td><span className="font-medium text-slate-200">{sp.name}</span></Td>
                    <Td>{sp.jurisdiction}</Td>
                    <Td>{sp.service}</Td>
                    <Td>{sp.data}</Td>
                    <Td>{sp.engagement}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </Section>

        {/* 2. Engagement Process */}
        <Section id="engagement" title="2. Engagement Process">
          <Body>
            <p>
              Before engaging a new sub-processor, DPR.ai conducts a due diligence review that includes:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Security and privacy assessment against DPR.ai&rsquo;s standards</li>
              <li>Review of the sub-processor&rsquo;s SOC 2, ISO 27001, or equivalent certifications</li>
              <li>Contractual commitment to data protection obligations at least as protective as our DPA</li>
              <li>Verification of data processing boundaries and restrictions on further sub-processing</li>
            </ul>
            <p className="mt-4">
              Each sub-processor agreement incorporates Standard Contractual Clauses (SCCs) where
              required and restricts the sub-processor from processing customer data for any purpose
              other than the specific service engagement.
            </p>
          </Body>
        </Section>

        {/* 3. Objection Mechanism */}
        <Section id="objection" title="3. Objection Mechanism">
          <Body>
            <p>
              Customers who have executed a DPA with DPR.ai may object to the engagement of a new
              sub-processor on reasonable data protection grounds. To object:
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
              <p><strong className="text-slate-200">1.</strong> Submit a written objection to <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">dpo@dpr.ai</a> within 14 days of receiving a sub-processor change notification.</p>
              <p><strong className="text-slate-200">2.</strong> Provide specific, documented reasons why the new sub-processor cannot provide adequate data protection.</p>
              <p><strong className="text-slate-200">3.</strong> DPR.ai will review and respond within 14 days, proposing a commercially reasonable alternative or explaining why the objection cannot be accommodated.</p>
              <p className="text-slate-400">If the objection cannot be resolved, the customer may terminate the affected services as provided in the DPA.</p>
            </div>
          </Body>
        </Section>

        {/* 4. Notification of Changes */}
        <Section id="notification" title="4. Notification of Changes">
          <Body>
            <p>
              DPR.ai notifies customers of any intended changes concerning the addition or replacement
              of sub-processors in accordance with our DPA. Notification methods include:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Email notification to the account owner(s) at least 14 days before the change takes effect</li>
              <li>Update to this sub-processor page, which serves as the official register</li>
              <li>In-app notification banner (where available)</li>
            </ul>
            <p className="mt-4">
              Customers are encouraged to subscribe to updates by watching this page or contacting
              <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline"> dpo@dpr.ai</a> to be added to our sub-processor notification list.
            </p>
          </Body>
        </Section>

        {/* 5. Change History */}
        <Section id="change-history" title="5. Change History">
          <Body>
            <p>
              All changes to the sub-processor list are recorded below. Customers may request
              historical versions by emailing <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">dpo@dpr.ai</a>.
            </p>
          </Body>
          <div className="mt-4">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Change</Th>
                  <Th>Customer Process</Th>
                  <Th>Notice Period</Th>
                </tr>
              </thead>
              <tbody>
                {changeHistory.map((entry) => (
                  <tr key={`${entry.date}-${entry.change}`}>
                    <Td>{entry.date}</Td>
                    <Td>{entry.change}</Td>
                    <Td>{entry.process}</Td>
                    <Td>{entry.notice}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </Section>

        {/* Footer note */}
        <div className="mt-10 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-sm text-slate-400">
          Questions about our sub-processors? Contact{" "}
          <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">dpo@dpr.ai</a>{" "}
          or your account manager.
        </div>
      </div>
    </main>
  );
}
