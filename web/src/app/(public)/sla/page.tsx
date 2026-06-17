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

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-white/5 px-4 py-3 text-slate-300 ${className ?? ""}`}>{children}</td>;
}

export default function SLAPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-8">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Service Level Agreement
          </h1>
          <p className="mt-1 text-sm text-slate-400">Version 1.0 &mdash; Effective: June 17, 2026</p>
          <p className="text-xs text-slate-500">Last updated: June 17, 2026</p>
        </div>

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">On this page</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "overview", label: "1. SLA Overview" },
              { id: "availability", label: "2. Service Availability Commitment" },
              { id: "support", label: "3. Support Response Times" },
              { id: "performance", label: "4. Performance Commitments" },
              { id: "backup", label: "5. Data Backup and Recovery" },
              { id: "incident", label: "6. Security Incident Response" },
              { id: "credits", label: "7. Service Credits" },
              { id: "monitoring", label: "8. Monitoring and Reporting" },
              { id: "exclusions", label: "9. SLA Exclusions" },
              { id: "changes", label: "10. Changes to SLA" },
              { id: "contact", label: "11. Contact for SLA Questions" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 hover:text-white hover:underline">{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Overview */}
        <Section id="overview" title="1. SLA Overview">
          <Body>
            <p>
              This Service Level Agreement (&ldquo;SLA&rdquo;) governs the use of DPR.ai under the
              terms of the Customer&rsquo;s subscription agreement. This SLA applies to all paid
              subscription plans unless otherwise specified.
            </p>
            <p>
              <strong>Covered Services:</strong> The DPR.ai web application, mobile application, and
              public API endpoints used for data submission and retrieval.
            </p>
            <p>
              <strong>Excluded Services:</strong> Beta features, free trial accounts, third-party
              integrations, and features explicitly marked as &ldquo;Beta&rdquo; or &ldquo;Preview.&rdquo;
            </p>
          </Body>
        </Section>

        {/* 2. Availability */}
        <Section id="availability" title="2. Service Availability Commitment">
          <Body>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5 text-center">
              <div className="text-4xl font-bold tracking-[-0.04em] text-emerald-300">99.5%</div>
              <p className="mt-1 text-sm text-emerald-200">Monthly uptime commitment</p>
            </div>

            <p>
              DPR.ai commits to a monthly uptime percentage of at least <strong>99.5%</strong>,
              calculated as follows:
            </p>
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 font-mono text-xs text-slate-300">
              Uptime % = (Total minutes in month - Downtime minutes) / Total minutes in month × 100
            </p>

            <p>
              &ldquo;Downtime&rdquo; means the platform is unavailable for normal use, as confirmed
              by our monitoring systems. A period of unavailability begins when our monitoring detects
              that the service is unreachable and ends when normal operation is restored.
            </p>

            <SubHeading>Excluded Downtime</SubHeading>
            <p>The following are not counted as Downtime for SLA calculation purposes:</p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Scheduled maintenance</strong> with at least 48 hours&rsquo; advance notice.</li>
              <li><strong>Emergency maintenance</strong> required to apply urgent security patches (notification provided as soon as possible).</li>
              <li>Service disruptions caused by third-party services outside DPR.ai&rsquo;s control.</li>
              <li>Issues caused by the Customer&rsquo;s network, infrastructure, or misuse of the platform.</li>
              <li>Force majeure events, natural disasters, or acts of terrorism.</li>
            </ul>

            <SubHeading>Maintenance Windows</SubHeading>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Scheduled:</strong> Sundays 00:00&ndash;04:00 UTC, maximum once per month.</li>
              <li><strong>Notice:</strong> 48 hours minimum advance notice via email and platform notification.</li>
              <li><strong>Emergency:</strong> As needed for critical security patches; notification as soon as practical.</li>
            </ul>
          </Body>
        </Section>

        {/* 3. Support */}
        <Section id="support" title="3. Support Response Times">
          <Body>
            <p>
              DPR.ai provides technical support through the following channels:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Email: <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">support@dpr.ai</a></li>
              <li>In-app chat (available on paid plans)</li>
              <li>Phone support (Enterprise plans only)</li>
            </ul>

            <p className="mt-4">Response time commitments by severity level:</p>

            <DataTable>
              <thead>
                <tr>
                  <Th>Severity</Th>
                  <Th>Description</Th>
                  <Th>First Response</Th>
                  <Th>Resolution Target</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td><span className="font-semibold text-red-300">Critical</span></Td>
                  <Td>Service unavailable, data loss risk, security incident</Td>
                  <Td className="font-medium text-white">2 hours</Td>
                  <Td>8 hours</Td>
                </tr>
                <tr>
                  <Td><span className="font-semibold text-amber-300">High</span></Td>
                  <Td>Major feature broken, significant operational impact</Td>
                  <Td className="font-medium text-white">4 hours</Td>
                  <Td>24 hours</Td>
                </tr>
                <tr>
                  <Td><span className="font-semibold text-sky-300">Medium</span></Td>
                  <Td>Feature issue, workaround available</Td>
                  <Td className="font-medium text-white">8 hours</Td>
                  <Td>72 hours</Td>
                </tr>
                <tr>
                  <Td><span className="font-semibold text-slate-300">Low</span></Td>
                  <Td>Minor issue, question, feature request</Td>
                  <Td className="font-medium text-white">24 hours</Td>
                  <Td>Best effort</Td>
                </tr>
              </tbody>
            </DataTable>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Standard Support Hours</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Monday&ndash;Friday, 9:00 AM&ndash;6:00 PM IST<br />
                  Saturday, 9:00 AM&ndash;1:00 PM IST<br />
                  Sunday: Closed
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <SubHeading>Critical Issues</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  <strong>24/7 monitoring</strong> for Critical severity issues.<br />
                  Response team is alerted automatically regardless of time or day.
                </p>
              </div>
            </div>
          </Body>
        </Section>

        {/* 4. Performance */}
        <Section id="performance" title="4. Performance Commitments">
          <Body>
            <p>
              DPR.ai commits to the following performance targets, measured on a monthly basis:
            </p>
            <DataTable>
              <thead>
                <tr>
                  <Th>Metric</Th>
                  <Th>Target</Th>
                  <Th>Measurement</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>API response time</Td>
                  <Td className="font-medium text-white">95% of requests under 500ms</Td>
                  <Td>Rolling 30-day window</Td>
                </tr>
                <tr>
                  <Td>Dashboard page load</Td>
                  <Td className="font-medium text-white">Under 2 seconds</Td>
                  <Td>Median of synthetic checks every 5 minutes</Td>
                </tr>
                <tr>
                  <Td>OCR processing time</Td>
                  <Td className="font-medium text-white">Under 30 seconds per page</Td>
                  <Td>Average over a calendar month</Td>
                </tr>
                <tr>
                  <Td>Concurrent users</Td>
                  <Td className="font-medium text-white">As specified in plan limits</Td>
                  <Td>Plan-dependent</Td>
                </tr>
              </tbody>
            </DataTable>
          </Body>
        </Section>

        {/* 5. Backup */}
        <Section id="backup" title="5. Data Backup and Recovery">
          <Body>
            <DataTable>
              <thead>
                <tr>
                  <Th>Metric</Th>
                  <Th>Commitment</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Backup frequency</Td>
                  <Td className="font-medium text-white">Daily automated backups</Td>
                </tr>
                <tr>
                  <Td>Backup retention</Td>
                  <Td className="font-medium text-white">30 days (rolling)</Td>
                </tr>
                <tr>
                  <Td>Recovery Point Objective (RPO)</Td>
                  <Td className="font-medium text-white">24 hours</Td>
                </tr>
                <tr>
                  <Td>Recovery Time Objective (RTO)</Td>
                  <Td className="font-medium text-white">8 hours for full restoration</Td>
                </tr>
                <tr>
                  <Td>Geographic redundancy</Td>
                  <Td className="font-medium text-white">Cross-region replication to secondary AWS region</Td>
                </tr>
              </tbody>
            </DataTable>
          </Body>
        </Section>

        {/* 6. Incident Response */}
        <Section id="incident" title="6. Security Incident Response">
          <Body>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Incident detection:</strong> Continuous automated monitoring with real-time alerting.</li>
              <li><strong>Customer notification:</strong> Within <strong>24 hours</strong> of confirmation of a security incident involving customer data.</li>
              <li><strong>Incident resolution:</strong> Best effort based on severity; Critical incidents receive continuous attention until resolved.</li>
              <li><strong>Post-incident report:</strong> Provided to affected customers within 10 business days of resolution.</li>
            </ul>
          </Body>
        </Section>

        {/* 7. Credits */}
        <Section id="credits" title="7. Service Credits">
          <Body>
            <p>
              If DPR.ai fails to meet the uptime commitment in a given month, the Customer may be
              eligible for a service credit applied to the next billing cycle.
            </p>

            <DataTable>
              <thead>
                <tr>
                  <Th>Monthly Uptime</Th>
                  <Th>Credit (% of monthly fee)</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>99.0% &ndash; 99.49%</Td>
                  <Td className="font-medium text-amber-300">10%</Td>
                </tr>
                <tr>
                  <Td>95.0% &ndash; 98.99%</Td>
                  <Td className="font-medium text-amber-300">25%</Td>
                </tr>
                <tr>
                  <Td>Below 95.0%</Td>
                  <Td className="font-medium text-amber-300">50%</Td>
                </tr>
              </tbody>
            </DataTable>

            <SubHeading>How to Claim</SubHeading>
            <ol className="list-inside list-decimal space-y-1.5 pl-2">
              <li>Submit a written request to <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">billing@dpr.ai</a> within <strong>30 days</strong> of the incident.</li>
              <li>Include your account details, the dates and times of the downtime, and any relevant incident references.</li>
              <li>We will verify the claim against our monitoring data and respond within 10 business days.</li>
            </ol>

            <SubHeading>Credit Limitations</SubHeading>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Maximum credit in any single month: <strong>50%</strong> of the monthly subscription fee.</li>
              <li>Service credits are the <strong>sole and exclusive remedy</strong> for any SLA breach.</li>
              <li>Credits are applied to future invoices and are not redeemable for cash.</li>
              <li>No credits are issued for downtime caused by excluded events (Section 2).</li>
            </ul>
          </Body>
        </Section>

        {/* 8. Monitoring */}
        <Section id="monitoring" title="8. Monitoring and Reporting">
          <Body>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                <strong>Public status page:</strong>{" "}
                <a href="https://status.dpr.ai" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">
                  status.dpr.ai
                </a>{" "}
                &mdash; Real-time service availability and incident updates.
              </li>
              <li><strong>Incident notifications:</strong> Emailed to account administrators when a major incident is declared or resolved.</li>
              <li><strong>Monthly uptime reports:</strong> Available on request from support@dpr.ai.</li>
            </ul>
          </Body>
        </Section>

        {/* 9. Exclusions */}
        <Section id="exclusions" title="9. SLA Exclusions">
          <Body>
            <p>
              This SLA does not apply to the following:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Beta features, preview releases, or features explicitly marked as experimental.</li>
              <li>Free trial accounts or accounts with no paid subscription.</li>
              <li>Issues caused by Customer&rsquo;s misuse, unauthorized access, or violation of the Acceptable Use Policy.</li>
              <li>Third-party integrations, services, or APIs not under DPR.ai&rsquo;s control.</li>
              <li>Network or infrastructure issues on the Customer&rsquo;s side.</li>
              <li>Force majeure events as defined in the Terms of Service.</li>
            </ul>
          </Body>
        </Section>

        {/* 10. Changes */}
        <Section id="changes" title="10. Changes to SLA">
          <Body>
            <p>
              DPR.ai may modify this SLA with 30 days&rsquo; advance notice to account administrators
              via email. If a modification materially degrades the SLA, the Customer may terminate
              the subscription without penalty within 30 days of the change.
            </p>
          </Body>
        </Section>

        {/* 11. Contact */}
        <Section id="contact" title="11. Contact for SLA Questions">
          <Body>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">SLA Questions:</strong>{" "}
                <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">support@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Credit Claims:</strong>{" "}
                <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">billing@dpr.ai</a>
              </p>
              <p>
                <strong className="text-slate-200">Status Page:</strong>{" "}
                <a href="https://status.dpr.ai" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">status.dpr.ai</a>
              </p>
            </div>
          </Body>
        </Section>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} DPR.ai Technologies Pvt. Ltd.</p>
          <p className="mt-1 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-sky-300 hover:underline">Privacy Policy</Link>
            <span className="text-white/20">|</span>
            <Link href="/terms" className="text-sky-300 hover:underline">Terms of Service</Link>
            <span className="text-white/20">|</span>
            <Link href="/security" className="text-sky-300 hover:underline">Security</Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="text-sky-300 hover:underline">Return to DPR.ai</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
