"use client";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">{title}</h2>
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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l7 3v7c0 4.5-3.5 8-7 9-3.5-1-7-4.5-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" strokeLinecap="round" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

const bountyTiers = [
  { severity: "Critical", description: "Remote code execution, SQL injection with data exfiltration, authentication bypass, privilege escalation to admin", reward: "$2,000 \u2013 $5,000" },
  { severity: "High", description: "Cross-site scripting (stored), server-side request forgery, IDOR with sensitive data access, business logic flaws leading to data loss", reward: "$500 \u2013 $2,000" },
  { severity: "Medium", description: "Cross-site scripting (reflected), CSRF on state-changing actions, subdomain takeover, information disclosure of non-critical data", reward: "$100 \u2013 $500" },
  { severity: "Low", description: "Minor information leaks, missing security headers, version disclosure, clickjacking on non-sensitive pages", reward: "Recognition only" },
];

const outOfScope = [
  "Denial-of-service (DoS/DDoS) attacks",
  "Physical security attacks on DPR.ai facilities or personnel",
  "Social engineering of DPR.ai employees, contractors, or users",
  "Attacks on third-party services not operated by DPR.ai",
  "Rate-limiting bypass or brute-force attacks on authentication endpoints",
  "Self-XSS or issues requiring user interaction with attacker-controlled input",
  "Previously reported vulnerabilities that have been triaged",
  "TLS cipher suite analysis or certificate transparency issues",
  "Content spoofing without a demonstrated security impact",
  "Presence of autocomplete attributes on non-sensitive forms",
];

export default function DisclosurePage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <BugIcon />
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Responsible Disclosure Policy
              </h1>
            </div>
            <p className="mt-2 text-sm text-slate-400">Version 1.0 &mdash; Last updated: June 17, 2026</p>
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
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-caption text-slate-300">
            Table of Contents
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "intro", label: "1. Introduction" },
              { id: "scope", label: "2. Scope" },
              { id: "guidelines", label: "3. Submission Guidelines" },
              { id: "safe-harbor", label: "4. Safe Harbor" },
              { id: "bounty", label: "5. Bounty Program" },
              { id: "expectations", label: "6. Our Commitments" },
              { id: "out-of-scope", label: "7. Out of Scope" },
              { id: "contact", label: "8. Contact" },
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
              At DPR.ai, the security of our platform and the trust of our customers are our top
              priorities. We recognise the valuable role that the security research community plays
              in helping us maintain a high security posture. This Responsible Disclosure Policy
              outlines our commitment to working with researchers who identify and report potential
              security vulnerabilities in our platform.
            </p>
            <p>
              We encourage security researchers to report any vulnerabilities they discover in our
              systems responsibly. We pledge to acknowledge, investigate, and remediate verified
              reports in a timely manner, and to treat researchers with respect and transparency
              throughout the process.
            </p>
          </Body>
        </Section>

        {/* 2. Scope */}
        <Section id="scope" title="2. Scope">
          <Body>
            <p>This policy applies to the following systems and services operated by DPR.ai:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The DPR.ai web application (app.dpr.ai and all subdomains under dpr.ai)</li>
              <li>DPR.ai public API endpoints (api.dpr.ai)</li>
              <li>Official DPR.ai mobile applications</li>
              <li>Authentication and identity systems integrated with the platform</li>
            </ul>
            <p className="mt-4">
              Third-party services, customer-hosted instances, and systems not explicitly listed
              above are outside the scope of this policy.
            </p>
          </Body>
        </Section>

        {/* 3. Submission Guidelines */}
        <Section id="guidelines" title="3. Submission Guidelines">
          <Body>
            <p>To report a security vulnerability, please email us at:</p>
            <p className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-emerald-200">
              <ShieldIcon />
              <span>
                <a href="mailto:security@dpr.ai" className="font-medium text-sky-300 hover:underline">security@dpr.ai</a>
                {" \u2014 "}PGP fingerprint: <code className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-300">D4E9 F2C1 8A7B 3E5F 91C0  2B6D 7A3E 9F81 C4D2 E5F6</code>
              </span>
            </p>
            <p className="mt-4">When submitting a report, please include:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A clear description of the vulnerability and its potential impact</li>
              <li>Steps to reproduce the issue, including proof-of-concept code (if applicable)</li>
              <li>The affected URL, endpoint, component, or version</li>
              <li>Your preferred contact information for follow-up</li>
              <li>Any relevant screenshots, logs, or network traffic captures</li>
            </ul>
            <p className="mt-4">
              Please do not include personally identifiable information (PII) of other users in
              your proof-of-concept. If user data is necessary to demonstrate the issue, use your
              own test accounts.
            </p>
          </Body>
        </Section>

        {/* 4. Safe Harbor */}
        <Section id="safe-harbor" title="4. Safe Harbor">
          <Body>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <p className="flex items-start gap-3 text-sm leading-7 text-emerald-200">
                <ShieldIcon />
                <span>
                  <strong className="text-emerald-100">Safe Harbor.</strong> DPR.ai considers
                  security research conducted in accordance with this policy to be:
                </span>
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-emerald-200/80">
                <li>Authorised and lawful under applicable computer fraud and abuse laws</li>
                <li>Not a violation of our Acceptable Use Policy or Terms of Service</li>
                <li>Exempt from any anti-circumvention provisions in our agreements</li>
              </ul>
              <p className="mt-3 text-sm text-emerald-200/80">
                If legal action is initiated by a third party against a researcher for activities
                conducted in good faith and in compliance with this policy, DPR.ai will take steps
                to clarify that the activities were authorised.
              </p>
            </div>
            <p className="mt-4">
              To qualify for safe harbor protections, researchers must:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Share the vulnerability report exclusively with DPR.ai and not disclose it publicly until we have resolved the issue and granted permission</li>
              <li>Not exploit the vulnerability beyond what is necessary to demonstrate the issue</li>
              <li>Not access, modify, or delete data that does not belong to them</li>
              <li>Act in good faith to avoid privacy violations, data destruction, and service disruption</li>
              <li>Provide reasonable time for DPR.ai to respond and remediate before any public disclosure</li>
            </ul>
          </Body>
        </Section>

        {/* 5. Bounty Program */}
        <Section id="bounty" title="5. Bounty Program">
          <Body>
            <p>
              DPR.ai operates a vulnerability bounty program to recognise and reward researchers
              who help us improve our security. Bounties are awarded at our discretion based on
              the severity and quality of the report.
            </p>
          </Body>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Severity</th>
                  <th className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Description</th>
                  <th className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Reward</th>
                </tr>
              </thead>
              <tbody>
                {bountyTiers.map((tier) => (
                  <tr key={tier.severity}>
                    <td className="border-b border-white/5 px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tier.severity === "Critical" ? "bg-red-500/15 text-red-300" :
                        tier.severity === "High" ? "bg-orange-500/15 text-orange-300" :
                        tier.severity === "Medium" ? "bg-yellow-500/15 text-yellow-300" :
                        "bg-slate-500/15 text-slate-300"
                      }`}>
                        {tier.severity === "Critical" && <LockIcon />}
                        {tier.severity}
                      </span>
                    </td>
                    <td className="border-b border-white/5 px-4 py-3 text-slate-300">{tier.description}</td>
                    <td className="border-b border-white/5 px-4 py-3 font-medium text-slate-200">{tier.reward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Body>
            <p className="mt-4">
              All rewards are paid via bug bounty platform, bank transfer, or equivalent. Duplicate
              reports are eligible only for the first complete submission. Researchers must comply
              with applicable tax laws in their jurisdiction.
            </p>
          </Body>
        </Section>

        {/* 6. Our Commitments */}
        <Section id="expectations" title="6. Our Commitments">
          <Body>
            <p>When you report a vulnerability to us, we commit to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong className="text-slate-200">Acknowledge</strong> receipt of your report within 3 business days</li>
              <li><strong className="text-slate-200">Evaluate</strong> and triage the report within 10 business days</li>
              <li><strong className="text-slate-200">Remediate</strong> verified vulnerabilities based on severity: Critical (7 days), High (14 days), Medium (30 days), Low (90 days)</li>
              <li><strong className="text-slate-200">Communicate</strong> progress updates at least once per week during remediation</li>
              <li><strong className="text-slate-200">Credit</strong> the researcher in our security acknowledgements (with permission)</li>
              <li><strong className="text-slate-200">Disclose</strong> vulnerability details after remediation, coordinated with the researcher</li>
            </ul>
            <p className="mt-4">
              If remediation will take longer than the target timeline, we will provide a detailed
              explanation and an updated estimated completion date.
            </p>
          </Body>
        </Section>

        {/* 7. Out of Scope */}
        <Section id="out-of-scope" title="7. Out of Scope">
          <Body>
            <p>The following activities and findings are explicitly outside the scope of this policy and are not eligible for bounties:</p>
          </Body>
          <div className="mt-4 space-y-2">
            {outOfScope.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
                <span className="mt-0.5 shrink-0 text-slate-600">&times;</span>
                {item}
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Contact */}
        <Section id="contact" title="8. Contact">
          <Body>
            <p>
              All vulnerability reports and security-related inquiries should be directed to:
            </p>
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
              <p><strong className="text-slate-200">Security Team:</strong> <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a></p>
              <p className="mt-1"><strong className="text-slate-200">PGP Key Fingerprint:</strong> <code className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-slate-300">D4E9 F2C1 8A7B 3E5F 91C0  2B6D 7A3E 9F81 C4D2 E5F6</code></p>
              <p className="mt-3 text-slate-400">
                For non-security inquiries, please visit our{" "}
                <a href="/contact" className="text-sky-300 hover:underline">Contact page</a>.
              </p>
            </div>
          </Body>
        </Section>
      </div>
    </main>
  );
}
