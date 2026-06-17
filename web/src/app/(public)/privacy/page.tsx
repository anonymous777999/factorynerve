"use client";

import Link from "next/link";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-slate-400">Last updated: June 17, 2026</p>
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.print();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
          >
            <DownloadIcon />
            Download PDF
          </a>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-caption text-slate-300">
            Table of Contents
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "introduction", label: "1. Introduction and Scope" },
              { id: "controller", label: "2. Data Controller" },
              { id: "collected-data", label: "3. Information We Collect" },
              { id: "legal-basis", label: "4. Legal Basis for Processing" },
              { id: "usage", label: "5. How We Use Your Information" },
              { id: "retention", label: "6. Data Retention" },
              { id: "sharing", label: "7. Sharing and Third Parties" },
              { id: "rights", label: "8. Your Privacy Rights" },
              { id: "transfers", label: "9. International Transfers" },
              { id: "security", label: "10. Security Measures" },
              { id: "changes", label: "11. Policy Changes" },
              { id: "contact", label: "12. Contact Us" },
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

        {/* 1. Introduction */}
        <Section id="introduction" title="1. Introduction and Scope">
          <Body>
            <p>
              DPR.ai (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, store, and protect your personal data when you use
              our Software-as-a-Service (SaaS) platform.
            </p>
            <p>
              This policy applies to all users of the DPR.ai platform, including company administrators, factory
              supervisors, shift in-charges, and any employees whose data may be processed through our systems.
              By accessing or using DPR.ai, you acknowledge that you have read and understood this policy.
            </p>
            <p>
              DPR.ai provides operational data management for manufacturing facilities, including attendance
              tracking, production reporting, inventory management, OCR document processing, invoicing, and
              employee records. This policy covers all data processed in connection with these services.
            </p>
          </Body>
        </Section>

        {/* 2. Data Controller */}
        <Section id="controller" title="2. Data Controller Information">
          <Body>
            <p>
              <strong className="text-slate-200">Data Controller:</strong> DPR.ai Technologies Pvt. Ltd.
            </p>
            <p>
              <strong className="text-slate-200">Registered Address:</strong> 4th Floor, Tech Tower, Industrial
              District, Shillong, Meghalaya 793001, India
            </p>
            <p>
              <strong className="text-slate-200">Contact Email:</strong>{" "}
              <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">
                privacy@dpr.ai
              </a>
            </p>
            <p>
              <strong className="text-slate-200">Data Protection Officer (DPO):</strong>{" "}
              <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">
                dpo@dpr.ai
              </a>
            </p>
            <p>
              For customers established in the European Union, our representative can be reached at
              dpo@dpr.ai for all GDPR-related inquiries.
            </p>
          </Body>
        </Section>

        {/* 3. Types of Data Collected */}
        <Section id="collected-data" title="3. Information We Collect">
          <Body>
            <p>
              We collect and process the following categories of data to provide and improve our services.
              The specific data collected depends on how you use the platform and which features you enable.
            </p>

            <div>
              <SubHeading>3.1 Account Information</SubHeading>
              <p>
                When a company registers for DPR.ai, we collect company name, administrator name, work email
                address, phone number, billing address, and payment information. This data is necessary to
                create and maintain your account, process subscriptions, and provide customer support.
              </p>
            </div>

            <div>
              <SubHeading>3.2 Employee Data</SubHeading>
              <p>
                For workforce management features, we process employee names, employee identification numbers,
                attendance records (check-in/check-out times), shift assignments, department or line
                assignments, leave records, and supervisory notes. This data is provided to us by the employer
                (who acts as the data controller for this information) and processed solely on their behalf.
              </p>
            </div>

            <div>
              <SubHeading>3.3 Operational Data</SubHeading>
              <p>
                This includes production metrics (daily production reports, shift-wise output, machine-wise
                production), inventory records (stock levels, material receipts, dispatches), OCR-scanned
                documents (handwritten register pages, delivery challans, weighbridge tickets, invoices),
                quality control data, and dispatch logs. This data constitutes the core operational records
                managed through the platform.
              </p>
            </div>

            <div>
              <SubHeading>3.4 Usage Data</SubHeading>
              <p>
                We automatically collect login times, feature usage patterns, page interactions, time spent
                on different sections, search queries within the platform, and IP addresses. This data helps
                us understand how the platform is used and identify areas for improvement.
              </p>
            </div>

            <div>
              <SubHeading>3.5 Technical Data</SubHeading>
              <p>
                We collect browser type and version, device type and operating system, session tokens for
                authentication, cookies and similar tracking technologies (as described in our Cookie Policy),
                and log data including access times and error reports.
              </p>
            </div>
          </Body>
        </Section>

        {/* 4. Legal Basis */}
        <Section id="legal-basis" title="4. Legal Basis for Processing">
          <Body>
            <p>
              We process your personal data on the following legal bases, as applicable under data protection
              laws including the General Data Protection Regulation (GDPR):
            </p>

            <div>
              <SubHeading>4.1 Contract Performance</SubHeading>
              <p>
                We process account information, billing details, and core operational data to perform our
                obligations under the Terms of Service agreement with your organization. Without this data,
                we cannot deliver the platform services you have subscribed to.
              </p>
            </div>

            <div>
              <SubHeading>4.2 Legitimate Interests</SubHeading>
              <p>
                Usage data and technical data are processed based on our legitimate interest in improving
                platform performance, ensuring security, preventing fraud, and developing new features.
                We balance these interests against your privacy rights and ensure that processing is
                necessary and proportionate.
              </p>
            </div>

            <div>
              <SubHeading>4.3 Consent</SubHeading>
              <p>
                Where required by applicable law, we obtain your consent before placing non-essential cookies,
                sending marketing communications, or processing data for purposes not covered by contract
                or legitimate interest. You may withdraw your consent at any time without affecting the
                lawfulness of processing based on consent before its withdrawal.
              </p>
            </div>

            <div>
              <SubHeading>4.4 Legal Obligations</SubHeading>
              <p>
                We may process personal data to comply with applicable legal obligations, such as retaining
                financial records for tax purposes or responding to lawful requests from regulatory authorities.
              </p>
            </div>
          </Body>
        </Section>

        {/* 5. How We Use Your Information */}
        <Section id="usage" title="5. How We Use Your Information">
          <Body>
            <div>
              <SubHeading>5.1 Service Delivery</SubHeading>
              <p>
                We use your data to provide, maintain, and operate the DPR.ai platform. This includes
                processing daily production reports, managing attendance records, generating invoices,
                processing OCR-scanned documents, tracking inventory movements, and enabling approvals
                workflows. All operational data is processed in real time to support factory operations.
              </p>
            </div>

            <div>
              <SubHeading>5.2 Analytics and Improvement</SubHeading>
              <p>
                Aggregated and anonymized usage data helps us understand platform performance, identify
                bottlenecks, and develop new features. We analyze feature adoption patterns to improve
                user experience. Individual operational records are never used for analytics in
                identifiable form.
              </p>
            </div>

            <div>
              <SubHeading>5.3 Customer Support</SubHeading>
              <p>
                Account and technical data are used to respond to support tickets, troubleshoot issues,
                provide onboarding assistance, and communicate service updates or changes to terms.
              </p>
            </div>

            <div>
              <SubHeading>5.4 Security Monitoring</SubHeading>
              <p>
                We monitor login patterns, access logs, and API usage to detect unauthorized access
                attempts, potential breaches, and anomalous activity. This is essential for protecting
                both our platform and your data.
              </p>
            </div>
          </Body>
        </Section>

        {/* 6. Data Retention */}
        <Section id="retention" title="6. Data Retention">
          <Body>
            <p>
              We retain your personal data only as long as necessary to fulfill the purposes described in
              this policy, or as required by applicable law. The retention periods vary by data category:
            </p>

            <DataTable>
              <thead>
                <tr>
                  <Th>Data Category</Th>
                  <Th>Retention Period</Th>
                  <Th>Rationale</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Account Information</Td>
                  <Td>Duration of account + 6 years</Td>
                  <Td>Contractual and legal (tax) obligations</Td>
                </tr>
                <tr>
                  <Td>Employee Records</Td>
                  <Td>Duration of employment relationship + 3 years</Td>
                  <Td>Employer compliance and dispute resolution</Td>
                </tr>
                <tr>
                  <Td>Attendance Data</Td>
                  <Td>3 years from date of record</Td>
                  <Td>Wage calculation and labor law compliance</Td>
                </tr>
                <tr>
                  <Td>Production / Operational Data</Td>
                  <Td>5 years from date of record</Td>
                  <Td>Business record keeping and audit trail</Td>
                </tr>
                <tr>
                  <Td>OCR-Scanned Documents</Td>
                  <Td>5 years from date of scan</Td>
                  <Td>Audit trail and quality verification</Td>
                </tr>
                <tr>
                  <Td>Invoices & Billing Records</Td>
                  <Td>7 years (or as required by local tax law)</Td>
                  <Td>Statutory tax and accounting requirements</Td>
                </tr>
                <tr>
                  <Td>Usage Data (logs, telemetry)</Td>
                  <Td>12 months</Td>
                  <Td>Platform improvement and security analysis</Td>
                </tr>
                <tr>
                  <Td>Session Tokens / Cookies</Td>
                  <Td>Session duration or 6 months (persistent)</Td>
                  <Td>Authentication and user experience</Td>
                </tr>
              </tbody>
            </DataTable>

            <p className="mt-4">
              Upon expiration of the applicable retention period, data is securely deleted or anonymized.
              You may request earlier deletion of your data subject to our legal obligations to retain
              certain records.
            </p>
          </Body>
        </Section>

        {/* 7. Sharing and Third Parties */}
        <Section id="sharing" title="7. Sharing and Third Parties">
          <Body>
            <p>
              We do not sell your personal data to third parties. We share data only with trusted service
              providers who help us deliver the platform, and only under strict data processing agreements.
            </p>

            <DataTable>
              <thead>
                <tr>
                  <Th>Third Party</Th>
                  <Th>Service</Th>
                  <Th>Data Shared</Th>
                  <Th>Location</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>AWS (Amazon Web Services)</Td>
                  <Td>Cloud hosting and infrastructure</Td>
                  <Td>All platform data (encrypted)</Td>
                  <Td>India (ap-south-1)</Td>
                </tr>
                <tr>
                  <Td>Resend</Td>
                  <Td>Email delivery (notifications, invoices)</Td>
                  <Td>Email addresses, recipient names</Td>
                  <Td>US / EU</Td>
                </tr>
                <tr>
                  <Td>PostHog</Td>
                  <Td>Product analytics and feature usage</Td>
                  <Td>Anonymized usage data, page views</Td>
                  <Td>US / EU</Td>
                </tr>
                <tr>
                  <Td>Sentry</Td>
                  <Td>Error monitoring and crash reporting</Td>
                  <Td>Error logs, browser/device info</Td>
                  <Td>US / EU</Td>
                </tr>
                <tr>
                  <Td>Stripe / Razorpay</Td>
                  <Td>Payment processing (subscriptions)</Td>
                  <Td>Billing info, payment amount</Td>
                  <Td>US / India</Td>
                </tr>
              </tbody>
            </DataTable>

            <p className="mt-4">
              We require all third-party service providers to implement appropriate technical and
              organizational measures to protect your data. We may also disclose data when required by
              law, court order, or governmental regulation.
            </p>
          </Body>
        </Section>

        {/* 8. Your Privacy Rights */}
        <Section id="rights" title="8. Your Privacy Rights">
          <Body>
            <p>
              Depending on your jurisdiction, you may have the following rights regarding your personal data.
              We respond to all requests in accordance with applicable data protection laws.
            </p>

            <div>
              <SubHeading>8.1 Right of Access</SubHeading>
              <p>
                You have the right to obtain confirmation of whether we process your personal data and, if so,
                to request a copy of that data along with information about how it is processed.
              </p>
            </div>

            <div>
              <SubHeading>8.2 Right to Rectification</SubHeading>
              <p>
                You may request correction of inaccurate or incomplete personal data. Account administrators
                can update most information directly through the platform settings.
              </p>
            </div>

            <div>
              <SubHeading>8.3 Right to Deletion (&ldquo;Right to be Forgotten&rdquo;)</SubHeading>
              <p>
                You may request deletion of your personal data where it is no longer necessary for the purposes
                for which it was collected, or where you withdraw consent on which processing is based.
                This is subject to our legal retention obligations.
              </p>
            </div>

            <div>
              <SubHeading>8.4 Right to Data Portability</SubHeading>
              <p>
                You have the right to receive your personal data in a structured, commonly used, and
                machine-readable format, and to transmit that data to another controller without hindrance.
              </p>
            </div>

            <div>
              <SubHeading>8.5 Right to Restrict Processing</SubHeading>
              <p>
                You may request restriction of processing where you contest the accuracy of the data, where
                processing is unlawful, or where you have objected to processing pending verification of
                our legitimate grounds.
              </p>
            </div>

            <div>
              <SubHeading>8.6 Right to Object</SubHeading>
              <p>
                You have the right to object to processing based on legitimate interests, including
                profiling. We will cease processing unless we demonstrate compelling legitimate grounds
                that override your interests or where processing is necessary for legal claims.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <p className="text-sm leading-7 text-amber-200">
                <strong>How to Exercise Your Rights:</strong> To exercise any of these rights, please
                submit a request to{" "}
                <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">
                  privacy@dpr.ai
                </a>{" "}
                or write to our DPO at{" "}
                <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">
                  dpo@dpr.ai
                </a>
                . We will respond within 30 days of receiving a verifiable request. Where requests are
                manifestly unfounded or excessive, we may charge a reasonable fee or refuse to act.
              </p>
            </div>
          </Body>
        </Section>

        {/* 9. International Transfers */}
        <Section id="transfers" title="9. International Data Transfers">
          <Body>
            <p>
              Your personal data may be transferred to and processed in countries other than your own.
              When we transfer personal data from the European Economic Area (EEA), the United Kingdom,
              or Switzerland to countries that have not been deemed adequate by the European Commission,
              we rely on appropriate safeguards.
            </p>
            <p>
              <strong className="text-slate-200">Safeguards we use include:</strong>
            </p>
            <ul className="list-inside list-disc space-y-2 pl-2">
              <li>
                <strong>Standard Contractual Clauses (SCCs):</strong> We execute SCCs approved by the
                European Commission with all third-party service providers that process data outside
                the EEA.
              </li>
              <li>
                <strong>Data Processing Agreements (DPAs):</strong> We maintain DPAs with all sub-processors
                that include the required transfer safeguards.
              </li>
              <li>
                <strong>AWS India Region:</strong> Primary data hosting is in Mumbai, India (ap-south-1),
                which provides a data residency option for Indian and Asian customers.
              </li>
            </ul>
            <p>
              By using DPR.ai, you consent to the transfer of your data to our servers in India and to
              the third parties listed in Section 7, subject to the safeguards described above.
            </p>
          </Body>
        </Section>

        {/* 10. Security */}
        <Section id="security" title="10. Security Measures">
          <Body>
            <p>
              We implement robust technical and organizational measures to protect your personal data
              against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <div>
              <SubHeading>10.1 Technical Measures</SubHeading>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Data encryption at rest using AES-256 and in transit using TLS 1.3</li>
                <li>Multi-factor authentication (MFA) for all admin accounts</li>
                <li>Role-based access control (RBAC) that restricts data access by user role</li>
                <li>Automated session timeouts and IP-based access restrictions</li>
                <li>Regular vulnerability scanning and penetration testing</li>
                <li>24/7 automated security monitoring and anomaly detection</li>
              </ul>
            </div>

            <div>
              <SubHeading>10.2 Organizational Measures</SubHeading>
              <ul className="list-inside list-disc space-y-2 pl-2">
                <li>Strict access controls on a need-to-know basis for all employees</li>
                <li>Regular data protection training for all team members</li>
                <li>Annual third-party security audits (SOC 2 Type II)</li>
                <li>Incident response plan with 24-hour breach notification commitment</li>
                <li>Data processing agreements with all sub-processors</li>
              </ul>
            </div>

            <p>
              In the unlikely event of a data breach that poses a risk to your rights and freedoms, we
              will notify affected parties and relevant supervisory authorities within 72 hours as
              required by applicable law.
            </p>
          </Body>
        </Section>

        {/* 11. Changes */}
        <Section id="changes" title="11. Policy Changes">
          <Body>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              legal requirements, or operational needs. When we make material changes, we will notify
              you through the platform and, where appropriate, via email.
            </p>
            <p>
              We encourage you to review this policy periodically. The &ldquo;Last updated&rdquo; date at
              the top of this page indicates when the policy was last revised. Continued use of DPR.ai
              after changes take effect constitutes your acceptance of the updated policy.
            </p>
            <p>
              Significant changes include, but are not limited to: new data collection practices, changes
              in how we use data, new third-party processors, or changes to your rights under this policy.
            </p>
          </Body>
        </Section>

        {/* 12. Contact */}
        <Section id="contact" title="12. Contact Us">
          <Body>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data
              practices, please contact us:
            </p>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Email (Privacy Inquiries):</strong>{" "}
                <a href="mailto:privacy@dpr.ai" className="text-sky-300 hover:underline">
                  privacy@dpr.ai
                </a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Data Protection Officer:</strong>{" "}
                <a href="mailto:dpo@dpr.ai" className="text-sky-300 hover:underline">
                  dpo@dpr.ai
                </a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Postal Address:</strong> DPR.ai Technologies Pvt. Ltd.,
                4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India
              </p>
              <p>
                <strong className="text-slate-200">Response Time:</strong> We aim to respond to all
                inquiries within 10 business days.
              </p>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              For EU residents: You also have the right to lodge a complaint with your local data
              protection supervisory authority if you believe your rights have been violated.
            </p>
          </Body>
        </Section>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} DPR.ai Technologies Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1">
            <Link href="/" className="text-sky-300 hover:underline">
              Return to DPR.ai
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
