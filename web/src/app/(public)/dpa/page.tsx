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

export default function DPAPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Data Processing Addendum
              </h1>
              <p className="mt-1 text-sm text-slate-400">Version 1.0 &mdash; Effective: June 17, 2026</p>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.print(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </a>
          </div>
        </div>

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">On this page</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "intro", label: "1. Introduction" },
              { id: "definitions", label: "2. Definitions" },
              { id: "scope", label: "3. Scope and Roles" },
              { id: "customer-obligations", label: "4. Customer Obligations" },
              { id: "dpr-obligations", label: "5. DPR.ai Obligations" },
              { id: "security", label: "6. Security Measures" },
              { id: "subprocessors", label: "7. Sub-processors" },
              { id: "transfers", label: "8. International Data Transfers" },
              { id: "data-subject-rights", label: "9. Data Subject Rights" },
              { id: "breach", label: "10. Data Breach Notification" },
              { id: "deletion", label: "11. Data Deletion and Return" },
              { id: "audit", label: "12. Audit Rights" },
              { id: "liability", label: "13. Liability and Indemnification" },
              { id: "term", label: "14. Term and Termination" },
              { id: "governing-law", label: "15. Governing Law" },
              { id: "contact", label: "16. Contact Information" },
              { id: "annex-1", label: "Annex 1: Details of Processing" },
              { id: "annex-2", label: "Annex 2: Security Measures" },
              { id: "annex-3", label: "Annex 3: Sub-processors" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 hover:text-white hover:underline">{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Introduction */}
        <Section id="intro" title="1. Introduction">
          <Body>
            <p>
              <strong>1.1</strong> This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of the
              Terms of Service (the &ldquo;Agreement&rdquo;) between DPR.ai Technologies Pvt. Ltd.
              (&ldquo;DPR.ai,&rdquo; &ldquo;Processor&rdquo;) and the Customer (&ldquo;Controller&rdquo;).
            </p>
            <p>
              <strong>1.2</strong> This DPA governs the processing of Personal Data by DPR.ai on behalf
              of the Customer in connection with the provision of the DPR.ai platform and services.
            </p>
            <p>
              <strong>1.3</strong> This DPA is effective upon the Customer&rsquo;s acceptance of the
              Agreement and continues in effect until the Agreement is terminated.
            </p>
            <p>
              <strong>1.4</strong> This DPA is governed by the General Data Protection Regulation
              (Regulation (EU) 2016/679) (&ldquo;GDPR&rdquo;) and, where applicable, other data
              protection laws, including the UK GDPR and India&rsquo;s Digital Personal Data
              Protection Act, 2023.
            </p>
          </Body>
        </Section>

        {/* 2. Definitions */}
        <Section id="definitions" title="2. Definitions">
          <Body>
            <p>
              Capitalized terms used but not defined in this DPA have the meanings given in the
              Agreement. In addition:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>&ldquo;Customer&rdquo;</strong> means the entity that has subscribed to the DPR.ai platform and acts as the Data Controller.</li>
              <li><strong>&ldquo;DPR.ai&rdquo;</strong> means DPR.ai Technologies Pvt. Ltd., acting as the Data Processor.</li>
              <li><strong>&ldquo;Personal Data&rdquo;</strong> means any information relating to an identified or identifiable natural person as defined in Article 4(1) of the GDPR.</li>
              <li><strong>&ldquo;Processing&rdquo;</strong> has the meaning given in Article 4(2) of the GDPR.</li>
              <li><strong>&ldquo;Data Subject&rdquo;</strong> means an identified or identifiable natural person as defined in Article 4(1) of the GDPR.</li>
              <li><strong>&ldquo;Sub-processor&rdquo;</strong> means a third-party engaged by DPR.ai to process Personal Data on behalf of the Customer.</li>
              <li><strong>&ldquo;Supervisory Authority&rdquo;</strong> means an independent public authority established pursuant to Article 51 of the GDPR.</li>
            </ul>
          </Body>
        </Section>

        {/* 3. Scope */}
        <Section id="scope" title="3. Scope and Roles">
          <Body>
            <p>
              <strong>3.1</strong> The parties acknowledge and agree that:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>The <strong>Customer</strong> is the Data Controller of all Personal Data processed through the DPR.ai platform.</li>
              <li><strong>DPR.ai</strong> is the Data Processor of that Personal Data, acting on the documented instructions of the Customer.</li>
            </ul>

            <SubHeading>Categories of Data Subjects</SubHeading>
            <p>The Personal Data processed concerns the following categories of Data Subjects:</p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>Customer&rsquo;s employees and workers whose attendance, shift, and production data is recorded</li>
              <li>Customer&rsquo;s contractors, temporary staff, and visitors</li>
              <li>Customer&rsquo;s authorized users and account administrators</li>
            </ul>

            <SubHeading>Categories of Personal Data</SubHeading>
            <p>The Personal Data processed includes:</p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>Employee names, identification numbers, contact details, and role/designation</li>
              <li>Attendance records, check-in/out times, shift assignments, and leave records</li>
              <li>Production performance data associated with individual workers</li>
              <li>Any other Personal Data uploaded to the platform by the Customer</li>
            </ul>

            <SubHeading>Purpose of Processing</SubHeading>
            <p>
              DPR.ai processes Personal Data solely for the purpose of providing the DPR.ai platform
              and related services as described in the Agreement, including attendance tracking,
              production reporting, inventory management, OCR document processing, invoicing, and
              employee management, all on the documented instructions of the Customer.
            </p>
          </Body>
        </Section>

        {/* 4. Customer Obligations */}
        <Section id="customer-obligations" title="4. Customer Obligations (as Data Controller)">
          <Body>
            <p>The Customer is responsible for:</p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Establishing a lawful basis for processing Personal Data and complying with applicable data protection laws.</li>
              <li>Obtaining all necessary consents from Data Subjects where required by law.</li>
              <li>Ensuring the accuracy, completeness, and legality of all Personal Data uploaded to the platform.</li>
              <li>Providing appropriate privacy notices to Data Subjects regarding the processing of their data.</li>
              <li>Responding to Data Subject requests (DPR.ai will assist as described in Section 9).</li>
              <li>Configuring the platform&rsquo;s access controls, retention settings, and security features appropriately.</li>
            </ul>
          </Body>
        </Section>

        {/* 5. DPR.ai Obligations */}
        <Section id="dpr-obligations" title="5. DPR.ai Obligations (as Data Processor)">
          <Body>
            <p>DPR.ai shall:</p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Process Personal Data only on the documented instructions of the Customer, unless required to do otherwise by applicable law (in which case DPR.ai will notify the Customer of that legal requirement before processing, unless prohibited).</li>
              <li>Ensure that all persons authorized to process Personal Data are bound by appropriate confidentiality obligations.</li>
              <li>Implement and maintain the technical and organizational security measures described in Section 6 and Annex 2.</li>
              <li>Assist the Customer in fulfilling its obligations to respond to Data Subject requests (Section 9).</li>
              <li>Assist the Customer with data protection impact assessments and consultations with Supervisory Authorities, where required.</li>
              <li>Delete or return all Personal Data upon termination of the Agreement (Section 11).</li>
              <li>Make available all information necessary to demonstrate compliance with this DPA.</li>
            </ul>
          </Body>
        </Section>

        {/* 6. Security */}
        <Section id="security" title="6. Security Measures">
          <Body>
            <p>
              DPR.ai shall implement and maintain appropriate technical and organizational measures to
              ensure a level of security appropriate to the risk, including as described in our{" "}
              <Link href="/security" className="text-sky-300 hover:underline">Security page</Link>.
              These measures include, at minimum:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Encryption of Personal Data in transit (TLS 1.3) and at rest (AES-256).</li>
              <li>Access controls based on the principle of least privilege.</li>
              <li>Multi-factor authentication for administrative access.</li>
              <li>Regular vulnerability scanning and penetration testing.</li>
              <li>24/7 monitoring, intrusion detection, and incident response procedures.</li>
              <li>Automated daily backups with cross-region redundancy.</li>
            </ul>
          </Body>
        </Section>

        {/* 7. Sub-processors */}
        <Section id="subprocessors" title="7. Sub-processors">
          <Body>
            <p>
              <strong>7.1</strong> The Customer authorizes DPR.ai to engage Sub-processors to process
              Personal Data. A current list of Sub-processors is maintained at{" "}
              <Link href="/subprocessors" className="text-sky-300 hover:underline">/subprocessors</Link>.
            </p>
            <p>
              <strong>7.2</strong> DPR.ai shall notify the Customer of any intended changes concerning
              the addition or replacement of Sub-processors at least 30 days in advance via email.
            </p>
            <p>
              <strong>7.3</strong> The Customer may object to a new Sub-processor within 30 days of
              notification. If the objection is reasonable and cannot be resolved within 30 days,
              the Customer may terminate the Agreement without penalty.
            </p>
            <p>
              <strong>7.4</strong> DPR.ai shall enter into written agreements with all Sub-processors
              that impose data protection obligations equivalent to those in this DPA. DPR.ai remains
              fully liable for all acts and omissions of its Sub-processors.
            </p>
          </Body>
        </Section>

        {/* 8. Transfers */}
        <Section id="transfers" title="8. International Data Transfers">
          <Body>
            <p>
              <strong>8.1</strong> The Customer&rsquo;s Personal Data is primarily stored in AWS
              Mumbai, India (ap-south-1). When Personal Data is transferred from the European Economic
              Area (EEA), the United Kingdom, or Switzerland to India or other countries, the
              following safeguards apply:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Standard Contractual Clauses (SCCs):</strong> DPR.ai has executed the EU Standard Contractual Clauses (Module 2: Controller-to-Processor) with all relevant Sub-processors.</li>
              <li><strong>Data Processing Agreements:</strong> Written DPAs with all Sub-processors incorporating the required transfer safeguards.</li>
              <li><strong>Supplementary measures:</strong> Technical controls (encryption, access controls) as described in Section 6.</li>
            </ul>
            <p>
              <strong>8.2</strong> DPR.ai will ensure that all transfers of Personal Data comply with
              applicable data protection laws and will implement any additional measures required by
              regulatory guidance.
            </p>
          </Body>
        </Section>

        {/* 9. Data Subject Rights */}
        <Section id="data-subject-rights" title="9. Data Subject Rights">
          <Body>
            <p>
              <strong>9.1</strong> DPR.ai shall assist the Customer in responding to Data Subject
              requests under Chapter III of the GDPR, including rights of:
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                "Access (Art. 15)",
                "Rectification (Art. 16)",
                "Erasure (Art. 17)",
                "Restriction (Art. 18)",
                "Portability (Art. 20)",
                "Objection (Art. 21)",
              ].map((right) => (
                <div key={right} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                  {right}
                </div>
              ))}
            </div>
            <p>
              <strong>9.2</strong> DPR.ai shall respond to any assistance request from the Customer
              regarding Data Subject rights within <strong>5 business days</strong>.
            </p>
            <p>
              <strong>9.3</strong> If a Data Subject makes a request directly to DPR.ai, DPR.ai shall
              promptly forward the request to the Customer (within 48 hours) and shall not respond
              to the Data Subject without the Customer&rsquo;s prior authorization.
            </p>
          </Body>
        </Section>

        {/* 10. Breach */}
        <Section id="breach" title="10. Data Breach Notification">
          <Body>
            <p>
              <strong>10.1</strong> DPR.ai shall notify the Customer without undue delay and, where
              feasible, within <strong>24 hours</strong> of becoming aware of a confirmed Personal
              Data Breach involving Customer Data.
            </p>
            <p>
              <strong>10.2</strong> The notification shall include, to the extent available:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>The nature of the Personal Data Breach, including categories and approximate number of Data Subjects and records concerned.</li>
              <li>The likely consequences of the Personal Data Breach.</li>
              <li>The measures taken or proposed to address the breach and mitigate its effects.</li>
              <li>The name and contact details of the Data Protection Officer or other contact point for further information.</li>
            </ul>
            <p>
              <strong>10.3</strong> The Customer is responsible for notifying the relevant Supervisory
              Authority and affected Data Subjects as required by applicable law. DPR.ai will provide
              reasonable cooperation in this process.
            </p>
            <p>
              <strong>10.4</strong> For reporting security incidents:{" "}
              <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a>.
            </p>
          </Body>
        </Section>

        {/* 11. Deletion */}
        <Section id="deletion" title="11. Data Deletion and Return">
          <Body>
            <p>
              <strong>11.1</strong> Upon termination of the Agreement, the Customer may request export
              of Personal Data for up to <strong>30 days</strong> following termination. DPR.ai will
              make the data available in a commonly used, machine-readable format.
            </p>
            <p>
              <strong>11.2</strong> After the 30-day export window, DPR.ai shall delete all Personal
              Data from its production systems and backups, subject to Section 11.3.
            </p>
            <p>
              <strong>11.3</strong> DPR.ai may retain Personal Data to the extent required by
              applicable law (e.g., invoicing records required for tax purposes), provided that such
              data remains subject to the confidentiality and security obligations of this DPA.
            </p>
            <p>
              <strong>11.4</strong> A certification of deletion is available upon request from{" "}
              <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a>.
            </p>
          </Body>
        </Section>

        {/* 12. Audit */}
        <Section id="audit" title="12. Audit Rights">
          <Body>
            <p>
              <strong>12.1</strong> Upon 30 days&rsquo; written notice, the Customer may audit
              DPR.ai&rsquo;s compliance with this DPA, no more than once per calendar year.
            </p>
            <p>
              <strong>12.2</strong> The audit shall be conducted in a manner that minimizes
              disruption to DPR.ai&rsquo;s operations. The Customer shall bear its own audit costs,
              unless the audit reveals a material breach of this DPA, in which case DPR.ai shall
              reimburse reasonable audit costs.
            </p>
            <p>
              <strong>12.3</strong> As an alternative to an on-site audit, DPR.ai may provide:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Copies of its SOC 2 Type II report (when available) or equivalent certification.</li>
              <li>Summary results of the most recent penetration test.</li>
              <li>Completed security questionnaire responses.</li>
            </ul>
          </Body>
        </Section>

        {/* 13. Liability */}
        <Section id="liability" title="13. Liability and Indemnification">
          <Body>
            <p>
              <strong>13.1</strong> Each party&rsquo;s liability arising out of or related to this DPA
              shall be subject to the limitations set forth in the Agreement.
            </p>
            <p>
              <strong>13.2</strong> DPR.ai shall be liable for any breaches of this DPA caused by its
              Sub-processors to the same extent as if DPR.ai itself had committed the breach.
            </p>
            <p>
              <strong>13.3</strong> The Customer agrees to indemnify and hold DPR.ai harmless from any
              claims, damages, or penalties arising from the Customer&rsquo;s failure to comply with
              its obligations as Data Controller under applicable data protection laws.
            </p>
          </Body>
        </Section>

        {/* 14. Term */}
        <Section id="term" title="14. Term and Termination">
          <Body>
            <p>
              <strong>14.1</strong> This DPA commences on the effective date of the Agreement and
              continues until the Agreement is terminated.
            </p>
            <p>
              <strong>14.2</strong> The obligations under Sections 11 (Data Deletion and Return),
              13 (Liability), and 15 (Governing Law) shall survive termination of this DPA.
            </p>
          </Body>
        </Section>

        {/* 15. Governing Law */}
        <Section id="governing-law" title="15. Governing Law">
          <Body>
            <p>
              <strong>15.1</strong> This DPA shall be governed by and construed in accordance with the
              laws of India, without regard to its conflict-of-laws principles. However, the data
              protection principles of the GDPR shall apply regardless of the governing law.
            </p>
            <p>
              <strong>15.2</strong> Any dispute arising out of this DPA shall be resolved in accordance
              with the dispute resolution provisions of the Agreement.
            </p>
          </Body>
        </Section>

        {/* 16. Contact */}
        <Section id="contact" title="16. Contact Information">
          <Body>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">DPA Questions:</strong>{" "}
                <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Data Subject Requests:</strong>{" "}
                <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">privacy@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Security Incidents:</strong>{" "}
                <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a>
              </p>
              <p>
                <strong className="text-slate-200">Data Protection Officer:</strong>{" "}
                <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">dpo@dpr.ai</a>
              </p>
            </div>
          </Body>
        </Section>

        {/* Annex 1 */}
        <Section id="annex-1" title="Annex 1: Details of Processing">
          <Body>
            <DataTable>
              <thead>
                <tr>
                  <Th>Element</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td className="font-medium text-slate-200">Nature and purpose of processing</Td>
                  <Td>Provision of the DPR.ai SaaS platform for operational data management, including attendance tracking, production reporting, inventory management, OCR document processing, invoicing, and employee records management.</Td>
                </tr>
                <tr>
                  <Td className="font-medium text-slate-200">Duration of processing</Td>
                  <Td>For the duration of the Agreement plus up to 60 days following termination for data retrieval, then deletion subject to legal retention requirements.</Td>
                </tr>
                <tr>
                  <Td className="font-medium text-slate-200">Categories of Data Subjects</Td>
                  <Td>Customer&rsquo;s employees, contractors, temporary workers, visitors, and authorized users.</Td>
                </tr>
                <tr>
                  <Td className="font-medium text-slate-200">Types of Personal Data</Td>
                  <Td>Names, identification numbers, contact information, role/designation, attendance data, shift assignments, leave records, production performance data, and any other Personal Data uploaded by the Customer.</Td>
                </tr>
                <tr>
                  <Td className="font-medium text-slate-200">Processing location</Td>
                  <Td>Primary: AWS Mumbai, India (ap-south-1). Sub-processors may process in other regions as listed at /subprocessors.</Td>
                </tr>
              </tbody>
            </DataTable>
          </Body>
        </Section>

        {/* Annex 2 */}
        <Section id="annex-2" title="Annex 2: Security Measures">
          <Body>
            <p>
              The technical and organizational security measures implemented by DPR.ai are described
              in detail on our{" "}
              <Link href="/security" className="text-sky-300 hover:underline">Security page</Link>.
              In summary:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Encryption:</strong> TLS 1.3 in transit; AES-256 at rest.</li>
              <li><strong>Access controls:</strong> RBAC, least privilege, MFA for admins.</li>
              <li><strong>Infrastructure:</strong> AWS VPC with WAF, DDoS protection, security groups.</li>
              <li><strong>Application security:</strong> Input validation, parameterized queries, CSP headers, CSRF tokens.</li>
              <li><strong>Backups:</strong> Daily encrypted backups with 30-day rolling retention and cross-region replication.</li>
              <li><strong>Incident response:</strong> 24/7 monitoring, automated alerts, documented IR plan.</li>
              <li><strong>Personnel:</strong> Background checks, confidentiality agreements, annual security training.</li>
              <li><strong>Vulnerability management:</strong> Weekly automated scans, annual penetration testing, dependency monitoring.</li>
            </ul>
          </Body>
        </Section>

        {/* Annex 3 */}
        <Section id="annex-3" title="Annex 3: Sub-processors">
          <Body>
            <p>
              A current list of Sub-processors engaged by DPR.ai is maintained at{" "}
              <Link href="/subprocessors" className="text-sky-300 hover:underline">
                /subprocessors
              </Link>.
            </p>
            <p>
              Categories of Sub-processors include cloud infrastructure providers (AWS), email
              delivery services (Resend), analytics and monitoring tools (PostHog, Sentry), and
              payment processors (Stripe, Razorpay).
            </p>
            <p>
              All Sub-processors are bound by written agreements that impose data protection
              obligations equivalent to those in this DPA, including the EU Standard Contractual
              Clauses where applicable.
            </p>
          </Body>
        </Section>

        {/* Signature block */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <SubHeading>Execution of DPA</SubHeading>
          <p className="text-sm leading-7 text-slate-300">
            This DPA is hereby incorporated into the Agreement. By accepting the Agreement, the
            Customer agrees to be bound by the terms of this DPA. If the Customer requires a
            separately executed copy of this DPA, please contact{" "}
            <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a>.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">DPR.ai Technologies Pvt. Ltd.</p>
              <div className="mt-2 border-t border-white/10 pt-2 text-sm text-slate-300">
                <p>Signed: ____________________________</p>
                <p className="mt-1">Name: ____________________________</p>
                <p className="mt-1">Title: ____________________________</p>
                <p className="mt-1">Date: ____________________________</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Customer</p>
              <div className="mt-2 border-t border-white/10 pt-2 text-sm text-slate-300">
                <p>Signed: ____________________________</p>
                <p className="mt-1">Name: ____________________________</p>
                <p className="mt-1">Title: ____________________________</p>
                <p className="mt-1">Date: ____________________________</p>
              </div>
            </div>
          </div>
        </div>

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
