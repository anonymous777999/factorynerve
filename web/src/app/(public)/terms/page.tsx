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

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Version 1.0 &mdash; Last updated: June 17, 2026
            </p>
            <p className="text-xs text-slate-500">
              Effective: June 17, 2026
            </p>
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
              { id: "acceptance", label: "1. Agreement Acceptance and Scope" },
              { id: "account", label: "2. Account Registration and Responsibilities" },
              { id: "subscription", label: "3. Subscription and Service Plans" },
              { id: "payment", label: "4. Payment Terms" },
              { id: "data-ownership", label: "5. Data Ownership" },
              { id: "aup", label: "6. Acceptable Use Policy" },
              { id: "availability", label: "7. Service Availability and Limitations" },
              { id: "ip", label: "8. Intellectual Property" },
              { id: "confidentiality", label: "9. Confidentiality" },
              { id: "liability", label: "10. Limitation of Liability" },
              { id: "indemnification", label: "11. Indemnification" },
              { id: "termination", label: "12. Account Suspension and Termination" },
              { id: "modifications", label: "13. Modifications to Terms" },
              { id: "disputes", label: "14. Dispute Resolution and Governing Law" },
              { id: "entire-agreement", label: "15. Entire Agreement" },
              { id: "contact", label: "16. Contact Information" },
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

        {/* Preliminary note */}
        <div className="mb-10 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="text-sm leading-7 text-amber-200">
            <strong>Acceptance:</strong> By accessing or using DPR.ai (&ldquo;the Platform&rdquo;), you agree
            to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you are entering into these Terms
            on behalf of a legal entity (&ldquo;Customer&rdquo;), you represent that you have the authority to
            bind that entity. If you do not agree, do not use the Platform.
          </p>
        </div>

        {/* 1. Acceptance and Scope */}
        <Section id="acceptance" title="1. Agreement Acceptance and Scope">
          <Body>
            <p>
              <strong>1.1</strong> These Terms of Service govern the use of the DPR.ai SaaS platform, including
              all associated web applications, mobile applications, APIs, and related services (collectively,
              the &ldquo;Service&rdquo; or &ldquo;Platform&rdquo;).
            </p>
            <p>
              <strong>1.2</strong> The Service is a B2B operational data management platform designed for
              manufacturing facilities. Features include attendance tracking, production reporting, inventory
              management, OCR document processing, invoicing, employee records, and related operational tools.
            </p>
            <p>
              <strong>1.3</strong> These Terms apply to all users of the Platform, including account
              administrators, supervisors, operators, and any individual accessing the Service under a
              Customer account (&ldquo;Authorized Users&rdquo;).
            </p>
            <p>
              <strong>1.4</strong> DPR.ai reserves the right to update or modify these Terms at any time
              in accordance with Section 13. Continued use of the Platform after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </Body>
        </Section>

        {/* 2. Account Registration and Responsibilities */}
        <Section id="account" title="2. Account Registration and Responsibilities">
          <Body>
            <p>
              <strong>2.1 Account Registration.</strong> To access the Platform, the Customer must register
              for an account by providing accurate, current, and complete information as prompted by the
              registration form. Each account must be registered using a valid work email address.
            </p>

            <p>
              <strong>2.2 Admin Account Obligations.</strong> The Customer designates one or more account
              administrators (&ldquo;Admins&rdquo;) who are responsible for:
            </p>
            <ul className="list-inside list-disc space-y-2 pl-2">
              <li>Managing Authorized Users and their access permissions</li>
              <li>Ensuring that all users comply with these Terms</li>
              <li>Maintaining accurate billing and contact information</li>
              <li>Configuring factory, shift, and employee data within the Platform</li>
              <li>Responding to DPR.ai notices regarding account or security matters</li>
            </ul>

            <p>
              <strong>2.3 Accuracy of Information.</strong> The Customer warrants that all information
              provided during registration and throughout the use of the Service is accurate, complete,
              and up to date. The Customer must promptly update any changes through the account settings
              or by contacting support.
            </p>

            <p>
              <strong>2.4 Account Security.</strong> The Customer is responsible for maintaining the
              confidentiality of all login credentials, including passwords and API keys. The Customer
              must notify DPR.ai immediately of any unauthorized use of the account or any security
              breach. DPR.ai is not liable for any loss or damage arising from unauthorized use of the
              Customer&rsquo;s account.
            </p>

            <p>
              <strong>2.5 User Eligibility.</strong> The Service may only be used by individuals who are
              authorized employees, contractors, or agents of the Customer. Users must be at least 18
              years of age. The Customer is fully responsible for the actions of all Authorized Users
              under its account.
            </p>
          </Body>
        </Section>

        {/* 3. Subscription and Service Plans */}
        <Section id="subscription" title="3. Subscription and Service Plans">
          <Body>
            <p>
              <strong>3.1 Plan Types.</strong> DPR.ai offers subscription plans that vary by included
              features, number of Authorized Users, number of facilities, and usage limits (including
              OCR credits, AI operations, and WhatsApp messages). Plan details are described on the
              pricing page at the time of subscription and in the Customer&rsquo;s order form.
            </p>

            <p>
              <strong>3.2 Subscription Periods.</strong> Subscriptions are billed on a monthly or annual
              basis as selected during registration. The subscription period begins on the activation date
              and renews automatically unless canceled in accordance with Section 12.
            </p>

            <p>
              <strong>3.3 User and Facility Limits.</strong> Each plan includes a specified maximum number
              of Authorized Users and registered facilities. Exceeding these limits may result in additional
              charges or enforced restrictions. The Customer may upgrade their plan at any time to increase
              limits.
            </p>

            <p>
              <strong>3.4 Feature Availability.</strong> Features are subject to the plan selected. DPR.ai
              reserves the right to modify, add, or remove features across plans with reasonable notice.
              Critical feature changes will be communicated at least 30 days in advance.
            </p>

            <p>
              <strong>3.5 Trial Periods.</strong> If the Customer registers for a free trial, DPR.ai will
              make the applicable Service available on a trial basis until the earlier of (a) the end of
              the trial period, or (b) the start date of any purchased subscription. Trial use is subject
              to all terms of this agreement, except that no payment obligation accrues during the trial.
              At the end of the trial, access will be suspended unless a paid subscription is activated.
            </p>
          </Body>
        </Section>

        {/* 4. Payment Terms */}
        <Section id="payment" title="4. Payment Terms">
          <Body>
            <p>
              <strong>4.1 Billing Cycles.</strong> DPR.ai invoices in advance for monthly subscriptions
              and in full for annual subscriptions. Invoices are generated on the subscription start date
              and on each renewal date thereafter.
            </p>

            <p>
              <strong>4.2 Payment Methods.</strong> Payments are processed through DPR.ai&rsquo;s third-party
              payment processors (including Stripe and Razorpay). Acceptable payment methods include major
              credit cards, debit cards, UPI, and net banking, as available in the Customer&rsquo;s region.
              The Customer authorizes DPR.ai to charge the chosen payment method on each billing date.
            </p>

            <p>
              <strong>4.3 Late Payment.</strong> If payment is not received within 15 days of the invoice
              date, DPR.ai may: (a) suspend access to the Platform until the outstanding amount is paid
              in full, (b) charge a late fee of 1.5% per month (or the maximum permitted by law) on all
              overdue balances, and (c) pursue collection of the debt through legal means, with the
              Customer responsible for all collection costs.
            </p>

            <p>
              <strong>4.4 Price Changes.</strong> DPR.ai may adjust subscription prices at any time.
              Price increases will take effect at the next renewal period and will be communicated at
              least 30 days in advance. If the Customer does not agree to the price change, they may
              cancel the subscription before the renewal date without penalty.
            </p>

            <p>
              <strong>4.5 Taxes.</strong> All fees are exclusive of applicable taxes, duties, or
              government levies. The Customer is responsible for paying all taxes associated with their
              use of the Service, excluding taxes based on DPR.ai&rsquo;s income.
            </p>

            <p>
              <strong>4.6 No Refunds.</strong> Subscription fees are non-refundable except as expressly
              stated in these Terms or as required by applicable law. Partial-month subscriptions are not
              prorated upon cancellation.
            </p>
          </Body>
        </Section>

        {/* 5. Data Ownership */}
        <Section id="data-ownership" title="5. Data Ownership">
          <Body>
            <p>
              <strong>5.1 Customer Data Ownership.</strong> The Customer retains all right, title, and
              interest in and to all data, information, and materials uploaded, submitted, or generated
              through the Platform (&ldquo;Customer Data&rdquo;). This includes production reports,
              attendance records, inventory data, OCR-scanned documents, invoices, employee records,
              and any other data the Customer enters into the Service.
            </p>

            <p>
              <strong>5.2 Limited License to Process.</strong> The Customer grants DPR.ai a limited,
              non-exclusive, non-transferable license to access, process, store, and display Customer
              Data solely as necessary to: (a) provide, maintain, and improve the Service, (b) generate
              reports and analytics for the Customer, and (c) comply with legal obligations. This license
              does not grant DPR.ai any ownership rights in Customer Data.
            </p>

            <p>
              <strong>5.3 Aggregated Anonymized Data.</strong> DPR.ai may use anonymized, aggregated data
              derived from Customer Data for analytics, benchmarking, and product improvement purposes,
              provided that such data cannot identify the Customer or any individual. No Customer Data
              in identifiable form will be used for these purposes.
            </p>

            <p>
              <strong>5.4 Data Export.</strong> The Customer may export their data at any time through
              the Platform&rsquo;s export features. DPR.ai will provide Customer Data in a commonly used,
              machine-readable format upon request within 30 days of termination, subject to Section 12.7.
            </p>

            <p>
              <strong>5.5 Data Portability.</strong> DPR.ai shall not create a barrier to the
              Customer&rsquo;s ability to retrieve their data. Upon termination, DPR.ai will make Customer
              Data available for download for a period of 60 days in accordance with Section 12.7.
            </p>
          </Body>
        </Section>

        {/* 6. Acceptable Use Policy */}
        <Section id="aup" title="6. Acceptable Use Policy">
          <Body>
            <p>
              <strong>6.1 Permitted Uses.</strong> The Platform may only be used for lawful, legitimate
              business purposes related to the Customer&rsquo;s manufacturing operations. The Customer
              agrees to use the Service in compliance with all applicable local, national, and
              international laws and regulations.
            </p>

            <p>
              <strong>6.2 Prohibited Activities.</strong> The Customer must not, and must not permit any
              Authorized User to:
            </p>
            <ul className="list-inside list-disc space-y-2 pl-2">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable law</li>
              <li>Access or attempt to access another customer&rsquo;s account or data</li>
              <li>Upload, store, or transmit viruses, malware, or any malicious code</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Platform</li>
              <li>Scrape, crawl, or harvest data from the Platform without prior written consent</li>
              <li>Use the Platform to send unsolicited communications (spam)</li>
              <li>Circumvent any access controls, rate limits, or security measures</li>
              <li>Use the Platform in a way that could damage DPR.ai&rsquo;s reputation or goodwill</li>
              <li>Resell, sublicense, or redistribute the Service to any third party without authorization</li>
            </ul>

            <p>
              <strong>6.3 Monitoring and Enforcement.</strong> DPR.ai reserves the right to monitor use
              of the Platform for compliance with these Terms. We may investigate suspected violations
              and take appropriate action, including suspension or termination of access, as described
              in Section 12.
            </p>

            <p>
              <strong>6.4 Content Standards.</strong> The Customer must not upload or transmit any
              material that is defamatory, obscene, infringing, or otherwise objectionable. DPR.ai
              reserves the right to remove any content that violates these standards without prior notice.
            </p>
          </Body>
        </Section>

        {/* 7. Service Availability and Limitations */}
        <Section id="availability" title="7. Service Availability and Limitations">
          <Body>
            <p>
              <strong>7.1 Service Provided &ldquo;As-Is.&rdquo;</strong> THE PLATFORM IS PROVIDED
              &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, EXCEPT AS EXPRESSLY SET FORTH IN THIS SECTION. DPR.ai
              DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <p>
              <strong>7.2 Scheduled Maintenance.</strong> DPR.ai may perform scheduled maintenance
              during designated maintenance windows. We will use reasonable efforts to schedule
              maintenance during low-usage periods and to provide at least 24 hours&rsquo; notice
              through the Platform or email. Emergency maintenance may be performed without prior notice.
            </p>

            <p>
              <strong>7.3 No Guarantee of Uninterrupted Service.</strong> While DPR.ai strives for 99.9%
              uptime, we do not guarantee that the Service will be uninterrupted, error-free, secure, or
              free from defects. The Service may be temporarily unavailable due to factors beyond our
              reasonable control, including internet outages, third-party service failures, or force
              majeure events.
            </p>

            <p>
              <strong>7.4 Service Level Commitment.</strong> DPR.ai offers a service level commitment
              as described in the order form or applicable plan documentation. Service credits, if any,
              are the sole remedy for uptime failures and are governed by the SLA terms.
            </p>

            <p>
              <strong>7.5 Beta Features.</strong> From time to time, DPR.ai may offer beta or early-access
              features (&ldquo;Beta Features&rdquo;). Beta Features are provided &ldquo;as is&rdquo;
              without any warranty and may be discontinued at any time without notice.
            </p>
          </Body>
        </Section>

        {/* 8. Intellectual Property */}
        <Section id="ip" title="8. Intellectual Property">
          <Body>
            <p>
              <strong>8.1 DPR.ai Ownership.</strong> DPR.ai owns all right, title, and interest in and
              to the Platform, including its software, code, design, user interface, algorithms,
              documentation, trademarks, trade dress, and all related intellectual property rights.
              These Terms do not transfer any ownership rights in the Platform to the Customer.
            </p>

            <p>
              <strong>8.2 Customer Ownership.</strong> The Customer retains all intellectual property
              rights in Customer Data and in any materials, content, or data the Customer provides to
              DPR.ai. DPR.ai claims no ownership over Customer Data.
            </p>

            <p>
              <strong>8.3 Feedback License.</strong> If the Customer or any Authorized User provides
              feedback, suggestions, or ideas about the Platform (&ldquo;Feedback&rdquo;), the Customer
              grants DPR.ai a perpetual, irrevocable, worldwide, royalty-free license to use, modify,
              incorporate, and commercialize that Feedback without any obligation or compensation to
              the Customer.
            </p>

            <p>
              <strong>8.4 Usage of Branding.</strong> DPR.ai may identify the Customer as a user of the
              Platform on DPR.ai&rsquo;s website and marketing materials. The Customer may request
              removal of such references at any time.
            </p>
          </Body>
        </Section>

        {/* 9. Confidentiality */}
        <Section id="confidentiality" title="9. Confidentiality">
          <Body>
            <p>
              <strong>9.1 Definition.</strong> &ldquo;Confidential Information&rdquo; means any
              non-public information disclosed by one party to the other, whether orally or in writing,
              that is designated as confidential or that reasonably should be understood to be
              confidential given the nature of the information and circumstances of disclosure.
            </p>

            <p>
              <strong>9.2 Obligations.</strong> Each party agrees to: (a) hold the other party&rsquo;s
              Confidential Information in strict confidence, (b) not disclose it to any third party
              except as necessary to perform obligations under these Terms, and (c) use it only for
              purposes related to these Terms.
            </p>

            <p>
              <strong>9.3 Exclusions.</strong> Confidential Information does not include information that:
              (a) is or becomes publicly available without breach of these Terms, (b) was known to the
              receiving party before disclosure, (c) is independently developed by the receiving party
              without use of the disclosing party&rsquo;s Confidential Information, or (d) is required
              to be disclosed by law or court order.
            </p>

            <p>
              <strong>9.4 Duration.</strong> Confidentiality obligations continue for 3 years from the
              date of disclosure, or indefinitely for trade secrets and source code.
            </p>
          </Body>
        </Section>

        {/* 10. Limitation of Liability */}
        <Section id="liability" title="10. Limitation of Liability">
          <Body>
            <p>
              <strong>10.1 Exclusion of Consequential Damages.</strong> TO THE MAXIMUM EXTENT PERMITTED
              BY APPLICABLE LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST
              REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO THESE TERMS
              OR THE USE OF THE PLATFORM.
            </p>

            <p>
              <strong>10.2 Liability Cap.</strong> DPR.AI&rsquo;S TOTAL LIABILITY TO THE CUSTOMER FOR
              ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE
              TOTAL SUBSCRIPTION FEES PAID BY THE CUSTOMER DURING THE 12 MONTHS IMMEDIATELY PRECEDING
              THE EVENT GIVING RISE TO THE CLAIM.
            </p>

            <p>
              <strong>10.3 Exceptions.</strong> Nothing in this Section 10 limits or excludes liability
              for: (a) death or personal injury caused by negligence, (b) fraud or fraudulent
              misrepresentation, (c) intentional misconduct or gross negligence, (d) infringement of
              intellectual property rights, or (e) any liability that cannot be excluded or limited
              under applicable law.
            </p>

            <p>
              <strong>10.4 Basis of the Bargain.</strong> The parties acknowledge that the subscription
              fees reflect the allocation of risk and limitations of liability set forth in these Terms,
              and that DPR.ai would not offer the Platform without these limitations.
            </p>
          </Body>
        </Section>

        {/* 11. Indemnification */}
        <Section id="indemnification" title="11. Indemnification">
          <Body>
            <p>
              <strong>11.1 Customer Indemnification.</strong> The Customer agrees to indemnify, defend,
              and hold harmless DPR.ai, its affiliates, officers, directors, employees, and agents from
              and against all claims, damages, losses, liabilities, and expenses (including reasonable
              legal fees) arising out of or related to:
            </p>
            <ul className="list-inside list-disc space-y-2 pl-2">
              <li>The Customer&rsquo;s use of the Platform in violation of these Terms</li>
              <li>Any Customer Data that infringes third-party rights or violates applicable law</li>
              <li>Any dispute between the Customer and its Authorized Users</li>
              <li>The Customer&rsquo;s violation of any applicable law or regulation</li>
            </ul>

            <p>
              <strong>11.2 DPR.ai Indemnification.</strong> DPR.ai shall indemnify the Customer against
              any third-party claim that the Platform (excluding Customer Data) infringes any patent,
              copyright, trademark, or trade secret, provided that: (a) the Customer promptly notifies
              DPR.ai of the claim, (b) DPR.ai has sole control over the defense and settlement, and
              (c) the Customer cooperates fully with DPR.ai&rsquo;s defense.
            </p>

            <p>
              <strong>11.3 Mitigation.</strong> If the Platform is found to infringe, DPR.ai may, at its
              option: (a) modify the Platform to make it non-infringing, (b) obtain a license for the
              Customer to continue use, or (c) terminate the subscription and refund any prepaid fees
              for the unused portion.
            </p>
          </Body>
        </Section>

        {/* 12. Account Suspension and Termination */}
        <Section id="termination" title="12. Account Suspension and Termination">
          <Body>
            <p>
              <strong>12.1 Grounds for Suspension.</strong> DPR.ai may suspend access to the Platform
              immediately if: (a) payment is overdue by more than 15 days, (b) the Customer materially
              breaches these Terms (including the Acceptable Use Policy), (c) the Customer&rsquo;s use
              of the Platform poses a security risk to DPR.ai or other customers, or (d) required by
              applicable law or regulatory authority.
            </p>

            <p>
              <strong>12.2 Notice of Suspension.</strong> DPR.ai will provide notice of suspension within
              24 hours, except in urgent security situations where immediate action is required.
            </p>

            <p>
              <strong>12.3 Termination by Customer.</strong> The Customer may terminate these Terms at any
              time by canceling the account through the Platform settings or by contacting support.
              Termination takes effect at the end of the current billing period.
            </p>

            <p>
              <strong>12.4 Termination by DPR.ai.</strong> DPR.ai may terminate these Terms and the
              Customer&rsquo;s access to the Platform: (a) for cause, if the Customer fails to cure a
              material breach within 15 days of written notice, (b) immediately for violations of
              Section 6 (Acceptable Use Policy), or (c) for convenience, with 60 days&rsquo; written
              notice.
            </p>

            <p>
              <strong>12.5 Effect of Termination.</strong> Upon termination: (a) all rights granted to
              the Customer under these Terms immediately cease, (b) the Customer must stop all use of
              the Platform, (c) any outstanding payment obligations become immediately due, and
              (d) Customer Data will be handled as described in Section 12.7.
            </p>

            <p>
              <strong>12.6 Survival.</strong> Sections 5 (Data Ownership), 8 (Intellectual Property),
              9 (Confidentiality), 10 (Limitation of Liability), 11 (Indemnification), 14 (Dispute
              Resolution), and this Section 12.6 shall survive any termination of these Terms.
            </p>

            <p>
              <strong>12.7 Data Retrieval Period.</strong> For 60 days after termination, DPR.ai will
              provide the Customer with access to export Customer Data in a commonly used format upon
              request. After 60 days, DPR.ai may permanently delete all Customer Data from its systems,
              subject to legal retention requirements. DPR.ai has no obligation to retain Customer Data
              beyond the 60-day retrieval window.
            </p>
          </Body>
        </Section>

        {/* 13. Modifications to Terms */}
        <Section id="modifications" title="13. Modifications to Terms">
          <Body>
            <p>
              <strong>13.1</strong> DPR.ai reserves the right to modify these Terms at any time.
              Material changes will be communicated to the Customer via email and through the Platform
              at least 30 days before the effective date. Non-material changes may be made without
              prior notice.
            </p>

            <p>
              <strong>13.2</strong> If the Customer does not agree to a material change, they may
              terminate the subscription before the effective date without penalty by providing written
              notice. Continued use of the Platform after a modification takes effect constitutes
              acceptance of the modified Terms.
            </p>

            <p>
              <strong>13.3</strong> DPR.ai will maintain an archive of previous versions of these Terms
              available upon request.
            </p>
          </Body>
        </Section>

        {/* 14. Dispute Resolution */}
        <Section id="disputes" title="14. Dispute Resolution and Governing Law">
          <Body>
            <p>
              <strong>14.1 Governing Law.</strong> These Terms shall be governed by and construed in
              accordance with the laws of India, without regard to its conflict-of-laws principles.
              The United Nations Convention on Contracts for the International Sale of Goods does not
              apply.
            </p>

            <p>
              <strong>14.2 Informal Resolution.</strong> Before initiating any legal proceeding, the
              parties agree to attempt to resolve any dispute informally by contacting the other party
              and negotiating in good faith for at least 30 days.
            </p>

            <p>
              <strong>14.3 Arbitration.</strong> Any dispute arising out of or related to these Terms
              that cannot be resolved informally shall be settled by binding arbitration administered
              by the Indian Arbitration Council in accordance with its rules. The arbitration shall be
              conducted in English in Shillong, Meghalaya, India. The decision of the arbitrator shall
              be final and binding on both parties.
            </p>

            <p>
              <strong>14.4 Jurisdiction.</strong> Subject to Section 14.3, the courts located in
              Shillong, Meghalaya, India shall have exclusive jurisdiction over any disputes not subject
              to arbitration.
            </p>

            <p>
              <strong>14.5 Class Action Waiver.</strong> Both parties agree that any dispute resolution
              proceedings shall be conducted on an individual basis and not as a class, consolidated,
              or representative action.
            </p>
          </Body>
        </Section>

        {/* 15. Entire Agreement */}
        <Section id="entire-agreement" title="15. Entire Agreement">
          <Body>
            <p>
              <strong>15.1</strong> These Terms, together with the Privacy Policy, any order form or
              plan description, and any data processing agreement (DPA) entered into by the parties,
              constitute the entire agreement between the Customer and DPR.ai regarding the use of the
              Platform.
            </p>

            <p>
              <strong>15.2</strong> These Terms supersede all prior or contemporaneous agreements,
              representations, warranties, and understandings, whether written or oral.
            </p>

            <p>
              <strong>15.3</strong> If any provision of these Terms is found to be unenforceable or
              invalid, that provision shall be limited or eliminated to the minimum extent necessary,
              and the remaining provisions shall remain in full force and effect.
            </p>

            <p>
              <strong>15.4</strong> No failure or delay by either party in exercising any right under
              these Terms shall operate as a waiver of that right.
            </p>

            <p>
              <strong>15.5</strong> The Customer may not assign or transfer these Terms, or any rights
              or obligations hereunder, without DPR.ai&rsquo;s prior written consent. DPR.ai may assign
              these Terms without restriction.
            </p>
          </Body>
        </Section>

        {/* 16. Contact */}
        <Section id="contact" title="16. Contact Information">
          <Body>
            <p>
              For questions, complaints, or notices regarding these Terms, please contact DPR.ai using
              the information below:
            </p>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Email (Legal Notices):</strong>{" "}
                <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">
                  legal@dpr.ai
                </a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Customer Support:</strong>{" "}
                <a href="mailto:support@dpr.ai" className="text-sky-300 hover:underline">
                  support@dpr.ai
                </a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Postal Address:</strong> DPR.ai Technologies Pvt. Ltd.,
                4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India
              </p>
              <p>
                <strong className="text-slate-200">Response Time:</strong> We aim to respond to legal
                inquiries within 10 business days.
              </p>
            </div>
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
            <Link href="/" className="text-sky-300 hover:underline">
              Return to DPR.ai
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
