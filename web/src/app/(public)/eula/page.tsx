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

export default function EULAPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              End User License Agreement
            </h1>
            <p className="mt-1 text-sm text-slate-400">Version 1.0 &mdash; Last updated: June 17, 2026</p>
            <p className="text-xs text-slate-500">Effective: June 17, 2026</p>
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
              { id: "definitions", label: "1. Definitions" },
              { id: "license", label: "2. License Grant" },
              { id: "restrictions", label: "3. License Restrictions" },
              { id: "accounts", label: "4. User Accounts" },
              { id: "ip", label: "5. Intellectual Property" },
              { id: "open-source", label: "6. Third-Party & Open Source Components" },
              { id: "updates", label: "7. Updates and Modifications" },
              { id: "term", label: "8. Term and Termination" },
              { id: "warranty", label: "9. Disclaimer of Warranties" },
              { id: "liability", label: "10. Limitation of Liability" },
              { id: "law", label: "11. Governing Law" },
              { id: "contact", label: "12. Contact" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 transition-colors hover:text-white hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Preliminary note */}
        <div className="mb-10 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="text-sm leading-7 text-amber-200">
            <strong>Please read this End User License Agreement carefully.</strong> By installing,
            accessing, or using the DPR.ai software or platform, you agree to be bound by the terms
            of this EULA. If you are accepting on behalf of an organisation, you represent that you
            have the authority to bind that organisation. If you do not agree, do not use the software.
          </p>
        </div>

        {/* 1. Definitions */}
        <Section id="definitions" title="1. Definitions">
          <Body>
            <p>The following capitalised terms have the meanings set forth below:</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p><strong className="text-slate-200">&ldquo;DPR.ai&rdquo;</strong> means DPR.ai Technologies Pvt. Ltd., the licensor under this Agreement.</p>
              <p><strong className="text-slate-200">&ldquo;Software&rdquo;</strong> means the DPR.ai web application, mobile application, APIs, and all associated code, documentation, and updates provided by DPR.ai.</p>
              <p><strong className="text-slate-200">&ldquo;You&rdquo; or &ldquo;Licensee&rdquo;</strong> means the individual or entity that has agreed to this EULA and is authorised to use the Software.</p>
              <p><strong className="text-slate-200">&ldquo;Authorised Users&rdquo;</strong> means individuals designated by You who are permitted to access the Software under your subscription.</p>
              <p><strong className="text-slate-200">&ldquo;Documentation&rdquo;</strong> means any user guides, manuals, technical documentation, and support materials provided by DPR.ai.</p>
            </div>
          </Body>
        </Section>

        {/* 2. License Grant */}
        <Section id="license" title="2. License Grant">
          <SubHeading>2.1 Grant of License</SubHeading>
          <Body>
            <p>
              Subject to the terms and conditions of this EULA, DPR.ai grants You a non-exclusive,
              non-transferable, non-sublicensable, revocable, limited license to access and use the
              Software and Documentation solely for your internal business operations during the
              applicable subscription term.
            </p>
          </Body>
          <SubHeading>2.2 Scope of Use</SubHeading>
          <Body>
            <p>
              Your license is limited to the number of Authorised Users and the service plan
              specified in your subscription. You may permit Authorised Users to access the Software
              provided they comply with this EULA. You are responsible for all activities conducted
              under your account.
            </p>
          </Body>
          <SubHeading>2.3 Reservation of Rights</SubHeading>
          <Body>
            <p>
              All rights not expressly granted to You are reserved by DPR.ai. The Software is licensed,
              not sold. This EULA does not convey any ownership rights or title in the Software.
            </p>
          </Body>
        </Section>

        {/* 3. License Restrictions */}
        <Section id="restrictions" title="3. License Restrictions">
          <Body>
            <p>You agree that You will not, and will not permit any third party to:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Copy, reproduce, modify, or create derivative works of the Software, in whole or in part</li>
              <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Software, except to the extent expressly permitted by applicable law</li>
              <li>Rent, lease, lend, sell, redistribute, or sublicense the Software to any third party</li>
              <li>Use the Software to provide services to third parties (e.g., as a service bureau or ASP) without prior written consent</li>
              <li>Remove, alter, or obscure any copyright, trademark, or other proprietary notices in the Software</li>
              <li>Circumvent or disable any security features, licence controls, or usage limits in the Software</li>
              <li>Use the Software in a manner that violates applicable laws or third-party rights</li>
              <li>Publish benchmark tests or performance analyses of the Software without prior written permission</li>
              <li>Use automated tools (bots, scrapers, crawlers) to extract data from the Software beyond permitted API limits</li>
            </ol>
          </Body>
        </Section>

        {/* 4. User Accounts */}
        <Section id="accounts" title="4. User Accounts">
          <Body>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Provide accurate, current, and complete account information</li>
              <li>Notify DPR.ai immediately of any unauthorised use of your account</li>
              <li>Ensure that Authorised Users comply with this EULA and all applicable policies</li>
              <li>Not share accounts or credentials between individuals</li>
            </ul>
            <p className="mt-4">
              DPR.ai reserves the right to suspend or terminate accounts that violate this EULA
              or our Acceptable Use Policy.
            </p>
          </Body>
        </Section>

        {/* 5. Intellectual Property */}
        <Section id="ip" title="5. Intellectual Property">
          <Body>
            <p>
              <strong className="text-slate-200">Ownership.</strong> DPR.ai retains all rights, title,
              and interest in and to the Software, including all intellectual property rights therein.
              This EULA does not transfer any ownership rights to You.
            </p>
            <p>
              <strong className="text-slate-200">Feedback.</strong> If You provide suggestions,
              enhancement requests, recommendations, or other feedback regarding the Software, DPR.ai
              may use such feedback without restriction or obligation to You.
            </p>
            <p>
              <strong className="text-slate-200">Your Data.</strong> As between You and DPR.ai, You
              retain all rights to the data, content, and materials You upload or input into the
              Software (&ldquo;Your Data&rdquo;). You grant DPR.ai a limited license to process Your
              Data solely to provide, maintain, and improve the Software in accordance with our
              Privacy Policy and Data Processing Addendum.
            </p>
          </Body>
        </Section>

        {/* 6. Third-Party & Open Source Components */}
        <Section id="open-source" title="6. Third-Party & Open Source Components">
          <Body>
            <p>
              The Software may incorporate third-party libraries, open source components, and
              dependencies that are subject to their own license terms. A list of open source
              components and their applicable licenses is available upon request.
            </p>
            <p>
              To the extent required by applicable open source licenses, the terms of those licenses
              will govern the use of those specific components. In the event of a conflict between
              this EULA and an open source license, the open source license will prevail solely
              with respect to that component.
            </p>
            <p>
              Nothing in this EULA restricts your rights under, or grants You rights that supersede,
              any open source license terms that are irrevocable.
            </p>
          </Body>
        </Section>

        {/* 7. Updates and Modifications */}
        <Section id="updates" title="7. Updates and Modifications">
          <Body>
            <p>
              DPR.ai may from time to time provide updates, patches, or new versions of the Software
              (&ldquo;Updates&rdquo;). Updates are subject to the terms of this EULA unless
              accompanied by a separate license, in which case that license will govern.
            </p>
            <p>
              DPR.ai reserves the right to modify, deprecate, or discontinue features of the Software
              with reasonable notice. Material modifications that reduce functionality will be
              communicated at least 30 days in advance.
            </p>
            <p>
              Continued use of the Software after an Update constitutes acceptance of any changes
              to the Software, provided that such changes do not materially alter the terms of
              this EULA.
            </p>
          </Body>
        </Section>

        {/* 8. Term and Termination */}
        <Section id="term" title="8. Term and Termination">
          <Body>
            <p>
              <strong className="text-slate-200">Term.</strong> This EULA commences on the date
              You first access the Software and continues until your subscription expires or is
              terminated.
            </p>
            <p>
              <strong className="text-slate-200">Termination by DPR.ai.</strong> DPR.ai may terminate
              this EULA immediately if You breach any material term, including but not limited to
              license restrictions or payment obligations.
            </p>
            <p>
              <strong className="text-slate-200">Termination by You.</strong> You may terminate this
              EULA by cancelling your subscription and ceasing all use of the Software.
            </p>
            <p>
              <strong className="text-slate-200">Effect of Termination.</strong> Upon termination,
              your license immediately ceases. You must cease all use of the Software and destroy
              any copies in your possession. DPR.ai will provide access to Your Data for 60 days
              after termination in accordance with our Data Retention Policy.
            </p>
            <p>
              <strong className="text-slate-200">Survival.</strong> Sections 3 (License Restrictions),
              5 (Intellectual Property), 9 (Disclaimer), 10 (Limitation of Liability), and 11
              (Governing Law) survive termination.
            </p>
          </Body>
        </Section>

        {/* 9. Disclaimer of Warranties */}
        <Section id="warranty" title="9. Disclaimer of Warranties">
          <Body>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-amber-200">
              <p className="text-sm leading-7">
                THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
                WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY
                APPLICABLE LAW, DPR.AI DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO
                IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
                AND NON-INFRINGEMENT.
              </p>
              <p className="mt-3 text-sm leading-7">
                DPR.AI DOES NOT WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE,
                SECURE, OR FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS. YOU ASSUME ALL RISK
                FOR ANY DAMAGE OR LOSS RESULTING FROM YOUR USE OF THE SOFTWARE.
              </p>
              <p className="mt-3 text-sm leading-7">
                SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES, SO THE
                ABOVE EXCLUSIONS MAY NOT APPLY TO YOU. IN THAT CASE, WARRANTIES ARE LIMITED
                TO THE FULLEST EXTENT PERMITTED BY LAW.
              </p>
            </div>
          </Body>
        </Section>

        {/* 10. Limitation of Liability */}
        <Section id="liability" title="10. Limitation of Liability">
          <Body>
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-red-200">
              <p className="text-sm leading-7">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, DPR.AI AND ITS AFFILIATES, OFFICERS,
                EMPLOYEES, AND SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
                OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED TO THIS EULA OR
                THE USE OF THE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="mt-3 text-sm leading-7">
                DPR.AI&rsquo;S TOTAL LIABILITY FOR ALL CLAIMS ARISING UNDER THIS EULA SHALL NOT
                EXCEED THE AMOUNT PAID BY YOU FOR THE SOFTWARE DURING THE TWELVE (12) MONTHS
                PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </p>
              <p className="mt-3 text-sm leading-7">
                THE FOREGOING LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY (CONTRACT, TORT,
                OR OTHERWISE) AND NOTWITHSTANDING THE FAILURE OF ESSENTIAL PURPOSE OF ANY
                LIMITED REMEDY.
              </p>
            </div>
          </Body>
        </Section>

        {/* 11. Governing Law */}
        <Section id="law" title="11. Governing Law">
          <Body>
            <p>
              This EULA is governed by the laws of India, without regard to its conflict of laws
              principles. The courts of Shillong, Meghalaya shall have exclusive jurisdiction
              over any disputes arising under this EULA.
            </p>
            <p>
              The United Nations Convention on Contracts for the International Sale of Goods
              (CISG) does not apply to this EULA.
            </p>
            <p>
              Any dispute arising out of or relating to this EULA shall first be attempted to be
              resolved through good-faith negotiations. If the dispute cannot be resolved within
              30 days, it shall be finally resolved by binding arbitration in accordance with the
              Arbitration and Conciliation Act, 1996, with the seat of arbitration in Shillong,
              Meghalaya.
            </p>
          </Body>
        </Section>

        {/* 12. Contact */}
        <Section id="contact" title="12. Contact">
          <Body>
            <p>
              If you have any questions about this EULA, please contact:
            </p>
            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-300">
              <p><strong className="text-slate-200">Email:</strong> <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a></p>
              <p className="mt-1"><strong className="text-slate-200">Legal Notices:</strong> <a href="mailto:legal@dpr.ai" className="text-sky-300 hover:underline">legal@dpr.ai</a></p>
              <p className="mt-3 text-slate-400">
                DPR.ai Technologies Pvt. Ltd.<br />
                4th Floor, Tech Tower, Industrial District<br />
                Shillong, Meghalaya 793001, India
              </p>
            </div>
            <p className="mt-4">
              For support-related inquiries, please visit our{" "}
              <a href="/contact" className="text-sky-300 hover:underline">Contact page</a>.
            </p>
          </Body>
        </Section>
      </div>
    </main>
  );
}
