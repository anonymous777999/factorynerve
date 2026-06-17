"use client";

import Link from "next/link";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold tracking-[-0.02em] text-white">{title}</h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-base font-semibold text-slate-200">{children}</h3>;
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

function AlertTriangle() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
    </svg>
  );
}

export default function AcceptableUsePage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Acceptable Use Policy
            </h1>
            <p className="mt-2 text-sm text-slate-400">Last updated: June 17, 2026</p>
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

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Table of Contents
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "intro", label: "1. Introduction" },
              { id: "scope", label: "2. Scope" },
              { id: "prohibited", label: "3. Prohibited Activities" },
              { id: "monitoring", label: "4. Monitoring and Enforcement" },
              { id: "reporting", label: "5. Reporting Abuse" },
              { id: "consequences", label: "6. Consequences of Violation" },
              { id: "liability", label: "7. User Liability" },
              { id: "changes", label: "8. Changes to This Policy" },
              { id: "contact", label: "9. Contact" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 transition-colors hover:text-white hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Introduction */}
        <Section id="intro" title="1. Introduction">
          <Body>
            <p>
              This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs the use of the DPR.ai platform,
              website, and related services (collectively, the &ldquo;Platform&rdquo;). By accessing
              or using the Platform, you agree to comply with this AUP. DPR.ai Technologies Pvt. Ltd.
              (&ldquo;DPR.ai,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
              reserves the right to enforce this AUP at its sole discretion.
            </p>
            <p>
              This AUP supplements our Terms of Service and other incorporated policies. Capitalised
              terms used but not defined herein have the meanings given in the Terms of Service.
            </p>
          </Body>
        </Section>

        {/* 2. Scope */}
        <Section id="scope" title="2. Scope">
          <Body>
            <p>
              This AUP applies to all users of the Platform, including customers, their employees,
              contractors, and any third parties accessing the Platform through a customer account.
              You are responsible for ensuring that all users under your account comply with this AUP.
            </p>
            <p>
              Violations of this AUP by any user under your account may result in suspension or
              termination of your access to the Platform, as determined by DPR.ai in its sole discretion.
            </p>
          </Body>
        </Section>

        {/* 3. Prohibited Activities */}
        <Section id="prohibited" title="3. Prohibited Activities">
          <Body>
            <p className="mb-4 text-slate-200">You may not use the Platform to engage in, facilitate, or promote any of the following:</p>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <Th>Category</Th>
                    <Th>Prohibited Activity</Th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Illegal Activities", "Any use of the Platform that violates applicable laws, regulations, or governmental orders."],
                    ["Unauthorised Access", "Attempting to access, probe, or connect to systems or data without authorisation, including password cracking, port scanning, or denial-of-service attacks."],
                    ["Malicious Code", "Transmitting or introducing viruses, worms, malware, ransomware, Trojan horses, or any other harmful code."],
                    ["Phishing & Fraud", "Creating or distributing deceptive content intended to obtain sensitive information, impersonate any person or entity, or commit fraud."],
                    ["Spam & Bulk Messaging", "Sending unsolicited commercial messages, bulk emails, or automated messaging that violates applicable anti-spam laws (including CAN-SPAM)."],
                    ["Data Scraping", "Using automated tools (bots, scrapers, crawlers) to extract data from the Platform without our prior written consent."],
                    ["Infringement", "Uploading, storing, or sharing content that infringes on intellectual property rights, privacy rights, or other proprietary rights of others."],
                    ["Resource Abuse", "Knowingly imposing an unreasonable load on the Platform's infrastructure, including excessive API calls, storage abuse, or compute resource exhaustion."],
                    ["Benchmarking", "Conducting competitive benchmarking, performance testing, or publishing comparative analyses of the Platform without prior written permission."],
                    ["Circumvention", "Bypassing or attempting to bypass any security controls, rate limits, access restrictions, or usage quotas."],
                    ["Objectionable Content", "Uploading, sharing, or generating content that is violent, hateful, discriminatory, harassing, defamatory, sexually explicit, or otherwise objectionable."],
                    ["Export Violations", "Using the Platform in violation of applicable export control or sanctions laws."],
                  ].map(([category, activity]) => (
                    <tr key={category}>
                      <Td><span className="font-medium text-slate-200">{category}</span></Td>
                      <Td>{activity}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              This list is not exhaustive. DPR.ai reserves the right to determine, in its sole
              discretion, whether any conduct violates the spirit or letter of this AUP.
            </p>
          </Body>
        </Section>

        {/* 4. Monitoring and Enforcement */}
        <Section id="monitoring" title="4. Monitoring and Enforcement">
          <Body>
            <p>
              DPR.ai monitors the Platform for signs of abuse, anomalous activity, and potential
              violations of this AUP. Monitoring methods include automated analysis of traffic
              patterns, API usage, content scanning (where permitted by law), and manual review.
            </p>
            <p>
              We reserve the right to investigate any suspected violation and may take any action
              we deem appropriate, including but not limited to:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Issuing a warning to the account owner</li>
              <li>Temporarily suspending access to the Platform</li>
              <li>Permanently terminating the account and all associated data</li>
              <li>Removing or disabling access to specific content</li>
              <li>Notifying law enforcement authorities</li>
            </ul>
          </Body>
        </Section>

        {/* 5. Reporting Abuse */}
        <Section id="reporting" title="5. Reporting Abuse">
          <Body>
            <p>
              If you become aware of any violation of this AUP, or suspect abusive activity on
              the Platform, please report it immediately to:
            </p>
            <p className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 text-amber-200">
              <AlertTriangle />
              <span>
                Email: <a href="mailto:abuse@dpr.ai" className="font-medium text-sky-300 hover:underline">abuse@dpr.ai</a>
                {" \u2014 "}We aim to acknowledge all reports within 24 hours.
              </span>
            </p>
            <p className="mt-4">
              When reporting, please include relevant details such as the nature of the violation,
              affected accounts or resources, timestamps, and any supporting evidence. Reports may
              be submitted anonymously.
            </p>
          </Body>
        </Section>

        {/* 6. Consequences of Violation */}
        <Section id="consequences" title="6. Consequences of Violation">
          <Body>
            <p>
              Violation of this AUP may result in immediate suspension of your account without
              prior notice, particularly for activities that threaten the security or stability
              of the Platform or other users.
            </p>
            <p>
              Where commercially reasonable, we will provide advance notice of enforcement actions
              and an opportunity to cure. However, we reserve the right to take immediate action
              for serious or repeated violations.
            </p>
            <p>
              Account termination for AUP violations is final. Upon termination, you will lose
              access to all data stored on the Platform, subject to the data retrieval provisions
              in our Terms of Service.
            </p>
          </Body>
        </Section>

        {/* 7. User Liability */}
        <Section id="liability" title="7. User Liability">
          <Body>
            <p>
              You are solely responsible for all activities conducted under your account, including
              any violations of this AUP by your employees, contractors, or end users. You agree
              to indemnify and hold harmless DPR.ai against any claims, losses, or damages arising
              from your violation of this AUP.
            </p>
            <p>
              DPR.ai reserves the right to pursue all available legal remedies, including seeking
              injunctive relief and recovering costs and attorneys&rsquo; fees, for violations of
              this AUP.
            </p>
          </Body>
        </Section>

        {/* 8. Changes */}
        <Section id="changes" title="8. Changes to This Policy">
          <Body>
            <p>
              We may update this AUP from time to time to reflect changes in our practices, legal
              requirements, or industry standards. Material changes will be communicated via email
              to the account owner and/or through a notice on the Platform at least 14 days before
              the effective date.
            </p>
            <p>
              Continued use of the Platform after the effective date constitutes acceptance of the
              revised AUP. If you do not agree to the changes, you must stop using the Platform
              and cancel your account.
            </p>
          </Body>
        </Section>

        {/* 9. Contact */}
        <Section id="contact" title="9. Contact">
          <Body>
            <p>
              Questions or concerns about this AUP may be directed to:
            </p>
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
              <p><strong className="text-slate-200">Email:</strong> <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a></p>
              <p className="mt-1"><strong className="text-slate-200">Abuse Reporting:</strong> <a href="mailto:abuse@dpr.ai" className="text-sky-300 hover:underline">abuse@dpr.ai</a></p>
              <p className="mt-1"><strong className="text-slate-200">Security Concerns:</strong> <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a></p>
              <p className="mt-3 text-slate-400">
                DPR.ai Technologies Pvt. Ltd.<br />
                4th Floor, Tech Tower, Industrial District<br />
                Shillong, Meghalaya 793001, India
              </p>
            </div>
          </Body>
        </Section>
      </div>
    </main>
  );
}
