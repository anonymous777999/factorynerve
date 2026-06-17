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

function Body({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-sm leading-7 text-slate-300">{children}</div>;
}

function Q({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold text-slate-100">{children}</p>;
}

function A({ children }: { children: React.ReactNode }) {
  return <div className="text-sm leading-7 text-slate-300">{children}</div>;
}

function QaPair({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <Q>{question}</Q>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Refund and Cancellation Policy
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download PDF
          </a>
        </div>

        {/* Quick summary */}
        <div className="mb-10 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-5">
          <p className="text-sm leading-7 text-sky-200">
            <strong>Quick summary:</strong> You can cancel anytime from your account settings. Monthly
            subscriptions are non-refundable. Annual subscriptions may qualify for a prorated refund
            within the first 30 days. After cancellation, you have 60 days to export your data.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            On this page
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "subscription-model", label: "1. Subscription Model Overview" },
              { id: "cancellation", label: "2. Cancellation Process" },
              { id: "refunds", label: "3. Refund Eligibility" },
              { id: "request", label: "4. How to Request a Refund" },
              { id: "disputes", label: "5. Billing Disputes" },
              { id: "downgrades", label: "6. Downgrades" },
              { id: "non-payment", label: "7. Non-Payment and Suspension" },
              { id: "contact", label: "8. Contact Information" },
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

        {/* 1. Subscription Model */}
        <Section id="subscription-model" title="1. Subscription Model Overview">
          <Body>
            <QaPair question="How does DPR.ai billing work?">
              <A>
                <p>
                  DPR.ai operates on a subscription (SaaS) model. You pay a recurring fee to access
                  the platform, and your subscription renews automatically at the end of each billing
                  period unless you cancel.
                </p>
              </A>
            </QaPair>

            <QaPair question="What billing cycles are available?">
              <A>
                <p>
                  We offer two billing options:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                  <li>
                    <strong>Monthly billing</strong> &mdash; You are charged once per month on your
                    subscription anniversary date.
                  </li>
                  <li>
                    <strong>Annual billing</strong> &mdash; You are charged once per year. Annual plans
                    typically come at a discounted rate compared to monthly billing.
                  </li>
                </ul>
              </A>
            </QaPair>

            <QaPair question="Does my subscription auto-renew?">
              <A>
                <p>
                  Yes. All subscriptions renew automatically at the end of each billing period unless
                  canceled in advance. You will receive an email reminder before renewal. You can turn
                  off auto-renewal at any time from your account settings.
                </p>
              </A>
            </QaPair>

            <QaPair question="What payment methods do you accept?">
              <A>
                <p>
                  We accept major credit cards (Visa, Mastercard, Amex), debit cards, UPI, and net
                  banking through our payment partners Stripe and Razorpay. Payment is collected at the
                  start of each billing period.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 2. Cancellation */}
        <Section id="cancellation" title="2. Cancellation Process">
          <Body>
            <QaPair question="How do I cancel my subscription?">
              <A>
                <p>
                  Cancellation is self-service from your account settings:
                </p>
                <ol className="mt-2 list-inside list-decimal space-y-1 pl-2">
                  <li>Go to <strong>Settings &rarr; Subscription</strong>.</li>
                  <li>Click <strong>Cancel Subscription</strong>.</li>
                  <li>Follow the prompts to confirm cancellation.</li>
                </ol>
                <p className="mt-2">
                  If you encounter any issues, email{" "}
                  <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">billing@dpr.ai</a>{" "}
                  and our team will process it manually.
                </p>
              </A>
            </QaPair>

            <QaPair question="When does my cancellation take effect?">
              <A>
                <p>
                  Cancellation takes effect at the <strong>end of the current billing period</strong>.
                  You retain full access to the platform until that date. We do not provide immediate
                  cancellations with prorated refunds (except as noted in Section 3 for annual plans).
                </p>
              </A>
            </QaPair>

            <QaPair question="What happens to my data after cancellation?">
              <A>
                <p>
                  After cancellation, you have <strong>60 days</strong> to export your data. During this
                  period, your account enters a read-only state &mdash; you can log in, view, and export
                  your data, but you cannot create new records or use active features.
                </p>
                <p className="mt-2">
                  After 60 days, your account and all associated data will be permanently deleted from
                  our systems, subject to any legal retention obligations we may have. We recommend
                  exporting your data before cancellation.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 3. Refunds */}
        <Section id="refunds" title="3. Refund Eligibility">
          <Body>
            <QaPair question="What is your refund policy for monthly subscriptions?">
              <A>
                <p>
                  <strong>Monthly subscriptions are non-refundable.</strong> Because you are billed
                  month-to-month and can cancel at any time before the next billing date, we do not
                  offer refunds for partial months or unused time within a billing period.
                </p>
              </A>
            </QaPair>

            <QaPair question="What about annual subscriptions?">
              <A>
                <p>
                  Annual subscriptions <strong>may qualify for a prorated refund</strong> if you cancel
                  within the first <strong>30 days</strong> of the annual term. The refund amount will
                  be prorated based on the remaining months in the annual term, minus any service already
                  used.
                </p>
                <p className="mt-2">
                  After the first 30 days of an annual subscription, no refunds are available. However,
                  you may continue using the service for the remainder of the paid annual term.
                </p>
              </A>
            </QaPair>

            <QaPair question="Are there any exceptions for technical issues?">
              <A>
                <p>
                  If you experience a <strong>critical technical issue</strong> that prevents you from
                  using the platform and we cannot resolve it within 5 business days, we may, at our
                  discretion, issue a prorated refund or service credit. Each case is reviewed
                  individually by our support team.
                </p>
              </A>
            </QaPair>

            <QaPair question="What is the timeframe to request a refund?">
              <A>
                <p>
                  Refund requests must be submitted within <strong>7 days</strong> of the charge date.
                  Requests received after this window will not be considered, except in cases of
                  demonstrable technical failure on our part.
                </p>
              </A>
            </QaPair>

            <QaPair question="Does DPR.ai offer any guarantees?">
              <A>
                <p>
                  We stand behind our platform. If you are a new customer and DPR.ai does not meet
                  your needs within the first <strong>14 days</strong> of your paid subscription
                  (monthly or annual), contact us for a full refund. This trial-period guarantee
                  applies once per customer.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 4. How to Request */}
        <Section id="request" title="4. How to Request a Refund">
          <Body>
            <QaPair question="How do I submit a refund request?">
              <A>
                <p>
                  Send an email to{" "}
                  <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">billing@dpr.ai</a>{" "}
                  with the following information:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                  <li>Account email address</li>
                  <li>Company or factory name</li>
                  <li>Invoice number or transaction ID (found in Settings &rarr; Billing)</li>
                  <li>Reason for the refund request</li>
                </ul>
              </A>
            </QaPair>

            <QaPair question="How long does it take to process a refund?">
              <A>
                <p>
                  Refund requests are processed within <strong>5&ndash;10 business days</strong> of
                  approval. The refund is issued to the original payment method. Depending on your
                  bank or card issuer, it may take 3&ndash;5 additional business days to appear on
                  your statement.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 5. Billing Disputes */}
        <Section id="disputes" title="5. Billing Disputes">
          <Body>
            <QaPair question="How do I report an incorrect charge?">
              <A>
                <p>
                  If you believe you have been charged incorrectly (e.g., duplicate charge, wrong
                  amount, unauthorized charge), please contact us immediately at{" "}
                  <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">billing@dpr.ai</a>.
                </p>
              </A>
            </QaPair>

            <QaPair question="What happens after I report a dispute?">
              <A>
                <p>
                  Our billing team will investigate and respond within <strong>3 business days</strong>.
                  During the investigation, your account will remain active. If the charge is confirmed
                  to be in error, we will issue a full refund within 5 business days.
                </p>
              </A>
            </QaPair>

            <QaPair question="Should I file a chargeback with my bank?">
              <A>
                <p>
                  Please contact us first before initiating a chargeback. We are committed to resolving
                  disputes directly and quickly. Filing a chargeback without contacting us may delay
                  resolution and result in account suspension. If a chargeback is filed after a refund
                  has already been processed, we may dispute it.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 6. Downgrades */}
        <Section id="downgrades" title="6. Downgrades">
          <Body>
            <QaPair question="Can I downgrade my plan?">
              <A>
                <p>
                  Yes. You can change to a lower-priced plan at any time from{" "}
                  <strong>Settings &rarr; Subscription &rarr; Change Plan</strong>. The downgrade takes
                  effect at the <strong>end of the current billing period</strong>. You retain access
                  to all features of your current plan until then.
                </p>
              </A>
            </QaPair>

            <QaPair question="Will I get a refund for downgrading?">
              <A>
                <p>
                  No. Downgrading does not entitle you to a refund for the remaining portion of the
                  current billing period. The new, lower rate will apply starting from the next billing
                  cycle.
                </p>
              </A>
            </QaPair>

            <QaPair question="What happens to features I lose after downgrading?">
              <A>
                <p>
                  If your new plan does not include certain features (e.g., OCR credits, AI operations,
                  additional users), those features will be disabled at the start of the next billing
                  period. Your existing data is not deleted &mdash; you simply lose the ability to
                  create new records using those features.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 7. Non-Payment */}
        <Section id="non-payment" title="7. Non-Payment and Service Suspension">
          <Body>
            <QaPair question="What happens if my payment fails?">
              <A>
                <p>
                  If a payment fails, we will notify you by email and retry the charge automatically
                  after <strong>3 days</strong>. If the second attempt also fails, we will send
                  another notice and retry once more after <strong>7 days</strong>.
                </p>
              </A>
            </QaPair>

            <QaPair question="When is my account suspended?">
              <A>
                <p>
                  If payment is not received within <strong>15 days</strong> of the original invoice
                  date, your account will be suspended. During suspension:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                  <li>You cannot log in to the platform.</li>
                  <li>All scheduled reports and notifications are paused.</li>
                  <li>OCR processing and API access are disabled.</li>
                </ul>
              </A>
            </QaPair>

            <QaPair question="How do I restore access after suspension?">
              <A>
                <p>
                  To restore access, pay the outstanding balance from your account settings or contact
                  our billing team. Once payment is confirmed, access is typically restored within a
                  few minutes.
                </p>
              </A>
            </QaPair>

            <QaPair question="What happens to my data after prolonged non-payment?">
              <A>
                <p>
                  If the account remains unpaid for <strong>60 days</strong> after suspension, we will
                  permanently delete your account and all associated data, subject to legal retention
                  requirements. We will send multiple reminders before deletion.
                </p>
              </A>
            </QaPair>
          </Body>
        </Section>

        {/* 8. Contact */}
        <Section id="contact" title="8. Contact Information">
          <Body>
            <p>
              For any billing, refund, or cancellation questions, contact us:
            </p>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Billing Inquiries:</strong>{" "}
                <a href="mailto:billing@dpr.ai" className="text-sky-300 hover:underline">
                  billing@dpr.ai
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
                <strong className="text-slate-200">Response Time:</strong> Billing inquiries are
                answered within 1 business day.
              </p>
            </div>

            <p className="text-xs text-slate-500">
              See also our{" "}
              <Link href="/terms" className="text-sky-300 hover:underline">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-sky-300 hover:underline">Privacy Policy</Link>{" "}
              for more information.
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
            <Link href="/cookies" className="text-sky-300 hover:underline">Cookie Policy</Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="text-sky-300 hover:underline">Return to DPR.ai</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
