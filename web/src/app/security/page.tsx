"use client";

import Link from "next/link";

function Section({ id, title, children, icon }: { id: string; title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold tracking-tight text-white">
        {icon && <span className="text-sky-300">{icon}</span>}
        {title}
      </h2>
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

function ShieldCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l7 3v7c0 4.5-3.5 8-7 9-3.5-1-7-4.5-7-9V5l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" strokeLinecap="round" />
      <line x1="6" y1="18" x2="6.01" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3.7 18.5a1 1 0 0 0 .88 1.5h14.84a1 1 0 0 0 .88-1.5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="6" />
      <path d="M12 14v4" strokeLinecap="round" />
      <path d="M9 18h6" strokeLinecap="round" />
      <path d="M15.5 6.5l-4 4-2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
    </svg>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Security
            </h1>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              How we protect your operational data, employee records, and business continuity.
            </p>
            <p className="mt-1 text-xs text-slate-500">Last updated: June 17, 2026</p>
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

        {/* TOC */}
        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-caption text-slate-300">On this page</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { id: "overview", label: "1. Security Overview" },
              { id: "encryption", label: "2. Data Encryption" },
              { id: "access-control", label: "3. Authentication & Access Control" },
              { id: "infrastructure", label: "4. Infrastructure Security" },
              { id: "app-security", label: "5. Application Security" },
              { id: "backup", label: "6. Data Backup & Recovery" },
              { id: "monitoring", label: "7. Monitoring & Logging" },
              { id: "incident-response", label: "8. Incident Response" },
              { id: "compliance", label: "9. Compliance & Certifications" },
              { id: "employee-access", label: "10. Employee Access" },
              { id: "third-party", label: "11. Third-Party Security" },
              { id: "vulnerability", label: "12. Vulnerability Management" },
              { id: "customer-controls", label: "13. Customer Security Controls" },
              { id: "contact", label: "14. Security Contact" },
            ].map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-sm text-slate-300 hover:text-white hover:underline">{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. Overview */}
        <Section id="overview" title="1. Security Overview" icon={<ShieldCheck />}>
          <Body>
            <p>
              DPR.ai is built on the principle that your operational data belongs to you and must be
              protected at every layer &mdash; from the factory floor to the cloud. We understand that
              manufacturing data includes sensitive production metrics, employee attendance records,
              inventory valuations, and financial documents. Protecting this data is not just a
              compliance obligation; it is fundamental to our service.
            </p>
            <p>
              Our security program is aligned with industry standards including OWASP Top 10, CIS
              Controls, and the NIST Cybersecurity Framework. We follow a &ldquo;defense in depth&rdquo;
              approach with controls at every layer: network, infrastructure, application, data, and
              personnel.
            </p>
          </Body>
        </Section>

        {/* 2. Encryption */}
        <Section id="encryption" title="2. Data Encryption" icon={<LockIcon />}>
          <Body>
            <div>
              <SubHeading>In Transit</SubHeading>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>All connections to DPR.ai require <strong>TLS 1.3</strong> (no support for TLS 1.1 or below).</li>
                <li>HTTPS is enforced across the entire platform with HTTP Strict Transport Security (HSTS) headers.</li>
                <li>All API communications are encrypted via HTTPS.</li>
                <li>Our TLS certificates are managed and rotated automatically.</li>
              </ul>
            </div>
            <div>
              <SubHeading>At Rest</SubHeading>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>All customer data stored in databases is encrypted using <strong>AES-256</strong>.</li>
                <li>Daily backups are encrypted with the same standard before leaving the data center.</li>
                <li>OCR-scanned documents, uploaded files, and attachments are encrypted at rest in object storage.</li>
                <li>Database encryption keys are managed separately from the data (envelope encryption).</li>
              </ul>
            </div>
          </Body>
        </Section>

        {/* 3. Access Control */}
        <Section id="access-control" title="3. Authentication & Access Control" icon={<KeyIcon />}>
          <Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Password Requirements</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>Minimum 12 characters</li>
                  <li>Mixed case, numbers, and symbols required</li>
                  <li>Common passwords blocked</li>
                  <li>Argon2 password hashing</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Multi-Factor Authentication</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>MFA available and recommended for all users</li>
                  <li>Required for all admin accounts</li>
                  <li>Supports authenticator apps (TOTP)</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Session Management</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>Automatic session timeout after inactivity</li>
                  <li>Refresh token rotation</li>
                  <li>Concurrent session limits</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Role-Based Access Control</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>Granular RBAC with least privilege</li>
                  <li>Predefined roles: Admin, Supervisor, Operator, Viewer</li>
                  <li>Permission matrix per factory/workspace</li>
                </ul>
              </div>
            </div>
          </Body>
        </Section>

        {/* 4. Infrastructure */}
        <Section id="infrastructure" title="4. Infrastructure Security" icon={<ServerIcon />}>
          <Body>
            <p>
              DPR.ai is hosted on <strong>Amazon Web Services (AWS)</strong>, one of the most secure
              and certified cloud platforms in the world, in the ap-south-1 (Mumbai) region.
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>All servers reside in a <strong>virtual private cloud (VPC)</strong> with no public direct access.</li>
              <li>Network access is controlled through security groups and network ACLs.</li>
              <li>Web application firewall (WAF) blocks common attack patterns.</li>
              <li>AWS Shield provides <strong>DDoS protection</strong> at the network and application layers.</li>
              <li>All infrastructure is managed through infrastructure-as-code (IaC) for consistency.</li>
              <li>Security patches are applied within 48 hours of release for critical vulnerabilities.</li>
            </ul>
          </Body>
        </Section>

        {/* 5. Application Security */}
        <Section id="app-security" title="5. Application Security" icon={<CodeIcon />}>
          <Body>
            <p>
              Security is integrated into our development lifecycle from design through deployment.
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li><strong>Code reviews:</strong> Every change requires a peer review before merging.</li>
              <li><strong>Input validation:</strong> All user input is validated and sanitized on both client and server.</li>
              <li><strong>SQL injection prevention:</strong> All database queries use parameterized statements or ORM abstractions.</li>
              <li><strong>XSS protection:</strong> Output encoding and Content Security Policy (CSP) headers prevent cross-site scripting.</li>
              <li><strong>CSRF protection:</strong> Anti-forgery tokens are required for all state-changing requests.</li>
              <li><strong>Dependency scanning:</strong> Automated scanning for known vulnerabilities in open-source libraries.</li>
              <li><strong>Secrets management:</strong> API keys and database credentials are stored in a vault, never in code.</li>
            </ul>
          </Body>
        </Section>

        {/* 6. Backup & Recovery */}
        <Section id="backup" title="6. Data Backup & Recovery" icon={<DatabaseIcon />}>
          <Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Backup Schedule</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Automated daily backups of all databases and file storage. Transaction logs are
                  streamed continuously for point-in-time recovery.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Backup Encryption</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  All backups are encrypted with AES-256 before leaving the primary data center.
                  Backup encryption keys are stored separately from primary data encryption keys.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Geographic Redundancy</SubHeading>
                <p className="text-sm leading-7 text-slate-300">
                  Backups are replicated to a secondary AWS region for disaster recovery.
                  Cross-region replication is encrypted and automated.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Recovery Objectives</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li><strong>RPO:</strong> 24 hours (max data loss in a disaster)</li>
                  <li><strong>RTO:</strong> 8 hours (max time to full restoration)</li>
                </ul>
              </div>
            </div>
          </Body>
        </Section>

        {/* 7. Monitoring */}
        <Section id="monitoring" title="7. Monitoring & Logging" icon={<MonitorIcon />}>
          <Body>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>24/7 automated system monitoring for availability, performance, and security events.</li>
              <li>Centralized logging with tamper-evident audit trails for all administrative actions.</li>
              <li>Anomaly detection algorithms identify unusual access patterns and potential threats.</li>
              <li>Security logs are retained for <strong>2 years</strong>; application logs for <strong>90 days</strong>.</li>
              <li>Alerts are routed to our on-call security team through automated escalation.</li>
              <li>Quarterly access reviews ensure appropriate permissions across the platform.</li>
            </ul>
          </Body>
        </Section>

        {/* 8. Incident Response */}
        <Section id="incident-response" title="8. Incident Response" icon={<AlertIcon />}>
          <Body>
            <p>
              DPR.ai maintains a formal incident response plan aligned with NIST 800-61 guidelines.
              Our process includes four phases:
            </p>
            <ol className="list-inside list-decimal space-y-1.5 pl-2">
              <li><strong>Preparation:</strong> Documented procedures, trained responders, and pre-authorized actions.</li>
              <li><strong>Detection & Analysis:</strong> Automated alerts trigger investigation within minutes.</li>
              <li><strong>Containment & Eradication:</strong> Immediate isolation of affected systems and removal of threats.</li>
              <li><strong>Recovery:</strong> Restoration from clean backups and validation of system integrity.</li>
            </ol>
            <p>
              <strong>Customer notification:</strong> If a confirmed security incident involves customer data,
              we will notify affected customers <strong>within 24 hours</strong> of confirmation, including
              details of the nature, scope, and remediation steps.
            </p>
          </Body>
        </Section>

        {/* 9. Compliance */}
        <Section id="compliance" title="9. Compliance & Certifications" icon={<BadgeIcon />}>
          <Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">Current</div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>GDPR compliance</li>
                  <li>Data Processing Addendum (DPA) available</li>
                  <li>Privacy policy published</li>
                  <li>Data retention policy defined</li>
                  <li>Breach notification procedures active</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">In Progress</div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>SOC 2 Type I &mdash; Target: H2 2026</li>
                  <li>ISO 27001 &mdash; Target: Q1 2027</li>
                  <li>SOC 2 Type II &mdash; Target: 2027</li>
                </ul>
              </div>
            </div>
          </Body>
        </Section>

        {/* 10. Employee Access */}
        <Section id="employee-access" title="10. Employee Access" icon={<UsersIcon />}>
          <Body>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>All DPR.ai team members undergo background verification before employment.</li>
              <li>Security awareness training is completed annually, with additional phishing simulations.</li>
              <li>Production access is granted on a <strong>strict need-to-know basis</strong> and revoked immediately when no longer required.</li>
              <li>All team members sign NDAs and data confidentiality agreements.</li>
              <li>Access to production data requires approval from the security team and is logged.</li>
              <li>Privileged access uses short-lived credentials with just-in-time (JIT) approval.</li>
            </ul>
          </Body>
        </Section>

        {/* 11. Third-Party */}
        <Section id="third-party" title="11. Third-Party Security" icon={<LinkIcon />}>
          <Body>
            <p>
              We evaluate all third-party service providers through a formal vendor security assessment
              before engagement. Each subprocessor must meet our security standards, including:
            </p>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Industry-standard security certifications (SOC 2, ISO 27001, or equivalent).</li>
              <li>Data processing agreements that include confidentiality and security obligations.</li>
              <li>Standard Contractual Clauses for any cross-border data transfers.</li>
              <li>Right to audit clauses in our contracts.</li>
            </ul>
            <p className="mt-2">
              For a complete list of subprocessors, see our{" "}
              <Link href="/subprocessors" className="text-sky-300 hover:underline">Subprocessor List</Link>.
            </p>
          </Body>
        </Section>

        {/* 12. Vulnerability Management */}
        <Section id="vulnerability" title="12. Vulnerability Management" icon={<SearchIcon />}>
          <Body>
            <ul className="list-inside list-disc space-y-1.5 pl-2">
              <li>Automated vulnerability scanning runs weekly across all infrastructure and applications.</li>
              <li>Third-party penetration testing is conducted <strong>annually</strong> by an independent security firm.</li>
              <li>Critical vulnerabilities are patched within 24 hours; high-severity within 72 hours.</li>
              <li>We maintain a <strong>responsible disclosure program</strong> for security researchers.</li>
              <li>Dependencies are monitored continuously for known CVEs.</li>
            </ul>
          </Body>
        </Section>

        {/* 13. Customer Controls */}
        <Section id="customer-controls" title="13. Customer Security Controls" icon={<ShieldCheck />}>
          <Body>
            <p>
              We provide tools for customers to manage their own security posture within the platform:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Available Controls</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>Multi-factor authentication for all users</li>
                  <li>Role-based permissions per factory</li>
                  <li>Audit log export</li>
                  <li>Session timeout configuration</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <SubHeading>Recommendations</SubHeading>
                <ul className="list-inside list-disc space-y-1 text-sm leading-7 text-slate-300">
                  <li>Enable MFA for all accounts</li>
                  <li>Use strong, unique passwords</li>
                  <li>Review user access quarterly</li>
                  <li>Export audit logs for your records</li>
                </ul>
              </div>
            </div>
          </Body>
        </Section>

        {/* 14. Contact */}
        <Section id="contact" title="14. Security Contact" icon={<ShieldCheck />}>
          <Body>
            <p>
              If you have discovered a security vulnerability in DPR.ai, please report it to us
              privately through our responsible disclosure process.
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-1">
                <strong className="text-slate-200">Security Reports:</strong>{" "}
                <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a>
              </p>
              <p className="mb-1">
                <strong className="text-slate-200">Security Questions:</strong>{" "}
                <a href="mailto:security@dpr.ai" className="text-sky-300 hover:underline">security@dpr.ai</a>
              </p>
              <p>
                <strong className="text-slate-200">PGP Key:</strong> Available on request for encrypted
                vulnerability disclosures.
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              We aim to acknowledge receipt within 24 hours and provide an initial assessment within
              72 hours. We commit to not pursuing legal action against researchers who follow
              responsible disclosure practices.
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
            <Link href="/compliance" className="text-sky-300 hover:underline">Compliance</Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="text-sky-300 hover:underline">Return to DPR.ai</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
