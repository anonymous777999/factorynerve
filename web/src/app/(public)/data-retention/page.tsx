"use client";

import Link from "next/link";

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

function CategoryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-300">
      {children}
    </span>
  );
}

export default function DataRetentionPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Data Retention Policy
          </h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: June 17, 2026 &mdash; Version 1.0</p>
        </div>

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-caption text-slate-300">On this page</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "overview", label: "1. Policy Overview" },
              { id: "categories", label: "2. Data Categories and Retention Periods" },
              { id: "reasons", label: "3. Reasons for Retention" },
              { id: "deletion", label: "4. Data Deletion Process" },
              { id: "customer-control", label: "5. Customer-Controlled Retention" },
              { id: "post-cancellation", label: "6. Post-Cancellation Data Handling" },
              { id: "export", label: "7. Data Export" },
              { id: "legal-holds", label: "8. Legal Holds and Exceptions" },
              { id: "updates", label: "9. Policy Updates" },
              { id: "contact", label: "10. Contact Information" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 hover:text-white hover:underline">{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Overview */}
        <Section id="overview" title="1. Policy Overview">
          <Body>
            <p>
              DPR.ai is committed to retaining your data only as long as necessary to fulfill the
              purposes for which it was collected, or as required by applicable law. This policy
              outlines the specific retention periods for different categories of data, the
              rationale behind those periods, and the processes we follow to securely delete data
              when it is no longer needed.
            </p>
            <p>
              We balance the need to retain data for business continuity, legal compliance, and
              customer support against our commitment to privacy and data minimization. Wherever
              possible, we default to shorter retention periods and give customers control over
              their own retention settings.
            </p>
          </Body>
        </Section>

        {/* 2. Categories and Periods */}
        <Section id="categories" title="2. Data Categories and Retention Periods">
          <Body>
            <p className="mb-4">
              The following table shows how long each category of data is retained and why.
            </p>

            <SubHeading>Account Data</SubHeading>
            <DataTable>
              <thead>
                <tr>
                  <Th>Data Type</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Account information (company name, admin details, billing info)</Td>
                  <Td>Duration of active subscription + 90 days</Td>
                  <Td>Contract performance and accounting</Td>
                </tr>
                <tr>
                  <Td>User profiles (names, roles, email addresses)</Td>
                  <Td>Duration of active subscription + 30 days</Td>
                  <Td>Access management and operational continuity</Td>
                </tr>
                <tr>
                  <Td>Payment and invoice records</Td>
                  <Td>7 years</Td>
                  <Td>Tax and statutory compliance</Td>
                </tr>
              </tbody>
            </DataTable>

            <SubHeading>Operational Data</SubHeading>
            <DataTable>
              <thead>
                <tr>
                  <Th>Data Type</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Attendance records (check-in/out, shift data)</Td>
                  <Td>3 years from date of record</Td>
                  <Td>Wage calculation, labor law compliance, dispute resolution</Td>
                </tr>
                <tr>
                  <Td>Production records (shift reports, machine output)</Td>
                  <Td>3 years from date of record</Td>
                  <Td>Operational auditing and performance analysis</Td>
                </tr>
                <tr>
                  <Td>Inventory records (stock levels, material receipts, dispatches)</Td>
                  <Td>3 years from date of record</Td>
                  <Td>Inventory auditing and reconciliation</Td>
                </tr>
                <tr>
                  <Td>OCR-scanned documents (register pages, challans, weighbridge tickets)</Td>
                  <Td>As configured by customer (max 5 years)</Td>
                  <Td>Audit trail and quality verification</Td>
                </tr>
                <tr>
                  <Td>Invoice and dispatch records</Td>
                  <Td>7 years</Td>
                  <Td>Statutory tax and accounting requirements</Td>
                </tr>
              </tbody>
            </DataTable>

            <SubHeading>System Data</SubHeading>
            <DataTable>
              <thead>
                <tr>
                  <Th>Data Type</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Audit logs (admin actions, configuration changes)</Td>
                  <Td>1 year</Td>
                  <Td>Security monitoring and compliance verification</Td>
                </tr>
                <tr>
                  <Td>Security logs (authentication attempts, access events)</Td>
                  <Td>2 years</Td>
                  <Td>Threat detection and incident investigation</Td>
                </tr>
                <tr>
                  <Td>Application logs (server logs, error traces)</Td>
                  <Td>90 days</Td>
                  <Td>Operational troubleshooting</Td>
                </tr>
                <tr>
                  <Td>Database backups</Td>
                  <Td>30 days (rolling backups)</Td>
                  <Td>Disaster recovery</Td>
                </tr>
              </tbody>
            </DataTable>

            <SubHeading>Support &amp; Communications Data</SubHeading>
            <DataTable>
              <thead>
                <tr>
                  <Th>Data Type</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Support tickets and correspondence</Td>
                  <Td>2 years from resolution</Td>
                  <Td>Customer service quality and issue tracking</Td>
                </tr>
                <tr>
                  <Td>Email communications with support/billing</Td>
                  <Td>2 years</Td>
                  <Td>Record of agreements and issue resolution</Td>
                </tr>
              </tbody>
            </DataTable>

            <SubHeading>Analytics Data</SubHeading>
            <DataTable>
              <thead>
                <tr>
                  <Th>Data Type</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Aggregated usage statistics (anonymized)</Td>
                  <Td>Indefinitely (anonymized)</Td>
                  <Td>Product improvement and benchmarking</Td>
                </tr>
                <tr>
                  <Td>Individual usage data (page views, feature use)</Td>
                  <Td>Duration of subscription + 6 months</Td>
                  <Td>User experience personalization</Td>
                </tr>
              </tbody>
            </DataTable>
          </Body>
        </Section>

        {/* 3. Reasons */}
        <Section id="reasons" title="3. Reasons for Retention">
          <Body>
            <p>We retain data for the following purposes:</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Legal &amp; Regulatory Compliance</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Tax laws require us to retain financial records (invoices, payment records) for
                  up to 7 years. Labor laws may require attendance and wage records for 3 years.
                  We comply with all applicable statutory requirements in the jurisdictions where
                  we operate.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Customer Service &amp; Support</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Retaining support tickets and communications allows us to resolve ongoing issues,
                  identify recurring patterns, and improve our service quality over time.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Security &amp; Fraud Prevention</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Logs and audit trails help us detect unauthorized access, investigate security
                  incidents, and protect all customers from threats.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Product Improvement</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Anonymized usage data helps us understand how the platform is used and what
                  improvements would deliver the most value. Individual usage data is retained
                  only as long as needed for personalization.
                </p>
              </div>
            </div>
          </Body>
        </Section>

        {/* 4. Deletion */}
        <Section id="deletion" title="4. Data Deletion Process">
          <Body>
            <p>
              When data reaches the end of its retention period, we follow a secure deletion process:
            </p>
            <ol className="list-inside list-decimal space-y-1.5 pl-2">
              <li>
                <strong>Automated deletion schedules</strong> run regularly to identify and remove
                expired data from production databases.
              </li>
              <li>
                <strong>Secure overwriting</strong> &mdash; data is overwritten before storage is
                released, preventing recovery via forensic methods.
              </li>
              <li>
                <strong>Backup purging</strong> &mdash; when backups reach the end of their retention
                window, they are securely destroyed. Data deleted from production before a backup
                cycle is naturally purged as backups roll over.
              </li>
              <li>
                <strong>Deletion verification</strong> &mdash; we run periodic audits to confirm that
                automated deletion processes are working correctly.
              </li>
            </ol>
            <p>
              Deleted data cannot be recovered once the process is complete. Please ensure you have
              exported any data you need before its retention period expires.
            </p>
          </Body>
        </Section>

        {/* 5. Customer Control */}
        <Section id="customer-control" title="5. Customer-Controlled Retention">
          <Body>
            <p>
              DPR.ai provides tools for customers to manage their own data retention:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                <strong>Retention settings</strong> &mdash; Admin users can configure retention
                periods for certain operational data categories from the Settings page.
              </li>
              <li>
                <strong>Manual deletion</strong> &mdash; Customers can delete specific records
                (attendance entries, production reports, OCR scans) at any time.
              </li>
              <li>
                <strong>Bulk cleanup</strong> &mdash; Enterprise customers can request bulk data
                removal based on date ranges or other criteria.
              </li>
              <li>
                <strong>Data export before deletion</strong> &mdash; We recommend exporting data
                before applying any manual deletion or changing retention settings.
              </li>
            </ul>
          </Body>
        </Section>

        {/* 6. Post-Cancellation */}
        <Section id="post-cancellation" title="6. Post-Cancellation Data Handling">
          <Body>
            <p>
              When a subscription is canceled, data handling follows this timeline:
            </p>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
              <div className="space-y-4 text-sm leading-7 text-slate-300">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/[0.1] text-xs font-bold text-amber-200">1</div>
                  <div>
                    <strong className="text-slate-200">Day 0 &mdash; Cancellation takes effect</strong>
                    <p>Account enters read-only state. You can log in and view data but cannot create new records.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/[0.1] text-xs font-bold text-amber-200">2</div>
                  <div>
                    <strong className="text-slate-200">Days 1&ndash;60 &mdash; Data export window</strong>
                    <p>You can export all your data from the platform. We recommend completing this within the first 30 days.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/[0.1] text-xs font-bold text-amber-200">3</div>
                  <div>
                    <strong className="text-slate-200">Day 61 &mdash; Data deletion</strong>
                    <p>All customer data is permanently deleted from production systems and backup media.</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              <strong>Exceptions:</strong> Invoice and payment records may be retained for the full
              7-year statutory period even after account cancellation. Legal holds may also prevent
              deletion (see Section 8).
            </p>
          </Body>
        </Section>

        {/* 7. Export */}
        <Section id="export" title="7. Data Export">
          <Body>
            <p>
              Customers can export their data at any time, including during the post-cancellation
              retrieval window.
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Supported formats:</strong> CSV, XLSX, and JSON for structured data. Original file formats for OCR-scanned documents.</li>
              <li><strong>How to export:</strong> Use the export feature available in each module (Production, Attendance, Inventory) or go to Settings &rarr; Data Export for a full backup.</li>
              <li><strong>API access:</strong> Customers with API access can programmatically retrieve their data.</li>
              <li><strong>Request assistance:</strong> If the self-service export does not meet your needs, contact support@dpr.ai for assistance.</li>
            </ul>
          </Body>
        </Section>

        {/* 8. Legal Holds */}
        <Section id="legal-holds" title="8. Legal Holds and Exceptions">
          <Body>
            <p>
              In certain circumstances, data may be retained beyond its standard retention period:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>
                <strong>Legal holds:</strong> If we receive a valid legal order, subpoena, or
                litigation hold notice, relevant data will be preserved until the hold is lifted.
              </li>
              <li>
                <strong>Regulatory investigations:</strong> If a regulatory authority is
                investigating a matter involving customer data, we may retain relevant data until
                the investigation concludes.
              </li>
              <li>
                <strong>Dispute resolution:</strong> Data relevant to an active dispute between
                DPR.ai and a customer may be retained until the dispute is resolved.
              </li>
              <li>
                <strong>Statutory obligations:</strong> Certain records (invoices, payment data)
                must be retained for legally mandated periods regardless of the standard policy.
              </li>
            </ul>
            <p>
              In the event of a legal hold affecting your data, we will notify you promptly, unless
              the law prohibits us from doing so.
            </p>
          </Body>
        </Section>

        {/* 9. Updates */}
        <Section id="updates" title="9. Policy Updates">
          <Body>
            <p>
              We may update this Data Retention Policy from time to time. Material changes will be
              communicated via email to account administrators and through the platform at least
              30 days before taking effect.
            </p>
            <p>
              We encourage you to review this policy periodically. The &ldquo;Last updated&rdquo;
              date at the top of this page indicates when the policy was last revised.
            </p>
          </Body>
        </Section>

        {/* 10. Contact */}
        <Section id="contact" title="10. Contact Information">
          <Body>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Retention Questions:</strong>{" "}
                <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">privacy@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Data Deletion Requests:</strong>{" "}
                <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">support@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Data Export Assistance:</strong>{" "}
                <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">support@dpr.ai</a>
              </p>
              <p>
                <strong className="text-slate-200">Response Time:</strong> We aim to respond to
                all data-related inquiries within 3 business days.
              </p>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              See also our{" "}
              <Link href="/privacy" className="text-sky-300 hover:underline">Privacy Policy</Link>,{" "}
              <Link href="/terms" className="text-sky-300 hover:underline">Terms of Service</Link>, and{" "}
              <Link href="/dpa" className="text-sky-300 hover:underline">Data Processing Addendum</Link>.
            </p>
          </Body>
        </Section>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} DPR.ai Technologies Pvt. Ltd. All rights reserved.</p>
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
