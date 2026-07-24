# DPR.ai — Business Workflow & Role Responsibility Analysis

**Author:** Senior Business Analyst / Solutions Architect  
**Date:** June 16, 2026  
**Classification:** Internal — Leadership, Product, Engineering, Operations  
**Evidence Basis:** Codebase scan, project documentation, RBAC audit, router/model inventory

---

## Executive Summary

DPR.ai is a factory-first operating system / AI-native ERP targeting Indian industrial SMBs. It is functionally broad — spanning attendance, daily production entries, OCR document digitization, reporting, analytics, AI insights, billing/subscriptions, and a substantial steel-specific ERP module (inventory, batches, customers, invoices, dispatches, payments).

The system is already structured like a **real factory operating platform**, not just a dashboard app. Its business-critical value chain is:

> **Workforce capture → Operational entry → OCR digitization → Approvals → Analytics → Alerts → Steel order-to-cash**

**Key finding:** The main next step is not adding more features first. It is tightening **governance, role clarity, workflow ownership, and control design** so the platform can be trusted at scale.

**Maturity Assessment:**
- **Functional breadth:** 8/10 — core operational workflows are well-covered
- **Process governance:** 4/10 — SLAs, ownership, escalation paths not formalized
- **Role/policy alignment:** 3/10 — documented matrix diverges from implementation
- **Test reliability:** 3/10 — full suite unstable, lint failing
- **Audit completeness:** 5/10 — write audit exists, but denial audit and systematic workflow audit missing

---

DPR.ai — Business Analysis, Workflow, and Role Responsibility Report
Evidence Legend
- Confirmed — directly supported by files/functions/docs cited in this conversation
- Inferred — strongly implied by implementation patterns or multiple sources
- Assumption — plausible, but not directly evidenced in reviewed materials
────────────────────────────────────────────────────────────────────────────────
1) Pre-analysis Snapshot
1.1 My understanding of the project
DPR.ai is a factory-first operating system for Indian industrial SMBs that digitizes daily operations traditionally handled through paper logs, WhatsApp messages, spreadsheets, and ad hoc approvals.
It combines:
- workforce and attendance workflows,
- production entry and approval,
- OCR-based document digitization,
- steel-specific ERP capabilities,
- reporting and AI summaries,
- alerts and notifications,
- billing/subscription controls,
- multi-factory user and governance management.
Evidence
-  README.md 
-  PROJECT_CONTEXT.md 
-  DPR_AI_MASTER_SYSTEM_DOCUMENTATION.md 
- Backend router inventory from:
-  backend/routers/auth.py 
-  backend/routers/attendance.py 
-  backend/routers/entries.py 
-  backend/routers/ocr.py 
-  backend/routers/steel.py 
-  backend/routers/reports.py 
-  backend/routers/analytics.py 
-  backend/routers/ai.py 
-  backend/routers/settings.py 
-  backend/routers/billing.py 
-  backend/routers/alerts.py 
-  backend/routers/feedback.py 
Classification: Confirmed
────────────────────────────────────────────────────────────────────────────────
1.2 Workflows detected
Core business workflows detected
1. User registration / invitation / onboarding
2. Authentication / session / MFA / Google OAuth / factory selection
3. Factory setup and user governance
4. Attendance punch and live attendance visibility
5. Attendance regularization and approval
6. Production entry submission and approval
7. OCR capture → verification → approval → export
8. Reporting / analytics / AI summaries / anomaly review
9. Steel inventory and stock reconciliation
10. Steel production batch and variance management
11. Steel customer → invoice → dispatch → payment settlement
12. Alerts and recipient management (including WhatsApp)
13. Billing, subscription, usage, and quota control
14. User feedback submission and triage
15. Background job execution, retry, and download
16. Release / QA / deployment governance
Classification: Core 1–15 are Confirmed; #16 is partly Confirmed from docs and partly Inferred
────────────────────────────────────────────────────────────────────────────────
1.3 Roles detected
Application roles
- ATTENDANCE
- OPERATOR
- SUPERVISOR
- ACCOUNTANT
- MANAGER
- ADMIN
- OWNER
Operational/support roles
- System / Automation
- AI Provider
- Payment Gateway (Razorpay)
- Google OAuth Provider
- WhatsApp Provider / Meta Cloud API
- Email Provider
- Factory Customer
- Driver / Transporter
- QA Lead / DevOps / Project Manager / Engineering Lead
Evidence
- Role matrix docs reviewed earlier:
-  factorynerve_role_permission_matrix.md 
-  docs/factorynerve_role_permission_matrix.md 
-  backend/models/user.py  →  UserRole 
-  backend/models/user_factory_role.py 
-  README.md 
-  IMMEDIATE_ACTION_ITEMS.md 
Classification:
- Application roles: Confirmed
- External/system/support roles: Confirmed or Inferred depending on role
────────────────────────────────────────────────────────────────────────────────
1.4 Important unknowns / ambiguities
┌─────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┬────────────────────┐
│ Topic                           │ Observation                                                                           │ Status             │
├─────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼────────────────────┤
│ CI/CD pipelines                 │ Deployment and QA process docs exist, but no actual pipeline/YAML evidence was        │ Assumption / Gap   │
│                                 │ reviewed                                                                              │                    │
│ Final redesign status           │ Docs conflict: some say 100% redesign complete, others say 11% complete               │ Confirmed          │
│                                 │                                                                                       │ inconsistency      │
│ Single auth standard            │ Both JWT-style auth and secure cookie/MFA auth exist                                  │ Confirmed          │
│                                 │                                                                                       │ ambiguity          │
│ True RBAC source of truth       │ Role matrix docs, route guards, frontend capabilities, and factory-role data model    │ Confirmed gap      │
│                                 │ are not fully aligned                                                                 │                    │
│ Approval coverage in Steel      │ Approval concepts exist in matrix/docs, but implementation evidence is uneven by      │ Inferred gap       │
│ workflows                       │ route                                                                                 │                    │
│ Release governance ownership    │ Documented in project docs, but not evidenced in executable workflow automation       │ Inferred gap       │
└─────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┴────────────────────┘
────────────────────────────────────────────────────────────────────────────────
2) Executive Summary
2.1 Project purpose
DPR.ai is a B2B SaaS operating system for factories, designed to digitize plant-floor workflows with a strong focus on:
- low-friction data capture,
- mobile-first usability,
- human-in-the-loop AI/OCR,
- role-based approvals,
- operational visibility for managers and owners.
Evidence
-  README.md 
-  PROJECT_CONTEXT.md 
-  DPR_AI_MASTER_SYSTEM_DOCUMENTATION.md 
Classification: Confirmed
────────────────────────────────────────────────────────────────────────────────
2.2 Likely business model / operating model
┌─────────────┬─────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
│ Dimension   │ Assessment                                  │ Basis                                                                            │
├─────────────┼─────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Commercial  │ SaaS subscription with plan tiers and       │ DPR_AI_MASTER_SYSTEM_DOCUMENTATION.md, backend/routers/billing.py,               │
│ model       │ usage-based AI/OCR economics                │ backend/routers/plans.py, backend/services/billing_manager.py                    │
│ Customer    │ Industrial SMBs, especially factories with  │ README.md, PROJECT_CONTEXT.md                                                    │
│ type        │ paper-heavy workflows                       │                                                                                  │
│ Operating   │ Multi-tenant, multi-factory workspace model │ backend/models/organization.py, backend/models/factory.py,                       │
│ model       │ with org/factory isolation                  │ backend/models/user_factory_role.py, backend/tenancy.py                          │
│ Product     │ AI-native ERP interpretation layer over     │ DPR_AI_MASTER_SYSTEM_DOCUMENTATION.md, backend/routers/ocr.py,                   │
│ strategy    │ messy real-world inputs                     │ backend/services/ocr_document_pipeline.py                                        │
└─────────────┴─────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────┘
Classification:
- SaaS / subscription / multi-tenant: Confirmed
- Detailed monetization structure: Inferred from docs + billing code
────────────────────────────────────────────────────────────────────────────────
2.3 Maturity assessment
┌─────────────────────────────┬─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────┐
│ Area                        │ Maturity        │ Commentary                                                                               │
├─────────────────────────────┼─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┤
│ Backend feature breadth     │ High            │ 15+ routers, 50+ models, rich services, async jobs, OCR, steel ERP, billing              │
│ Business process coverage   │ Medium-High     │ Many end-to-end flows exist, especially attendance, OCR, steel, reporting                │
│ Governance / control design │ Medium-Low      │ RBAC drift, role-order conflicts, partial workflow controls, unclear ownership in places │
│ Frontend redesign maturity  │ Unclear / Mixed │ Docs conflict between 11% and 100% redesign completion                                   │
│ Test maturity               │ Medium          │ Targeted tests pass, full suite unstable per PROJECT_CONTEXT.md                          │
│ Operational reliability     │ Medium          │ Known production risks documented: OCR policy mismatch, upload mismatch, invite bug      │
│ CI/CD maturity              │ Low / Unclear   │ Deployment process is documented, but pipeline automation evidence not reviewed          │
└─────────────────────────────┴─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────┘
────────────────────────────────────────────────────────────────────────────────
2.4 Leadership summary
DPR.ai is already more than a simple MVP. It is a broad operational platform with credible ERP-like coverage for factories, especially strong in:
- workforce capture,
- OCR-assisted digitization,
- steel operations,
- analytics and reporting,
- factory governance.
However, it is not yet fully mature from a control and process-governance perspective. The largest leadership-level concerns are:
1. Authorization drift across docs, backend, and frontend
2. Incomplete process governance for approvals, SLA ownership, and escalation
3. Documentation inconsistency around delivery maturity
4. Operational risk in OCR and user administration flows
5. Missing adjacent workflows such as procurement, supplier management, returns, and incident/change governance
────────────────────────────────────────────────────────────────────────────────
3) Functional Breakdown of Major Modules
┌─────────────┬────────────────────────────────────────────────┬────────────────────┬──────────────────┬───────────────────────────────┬───────┐
│ Module      │ What it does                                   │ Primary users      │ Key dependencies │ Evidence                      │ Confi │
│             │                                                │                    │                  │                               │ dence │
├─────────────┼────────────────────────────────────────────────┼────────────────────┼──────────────────┼───────────────────────────────┼───────┤
│ Auth &      │ Register, login, logout, refresh, profile,     │ All users          │ User, Org,       │ backend/routers/auth.py,      │ Confi │
│ Identity    │ password reset, email verification, factory    │                    │ Factory,         │ auth_secure.py,               │ rmed  │
│             │ selection, MFA, Google OAuth                   │                    │ Sessions, Tokens │ auth_google.py                │       │
│ User &      │ Manage factories, settings, templates, users,  │ Manager, Admin,    │ RBAC, tenancy,   │ backend/routers/settings.py   │ Confi │
│ Factory     │ roles, factory access, org usage               │ Owner              │ plans,           │                               │ rmed  │
│ Governance  │                                                │                    │ org/factory      │                               │       │
│             │                                                │                    │ models           │                               │       │
│ Attendance  │ Punch, live board, employee profiles, shift    │ Attendance,        │ Attendance       │ backend/routers/attendance.py │ Confi │
│             │ templates, regularization, review queue,       │ Supervisor,        │ models,          │                               │ rmed  │
│             │ reports                                        │ Manager, Admin     │ profiles, shifts │                               │       │
│ Production  │ Capture daily production entries, smart        │ Operator,          │ Entry model, AI, │ backend/routers/entries.py    │ Confi │
│ Entries     │ parsing, approvals/rejections, AI summaries    │ Supervisor,        │ reports          │                               │ rmed  │
│             │                                                │ Manager            │                  │                               │       │
│ OCR & Verif │ OCR status, templates, verifications, preview, │ Supervisor,        │ OCR services,    │ backend/routers/ocr.py, backe │ Confi │
│ ication     │ warp, async export, approval                   │ Manager, Admin,    │ templates, jobs, │ nd/services/ocr_document_pipe │ rmed  │
│             │                                                │ OCR reviewers      │ AI               │ line.py                       │       │
│ Reports     │ Insights, PDF/Excel export, report jobs        │ Supervisor,        │ Entries, OCR,    │ backend/routers/reports.py    │ Confi │
│             │                                                │ Manager, Admin,    │ jobs             │                               │ rmed  │
│             │                                                │ Owner              │                  │                               │       │
│ Analytics & │ Weekly/monthly analytics, trends, AI usage,    │ Manager, Owner,    │ AI router, usage │ backend/routers/analytics.py, │ Confi │
│ AI          │ suggestions, anomalies, natural-language       │ Admin              │ logs, background │ backend/routers/ai.py         │ rmed  │
│             │ queries, executive summary                     │                    │ jobs             │                               │       │
│ Steel ERP   │ Inventory, transactions, reconciliation,       │ Operator,          │ Steel models,    │ backend/routers/steel.py, bac │ Confi │
│             │ production batches, customers, follow-up       │ Supervisor,        │ stock, customer, │ kend/services/steel_service.p │ rmed  │
│             │ tasks, verification docs, invoices,            │ Accountant,        │ dispatch,        │ y                             │       │
│             │ dispatches, payments                           │ Manager, Admin,    │ reports          │                               │       │
│             │                                                │ Owner              │                  │                               │       │
│ Alerts & No │ Read alerts, recipient management, WhatsApp    │ Supervisor+,       │ Ops events,      │ backend/routers/alerts.py,    │ Confi │
│ tifications │ sending, alert history                         │ Admin, Owner       │ alert            │ alert_recipients.py,          │ rmed  │
│             │                                                │                    │ recipients,      │ whatsapp_webhook.py,          │       │
│             │                                                │                    │ webhook/provider │ README.md                     │       │
│ Billing &   │ Billing config/status, invoices, create        │ Admin, Owner       │ Razorpay,        │ backend/routers/billing.py,   │ Confi │
│ Plans       │ payment order, webhook, downgrade, usage/quota │                    │ subscriptions,   │ backend/routers/plans.py, bac │ rmed  │
│             │                                                │                    │ plans, usage     │ kend/services/billing_manager │       │
│             │                                                │                    │                  │ .py                           │       │
│ Feedback    │ Submit in-app feedback, triage, reporter       │ Operators+, Admin, │ Feedback model,  │ backend/routers/feedback.py,  │ Confi │
│             │ updates, CSV export                            │ Owner              │ translation      │ README.md, backend/services/f │ rmed  │
│             │                                                │                    │                  │ eedback_translation.py        │       │
│ Background  │ Create, update, list, retry, cancel, download  │ System, end users, │ OCR, AI, reports │ backend/services/background_j │ Confi │
│ Jobs        │ async job results                              │ admins             │                  │ obs.py,                       │ rmed  │
│             │                                                │                    │                  │ backend/routers/jobs.py       │       │
│ Observabili │ Readiness, AI health/dashboard, frontend error │ Admin,             │ System health,   │ backend/routers/observability │ Confi │
│ ty          │ capture                                        │ Ops/Engineering    │ error telemetry  │ .py                           │ rmed  │
│ Premium /   │ Premium dashboards, executive PDF, audit trail │ Manager+, Owners   │ Plans, billing,  │ backend/routers/premium.py    │ Confi │
│ Plan-Gated  │                                                │                    │ reports          │                               │ rmed  │
│ Features    │                                                │                    │                  │                               │       │
│ Intelligenc │ Async intelligence requests and usage tracking │ Manager, Owner,    │ AI and request   │ backend/routers/intelligence. │ Confi │
│ e Requests  │                                                │ System             │ models           │ py                            │ rmed  │
│ Release /   │ Staging, QA, go/no-go, production, monitoring  │ PM, QA, DevOps,    │ Documentation,   │ IMMEDIATE_ACTION_ITEMS.md,    │ Partl │
│ QA /        │                                                │ Engineering        │ deployment       │ DOCUMENTATION_INDEX.md        │ y Con │
│ Deployment  │                                                │                    │ process          │                               │ firme │
│             │                                                │                    │                  │                               │ d     │
└─────────────┴────────────────────────────────────────────────┴────────────────────┴──────────────────┴───────────────────────────────┴───────┘
────────────────────────────────────────────────────────────────────────────────
4) Role Catalog
4.1 Application roles
┌─────────┬────────────────────┬─────────────────────────────────────────────────────────────────────┬─────────────────────────────────┬───────┐
│ Role    │ Purpose            │ Responsibilities                                                    │ Evidence                        │ Confi │
│         │                    │                                                                     │                                 │ dence │
├─────────┼────────────────────┼─────────────────────────────────────────────────────────────────────┼─────────────────────────────────┼───────┤
│ ATTENDA │ Minimal workforce  │ Mark own attendance, view own attendance                            │ Role matrix docs,               │ Confi │
│ NCE     │ self-service role  │                                                                     │ backend/models/user.py          │ rmed  │
│ OPERATO │ Shop-floor         │ Create production entries, participate in floor workflows,          │ Role matrix docs, entries.py,   │ Confi │
│ R       │ execution role     │ gate/logistics-related activities, view limited stock/dispatch      │ steel.py                        │ rmed  │
│         │                    │ contexts                                                            │                                 │       │
│ SUPERVI │ First-line         │ Review operator work, approve entries/attendance, manage team       │ Role matrix docs,               │ Confi │
│ SOR     │ operational        │ workflows, dispatch progression, OCR review                         │ attendance.py, entries.py,      │ rmed  │
│         │ control role       │                                                                     │ ocr.py, steel.py                │       │
│ ACCOUNT │ Finance operations │ Customers, invoices, payments, financial visibility, financial OCR  │ Role matrix docs, steel.py,     │ Confi │
│ ANT     │ role               │ involvement                                                         │ billing.py                      │ rmed  │
│ MANAGER │ Factory-level      │ Oversee operations, limited governance, analytics, factory          │ settings.py, analytics.py,      │ Confi │
│         │ cross-domain       │ settings, user management in current code                           │ premium.py                      │ rmed  │
│         │ operator           │                                                                     │                                 │       │
│ ADMIN   │ System/factory     │ User administration, system settings, usage reconciliation, alert   │ settings.py, observability.py,  │ Confi │
│         │ governance role    │ recipient config, audit access                                      │ alert_recipients.py             │ rmed  │
│ OWNER   │ Org-wide authority │ Cross-factory control, billing/plan control, top-level overrides,   │ settings.py, billing.py, role   │ Confi │
│         │                    │ org plan updates                                                    │ matrix docs                     │ rmed  │
└─────────┴────────────────────┴─────────────────────────────────────────────────────────────────────┴─────────────────────────────────┴───────┘
4.2 Non-human / external roles
┌────────────────────┬────────────────────────────────────────┬─────────────────────────────────┬──────────────────────────────────────┬───────┐
│ Role               │ Purpose                                │ Responsibilities                │ Evidence                             │ Confi │
│                    │                                        │                                 │                                      │ dence │
├────────────────────┼────────────────────────────────────────┼─────────────────────────────────┼──────────────────────────────────────┼───────┤
│ System /           │ Executes async jobs, OCR processing,   │ Background jobs, retries,       │ backend/services/background_jobs.py, │ Confi │
│ Automation         │ alert dispatch, usage tracking         │ queued exports, auto-alerting   │ OCR/AI/report job endpoints          │ rmed  │
│ AI Provider        │ Remote AI extraction/reasoning         │ OCR enhancement, summaries,     │ backend/services/ai_router.py,       │ Confi │
│                    │                                        │ anomalies, NL query             │ ocr_document_pipeline.py             │ rmed  │
│ Payment Gateway    │ Payment/order settlement               │ Order creation, webhook         │ backend/routers/billing.py           │ Confi │
│ (Razorpay)         │                                        │ callbacks                       │                                      │ rmed  │
│ Google OAuth       │ External identity provider             │ Google login/callback           │ backend/routers/auth_google.py       │ Confi │
│ Provider           │                                        │                                 │                                      │ rmed  │
│ WhatsApp Provider  │ Alert delivery channel                 │ Sends approved templates,       │ README.md,                           │ Confi │
│ / Meta             │                                        │ webhook handling                │ backend/routers/whatsapp_webhook.py  │ rmed  │
│ Email Provider     │ Verification, invites, summaries       │ Invite emails, verification,    │ settings.py, emails.py,              │ Confi │
│                    │                                        │ summary send                    │ email_service.py                     │ rmed  │
│ Customer           │ Buyer of steel products                │ Receives invoice/dispatch,      │ backend/models/steel_customer.py,    │ Confi │
│                    │                                        │ makes payments                  │ steel.py                             │ rmed  │
│ Driver /           │ Logistics actor                        │ Truck, gate pass, dispatch      │ steel.py dispatch models/routes      │ Confi │
│ Transporter        │                                        │ execution                       │                                      │ rmed  │
└────────────────────┴────────────────────────────────────────┴─────────────────────────────────┴──────────────────────────────────────┴───────┘
4.3 Delivery / governance roles
┌────────────────────────┬───────────────────────────┬──────────────────────────────────────────────────┬─────────────────────┬────────────────┐
│ Role                   │ Purpose                   │ Responsibilities                                 │ Evidence            │ Confidence     │
├────────────────────────┼───────────────────────────┼──────────────────────────────────────────────────┼─────────────────────┼────────────────┤
│ Project Manager        │ Delivery coordination     │ Review completion, stakeholder communication,    │ IMMEDIATE_ACTION_IT │ Confirmed from │
│                        │                           │ release readiness                                │ EMS.md              │ docs           │
│ QA Lead / QA Team      │ Test execution            │ QA planning, test cases, staging verification    │ IMMEDIATE_ACTION_IT │ Confirmed from │
│                        │                           │                                                  │ EMS.md              │ docs           │
│ DevOps Lead            │ Environment and release   │ Staging/prod deployment, monitoring              │ IMMEDIATE_ACTION_IT │ Confirmed from │
│                        │ execution                 │                                                  │ EMS.md              │ docs           │
│ Engineering / Frontend │ Technical fixes and       │ Bug prioritization, performance, security review │ IMMEDIATE_ACTION_IT │ Confirmed from │
│ Lead                   │ optimization              │                                                  │ EMS.md              │ docs           │
└────────────────────────┴───────────────────────────┴──────────────────────────────────────────────────┴─────────────────────┴────────────────┘
────────────────────────────────────────────────────────────────────────────────
5) Workflow Inventory
┌─────┬──────────────────┬──────────────────┬──────────────┬───────────────────────┬─────────────────┬──────────────┬─────────────────┬────────┐
│ ID  │ Workflow         │ Business         │ Trigger      │ Involved roles        │ Systems/compone │ Start        │ End condition   │ Status │
│     │                  │ objective        │              │                       │ nts             │ condition    │                 │        │
├─────┼──────────────────┼──────────────────┼──────────────┼───────────────────────┼─────────────────┼──────────────┼─────────────────┼────────┤
│ W1  │ User onboarding  │ Provision valid  │ Register,    │ User,                 │ Auth, Settings, │ Valid        │ User exists and │ Confir │
│     │ & invitation     │ users into       │ invite,      │ Manager/Admin/Owner,  │ Email,          │ identity or  │ can access      │ med    │
│     │                  │ org/factory      │ Google login │ System                │ Org/Factory     │ invite       │ workspace       │        │
│     │                  │                  │              │                       │ models          │ action       │                 │        │
│ W2  │ Login, MFA,      │ Secure workspace │ Login/auth   │ User, System          │ Auth, Secure    │ Active user  │ Authenticated   │ Confir │
│     │ session &        │ access           │ request      │                       │ sessions, MFA,  │              │ session/context │ med    │
│     │ factory          │                  │              │                       │ Google OAuth    │              │ established     │        │
│     │ selection        │                  │              │                       │                 │              │                 │        │
│ W3  │ Factory & user   │ Manage workspace │ Governance   │ Manager/Admin/Owner   │ Settings, RBAC, │ Privileged   │ Factory/user/ro │ Confir │
│     │ governance       │ structure and    │ action       │                       │ Tenancy, Plans  │ user action  │ le/access       │ med    │
│     │                  │ access           │              │                       │                 │              │ updated         │        │
│ W4  │ Attendance punch │ Digitize         │ Employee     │ Attendance/All roles, │ Attendance      │ Active user  │ Attendance      │ Confir │
│     │ & live board     │ presence         │ punch        │ Supervisor, Manager   │ module          │ on           │ state updated   │ med    │
│     │                  │ tracking         │              │                       │                 │ attendance   │ and visible     │        │
│     │                  │                  │              │                       │                 │ day          │                 │        │
│ W5  │ Attendance       │ Correct          │ Missed/incor │ Employee, Supervisor, │ Attendance      │ Attendance   │ Request approve │ Confir │
│     │ regularization & │ attendance       │ rect punch   │ Manager               │ module          │ anomaly      │ d/rejected      │ med    │
│     │ approval         │ exceptions       │              │                       │                 │ exists       │                 │        │
│ W6  │ Production entry │ Capture daily    │ Manual entry │ Operator, Supervisor, │ Entries, AI,    │ Production   │ Entry approved/ │ Confir │
│     │ & approval       │ production data  │ / smart      │ Manager               │ Reports         │ event exists │ rejected and    │ med    │
│     │                  │                  │ parse        │                       │                 │              │ reportable      │        │
│ W7  │ OCR capture →    │ Convert          │ Image upload │ Supervisor, Manager,  │ OCR, Jobs,      │ Source       │ Verified/export │ Confir │
│     │ verification →   │ documents into   │              │ Admin, System         │ Templates, AI   │ document     │ able output     │ med    │
│     │ export           │ structured data  │              │                       │                 │ available    │                 │        │
│ W8  │ Reporting /      │ Decision support │ Report/expor │ Manager, Owner, Admin │ Reports,        │ Data exists  │ Insight/export  │ Confir │
│     │ analytics / AI   │                  │ t/AI request │                       │ Analytics, AI,  │              │ delivered       │ med    │
│     │ insight          │                  │              │                       │ Jobs            │              │                 │        │
│ W9  │ Steel inventory  │ Maintain trusted │ Stock        │ Supervisor/Manager/Ad │ Steel           │ Active steel │ Accurate        │ Confir │
│     │ & reconciliation │ stock            │ activity or  │ min/Owner, Accountant │ inventory,      │ factory      │ inventory state │ med    │
│     │                  │                  │ count        │ (read in code)        │ reconciliation  │              │                 │        │
│     │                  │                  │ variance     │                       │                 │              │                 │        │
│ W10 │ Steel production │ Record           │ Production   │ Operator/Supervisor/M │ Steel batches,  │ Raw/finished │ Batch posted    │ Confir │
│     │ batch            │ input-output     │ batch        │ anager                │ stock, audit    │ item context │ and visible     │ med    │
│     │                  │ conversion and   │ creation     │                       │                 │ exists       │                 │        │
│     │                  │ variance         │              │                       │                 │              │                 │        │
│ W11 │ Steel            │ Sell, dispatch,  │ Customer     │ Accountant,           │ Customers,      │ Customer/ord │ Payment         │ Confir │
│     │ order-to-cash    │ and collect      │ sale         │ Supervisor, Manager,  │ invoices,       │ er exists    │ allocated and   │ med    │
│     │                  │ payment          │              │ Operator, Customer    │ dispatches,     │              │ invoice settled │        │
│     │                  │                  │              │                       │ payments        │              │                 │        │
│ W12 │ Alerts &         │ Notify           │ Event or     │ Admin/Owner,          │ Alerts,         │ Alert        │ Alert           │ Confir │
│     │ recipient        │ stakeholders of  │ config       │ Supervisor/Manager,   │ recipients,     │ condition or │ delivered/read  │ med    │
│     │ management       │ operational      │ action       │ System                │ WhatsApp        │ admin setup  │                 │        │
│     │                  │ events           │              │                       │                 │              │                 │        │
│ W13 │ Billing &        │ Monetize and     │ Billing      │ Owner/Admin, System,  │ Billing, plans, │ Active org   │ Billing state   │ Confir │
│     │ subscription     │ control feature  │ action /     │ Razorpay              │ subscriptions   │              │ updated         │ med    │
│     │                  │ access           │ renewal /    │                       │                 │              │                 │        │
│     │                  │                  │ webhook      │                       │                 │              │                 │        │
│ W14 │ Feedback capture │ Collect field    │ User         │ All users,            │ Feedback,       │ User issue/s │ Feedback resolv │ Confir │
│     │ & triage         │ issues and       │ feedback     │ Admin/Owner           │ translation,    │ uggestion    │ ed/exported     │ med    │
│     │                  │ improve product  │              │                       │ review queue    │              │                 │        │
│ W15 │ Background job   │ Support async    │ Async        │ User, Admin, System   │ Background jobs │ Job created  │ Job completed/c │ Confir │
│     │ operations       │ processing       │ request      │                       │                 │              │ ancelled/retrie │ med    │
│     │                  │                  │              │                       │                 │              │ d               │        │
│ W16 │ Release / QA /   │ Safe production  │ Release      │ PM, QA, DevOps, Eng   │ Staging/deploy  │ Feature      │ Production      │ Partly │
│     │ deployment       │ rollout          │ readiness    │                       │ process docs    │ ready        │ monitored       │ Confir │
│     │                  │                  │              │                       │                 │              │                 │ med    │
└─────┴──────────────────┴──────────────────┴──────────────┴───────────────────────┴─────────────────┴──────────────┴─────────────────┴────────┘
────────────────────────────────────────────────────────────────────────────────
6) Detailed Workflow Documentation, RACI, and Control Matrices
────────────────────────────────────────────────────────────────────────────────
W1. User Onboarding & Invitation
Workflow overview
┌───────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item          │ Detail                                                                                                                       │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective     │ Create a valid user identity with org/factory access and appropriate role                                                    │
│ Trigger       │ Self-registration, admin invite, or Google OAuth                                                                             │
│ Preconditions │ Organization/factory context exists; email is unique; role assignment allowed; plan/user limits not exceeded                 │
│ Postcondition │ User created, user code issued, optional factory membership created, verification/reset flow initiated                       │
│ s             │                                                                                                                              │
│ Related       │ Auth, Settings, Email Verification, Password Reset, Factory Access                                                           │
│ modules       │                                                                                                                              │
│ Related       │ User, Organization, Factory, UserFactoryRole, EmailVerificationToken, PasswordResetToken, PendingRegistration                │
│ entities      │                                                                                                                              │
│ Exceptions    │ Duplicate email, cross-org conflict, plan limit exceeded, accountant feature not available, invite email failure             │
│ Evidence      │ backend/routers/auth.py::register_user, backend/routers/settings.py::invite_user, backend/services/auth_service.py,          │
│               │ backend/services/email_verification_service.py                                                                               │
│ Confidence    │ Confirmed                                                                                                                    │
└───────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬────────────┬─────┬──────┬───────────┬────────────────────┬────────┬──────────────┬──────────────┬──────────┬──────────────────────────┐
│ Step │ Descriptio │ Act │ Modu │ Input     │ Action             │ Output │ Decision     │ Business     │ Exceptio │ Evidence                 │
│      │ n          │ or  │ le   │           │                    │        │ point        │ rule         │ n        │                          │
│      │            │     │      │           │                    │        │              │              │ handling │                          │
├──────┼────────────┼─────┼──────┼───────────┼────────────────────┼────────┼──────────────┼──────────────┼──────────┼──────────────────────────┤
│ 1    │ Initiate   │ Use │ Auth │ Registrat │ Submit             │ Reques │ Self-registe │ Role and org │ Reject   │ auth.py::register_user,  │
│      │ user       │ r / │ / Se │ ion form  │ registration or    │ t capt │ r vs invite  │ context      │ invalid  │ settings.py::invite_user │
│      │ creation   │ Adm │ ttin │ or invite │ invite             │ ured   │ vs Google    │ required     │ payload  │ , auth_google.py         │
│      │            │ in  │ gs   │ request   │                    │        │              │              │          │                          │
│ 2    │ Validate   │ Sys │ Auth │ Email,    │ Check uniqueness,  │ Valida │ Existing     │ No cross-org │ 409/403  │ settings.py::_assert_rol │
│      │ identity   │ tem │ / Se │ org,      │ org mapping, role  │ ted re │ user?        │ reuse; role  │ on       │ e_assignment_allowed,    │
│      │ and        │     │ ttin │ role,     │ constraints, plan  │ quest  │ Cross-org?   │ assignment   │ conflict │ has_org_feature,         │
│      │ tenancy    │     │ gs   │ plan      │ limits             │        │ Accountant   │ limited      │          │ enforce_user_limit       │
│      │            │     │      │           │                    │        │ enabled?     │              │          │                          │
│ 3    │ Persist    │ Sys │ Auth │ Validated │ Create user,       │ User   │ Invite       │ User code    │ Retry/50 │ settings.py::_persist_us │
│      │ user and   │ tem │ serv │ data      │ assign user code   │ record │ existing     │ must be      │ 0 on col │ er_with_user_code, auth_ │
│      │ user code  │     │ ice  │           │                    │        │ inactive     │ unique       │ lision   │ service.py::_persist_use │
│      │            │     │      │           │                    │        │ user?        │              │          │ r_with_user_code         │
│ 4    │ Create     │ Sys │ Sett │ User +    │ Add                │ Access │ Factory      │ Factory role │ Validati │ backend/models/user_fact │
│      │ factory    │ tem │ ings │ factory   │ UserFactoryRole    │ establ │ available?   │ must not     │ on error │ ory_role.py, validate_fa │
│      │ membership │ / A │      │           │                    │ ished  │              │ exceed       │          │ ctory_role_assignment    │
│      │            │ dmi │      │           │                    │        │              │ global role  │          │                          │
│      │            │ n   │      │           │                    │        │              │              │          │                          │
│ 5    │ Issue veri │ Sys │ Emai │ User      │ Create             │ User   │ Email        │ Invite       │ Rollback │ settings.py::invite_user │
│      │ fication/r │ tem │ l /  │ record    │ verification and   │ can ac │ delivery     │ requires     │ on email │ , email_verification_ser │
│      │ eset flow  │     │ Secu │           │ reset tokens; send │ tivate │ mode?        │ verification │ send     │ vice.py, password_reset_ │
│      │            │     │ rity │           │ email or preview   │ accoun │              │ + password   │ failure  │ service.py               │
│      │            │     │      │           │ links              │ t      │              │ setup        │          │                          │
│ 6    │ Activate   │ Use │ Auth │ Verificat │ Verify email, set  │ Active │ Token valid? │ TTLs         │ Token in │ auth.py::verify_email_ad │
│      │ and access │ r   │      │ ion/reset │ password, login    │ accoun │              │ enforced     │ valid/ex │ dress, password_reset    │
│      │            │     │      │           │                    │ t      │              │              │ pired    │                          │
│      │            │     │      │           │                    │        │              │              │ response │                          │
└──────┴────────────┴─────┴──────┴───────────┴────────────────────┴────────┴──────────────┴──────────────┴──────────┴──────────────────────────┘
RACI matrix
┌──────────────────────────────┬──────┬─────────┬───────┬───────┬────────┬────────────────┐
│ Workflow step                │ User │ Manager │ Admin │ Owner │ System │ Email Provider │
├──────────────────────────────┼──────┼─────────┼───────┼───────┼────────┼────────────────┤
│ Initiate registration/invite │ R    │ R       │ A     │ A     │ I      │ I              │
│ Validate identity/role/plan  │ I    │ C       │ A     │ A     │ R      │ I              │
│ Create user/user code        │ I    │ I       │ A     │ A     │ R      │ I              │
│ Create factory access        │ I    │ C       │ A     │ A     │ R      │ I              │
│ Send verification/reset      │ I    │ I       │ A     │ A     │ R      │ R              │
│ Activate account             │ R    │ I       │ I     │ I     │ C      │ I              │
└──────────────────────────────┴──────┴─────────┴───────┴───────┴────────┴────────────────┘
Control matrix
┌────────────────────┬──────────────────────────┬──────────────┬───────┬──────────────────────┬────────────┬───────┬───────────────┬───────────┐
│ Step               │ Owner                    │ Approval     │ SLA   │ Risk if              │ Escalation │ Autom │ KPI           │ Audit     │
│                    │                          │ required     │       │ delayed/failed       │            │ ation │               │ need      │
├────────────────────┼──────────────────────────┼──────────────┼───────┼──────────────────────┼────────────┼───────┼───────────────┼───────────┤
│ Invite/register    │ Admin / PMO equivalent   │ No           │ Same  │ User cannot access   │ Admin →    │ Mediu │ Invite-to-act │ Request   │
│ submission         │ for internal onboarding  │              │ day   │ system               │ Owner      │ m     │ ivation time  │ log       │
│ Role/plan          │ Admin/Owner              │ Yes for      │ Immed │ Over-provisioning /  │ Admin →    │ High  │ Failed invite │ Role      │
│ validation         │                          │ privileged   │ iate  │ under-provisioning   │ Owner      │       │ rate          │ change    │
│                    │                          │ roles        │       │                      │            │       │               │ audit     │
│ Email/token issue  │ System                   │ No           │ Minut │ Onboarding blocked   │ Admin → En │ High  │ Activation    │ Token     │
│                    │                          │              │ es    │                      │ gineering  │       │ completion    │ issuance  │
│                    │                          │              │       │                      │            │       │ rate          │ log       │
│ Activation         │ User                     │ No           │ 24h t │ Dormant accounts     │ Admin      │ Mediu │ % activated   │ Verificat │
│                    │                          │              │ arget │                      │ follow-up  │ m     │ within SLA    │ ion log   │
└────────────────────┴──────────────────────────┴──────────────┴───────┴──────────────────────┴────────────┴───────┴───────────────┴───────────┘
────────────────────────────────────────────────────────────────────────────────
W2. Login, MFA, Session & Factory Selection
Workflow overview
┌────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item           │ Detail                                                                                                                      │
├────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective      │ Provide secure authenticated access and correct factory context                                                             │
│ Trigger        │ Login request, token refresh, MFA step, Google callback, factory switch                                                     │
│ Preconditions  │ Active user account; valid credentials or OAuth; MFA if enabled                                                             │
│ Postconditions │ Session/token valid; auth context returned; active factory set                                                              │
│ Related        │ Auth, Secure Auth, Google Auth, Tenancy                                                                                     │
│ modules        │                                                                                                                             │
│ Related        │ User, AuthSession, RefreshToken, AuthAuditLog, UserFactoryRole                                                              │
│ entities       │                                                                                                                             │
│ Exceptions     │ Invalid credentials, MFA failure, stale role revision, invalid factory selection                                            │
│ Evidence       │ backend/routers/auth.py, backend/routers/auth_secure.py, backend/routers/auth_google.py, backend/auth_security/sessions.py, │
│                │ backend/tenancy.py                                                                                                          │
│ Confidence     │ Confirmed                                                                                                                   │
└────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬───────────────┬──────┬──────┬─────────────┬───────────────┬──────────────┬────────────────┬──────────────┬────────────────────────────┐
│ Step │ Description   │ Acto │ Modu │ Input       │ Output        │ Decision     │ Rule           │ Exception    │ Evidence                   │
│      │               │ r    │ le   │             │               │ point        │                │              │                            │
├──────┼───────────────┼──────┼──────┼─────────────┼───────────────┼──────────────┼────────────────┼──────────────┼────────────────────────────┤
│ 1    │ Submit        │ User │ Auth │ Email/passw │ Auth attempt  │ Local vs     │ Auth method    │ 401/redirect │ auth.py::login_user,       │
│      │ credentials / │      │      │ ord or      │               │ Google vs    │ supported      │ failure      │ auth_secure.py::login, aut │
│      │ OAuth request │      │      │ Google      │               │ secure       │                │              │ h_google.py::google_login  │
│      │               │      │      │ login       │               │ session      │                │              │                            │
│ 2    │ Validate      │ Syst │ Auth │ Credentials │ Authenticated │ MFA enabled? │ Active user    │ 401          │ auth_secure.py,            │
│      │ identity      │ em   │ /Sec │ /session    │ identity or   │              │ required       │              │ security.py                │
│      │               │      │ urit │             │ rejection     │              │                │              │                            │
│      │               │      │ y    │             │               │              │                │              │                            │
│ 3    │ Complete MFA  │ User │ Secu │ OTP / MFA   │ MFA success   │ Pass/fail    │ MFA            │ Rejection on │ auth_secure.py::mfa_setup, │
│      │ if configured │ /Sys │ re   │ token       │               │              │ setup/verify   │ invalid code │ mfa_verify, mfa_disable    │
│      │               │ tem  │ Auth │             │               │              │ enforced when  │              │                            │
│      │               │      │      │             │               │              │ enabled        │              │                            │
│ 4    │ Issue         │ Syst │ Auth │ Authenticat │ Access token/ │ Token vs     │ Session        │ Session      │ auth.py, auth_secure.py,   │
│      │ session/token │ em   │ /Ses │ ed user     │ cookie/sessio │ cookie path  │ security       │ creation     │ auth_security/sessions.py  │
│      │               │      │ sion │             │ n             │              │ enforced       │ failure      │                            │
│      │               │      │ s    │             │               │              │                │              │                            │
│ 5    │ Return auth   │ Syst │ Auth │ Active      │ Profile and   │ Role/factory │ Context should │ Drift risk   │ auth.py::get_me,           │
│      │ context / me  │ em   │      │ session     │ capability    │ context      │ reflect        │ due          │ get_auth_context           │
│      │               │      │      │             │ context       │ available?   │ current role   │ ROLE_ORDER   │                            │
│      │               │      │      │             │               │              │                │ mismatch     │                            │
│ 6    │ Select active │ User │ Auth │ Factory     │ Active        │ Authorized   │ Must belong to │ Reject       │ auth.py::list_factories,   │
│      │ factory       │ /Sys │ /Ten │ selection   │ factory       │ for chosen   │ factory/org    │ invalid      │ select_factory, tenancy.py │
│      │               │ tem  │ ancy │             │ context       │ factory?     │                │ selection    │                            │
└──────┴───────────────┴──────┴──────┴─────────────┴───────────────┴──────────────┴────────────────┴──────────────┴────────────────────────────┘
RACI matrix
┌─────────────────────┬──────┬────────────┬─────────┬───────┬───────┬────────┬────────┐
│ Workflow step       │ User │ Supervisor │ Manager │ Admin │ Owner │ System │ Google │
├─────────────────────┼──────┼────────────┼─────────┼───────┼───────┼────────┼────────┤
│ Submit login        │ R    │ I          │ I       │ I     │ I     │ C      │ C      │
│ Validate identity   │ I    │ I          │ I       │ I     │ I     │ R/A    │ C      │
│ MFA                 │ R    │ I          │ I       │ I     │ I     │ C      │        │
│ Issue session       │ I    │ I          │ I       │ I     │ I     │ R/A    │        │
│ Return auth context │ I    │ I          │ I       │ I     │ I     │ R/A    │        │
│ Select factory      │ R    │ I          │ I       │ I     │ I     │ C      │        │
└─────────────────────┴──────┴────────────┴─────────┴───────┴───────┴────────┴────────┘
Control matrix
┌──────────────────┬─────────────────┬───────┬───────┬────────────────────────────┬───────────┬─────────┬─────────────────┬────────────────────┐
│ Step             │ Owner           │ Appro │ SLA   │ Risk                       │ Escalatio │ Automat │ KPI             │ Audit              │
│                  │                 │ val   │       │                            │ n         │ ion     │                 │                    │
├──────────────────┼─────────────────┼───────┼───────┼────────────────────────────┼───────────┼─────────┼─────────────────┼────────────────────┤
│ Login validation │ Security/Auth   │ No    │ Secon │ Access failure or          │ Admin →   │ High    │ Login success   │ Auth audit log     │
│                  │ owner           │       │ ds    │ unauthorized access        │ Eng       │         │ rate            │                    │
│ MFA              │ Security/Auth   │ No    │ Secon │ Account lockout or bypass  │ Admin →   │ High    │ MFA completion  │ MFA event log      │
│                  │ owner           │       │ ds    │                            │ Eng       │         │ rate            │                    │
│ Factory          │ Admin / Tenancy │ No    │ Secon │ Cross-factory data leak    │ Admin →   │ High    │ Invalid         │ Session/factory    │
│ selection        │ owner           │       │ ds    │                            │ Owner     │         │ selection rate  │ switch log         │
└──────────────────┴─────────────────┴───────┴───────┴────────────────────────────┴───────────┴─────────┴─────────────────┴────────────────────┘
────────────────────────────────────────────────────────────────────────────────
W3. Factory & User Governance
Workflow overview
┌──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item             │ Detail                                                                                        │
├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective        │ Manage factories, users, roles, access, templates, and usage                                  │
│ Trigger          │ Governance change request                                                                     │
│ Preconditions    │ Manager/Admin/Owner privileges depending action                                               │
│ Postconditions   │ Factory/user/governance state updated and auditable                                           │
│ Related modules  │ Settings, RBAC, Plans, Tenancy                                                                │
│ Related entities │ Factory, FactorySettings, User, UserFactoryRole, Organization, UserPlan, AuditLog             │
│ Exceptions       │ Last privileged user removal blocked, owner assignment restricted, org plan override disabled │
│ Evidence         │ backend/routers/settings.py                                                                   │
│ Confidence       │ Confirmed                                                                                     │
└──────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬───────────────┬────────┬──────────┬──────────────┬────────────┬──────────────────┬───────────────────┬────────┬───────────────────────┐
│ Step │ Description   │ Actor  │ Input    │ Action       │ Output     │ Decision point   │ Rule              │ Except │ Evidence              │
│      │               │        │          │              │            │                  │                   │ ion    │                       │
├──────┼───────────────┼────────┼──────────┼──────────────┼────────────┼──────────────────┼───────────────────┼────────┼───────────────────────┤
│ 1    │ Review        │ Manage │ Current  │ List factori │ Visibility │ Is org context   │ Scope by          │ Not fo │ settings.py::list_fac │
│      │ factory/user  │ r/Admi │ org      │ es/users/con │            │ valid?           │ org/factory       │ und/de │ tories, list_users,   │
│      │ landscape     │ n      │ context  │ trol tower   │            │                  │                   │ nied   │ get_control_tower     │
│ 2    │ Create/update │ Manage │ Factory  │ Create or    │ Factory    │ Name conflict?   │ Factory limit     │ 409/40 │ create_factory, updat │
│      │ factory       │ r/Owne │ profile/ │ update       │ state      │ plan limit?      │ enforcement       │ 3      │ e_factory_settings    │
│      │               │ r      │ settings │ factory      │ updated    │                  │                   │        │                       │
│ 3    │ Invite or     │ Manage │ User     │ Invite/creat │ User provi │ Existing user?   │ Role and feature  │ 409/40 │ invite_user           │
│      │ reactivate    │ r/Admi │ info     │ e/reactivate │ sioned     │ factory access?  │ gating            │ 3/500  │                       │
│      │ users         │ n      │          │              │            │                  │                   │        │                       │
│ 4    │ Update role / │ Manage │ Role or  │ Change       │ Updated me │ Actor outranks   │ Cannot assign     │ 403/40 │ update_user_role, upd │
│      │ factory       │ r/Admi │ access   │ role/access  │ mberships  │ target?          │ above own rank;   │ 0      │ ate_user_factory_acce │
│      │ access        │ n/Owne │ request  │              │            │                  │ owner             │        │ ss                    │
│      │               │ r      │          │              │            │                  │ restrictions      │        │                       │
│ 5    │ Deactivate    │ Manage │ Target   │ Deactivate   │ User       │ Last privileged  │ Cannot remove     │ 400/40 │ deactivate_user,      │
│      │ user / update │ r/Admi │ user /   │ or plan      │ disabled   │ user? manual     │ last owner/admin  │ 3      │ update_user_plan,     │
│      │ plan          │ n/Owne │ org plan │ change       │ or plan    │ override         │                   │        │ update_org_plan       │
│      │               │ r      │          │              │ updated    │ enabled?         │                   │        │                       │
│ 6    │ Usage and rec │ Admin  │ Period/r │ View/reconci │ Updated qu │ Dry run? allow   │ Admin required    │ Valida │ get_usage, reconcile_ │
│      │ onciliation   │        │ equest   │ le usage     │ ota/usage  │ decrease?        │                   │ tion   │ usage_endpoint        │
│      │               │        │          │              │            │                  │                   │ errors │                       │
└──────┴───────────────┴────────┴──────────┴──────────────┴────────────┴──────────────────┴───────────────────┴────────┴───────────────────────┘
RACI matrix
┌──────────────────────────┬─────────┬───────┬───────┬────────┐
│ Workflow step            │ Manager │ Admin │ Owner │ System │
├──────────────────────────┼─────────┼───────┼───────┼────────┤
│ Review org/factory/users │ R       │ A     │ I     │ C      │
│ Create/update factory    │ R       │ C     │ A     │ C      │
│ Invite/reactivate users  │ R       │ A     │ A     │ C      │
│ Update roles/access      │ C       │ A     │ A     │ R      │
│ Deactivate / plan update │ C       │ A     │ A     │ R      │
│ Usage reconcile          │ I       │ A/R   │ C     │ R      │
└──────────────────────────┴─────────┴───────┴───────┴────────┘
Control matrix
┌───────────────────┬───────────┬───────┬───────────────┬───────────────────────┬────────────┬─────────┬──────────────────────┬────────────────┐
│ Step              │ Owner     │ Appro │ SLA           │ Risk                  │ Escalation │ Automat │ KPI                  │ Audit          │
│                   │           │ val   │               │                       │            │ ion     │                      │                │
├───────────────────┼───────────┼───────┼───────────────┼───────────────────────┼────────────┼─────────┼──────────────────────┼────────────────┤
│ Factory creation  │ Owner /   │ Yes   │ 1 business    │ Wrong workspace setup │ Owner      │ Medium  │ Time to operational  │ Factory        │
│                   │ Admin     │       │ day           │                       │            │         │ readiness            │ created audit  │
│ Role/access       │ Admin/Own │ Yes   │ Same day      │ Privilege escalation  │ Owner      │ Medium  │ Access request       │ Role/access    │
│ change            │ er        │       │               │ / leakage             │            │         │ turnaround           │ audit          │
│ User deactivation │ Admin/Own │ Yes   │ Same day      │ Orphaned access       │ Owner      │ Medium  │ Dormant account      │ Deactivation   │
│                   │ er        │       │               │                       │            │         │ closure rate         │ audit          │
│ Usage             │ Admin     │ Yes   │ Monthly /     │ Billing misstatement  │ Owner /    │ High    │ Usage accuracy       │ Usage          │
│ reconciliation    │           │       │ as-needed     │                       │ Finance    │         │                      │ reconcile log  │
└───────────────────┴───────────┴───────┴───────────────┴───────────────────────┴────────────┴─────────┴──────────────────────┴────────────────┘
────────────────────────────────────────────────────────────────────────────────
W4. Attendance Punch & Live Board
Workflow overview
┌────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item           │ Detail                                                                                                                      │
├────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective      │ Record workforce attendance and provide operational visibility                                                              │
│ Trigger        │ User punch action                                                                                                           │
│ Preconditions  │ Active user; attendance day/shift context                                                                                   │
│ Postconditions │ Attendance record/event updated; live board refreshed                                                                       │
│ Related        │ Attendance                                                                                                                  │
│ modules        │                                                                                                                             │
│ Related        │ AttendanceRecord, AttendanceEvent, EmployeeProfile, ShiftTemplate                                                           │
│ entities       │                                                                                                                             │
│ Exceptions     │ Missing shift/profile context, duplicate or invalid punch scenario                                                          │
│ Evidence       │ backend/routers/attendance.py::get_my_attendance_today, punch_attendance, get_live_attendance,                              │
│                │ get_attendance_employee_profiles, upsert_shift_template                                                                     │
│ Confidence     │ Confirmed                                                                                                                   │
└────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬────────────────────┬─────────────┬─────────────┬───────────────┬────────────┬────────────────┬──────────┬─────────────────────────────┐
│ Step │ Description        │ Actor       │ Action      │ Output        │ Decision   │ Rule           │ Exceptio │ Evidence                    │
│      │                    │             │             │               │ point      │                │ n        │                             │
├──────┼────────────────────┼─────────────┼─────────────┼───────────────┼────────────┼────────────────┼──────────┼─────────────────────────────┤
│ 1    │ Retrieve current   │ User/System │ View today  │ Current       │ Has        │ Self-access    │ 404/empt │ get_my_attendance_today     │
│      │ attendance state   │             │ attendance  │ status        │ existing   │ allowed        │ y state  │                             │
│      │                    │             │             │               │ record?    │                │          │                             │
│ 2    │ Punch attendance   │ User        │ Submit      │ Attendance    │ Punch      │ Authenticated  │ Validati │ punch_attendance            │
│      │                    │             │ punch       │ updated       │ type/time  │ user required  │ on       │                             │
│      │                    │             │             │               │ valid?     │                │ failure  │                             │
│ 3    │ Update live        │ System      │ Aggregate   │ Live board    │ None       │ Live board     │ Data     │ get_live_attendance         │
│      │ attendance feed    │             │ live state  │               │            │ reflects       │ delay    │                             │
│      │                    │             │             │               │            │ active data    │          │                             │
│ 4    │ Maintain employee  │ Supervisor/ │ Upsert prof │ Supporting    │ Profile    │ Template/profi │ Validati │ upsert_attendance_employee_ │
│      │ profile / shifts   │ Manager/Adm │ ile/templat │ attendance    │ exists?    │ le governance  │ on       │ profile,                    │
│      │                    │ in          │ e           │ config        │            │                │ errors   │ upsert_shift_template       │
│ 5    │ Use attendance     │ Manager/Sys │ Pull        │ Reporting     │ None       │ Reporting by   │ Access   │ get_attendance_report_summa │
│      │ summary in reports │ tem         │ summary     │ view          │            │ authorized     │ denied   │ ry                          │
│      │                    │             │             │               │            │ roles          │          │                             │
└──────┴────────────────────┴─────────────┴─────────────┴───────────────┴────────────┴────────────────┴──────────┴─────────────────────────────┘
RACI matrix
┌─────────────────────────────┬─────────────────┬────────────┬─────────┬───────┬────────┐
│ Step                        │ Attendance User │ Supervisor │ Manager │ Admin │ System │
├─────────────────────────────┼─────────────────┼────────────┼─────────┼───────┼────────┤
│ View today state            │ R               │ I          │ I       │ I     │ C      │
│ Punch attendance            │ R               │ I          │ I       │ I     │ C      │
│ Update live board           │ I               │ I          │ I       │ I     │ R/A    │
│ Maintain templates/profiles │ I               │ R          │ A       │ A     │ C      │
│ Review reporting            │ I               │ C          │ A       │ C     │ R      │
└─────────────────────────────┴─────────────────┴────────────┴─────────┴───────┴────────┘
Control matrix
┌────────────────────┬────────────────────┬───────┬───────────┬──────────────────────┬────────────────┬─────────┬────────────────┬─────────────┐
│ Step               │ Owner              │ Appro │ SLA       │ Risk                 │ Escalation     │ Automat │ KPI            │ Audit       │
│                    │                    │ val   │           │                      │                │ ion     │                │             │
├────────────────────┼────────────────────┼───────┼───────────┼──────────────────────┼────────────────┼─────────┼────────────────┼─────────────┤
│ Punch capture      │ Workforce Ops /    │ No    │ Real-time │ Payroll/compliance   │ Supervisor →   │ High    │ Punch          │ Punch event │
│                    │ Supervisor         │       │           │ distortion           │ Manager        │         │ completion     │ log         │
│                    │                    │       │           │                      │                │         │ rate           │             │
│ Live board refresh │ System owner       │ No    │ Near      │ Poor staffing        │ Eng/Ops        │ High    │ Board          │ System logs │
│                    │                    │       │ real-time │ visibility           │                │         │ freshness      │             │
│ Shift/profile      │ Manager/Admin      │ Yes   │ Same day  │ Wrong shift mapping  │ Admin          │ Medium  │ Config         │ Config      │
│ config             │                    │       │           │                      │                │         │ accuracy       │ change log  │
└────────────────────┴────────────────────┴───────┴───────────┴──────────────────────┴────────────────┴─────────┴────────────────┴─────────────┘
────────────────────────────────────────────────────────────────────────────────
W5. Attendance Regularization & Approval
Workflow overview
┌──────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item         │ Detail                                                                                                                        │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective    │ Correct attendance exceptions through controlled review                                                                       │
│ Trigger      │ Missed punch, wrong time, exception case                                                                                      │
│ Precondition │ Existing attendance discrepancy                                                                                               │
│ s            │                                                                                                                               │
│ Postconditio │ Regularization approved or rejected; attendance/report state aligned                                                          │
│ ns           │                                                                                                                               │
│ Related      │ Attendance                                                                                                                    │
│ modules      │                                                                                                                               │
│ Related      │ AttendanceRegularization, AttendanceRecord, AuditLog                                                                          │
│ entities     │                                                                                                                               │
│ Exceptions   │ Self-approval blocked, missing evidence, rejection                                                                            │
│ Evidence     │ attendance.py::create_regularization_request, get_attendance_review_queue, approve_attendance_review,                         │
│              │ reject_attendance_review; backend/rbac.py::assert_not_self_approval                                                           │
│ Confidence   │ Confirmed                                                                                                                     │
└──────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬─────────────────┬──────────────┬────────────┬──────────────────┬──────────┬────────────────┬──────────────┬───────────────────────────┐
│ Step │ Description     │ Actor        │ Action     │ Output           │ Decision │ Rule           │ Exception    │ Evidence                  │
├──────┼─────────────────┼──────────────┼────────────┼──────────────────┼──────────┼────────────────┼──────────────┼───────────────────────────┤
│ 1    │ Submit          │ User         │ Create     │ Pending request  │ Request  │ Authenticated  │ Validation   │ create_regularization_req │
│      │ regularization  │              │ request    │                  │ valid?   │ self-service   │ error        │ uest                      │
│ 2    │ Queue review    │ System       │ Route to   │ Review backlog   │ None     │ Role-based     │ Queue        │ get_attendance_review_que │
│      │                 │              │ review     │                  │          │ visibility     │ visibility   │ ue                        │
│      │                 │              │ queue      │                  │          │                │ issue        │                           │
│ 3    │ Review request  │ Supervisor/M │ Assess     │ Decision-ready   │ Approve  │ No             │ Block self-a │ assert_not_self_approval  │
│      │                 │ anager       │ request    │ case             │ or       │ self-approval  │ pproval      │ import/use                │
│      │                 │              │            │                  │ reject   │                │              │                           │
│ 4    │ Approve or      │ Supervisor/M │ Execute    │ Attendance       │ Decision │ Requires       │ Rejection    │ approve_attendance_review │
│      │ reject          │ anager/Admin │ decision   │ corrected or     │          │ privileged     │ reason /     │ ,                         │
│      │                 │              │            │ unchanged        │          │ reviewer       │ denial       │ reject_attendance_review  │
│ 5    │ Reflect in      │ System       │ Update     │ Accurate         │ None     │ Reporting      │ Data sync    │ get_attendance_report_sum │
│      │ summary/report  │              │ report     │ reporting        │          │ consistency    │ issue        │ mary                      │
│      │                 │              │ state      │                  │          │                │              │                           │
└──────┴─────────────────┴──────────────┴────────────┴──────────────────┴──────────┴────────────────┴──────────────┴───────────────────────────┘
RACI matrix
┌────────────────┬─────────────────┬────────────┬─────────┬───────┬────────┐
│ Step           │ Attendance User │ Supervisor │ Manager │ Admin │ System │
├────────────────┼─────────────────┼────────────┼─────────┼───────┼────────┤
│ Submit request │ R               │ I          │ I       │ I     │ C      │
│ Queue review   │ I               │ I          │ I       │ I     │ R/A    │
│ Review request │ I               │ R          │ A       │ C     │ I      │
│ Approve/reject │ I               │ R          │ A       │ C     │ I      │
│ Update reports │ I               │ I          │ I       │ I     │ R/A    │
└────────────────┴─────────────────┴────────────┴─────────┴───────┴────────┘
Control matrix
┌────────────────────┬───────────────┬───────┬───────────┬────────────────────────┬───────────┬────────┬─────────────────────┬─────────────────┐
│ Step               │ Owner         │ Appro │ SLA       │ Risk                   │ Escalatio │ Automa │ KPI                 │ Audit           │
│                    │               │ val   │           │                        │ n         │ tion   │                     │                 │
├────────────────────┼───────────────┼───────┼───────────┼────────────────────────┼───────────┼────────┼─────────────────────┼─────────────────┤
│ Submit             │ Employee +    │ No    │ Same      │ Payroll dispute        │ Superviso │ Low    │ % exceptions        │ Request log     │
│ regularization     │ Supervisor    │       │ shift/day │                        │ r         │        │ submitted on time   │                 │
│ Review queue       │ Supervisor/Ma │ Yes   │ 24 hours  │ Unresolved workforce   │ Manager → │ Medium │ Queue age           │ Approval audit  │
│                    │ nager         │       │ target    │ discrepancies          │ Admin     │        │                     │                 │
│ Final decision     │ Manager       │ Yes   │ 24–48     │ Compliance/payroll     │ Admin     │ Low    │ Approval turnaround │ Approval/reject │
│                    │               │       │ hours     │ error                  │           │        │                     │ ion audit       │
└────────────────────┴───────────────┴───────┴───────────┴────────────────────────┴───────────┴────────┴─────────────────────┴─────────────────┘
────────────────────────────────────────────────────────────────────────────────
W6. Production Entry & Approval
Workflow overview
┌────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item           │ Detail                                                                                                                      │
├────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective      │ Capture and approve daily production/shift records                                                                          │
│ Trigger        │ Shift activity / production event                                                                                           │
│ Preconditions  │ User is authorized; entry context exists                                                                                    │
│ Postconditions │ Entry recorded, optionally approved/rejected, available for analytics and reports                                           │
│ Related        │ Entries, AI, Reports                                                                                                        │
│ modules        │                                                                                                                             │
│ Related        │ Entry, AuditLog, AI summary/job artifacts                                                                                   │
│ entities       │                                                                                                                             │
│ Exceptions     │ Invalid data, approval rejection, summary job failure                                                                       │
│ Evidence       │ backend/routers/entries.py::parse_smart_input, create_entry, list_entries, approve_entry, reject_entry,                     │
│                │ queue_entry_summary, regenerate_entry_summary                                                                               │
│ Confidence     │ Confirmed                                                                                                                   │
└────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬──────────────────┬───────────────┬───────────────┬──────────────┬────────────┬────────────────┬─────────────┬─────────────────────────┐
│ Step │ Description      │ Actor         │ Action        │ Output       │ Decision   │ Rule           │ Exception   │ Evidence                │
├──────┼──────────────────┼───────────────┼───────────────┼──────────────┼────────────┼────────────────┼─────────────┼─────────────────────────┤
│ 1    │ Optional smart   │ Operator/Supe │ Submit        │ Structured   │ Accept     │ AI-assisted    │ Parse       │ parse_smart_input       │
│      │ parsing          │ rvisor        │ freeform      │ suggestion   │ smart      │ parsing        │ failure     │                         │
│      │                  │               │ input         │              │ parse?     │ optional       │ fallback    │                         │
│ 2    │ Create           │ Operator      │ Submit entry  │ Entry saved  │ Valid      │ Role           │ Validation  │ create_entry            │
│      │ production entry │               │               │              │ data?      │ restrictions   │ failure     │                         │
│      │                  │               │               │              │            │ apply          │             │                         │
│ 3    │ Review queue /   │ Supervisor/Ma │ View          │ Reviewable   │ Needs      │ Scope-based    │ Access      │ list_entries,           │
│      │ visibility       │ nager         │ entries/today │ list         │ approval?  │ review         │ denied      │ get_today_entries       │
│      │                  │               │ entries       │              │            │                │             │                         │
│ 4    │ Approve or       │ Supervisor/Ma │ Decision      │ Approved/rej │ Decision   │ Approval       │ Rejection   │ approve_entry,          │
│      │ reject           │ nager         │               │ ected entry  │ point      │ authority      │ path        │ reject_entry            │
│      │                  │               │               │              │            │ required       │             │                         │
│ 5    │ Generate summary │ Supervisor/Ma │ Queue AI      │ Summary      │ Async or r │ Background     │ Job failure │ queue_entry_summary, re │
│      │ / regenerate     │ nager/System  │ summary       │ job/result   │ egenerate? │ jobs           │             │ generate_entry_summary  │
│ 6    │ Report/export    │ Manager/Syste │ Consume entry │ Insights,    │ None       │ Approved data  │ Report      │ reports.py,             │
│      │                  │ m             │ data          │ PDF, Excel   │            │ preferred      │ failure     │ analytics.py            │
└──────┴──────────────────┴───────────────┴───────────────┴──────────────┴────────────┴────────────────┴─────────────┴─────────────────────────┘
RACI matrix
┌──────────────────────┬──────────┬────────────┬─────────┬────────┐
│ Step                 │ Operator │ Supervisor │ Manager │ System │
├──────────────────────┼──────────┼────────────┼─────────┼────────┤
│ Smart parse / submit │ R        │ C          │ I       │ C      │
│ Create entry         │ R        │ I          │ I       │ C      │
│ Review queue         │ I        │ R          │ A       │ C      │
│ Approve/reject       │ I        │ R          │ A       │ I      │
│ Generate summary     │ I        │ C          │ A       │ R      │
│ Use in reports       │ I        │ C          │ A       │ R      │
└──────────────────────┴──────────┴────────────┴─────────┴────────┘
Control matrix
┌───────────────┬────────────────┬──────────┬─────────────┬────────────────────┬───────────┬──────────┬──────────────────────┬─────────────────┐
│ Step          │ Owner          │ Approval │ SLA         │ Risk               │ Escalatio │ Automati │ KPI                  │ Audit           │
│               │                │          │             │                    │ n         │ on       │                      │                 │
├───────────────┼────────────────┼──────────┼─────────────┼────────────────────┼───────────┼──────────┼──────────────────────┼─────────────────┤
│ Entry capture │ Supervisor     │ No       │ Same shift  │ Operational        │ Manager   │ Medium   │ On-time entry rate   │ Entry create    │
│               │                │          │             │ blindness          │           │          │                      │ log             │
│ Approval      │ Manager        │ Yes      │ Same day    │ Bad data in        │ Admin     │ Low      │ Approval cycle time  │ Approval audit  │
│               │                │          │             │ reporting          │           │          │                      │                 │
│ AI summary    │ Manager/System │ No       │ Minutes-hou │ Delayed visibility │ Engineeri │ High     │ Summary completion   │ Job + AI usage  │
│               │                │          │ rs          │                    │ ng        │          │ rate                 │ log             │
└───────────────┴────────────────┴──────────┴─────────────┴────────────────────┴───────────┴──────────┴──────────────────────┴─────────────────┘
────────────────────────────────────────────────────────────────────────────────
W7. OCR Capture → Verification → Export
Workflow overview
┌──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item             │ Detail                                                                                                                    │
├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective        │ Convert images/documents into structured, reviewable factory records                                                      │
│ Trigger          │ User uploads or captures a document image                                                                                 │
│ Preconditions    │ OCR route access; file within size/type limits; optional template context                                                 │
│ Postconditions   │ Verification draft/approved record and optional Excel/PDF output                                                          │
│ Related modules  │ OCR, Background Jobs, AI, Templates                                                                                       │
│ Related entities │ OcrVerification, OcrTemplate, OcrUsage, jobs                                                                              │
│ Exceptions       │ Image too large, OCR/AI failure, role mismatch, job failure                                                               │
│ Evidence         │ backend/routers/ocr.py, backend/services/ocr_document_pipeline.py, backend/services/background_jobs.py,                   │
│                  │ PROJECT_CONTEXT.md                                                                                                        │
│ Confidence       │ Confirmed                                                                                                                 │
└──────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬──────────────────┬──────────┬─────────────┬───────────┬──────────┬──────────────────────┬─────────────┬───────────────────────────────┐
│ Step │ Description      │ Actor    │ Action      │ Output    │ Decision │ Rule                 │ Exception   │ Evidence                      │
├──────┼──────────────────┼──────────┼─────────────┼───────────┼──────────┼──────────────────────┼─────────────┼───────────────────────────────┤
│ 1    │ Check OCR readin │ User/Sys │ Query statu │ OCR capab │ OCR avai │ Role-based access    │ Access      │ ocr.py::ocr_status,           │
│      │ ess/template     │ tem      │ s/templates │ ility     │ lable?   │                      │ denied      │ list_templates                │
│      │ options          │          │             │ known     │          │                      │             │                               │
│ 2    │ Upload/capture   │ User     │ Submit      │ Improved  │ Warp     │ File limits apply    │ Size/type   │ ocr.py::warp_document,        │
│      │ and optionally   │          │ image /     │ source    │ needed?  │                      │ rejection   │ PROJECT_CONTEXT.md            │
│      │ warp             │          │ warp doc    │ image     │          │                      │             │                               │
│ 3    │ Run preview      │ System   │ OCR preview │ Partial s │ Local    │ Tesseract/local path │ OCR error   │ ocr.py::ocr_logbook,          │
│      │ extraction       │          │ (/logbook)  │ tructured │ OCR suff │ may work without     │             │ PROJECT_CONTEXT.md            │
│      │                  │          │             │ data      │ icient?  │ remote AI            │             │                               │
│ 4    │ Create/update    │ User/Sys │ Save draft  │ Verificat │ Draft ac │ Human correction     │ Validation  │ create_verification,          │
│      │ verification     │ tem      │ and edits   │ ion       │ ceptable │ supported            │ error       │ update_verification,          │
│      │ draft            │          │             │ record    │ ?        │                      │             │ get_verification              │
│ 5    │ Submit for       │ Supervis │ Submit veri │ Pending   │ Approve/ │ HITL review expected │ Rejection   │ submit_verification,          │
│      │ approval         │ or/Revie │ fication    │ review    │ reject?  │                      │             │ approve_verification,         │
│      │                  │ wer      │             │           │          │                      │             │ reject_verification           │
│ 6    │ Generate/export  │ System/U │ Start async │ Job ID /  │ Job      │ Async background     │ Silent or   │ logbook-excel-async,          │
│      │ async result     │ ser      │ Excel/table │ download  │ success? │ jobs                 │ surfaced    │ table-excel-async,            │
│      │                  │          │ job         │           │          │                      │ failure     │ get_ocr_job, download_ocr_job │
└──────┴──────────────────┴──────────┴─────────────┴───────────┴──────────┴──────────────────────┴─────────────┴───────────────────────────────┘
RACI matrix
┌─────────────────────────┬───────────────┬────────────┬─────────┬───────┬────────┬─────────────┐
│ Step                    │ Operator/User │ Supervisor │ Manager │ Admin │ System │ AI Provider │
├─────────────────────────┼───────────────┼────────────┼─────────┼───────┼────────┼─────────────┤
│ Check readiness         │ R             │ I          │ I       │ I     │ C      │ I           │
│ Upload/warp             │ R             │ I          │ I       │ I     │ C      │ I           │
│ Extract preview         │ I             │ I          │ I       │ I     │ R/A    │ C           │
│ Draft/edit verification │ R             │ C          │ I       │ I     │ C      │ I           │
│ Submit/approve/reject   │ I             │ R          │ A       │ C     │ I      │ I           │
│ Async export/download   │ R             │ I          │ I       │ I     │ R/A    │ C           │
└─────────────────────────┴───────────────┴────────────┴─────────┴───────┴────────┴─────────────┘
Control matrix
┌────────────────────┬───────────────┬───────┬───────────────┬──────────────────────┬────────────┬────────┬────────────────┬───────────────────┐
│ Step               │ Owner         │ Appro │ SLA           │ Risk                 │ Escalation │ Automa │ KPI            │ Audit             │
│                    │               │ val   │               │                      │            │ tion   │                │                   │
├────────────────────┼───────────────┼───────┼───────────────┼──────────────────────┼────────────┼────────┼────────────────┼───────────────────┤
│ Image intake       │ Supervisor/OC │ No    │ Immediate     │ Lost digitization    │ Manager    │ Medium │ Upload success │ File + request    │
│                    │ R owner       │       │               │ opportunity          │            │        │ rate           │ log               │
│ Verification       │ Supervisor/Ma │ Yes   │ Same day      │ Bad data enters      │ Manager →  │ Low    │ Review         │ Verification      │
│ review             │ nager         │       │               │ ledger               │ Admin      │        │ turnaround     │ decision log      │
│ Async export       │ System        │ No    │ Minutes       │ Reporting/output     │ Engineerin │ High   │ Job success    │ Job log           │
│                    │               │       │               │ delay                │ g          │        │ rate           │                   │
│ OCR failure        │ Engineering/O │ No    │ Immediate     │ User abandonment     │ Admin →    │ Medium │ Failure rate   │ OCR failure log   │
│ handling           │ ps            │       │ detection     │                      │ Eng        │        │ by cause       │                   │
└────────────────────┴───────────────┴───────┴───────────────┴──────────────────────┴────────────┴────────┴────────────────┴───────────────────┘
────────────────────────────────────────────────────────────────────────────────
W8. Reporting, Analytics & AI Insight
Workflow overview
┌──────────────────┬───────────────────────────────────────────────────────────────────────────┐
│ Item             │ Detail                                                                    │
├──────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Objective        │ Convert operational data into summaries, exports, and management insight  │
│ Trigger          │ User requests report/export/AI summary                                    │
│ Preconditions    │ Underlying data exists; user authorized; plan may permit premium features │
│ Postconditions   │ Report file, insight response, or async job delivered                     │
│ Related modules  │ Reports, Analytics, AI, Premium                                           │
│ Related entities │ Entries, OCR data, AI usage logs, report jobs                             │
│ Exceptions       │ Job failure, AI provider failure, plan gating                             │
│ Evidence         │ backend/routers/reports.py, analytics.py, ai.py, premium.py               │
│ Confidence       │ Confirmed                                                                 │
└──────────────────┴───────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬─────────────────┬───────┬────────────────────────┬──────────┬────────┬─────────────┬─────────┬────────────────────────────────────────┐
│ Step │ Description     │ Actor │ Action                 │ Output   │ Decisi │ Rule        │ Excepti │ Evidence                               │
│      │                 │       │                        │          │ on     │             │ on      │                                        │
├──────┼─────────────────┼───────┼────────────────────────┼──────────┼────────┼─────────────┼─────────┼────────────────────────────────────────┤
│ 1    │ Request analyti │ Manag │ Query weekly/monthly/t │ Insight  │ Which  │ Role-based  │ Access  │ analytics.py, ai.py                    │
│      │ cs/insight      │ er/Ow │ rends/AI               │ request  │ insigh │ access      │ denied  │                                        │
│      │                 │ ner   │                        │          │ t?     │             │         │                                        │
│ 2    │ Aggregate       │ Syste │ Build metrics          │ Analytic │ Data e │ Org/factory │ Empty   │ weekly_analytics, monthly_summary,     │
│      │ source data     │ m     │                        │ al       │ xists? │ scope       │ result  │ trends                                 │
│      │                 │       │                        │ dataset  │        │             │         │                                        │
│ 3    │ Generate AI     │ Syste │ Suggestions,           │ Narrativ │ Sync   │ Cost/provid │ AI erro │ ai.py::get_dpr_suggestions,            │
│      │ narrative /     │ m/AI  │ anomalies, NL answers, │ e/alerts │ or     │ er controls │ r/fallb │ get_anomalies,                         │
│      │ anomalies       │       │ executive summary      │          │ async? │ apply       │ ack     │ query_with_natural_language,           │
│      │                 │       │                        │          │        │             │         │ executive_summary_job                  │
│ 4    │ Generate export │ User/ │ PDF/Excel request      │ File or  │ Direct │ Plan gating │ Job     │ reports.py::download_pdf,              │
│      │                 │ Syste │                        │ job      │ or     │ for         │ failure │ download_excel,                        │
│      │                 │ m     │                        │          │ async? │ premium/PDF │         │ export_factory_excel_job               │
│ 5    │ Download/review │ User  │ Consume output         │ Decision │ None   │ Authorized  │ Not fou │ get_report_job, download_report_job,   │
│      │ result          │       │                        │ -ready   │        │ user only   │ nd/fail │ get_ai_job                             │
│      │                 │       │                        │ report   │        │             │ ure     │                                        │
└──────┴─────────────────┴───────┴────────────────────────┴──────────┴────────┴─────────────┴─────────┴────────────────────────────────────────┘
RACI matrix
┌────────────────────┬────────────┬─────────┬───────┬───────┬────────┬─────────────┐
│ Step               │ Supervisor │ Manager │ Owner │ Admin │ System │ AI Provider │
├────────────────────┼────────────┼─────────┼───────┼───────┼────────┼─────────────┤
│ Request insight    │ C          │ R       │ A     │ C     │ I      │ I           │
│ Aggregate data     │ I          │ I       │ I     │ I     │ R/A    │ I           │
│ Generate AI output │ I          │ C       │ A     │ C     │ R      │ R           │
│ Generate export    │ C          │ R       │ A     │ C     │ R      │ I           │
│ Review result      │ C          │ R       │ A     │ I     │ C      │ I           │
└────────────────────┴────────────┴─────────┴───────┴───────┴────────┴─────────────┘
Control matrix
┌─────────────────────┬────────────┬────────┬─────────────┬────────────────────────┬────────────┬─────────┬────────────────────────┬───────────┐
│ Step                │ Owner      │ Approv │ SLA         │ Risk                   │ Escalation │ Automat │ KPI                    │ Audit     │
│                     │            │ al     │             │                        │            │ ion     │                        │           │
├─────────────────────┼────────────┼────────┼─────────────┼────────────────────────┼────────────┼─────────┼────────────────────────┼───────────┤
│ Analytics           │ Manager/Ow │ No     │ Minutes     │ Decisions based on     │ Engineerin │ High    │ Dashboard freshness    │ Query log │
│ generation          │ ner        │        │             │ stale data             │ g          │         │                        │           │
│ Executive summary   │ Owner      │ No     │ Daily/on    │ Missed risk signal     │ Manager →  │ High    │ Summary usage /        │ AI usage  │
│                     │            │        │ demand      │                        │ Eng        │         │ delivery rate          │ log       │
│ Export delivery     │ Admin/Syst │ No     │ Minutes     │ Reporting blocked      │ Eng/Ops    │ High    │ Export success rate    │ Job log   │
│                     │ em         │        │             │                        │            │         │                        │           │
└─────────────────────┴────────────┴────────┴─────────────┴────────────────────────┴────────────┴─────────┴────────────────────────┴───────────┘
────────────────────────────────────────────────────────────────────────────────
W9. Steel Inventory & Reconciliation
Workflow overview
┌──────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item         │ Detail                                                                                                                        │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective    │ Maintain trusted stock balances and reconcile physical vs system inventory                                                    │
│ Trigger      │ Manual transaction, reconciliation count, reporting need                                                                      │
│ Precondition │ Active steel factory; valid item; authorized user                                                                             │
│ s            │                                                                                                                               │
│ Postconditio │ Stock updated, reconciliation approved/rejected, audit trail available                                                        │
│ ns           │                                                                                                                               │
│ Related      │ Steel inventory                                                                                                               │
│ modules      │                                                                                                                               │
│ Related      │ SteelInventoryItem, SteelInventoryTransaction, SteelStockReconciliation                                                       │
│ entities     │                                                                                                                               │
│ Exceptions   │ Negative stock, invalid cause, pending approval rejection                                                                     │
│ Evidence     │ steel.py::list_steel_inventory_items, create_steel_inventory_transaction, create_steel_stock_reconciliation,                  │
│              │ approve_steel_stock_reconciliation, reject_steel_stock_reconciliation                                                         │
│ Confidence   │ Confirmed                                                                                                                     │
└──────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬────────────────────┬──────────┬───────────┬───────────────┬────────────┬────────────────┬───────────┬─────────────────────────────────┐
│ Step │ Description        │ Actor    │ Action    │ Output        │ Decision   │ Rule           │ Exception │ Evidence                        │
├──────┼────────────────────┼──────────┼───────────┼───────────────┼────────────┼────────────────┼───────────┼─────────────────────────────────┤
│ 1    │ Review items/stock │ User     │ Query     │ Visibility    │ Read-only  │ Role limited   │ Access    │ list_steel_inventory_items,     │
│      │ /transactions      │          │ current   │               │ vs action? │                │ denied    │ list_steel_inventory_stock      │
│      │                    │          │ stock     │               │            │                │           │                                 │
│ 2    │ Create manual      │ Manager/ │ Post tran │ Ledger        │ Would      │ Negative stock │ 400 error │ create_steel_inventory_transact │
│      │ inventory          │ Admin    │ saction   │ movement      │ stock go   │ blocked        │           │ ion                             │
│      │ transaction        │          │           │               │ negative?  │                │           │                                 │
│ 3    │ Submit             │ Manager/ │ Count     │ Pending/appro │ Variance   │ Cause required │ Validatio │ create_steel_stock_reconciliati │
│      │ reconciliation     │ Admin/Ow │ physical  │ ved reconcili │ exists?    │ for mismatch   │ n error   │ on                              │
│      │                    │ ner      │ stock     │ ation         │            │                │           │                                 │
│ 4    │ Approve or reject  │ Admin/Ow │ Decision  │ Final reconci │ Pending    │ Approval       │ Rejection │ approve_steel_stock_reconciliat │
│      │ reconciliation     │ ner      │           │ liation state │ only?      │ authority      │ with      │ ion, reject_steel_stock_reconci │
│      │                    │          │           │               │            │ required       │ reason    │ liation                         │
│ 5    │ Post ledger        │ System/A │ Adjustmen │ Corrected     │ Variance   │ Adjustment     │ Posting   │ same functions                  │
│      │ correction         │ dmin     │ t transac │ ledger        │ non-zero?  │ only on        │ failure   │                                 │
│      │                    │          │ tion      │               │            │ approved cases │           │                                 │
└──────┴────────────────────┴──────────┴───────────┴───────────────┴────────────┴────────────────┴───────────┴─────────────────────────────────┘
RACI matrix
┌───────────────────────┬────────────┬────────────┬─────────┬───────┬───────┬────────┐
│ Step                  │ Supervisor │ Accountant │ Manager │ Admin │ Owner │ System │
├───────────────────────┼────────────┼────────────┼─────────┼───────┼───────┼────────┤
│ Review stock          │ C          │ C          │ R       │ A     │ A     │ I      │
│ Create transaction    │ I          │ I          │ R       │ A     │ A     │ C      │
│ Submit reconciliation │ I          │ I          │ R       │ A     │ A     │ C      │
│ Approve/reject        │ I          │ I          │ C       │ R     │ A     │ I      │
│ Post correction       │ I          │ I          │ I       │ A     │ A     │ R      │
└───────────────────────┴────────────┴────────────┴─────────┴───────┴───────┴────────┘
Control matrix
┌──────────────────┬───────────────────┬───────┬──────────────────┬────────────────────┬──────────┬────────┬───────────────────┬───────────────┐
│ Step             │ Owner             │ Appro │ SLA              │ Risk               │ Escalati │ Automa │ KPI               │ Audit         │
│                  │                   │ val   │                  │                    │ on       │ tion   │                   │               │
├──────────────────┼───────────────────┼───────┼──────────────────┼────────────────────┼──────────┼────────┼───────────────────┼───────────────┤
│ Manual           │ Inventory owner / │ No    │ Same day         │ Wrong stock        │ Admin    │ Medium │ Transaction       │ Ledger audit  │
│ transaction      │ Manager           │       │                  │ position           │          │        │ accuracy          │               │
│ Reconciliation   │ Admin/Owner       │ Yes   │ 24h target       │ Stock mistrust /   │ Owner    │ Low-Me │ Reconciliation    │ Reconciliatio │
│                  │                   │       │                  │ theft risk         │          │ dium   │ cycle time        │ n audit       │
│ Adjustment       │ Admin/Owner       │ Yes   │ Immediate after  │ Misstated          │ Owner/Fi │ Medium │ Variance          │ Adjustment    │
│ posting          │                   │       │ approval         │ inventory          │ nance    │        │ resolution rate   │ log           │
└──────────────────┴───────────────────┴───────┴──────────────────┴────────────────────┴──────────┴────────┴───────────────────┴───────────────┘
────────────────────────────────────────────────────────────────────────────────
W10. Steel Production Batch & Variance Management
Workflow overview
┌───────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item          │ Detail                                                                                                                       │
├───────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective     │ Record production conversion of raw material to finished goods with variance visibility                                      │
│ Trigger       │ Production batch completion                                                                                                  │
│ Preconditions │ Active steel factory; input/output items exist; sufficient stock                                                             │
│ Postcondition │ Batch recorded; stock issue/output posted; variance visible                                                                  │
│ s             │                                                                                                                              │
│ Related       │ Steel batches, stock, reporting                                                                                              │
│ modules       │                                                                                                                              │
│ Related       │ SteelProductionBatch, SteelInventoryTransaction, AuditLog                                                                    │
│ entities      │                                                                                                                              │
│ Exceptions    │ Insufficient stock, invalid batch data, unauthorized access                                                                  │
│ Evidence      │ steel.py::create_steel_batch, list_steel_batches, get_steel_batch_detail, redaction helpers in steel.py, service functions   │
│               │ in backend/services/steel_service.py                                                                                         │
│ Confidence    │ Confirmed                                                                                                                    │
└───────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬───────────────┬──────────────┬───────────────┬──────────┬──────────────┬────────────────┬──────────────┬──────────────────────────────┐
│ Step │ Description   │ Actor        │ Action        │ Output   │ Decision     │ Rule           │ Exception    │ Evidence                     │
├──────┼───────────────┼──────────────┼───────────────┼──────────┼──────────────┼────────────────┼──────────────┼──────────────────────────────┤
│ 1    │ Prepare batch │ Operator/Sup │ Enter batch   │ Draft    │ Valid        │ Active steel   │ 400/404      │ create_steel_batch           │
│      │ input         │ ervisor      │ data          │ payload  │ stock/items? │ factory        │              │                              │
│      │               │              │               │          │              │ required       │              │                              │
│ 2    │ Record batch  │ Operator/Man │ Submit batch  │ Batch    │ Sufficient   │ Stock/quantity │ Validation   │ create_steel_batch           │
│      │               │ ager         │               │ saved    │ input stock? │ checks         │ failure      │                              │
│ 3    │ Post          │ System       │ Issue raw,    │ Ledger   │ None         │ Trusted stock  │ Transaction  │ steel_service.py, batch      │
│      │ inventory     │              │ add output    │ updated  │              │ movement       │ posting      │ detail links                 │
│      │ effects       │              │               │          │              │                │ issue        │                              │
│ 4    │ Calculate var │ System       │ Compare       │ Variance │ Elevated     │ Severity logic │ None         │ severity_from_variance,      │
│      │ iance/severit │              │ expected vs   │ metrics  │ variance?    │ applies        │              │ variance_reason in service   │
│      │ y             │              │ actual        │          │              │                │              │ layer                        │
│ 5    │ Review        │ Supervisor/M │ View detail   │ Traceabi │ Financial    │ Financial      │ Access/redac │ get_steel_batch_detail, _red │
│      │ detail/audit  │ anager/Owner │               │ lity     │ access       │ redaction by   │ tion         │ act_steel_batch_financials   │
│      │               │              │               │          │ allowed?     │ role           │ mismatch     │                              │
└──────┴───────────────┴──────────────┴───────────────┴──────────┴──────────────┴────────────────┴──────────────┴──────────────────────────────┘
RACI matrix
┌────────────────────────┬──────────┬────────────┬─────────┬───────┬───────┬────────┐
│ Step                   │ Operator │ Supervisor │ Manager │ Admin │ Owner │ System │
├────────────────────────┼──────────┼────────────┼─────────┼───────┼───────┼────────┤
│ Enter batch data       │ R        │ C          │ C       │ I     │ I     │ I      │
│ Submit batch           │ R        │ C          │ A       │ I     │ I     │ C      │
│ Post stock movements   │ I        │ I          │ I       │ I     │ I     │ R/A    │
│ Review variance        │ I        │ R          │ A       │ C     │ C     │ C      │
│ Audit/exception review │ I        │ C          │ R       │ A     │ A     │ C      │
└────────────────────────┴──────────┴────────────┴─────────┴───────┴───────┴────────┘
Control matrix
┌───────────────────┬────────────────┬──────────────────────────┬────────┬──────────────────┬────────┬────────┬───────────────────┬────────────┐
│ Step              │ Owner          │ Approval                 │ SLA    │ Risk             │ Escala │ Automa │ KPI               │ Audit      │
│                   │                │                          │        │                  │ tion   │ tion   │                   │            │
├───────────────────┼────────────────┼──────────────────────────┼────────┼──────────────────┼────────┼────────┼───────────────────┼────────────┤
│ Batch capture     │ Production     │ No                       │ Same   │ Lost yield       │ Manage │ Medium │ Batch capture     │ Batch      │
│                   │ Supervisor     │                          │ shift  │ visibility       │ r      │        │ timeliness        │ create log │
│ Variance review   │ Manager        │ Yes for high variance    │ Same   │ Scrap/loss       │ Owner  │ Medium │ Variance reviewed │ Variance   │
│                   │                │ (target-state)           │ day    │ hidden           │        │        │ %                 │ audit      │
│ Financial         │ Owner/Admin    │ No                       │ On     │ Sensitive margin │ Admin  │ High   │ Role-redaction    │ Access log │
│ visibility        │                │                          │ demand │ leakage          │        │        │ correctness       │            │
└───────────────────┴────────────────┴──────────────────────────┴────────┴──────────────────┴────────┴────────┴───────────────────┴────────────┘
────────────────────────────────────────────────────────────────────────────────
W11. Steel Order-to-Cash (Customer → Invoice → Dispatch → Payment)
Workflow overview
┌──────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item         │ Detail                                                                                                                        │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Objective    │ Manage sales, dispatch, and collections for steel operations                                                                  │
│ Trigger      │ Customer sale/order and subsequent fulfillment/payment                                                                        │
│ Precondition │ Customer exists or created; stock/invoiceable goods exist; authorized roles                                                   │
│ s            │                                                                                                                               │
│ Postconditio │ Invoice created, dispatch completed, payment allocated, status updated                                                        │
│ ns           │                                                                                                                               │
│ Related      │ Steel customers, invoices, dispatches, payments                                                                               │
│ modules      │                                                                                                                               │
│ Related      │ SteelCustomer, SteelSalesInvoice, SteelDispatch, SteelCustomerPayment, SteelCustomerPaymentAllocation, follow-up tasks        │
│ entities     │                                                                                                                               │
│ Exceptions   │ Credit limit breach, over-dispatch, invalid customer verification, payment mismatch                                           │
│ Evidence     │ steel.py::create_steel_customer, create_steel_invoice, create_steel_dispatch, update_steel_dispatch_status,                   │
│              │ create_steel_customer_payment, follow-up/verification routes                                                                  │
│ Confidence   │ Confirmed                                                                                                                     │
└──────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬─────────────┬────────────┬────────────────────┬──────────────┬─────────────────┬───────────────┬──────────────┬───────────────────────┐
│ Step │ Description │ Actor      │ Action             │ Output       │ Decision        │ Rule          │ Exception    │ Evidence              │
├──────┼─────────────┼────────────┼────────────────────┼──────────────┼─────────────────┼───────────────┼──────────────┼───────────────────────┤
│ 1    │ Create/mana │ Accountant │ Create customer /  │ Customer     │ Verification    │ Customer      │ Invalid cont │ create_steel_customer │
│      │ ge customer │ /Manager   │ follow-up /        │ master data  │ needed?         │ validation    │ act/GST/PAN  │ , verification routes │
│      │             │            │ verification       │              │                 │ fields        │              │                       │
│ 2    │ Create      │ Accountant │ Submit invoice     │ Invoice      │ Credit limit    │ Invoice/custo │ Limit breach │ create_steel_invoice  │
│      │ invoice     │            │ lines              │ created      │ okay?           │ mer rules     │ / invalid    │                       │
│      │             │            │                    │              │                 │ apply         │ lines        │                       │
│ 3    │ Create      │ Supervisor │ Create dispatch    │ Dispatch     │ Quantity        │ Cannot exceed │ Reject       │ create_steel_dispatch │
│      │ dispatch    │ /Manager   │ and gate pass      │ record       │ available?      │ invoice       │ invalid      │                       │
│      │             │            │                    │              │                 │ remaining     │ dispatch     │                       │
│ 4    │ Update      │ Supervisor │ Move through       │ Loading/disp │ Inventory       │ Status        │ Invalid      │ update_steel_dispatch │
│      │ dispatch    │ /Manager/S │ lifecycle          │ atched/deliv │ posting         │ transitions   │ state        │ _status               │
│      │ status      │ ystem      │                    │ ered         │ threshold       │ matter        │              │                       │
│      │             │            │                    │              │ reached?        │               │              │                       │
│ 5    │ Record      │ Accountant │ Post payment and   │ Payment      │ Direct invoice  │ Amount/alloca │ Allocation   │ create_steel_customer │
│      │ payment     │            │ allocations        │ recorded     │ or multi-alloca │ tion rules    │ errors       │ _payment              │
│      │             │            │                    │              │ tion?           │               │              │                       │
│ 6    │ Refresh     │ System     │ Update invoice pai │ Settled      │ None            │ Derived from  │ Sync issue   │ _refresh_invoice_paym │
│      │ settlement  │            │ d/partial/unpaid   │ status       │                 │ allocations   │              │ ent_statuses logic in │
│      │ status      │            │                    │              │                 │               │              │ steel.py              │
│ 7    │ Collections │ Accountant │ Follow-up tasks    │ Actionable   │ Overdue?        │ Risk/overdue  │ Uncollected  │ create_steel_customer │
│      │ follow-up   │ /Manager   │                    │ collections  │                 │ monitoring    │ debt         │ _follow_up_task,      │
│      │             │            │                    │ queue        │                 │               │              │ ledger views          │
└──────┴─────────────┴────────────┴────────────────────┴──────────────┴─────────────────┴───────────────┴──────────────┴───────────────────────┘
RACI matrix
┌────────────────────────┬──────────┬────────────┬────────────┬─────────┬───────┬───────┬──────────┬────────┐
│ Step                   │ Operator │ Supervisor │ Accountant │ Manager │ Admin │ Owner │ Customer │ System │
├────────────────────────┼──────────┼────────────┼────────────┼─────────┼───────┼───────┼──────────┼────────┤
│ Customer setup         │ I        │ I          │ R          │ A       │ C     │ I     │ C        │ I      │
│ Invoice creation       │ I        │ I          │ R          │ A       │ C     │ I     │ C        │ I      │
│ Dispatch creation      │ C        │ R          │ I          │ A       │ C     │ I     │ I        │ C      │
│ Dispatch status update │ R/C      │ R          │ I          │ A       │ I     │ I     │ I        │ C      │
│ Payment posting        │ I        │ I          │ R          │ A       │ C     │ I     │ R        │ C      │
│ Settlement update      │ I        │ I          │ C          │ A       │ I     │ I     │ I        │ R      │
│ Collections follow-up  │ I        │ I          │ R          │ A       │ I     │ I     │ C        │ C      │
└────────────────────────┴──────────┴────────────┴────────────┴─────────┴───────┴───────┴──────────┴────────┘
Control matrix
┌──────────────────┬─────────────┬──────────────────┬─────────────┬─────────────────────┬────────────┬────────┬───────────────┬────────────────┐
│ Step             │ Owner       │ Approval         │ SLA         │ Risk                │ Escalation │ Automa │ KPI           │ Audit          │
│                  │             │                  │             │                     │            │ tion   │               │                │
├──────────────────┼─────────────┼──────────────────┼─────────────┼─────────────────────┼────────────┼────────┼───────────────┼────────────────┤
│ Customer master  │ Accountant/ │ No               │ Same day    │ Bad credit / KYC    │ Manager    │ Medium │ Verified      │ Customer       │
│                  │ Manager     │                  │             │ issues              │            │        │ customer %    │ change log     │
│ Invoice creation │ Accountant  │ No / manager for │ Same day    │ Revenue leakage /   │ Manager →  │ Medium │ Invoice       │ Invoice audit  │
│                  │             │ exceptions       │             │ wrong billing       │ Owner      │        │ accuracy      │                │
│ Dispatch         │ Supervisor  │ Yes for          │ Same day    │ Wrong shipment /    │ Manager    │ Medium │ On-time       │ Dispatch +     │
│ execution        │             │ exceptions       │             │ stock leak          │            │        │ dispatch rate │ gate log       │
│ Payment posting  │ Accountant  │ No               │ Same day    │ Cash application    │ Manager /  │ Medium │ Days sales    │ Payment        │
│                  │             │                  │ receipt     │ errors              │ Finance    │        │ outstanding   │ allocation     │
│                  │             │                  │             │                     │            │        │               │ audit          │
│ Overdue          │ Manager     │ No               │ Weekly/dail │ Bad debt            │ Owner      │ Low    │ Outstanding   │ Follow-up log  │
│ follow-up        │             │                  │ y review    │                     │            │        │ reduction     │                │
└──────────────────┴─────────────┴──────────────────┴─────────────┴─────────────────────┴────────────┴────────┴───────────────┴────────────────┘
────────────────────────────────────────────────────────────────────────────────
W12. Alerts & Recipient Management
Workflow overview
┌──────────────────┬────────────────────────────────────────────────────────────────────────────────┐
│ Item             │ Detail                                                                         │
├──────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ Objective        │ Detect operational issues and notify the right stakeholders                    │
│ Trigger          │ Ops alert event or admin recipient change                                      │
│ Preconditions    │ Alerting enabled; recipients configured                                        │
│ Postconditions   │ Recipient list maintained; alerts delivered/read                               │
│ Related modules  │ Alerts, Alert Recipients, WhatsApp, Email                                      │
│ Related entities │ Alert, OpsAlertEvent, AdminAlertRecipient, WebhookEvent                        │
│ Exceptions       │ Recipient invalid, verification incomplete, provider unavailable               │
│ Evidence         │ backend/routers/alerts.py, alert_recipients.py, whatsapp_webhook.py, README.md │
│ Confidence       │ Confirmed                                                                      │
└──────────────────┴────────────────────────────────────────────────────────────────────────────────┘
Step-by-step workflow
┌──────┬─────────────┬────────────┬────────────────┬─────────────┬───────────┬─────────────┬──────────────┬────────────────────────────────────┐
│ Step │ Description │ Actor      │ Action         │ Output      │ Decision  │ Rule        │ Exception    │ Evidence                           │
├──────┼─────────────┼────────────┼────────────────┼─────────────┼───────────┼─────────────┼──────────────┼────────────────────────────────────┤
│ 1    │ Configure   │ Admin/Owne │ Add/update     │ Recipient   │ New or    │ Admin/Owner │ Validation   │ create_alert_recipient,            │
│      │ recipients  │ r          │ recipient      │ record      │ existing? │ control     │ error        │ update_alert_recipient             │
│ 2    │ Verify      │ Admin/Syst │ Start and      │ Active      │ Verified? │ Verificatio │ Expired/fail │ start_alert_recipient_verification │
│      │ recipient   │ em/Recipie │ confirm        │ recipient   │           │ n required  │ ed           │ , confirm_alert_recipient_verifica │
│      │             │ nt         │ verification   │             │           │             │ verification │ tion                               │
│ 3    │ Generate    │ System     │ Detect/store   │ Alert       │ Threshold │ Event-based │ Missed event │ OpsAlertEvent model, README        │
│      │ ops event   │            │ event          │ candidate   │ /event    │ rules       │              │                                    │
│      │             │            │                │             │ met?      │             │              │                                    │
│ 4    │ Dispatch    │ System     │ Send           │ Delivery    │ Provider  │ meta/mock/d │ Provider     │ README.md, whatsapp_webhook.py     │
│      │ via         │            │ WhatsApp/email │ attempt     │ mode?     │ isabled     │ failure      │                                    │
│      │ provider    │            │                │             │           │ modes       │              │                                    │
│ 5    │ Read/acknow │ User       │ List/mark read │ Closed-loop │ None      │ Auth        │ Access       │ alerts.py::list_unread_alerts,     │
│      │ ledge alert │            │                │ notificatio │           │ required    │ denied       │ mark_alert_read                    │
│      │             │            │                │ n           │           │             │              │                                    │
└──────┴─────────────┴────────────┴────────────────┴─────────────┴───────────┴─────────────┴──────────────┴────────────────────────────────────┘
RACI matrix
┌──────────────────────┬────────────┬─────────┬───────┬───────┬────────┬────────────────────┐
│ Step                 │ Supervisor │ Manager │ Admin │ Owner │ System │ Recipient/Provider │
├──────────────────────┼────────────┼─────────┼───────┼───────┼────────┼────────────────────┤
│ Configure recipients │ I          │ C       │ R     │ A     │ I      │ I                  │
│ Verify recipients    │ I          │ I       │ A     │ A     │ R      │ R                  │
│ Generate event       │ I          │ I       │ I     │ I     │ R/A    │ I                  │
│ Dispatch alert       │ I          │ I       │ I     │ I     │ R/A    │ R                  │
│ Read/ack alert       │ R          │ R       │ C     │ C     │ I      │ I                  │
└──────────────────────┴────────────┴─────────┴───────┴───────┴────────┴────────────────────┘
Control matrix
┌──────────────────────┬───────────────┬────────┬─────────────┬───────────────────────┬───────────┬──────────┬─────────────────────┬───────────┐
│ Step                 │ Owner         │ Approv │ SLA         │ Risk                  │ Escalatio │ Automati │ KPI                 │ Audit     │
│                      │               │ al     │             │                       │ n         │ on       │                     │           │
├──────────────────────┼───────────────┼────────┼─────────────┼───────────────────────┼───────────┼──────────┼─────────────────────┼───────────┤
│ Recipient config     │ Admin         │ Yes    │ Same day    │ Alerts sent to wrong  │ Owner     │ Medium   │ Verified recipient  │ Config    │
│                      │               │        │             │ people                │           │          │ ratio               │ audit     │
│ Event generation     │ Ops/System    │ No     │ Near        │ Critical events       │ Eng/Ops   │ High     │ Alert detection     │ Event log │
│                      │ owner         │        │ real-time   │ missed                │           │          │ latency             │           │
│ Delivery             │ System        │ No     │ Minutes     │ Escalation failure    │ Provider/ │ High     │ Delivery success    │ Delivery  │
│                      │               │        │             │                       │ Eng       │          │ rate                │ log       │
│ Read acknowledgement │ Functional    │ No     │ Same        │ Action not taken      │ Manager   │ Low      │ Read/               │           │
│                      │ owner         │        │ shift/day   │                       │           │          │                     │           │
└──────────────────────┴───────────────┴────────┴─────────────┴───────────────────────┴───────────┴──────────┴─────────────────────┴───────────┘

---
## Evidence Legend

Throughout this document:
- **Confirmed** = directly evidenced from code paths, routers, models, or documentation
- **Inferred** = strongly implied by existing implementation patterns
- **Assumption** = plausible but not explicitly supported in scanned evidence

---

## Section 1: Role Catalog

| # | Role / Actor | Purpose | Core Responsibilities | Evidence | Status |
|---|-------------|---------|----------------------|----------|--------|
| 1 | **ATTENDANCE** | Minimal workforce user | Punch own attendance, view own attendance | `UserRole.ATTENDANCE`, attendance routes | **Confirmed** |
| 2 | **OPERATOR** | Shop-floor execution | Record entries/batches, gate actions, operational capture | `UserRole.OPERATOR`, entries/steel routes | **Confirmed** |
| 3 | **SUPERVISOR** | First-line reviewer/approver | Review attendance, entries, OCR, dispatch progression | Attendance/entries/OCR/steel routes | **Confirmed** |
| 4 | **ACCOUNTANT** | Finance specialist | Customers, invoices, payments, finance OCR, balances | Steel invoice/payment/customer endpoints | **Confirmed** |
| 5 | **MANAGER** | Cross-functional controller | Operational oversight, partial admin, analytics, reports | Settings routes, analytics, reports | **Confirmed** |
| 6 | **ADMIN** | System/business admin | User/admin config, alerts, billing visibility, audit | Settings, alert recipients, observability | **Confirmed** |
| 7 | **OWNER** | Ultimate org authority | Cross-factory governance, billing, overrides | Owner-only routes (billing, org plan, PDF) | **Confirmed** |
| 8 | **System / Automation** | Async processor | Background jobs, alerts, email, OCR routing, schedulers | `background_jobs.py`, WhatsApp sender | **Confirmed** |
| 9 | **Steel Customer** | External counterparty | Receives goods, makes payments | Customer/invoice/payment models | **Confirmed** |
| 10 | **Driver / Transporter** | Physical logistics | Carries dispatched material | Dispatch fields (truck, driver, transporter) | **Confirmed** |
| 11 | **AI / OCR Provider** | External intelligence | OCR refinement, AI extraction, summaries | OCR/AI services, AI router | **Confirmed** |
| 12 | **Razorpay** | Payment gateway | Order creation, webhook confirmation | `billing.py`, `payment_order.py` | **Confirmed** |
| 13 | **Google OAuth** | Identity provider | Social login | `auth_google.py` | **Confirmed** |
| 14 | **WhatsApp (Meta)** | Notification provider | Alert delivery and webhook | WhatsApp section, `whatsapp_webhook.py` | **Confirmed** |

---

## Section 2: Workflow Inventory

| ID | Workflow | Business Objective | Primary Roles | Systems/Modules | Confidence |
|----|----------|-------------------|---------------|-----------------|------------|
| WF-01 | User Invitation, Registration & Onboarding | Add users securely into factory/org context | Admin, Manager, Owner, System | Auth, Settings, Email verification | **Confirmed** |
| WF-02 | Authentication, Session, MFA & Factory Context | Secure access and correct working context | All users, System, Google | Auth, Secure Sessions, MFA, Tenancy | **Confirmed** |
| WF-03 | Factory Administration & User Governance | Create factories, assign access, manage users/roles/plans | Manager, Admin, Owner | Settings, RBAC, Tenancy, Plans | **Confirmed** |
| WF-04 | Attendance Capture, Live Board & Regularization | Track workforce presence and exceptions | Worker, Operator, Supervisor, Manager | Attendance, Profiles, Shift Templates | **Confirmed** |
| WF-05 | Daily Entry / Production Reporting & Approval | Capture shift data and approve it | Operator, Supervisor, Manager | Entries, AI Summary Queue | **Confirmed** |
| WF-06 | OCR Scan → Verification → Structured Output | Convert paper/photo to verified data | Supervisor, Accountant, Manager, Admin, Owner, System | OCR, AI, Templates, Verification Queue | **Confirmed** |
| WF-07 | OCR Template Governance | Standardize OCR interpretation per document type | Supervisor+, Admin, Owner | OCR Template Management | **Confirmed** |
| WF-08 | Reporting, Export & Async Document Delivery | Produce PDFs, Excel, reports | Supervisor, Manager, Accountant, Admin, Owner | Reports, Jobs, Email | **Confirmed** |
| WF-09 | Analytics, AI Insight & Anomaly Review | Turn data into management insight | Supervisor, Manager, Admin, Owner, System | Analytics, AI, Premium, Intelligence | **Confirmed** |
| WF-10 | Operational Alerts & Recipient Management | Route critical signals to right people | Admin, Owner, System, Recipients | Alerts, WhatsApp, Recipients | **Confirmed** |
| WF-11 | Billing, Subscription & Payment Order Lifecycle | Manage plans and billing | Owner, Admin, System, Razorpay | Billing, Plans, Subscriptions, Webhook | **Confirmed** |
| WF-12 | Feedback Capture & Resolution | Capture issues/suggestions and resolve | Any user, Admin, Owner, System | Feedback, Translation | **Confirmed** |
| WF-13 | Steel Customer Onboarding & Verification | Create customer, verify tax identity, track follow-ups | Accountant, Manager, Admin, Owner | Steel Customers, Verification, Follow-ups | **Confirmed** |
| WF-14 | Steel Inventory Control & Reconciliation | Maintain inventory integrity | Manager, Admin, Owner, Supervisor | Steel Inventory, Reconciliation | **Confirmed** |
| WF-15 | Steel Production Batch Management | Record production with variance tracking | Operator, Supervisor, Manager, Admin, Owner | Steel Batches, Stock Posting | **Confirmed** |
| WF-16 | Steel Sales Invoicing & Credit Control | Create invoices with credit rules | Accountant, Manager, Admin, Owner | Steel Invoices, Customer Credit | **Confirmed** |
| WF-17 | Steel Dispatch & Gate Pass Lifecycle | Execute dispatch against invoice | Supervisor, Manager, Admin, Owner, Operator | Dispatch, Gate Pass, Inventory | **Confirmed** |
| WF-18 | Steel Payment Recording & Allocation | Record receipts and settle invoices | Accountant, Manager, Admin, Owner | Payments, Allocations | **Confirmed** |
| WF-19 | Background Job Operations | Manage long-running jobs reliably | User, Admin, System | Shared Background Jobs | **Confirmed** |
| WF-20 | Observability & Incident Signal Capture | Monitor health and capture errors | Admin, Owner, System | Observability | **Confirmed** |

---

## Section 3: Detailed Workflow Documentation

### WF-01 — User Invitation, Registration & Onboarding

**Objective:** Add a user to the platform with correct org/factory/role context  
**Trigger:** Admin/Manager invites user, or user self-registers  
**Preconditions:** Valid org/factory exists; inviter has rights; email not conflicting  
**Postconditions:** User account created/invited, verification/reset tokens issued, factory access set  
**Evidence:** `backend/routers/auth.py:register_user`, `backend/routers/settings.py:invite_user`, `backend/services/email_verification_service.py`

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | Admin/Manager initiates invite or user registers | Manager/Admin/Owner/User | Settings/Auth | Identity + role + factory | Request payload | `invite_user`, `register_user` |
| 2 | System validates org, email uniqueness, role/plan | System | Settings/RBAC/Plans | Email, role, org | Allow/reject | Plan checks in invite flow |
| 3 | User record created or pending registration persisted | System | DB | User data | User row | `User`, `PendingRegistration` |
| 4 | Verification/reset links generated and delivered | System | Email services | User context | Invite email | `create_verification_token` |
| 5 | User verifies email / sets password / logs in | User | Auth | Token/password | Activated access | `verify_email_address` |
| 6 | User selects active factory if multiple memberships | User | Auth/Tenancy | Factory selection | Active context | `select_factory` |

#### RACI Matrix

| Step | Manager | Admin | Owner | New User | System |
|------|:-------:|:-----:|:-----:|:--------:|:------:|
| Initiate invite / register | **R** | **R** | **A** | **R** (self) | I |
| Validate role/org/plan | C | C | C | I | **A/R** |
| Create account/membership | I | I | I | I | **A/R** |
| Send verification/reset links | I | I | I | I | **A/R** |
| Verify and activate | I | I | I | **A/R** | C |
| Select active factory | I | I | I | **A/R** | C |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Admin / Owner |
| Approval Required | Yes for invited role assignment; unclear for self-registration |
| SLA | **Not defined in code**; operationally should be same day |
| Key Risks | Wrong role assignment, duplicate account, invite email failure |
| Escalation | Manager → Admin → Owner |
| Audit Need | High — role changes, invites, membership grants |
| Evidence | `ROLE_UPDATED`, `FACTORY_ACCESS_UPDATED` audit writers |

---

### WF-02 — Authentication, Session, MFA & Factory Context

**Objective:** Secure login and controlled access to correct factory/org data  
**Trigger:** Login, OAuth login, token refresh, session check  
**Preconditions:** Active user, verified credentials, session/token validity  
**Postconditions:** Authenticated session/token and active factory context  
**Evidence:** `auth.py`, `auth_secure.py`, `auth_google.py`

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | User enters credentials or starts Google login | User | Auth | Email/password or OAuth | Auth request | `login_user`, `google_login` |
| 2 | System validates credentials/session | System | Auth/Security | Credentials/token | Auth success/deny | `login_user`, `refresh_access_token` |
| 3 | MFA setup/verify if enabled | User/System | Secure Auth | OTP/MFA code | Trusted session | `mfa_setup`, `mfa_verify` |
| 4 | User retrieves auth context and factories | User/System | Auth/Tenancy | Session | Profile/context | `get_me`, `get_auth_context` |
| 5 | User selects active factory | User | Auth/Tenancy | Factory ID | Factory-scoped context | `select_factory` |
| 6 | User refreshes or logs out | User/System | Auth | Refresh/logout | New token or closed session | `refresh_access_token`, `logout_user` |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Security / Platform Admin |
| Approval Required | No for normal login; RBAC behind the scenes |
| SLA | Real-time |
| Key Risks | Session hijack, weak factory isolation, MFA bypass |
| Escalation | User → Admin → Owner |
| Audit Need | Very high — auth audit, role revision, session events |

---

### WF-03 — Factory Administration & User Governance

**Objective:** Configure factory structure, users, roles, plans, and access  
**Trigger:** New factory setup or user governance action  
**Preconditions:** Manager+/Admin+/Owner rights, org context  
**Postconditions:** Factory/user/access settings updated  
**Evidence:** `backend/routers/settings.py`

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | Create or update factory | Manager/Admin/Owner | Settings | Factory data | Factory/settings row | `create_factory`, `update_factory_settings` |
| 2 | Invite/list/deactivate users | Manager/Admin/Owner | Settings | User identity | User governance change | `list_users`, `invite_user`, `deactivate_user` |
| 3 | Update role or plan | Manager/Admin/Owner | Settings/RBAC | User role/plan | Role revision / plan update | `update_user_role`, `update_user_plan` |
| 4 | Manage factory access memberships | Admin/Owner | Settings/Tenancy | Factory IDs | `UserFactoryRole` updates | `update_user_factory_access` |
| 5 | View control tower/org usage | Manager/Admin/Owner | Settings | None | Org/factory summary | `get_control_tower`, `get_usage` |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Admin / Owner |
| Approval Required | Yes for privileged role/factory access changes |
| SLA | Same day for operational changes |
| Key Risks | Privilege escalation, wrong factory membership, orphaned privileged user |
| Escalation | Manager → Admin → Owner |
| Audit Need | Very high — role change, plan change, factory access |

---

### WF-04 — Attendance Capture, Live Board & Regularization

**Objective:** Track workforce presence and resolve exceptions  
**Trigger:** Punch event, missed punch, review request  
**Preconditions:** User exists, active factory/shift setup  
**Postconditions:** Attendance record updated; exception approved/rejected  
**Evidence:** `backend/routers/attendance.py`

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | User punches attendance | Worker/Operator | Attendance | Punch request | Today's attendance state | `punch_attendance` |
| 2 | System updates live attendance board | System | Attendance | Attendance event | Live board metrics | `get_live_attendance` |
| 3 | If issue, user raises regularization request | Worker | Attendance | Reason, corrected info | Review request | `create_regularization_request` |
| 4 | Supervisor/manager reviews queue | Supervisor/Manager | Attendance | Review queue item | Approve/reject decision | `get_attendance_review_queue` |
| 5 | System updates records and reporting | System | Attendance/Reports | Review decision | Corrected attendance | `approve_attendance_review`, `get_attendance_report_summary` |

#### RACI Matrix

| Step | Worker | Supervisor | Manager | Admin | System |
|------|:------:|:----------:|:-------:|:-----:|:------:|
| Punch attendance | **R** | I | I | I | C |
| Update live board | I | I | I | I | **A/R** |
| Submit regularization | **R** | I | I | I | C |
| Review regularization | I | **R** | **A** | C | I |
| Finalize records/reports | I | C | C | I | **A/R** |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Supervisor / HR-like operational owner (inferred) |
| Approval Required | Yes for regularization/review |
| SLA | Same shift / same day recommended; not explicit |
| Key Risks | Proxy punch, missed punches, self-approval, report inaccuracies |
| Escalation | Supervisor → Manager → Admin |
| Audit Need | High — punch source, review action, reason logging |

---

### WF-05 — Daily Entry / Production Reporting & Approval

**Objective:** Capture shift/day production data and approve it  
**Trigger:** Entry creation or smart parsing  
**Preconditions:** Authenticated user, active factory, valid entry schema  
**Postconditions:** Entry created, approved/rejected, summaries queued  
**Evidence:** `backend/routers/entries.py`

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | User optionally uses smart parse | Operator/Supervisor | Entries/AI | Free text | Structured suggestion | `parse_smart_input` |
| 2 | User creates entry | Operator | Entries | Entry fields | Draft/submitted entry | `create_entry` |
| 3 | Reviewer lists and inspects entries | Supervisor/Manager | Entries | Filters | Review candidates | `list_entries`, `get_entry` |
| 4 | Reviewer approves or rejects | Supervisor/Manager | Entries | Review decision | Approved/rejected status | `approve_entry`, `reject_entry` |
| 5 | Summary metadata/job created if needed | System | Entries/Jobs/AI | Entry ID | Summary job/meta | `queue_entry_summary` |

#### RACI Matrix

| Step | Operator | Supervisor | Manager | Admin | System |
|------|:--------:|:----------:|:-------:|:-----:|:------:|
| Smart parse / create | **R** | C | I | I | C |
| Review queue | I | **R** | **A** | C | I |
| Approve/reject | I | **R** | **A** | C | I |
| Generate summary job | I | I | I | I | **A/R** |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Supervisor / Production Manager |
| Approval Required | Yes |
| SLA | Same shift / next shift recommended; not explicit |
| Key Risks | Bad data, delayed approvals, inaccurate AI summary |
| Escalation | Supervisor → Manager → Owner |
| Audit Need | High — create/update/delete/approve/reject |

---

### WF-06 — OCR Scan → Verification → Structured Output

**Objective:** Digitize paper logs/images into trusted structured data  
**Trigger:** Image upload / scan / async export request  
**Preconditions:** OCR-capable document, allowed role, active factory, file within limits  
**Postconditions:** Verification draft/approved record and optional export job  
**Evidence:** `backend/routers/ocr.py`, OCR services, frontend OCR state machine

#### Step Flow

| Step | Description | Role | System | Input | Output | Evidence |
|------|-------------|------|--------|-------|--------|----------|
| 1 | User uploads/scans image | User | OCR UI/API | Image | Upload accepted/rejected | `ocr_logbook`, `warp_document` |
| 2 | System preprocesses and extracts OCR preview | System | OCR/Tesseract/AI | Image bytes | Partial structured data | OCR pipeline, `ocr_document_pipeline.py` |
| 3 | Verification draft created/updated | User/System | OCR Verifications | Corrected fields | Draft verification | `create_verification`, `update_verification` |
| 4 | User submits verification | Supervisor/Accountant | OCR | Draft | Submitted state | `submit_verification` |
| 5 | Reviewer approves/rejects | Supervisor/Accountant/Manager | OCR | Review decision | Approved/rejected | `approve_verification`, `reject_verification` |
| 6 | Async Excel/report job may run | System | Jobs/OCR | Verification | Downloadable output | `ocr_logbook_excel_async` |

#### RACI Matrix

| Step | Supervisor | Accountant | Manager | Admin | Owner | System |
|------|:----------:|:----------:|:-------:|:-----:|:-----:|:------:|
| Upload/preview | **R** | **R** | C | I | I | C |
| Correct draft | **R** | **R** | C | I | I | C |
| Submit verification | **R** | **R** | C | I | I | I |
| Approve/reject | **R** (ops) | **R** (finance) | **A** | C | C | I |
| Async export | I | I | I | I | I | **A/R** |

#### Control Matrix

| Control | Value |
|---------|-------|
| Process Owner | Supervisor (ops docs) / Accountant (finance docs) |
| Approval Required | Yes for trusted/approved extraction |
| SLA | Same day for critical documents; not codified |
| Key Risks | OCR misread, role mismatch, oversized upload, silent export failure |
| Escalation | Supervisor/Accountant → Manager → Admin |
| Audit Need | Very high — original image, confidence, corrections, approver |

---

### WF-07 to WF-12 — Summary Tables

*(Full detailed documentation available in thinker-gpt analysis. Summary RACI and controls provided below.)*

| WF | Workflow | Process Owner | Approval Required | Key Risk | Escalation | Audit |
|----|----------|:-------------:|:-----------------:|:--------:|:----------:|:-----:|
| 07 | OCR Template Governance | Manager/Admin | Recommended | Template drift | Manager→Admin | Medium |
| 08 | Reporting & Export | Manager/Accountant | Usually not | Silent job errors | User→Admin | Medium-High |
| 09 | Analytics & AI Insight | Manager/Owner | No for view | AI hallucination | Manager→Owner | High |
| 10 | Operational Alerts | Admin | Recipient config only | Wrong recipients | Manager→Owner | High |
| 11 | Billing & Subscription | Owner | Yes for plan changes | Webhook failure | Admin→Owner | Very High |
| 12 | Feedback Resolution | Admin | Yes for closure | Untriaged issues | Admin→Owner | Medium |

---

### WF-13 to WF-18 — Steel ERP Workflows

*(The steel module forms a complete order-to-cash sub-ERP within the platform.)*

| WF | Workflow | Domain | Process Owner | Approval Required | Highest Risk |
|----|----------|:------:|:-------------:|:-----------------:|:------------:|
| 13 | Customer Onboarding & Verification | Finance/Commercial | Accountant | Yes for verification | Invalid tax data |
| 14 | Inventory Control & Reconciliation | Operations/Inventory | Manager | Yes for pending recs | Negative stock / unauthorized adjustment |
| 15 | Production Batch Management | Operations/Production | Production Manager | Implied for variance | Wrong yield / wrong item mapping |
| 16 | Sales Invoicing & Credit Control | Finance/Commercial | Accountant | Yes for credit override | Over-credit / post-dispatch tamper |
| 17 | Dispatch & Gate Pass Lifecycle | Operations/Logistics | Dispatch Manager | Yes for status progression | Over-dispatch / stock mismatch |
| 18 | Payment Recording & Allocation | Finance/Collections | Accountant | Usually no; yes for overrides | Misallocation / duplicate receipt |

#### Steel Order-to-Cash RACI (Combined View)

| Step | Operator | Supervisor | Accountant | Manager | Admin | Owner | System |
|------|:--------:|:----------:|:----------:|:-------:|:-----:|:-----:|:------:|
| Customer creation | — | — | **R** | **A** | C | I | C |
| Inventory item/setup | — | — | — | **R** | **A** | C | I |
| Production batch record | **R** | C | — | **A** | I | I | C |
| Stock reconciliation | — | C | I | **R** | **A** | C | C |
| Sales invoice create | — | — | **R** | **A** | C | I | C |
| Dispatch create | — | **R** | — | **A** | C | I | C |
| Dispatch status update | C | **R** | — | **A** | C | C | I |
| Payment record & allocate | — | — | **R** | **A** | C | I | C |
| Invoice payment refresh | — | — | I | I | I | I | **A/R** |
| Stock auto-posting | — | — | — | — | — | — | **A/R** |

---

### WF-19 — Background Job Operations

**Objective:** Manage long-running OCR/report/AI jobs reliably  
**Trigger:** Async job creation  
**Preconditions:** User starts async-capable action  
**Postconditions:** Job completed/failed/cancelled/retried  
**Evidence:** `backend/services/background_jobs.py`, `backend/routers/jobs.py`

| Control | Value |
|---------|-------|
| Process Owner | Platform/System Admin |
| Approval Required | No for normal use; admin oversight recommended for failures |
| SLA | Queue dependent |
| Key Risks | Silent failure, duplicate job paths, orphaned jobs |
| Escalation | User → Admin |
| Audit Need | High for critical OCR/report jobs |

---

### WF-20 — Observability & Incident Signal Capture

**Objective:** Expose health/readiness and capture operational/frontend errors  
**Trigger:** Health check, error event  
**Preconditions:** Service running  
**Postconditions:** Health response or captured incident signal  
**Evidence:** `backend/routers/observability.py`

| Control | Value |
|---------|-------|
| Process Owner | Admin |
| Approval Required | No |
| SLA | Real-time detection |
| Key Risks | Weak incident response ownership, limited escalation path |
| Escalation | Admin → Owner |
| Audit Need | Medium-High |

---

## Section 4: Gap Analysis

### A. Governance & Ownership Gaps

| # | Gap | Description | Evidence | Impact | Classification |
|---|-----|-------------|----------|--------|:--------------:|
| 1 | **Role-policy drift** | Documented matrix does not fully match implemented route access | RBAC audit: ROLE_ORDER conflicts, Manager user-admin in code, Accountant inventory access | Security and operational confusion | **Critical** |
| 2 | **Factory-scoped enforcement unclear** | `UserFactoryRole` exists but many decisions use `user.role` only | `rbac.py` vs `user_factory_role.py` | Cross-factory data access risk | **Critical** |
| 3 | **No explicit SLA model** | Workflow timing expectations not codified | No SLA evidence in scanned routes/docs | Delays hard to govern | **High** |
| 4 | **No clear process owner model** | Ownership implied by role access, not explicitly modeled | Across all workflows | Weak accountability | **High** |

### B. Workflow Control Gaps

| # | Gap | Description | Impact | Classification |
|---|-----|-------------|--------|:--------------:|
| 5 | **Missing denial audit logging** | 403 permission denials not centrally logged | Poor security observability | **Critical** |
| 6 | **OCR frontend/backend role mismatch** | Operator reaches OCR UI but backend denies some routes | Broken user journey | **Critical** |
| 7 | **Upload size mismatch** | Frontend 12MB vs backend 8MB | UX failure, repeat attempts | **High** |
| 8 | **Silent async failure** | OCR export catch swallows errors | False sense of completion | **High** |
| 9 | **Dual OCR async infrastructure** | Legacy and shared background jobs coexist | Maintenance confusion | **Medium** |

### C. Business Process Coverage Gaps

| # | Gap | Evidence | Impact | Classification |
|---|-----|----------|--------|:--------------:|
| 10 | **Procurement/Purchase workflow missing** | No purchase orders or vendor management | Incomplete ERP loop | **High** |
| 11 | **Returns/credit notes incomplete** | Invoice void exists but no robust returns flow | Revenue leakage/compliance risk | **High** |
| 12 | **Maintenance/task mgmt not formalized** | Docs mention maintenance vision but no confirmed router/model | Missed downtime control | **Medium** |
| 13 | **Formal incident management absent** | Observability exists but no incident workflow | Operational support weakness | **Medium** |

### D. Quality & Reliability Gaps

| # | Gap | Evidence | Impact | Classification |
|---|-----|----------|--------|:--------------:|
| 14 | **Full test suite unstable** | Targeted tests pass; full `pytest -q` fails | Release risk | **Critical** |
| 15 | **Web lint failing** | Build passes but lint fails | CI/CD gate risk | **High** |
| 16 | **Invite flow bug** | Missing `import secrets` in invite path | User onboarding failure | **Critical** |

---

## Section 5: Prioritized Recommendations

### Critical (Fix Before Go-Live)

| # | Recommendation | Why | Affected Workflows |
|---|---------------|-----|-------------------|
| 1 | Unify RBAC model and route authorization using one canonical permission source | Role drift creates security and workflow confusion | WF-01 to WF-18 |
| 2 | Enforce factory-scoped authorization using `UserFactoryRole` | Multi-factory data isolation is core to trust | WF-02, WF-03, WF-13 to WF-18 |
| 3 | Fix OCR role mismatch, upload-size mismatch, and silent async failures | Direct operational blockage and poor trust | WF-06, WF-08, WF-19 |
| 4 | Add centralized denial logging and override logging | Required for governance and audit | All controlled workflows |
| 5 | Fix onboarding/invite bug and stabilize critical test paths | Broken user onboarding undermines adoption | WF-01, release readiness |

### High (Fix Within First Release Sprint)

| # | Recommendation | Why | Affected Workflows |
|---|---------------|-----|-------------------|
| 6 | Publish formal workflow owners, approvers, and SLAs | Current ownership is implied, not governed | All |
| 7 | Complete missing procurement/vendor and returns/credit-note workflows | Steel ERP is incomplete without inbound supply flows | WF-13 to WF-18 |
| 8 | Standardize async job handling on one job framework | Reduces support complexity and hidden failures | WF-06, WF-08, WF-09, WF-19 |
| 9 | Separate "ops OCR" and "finance OCR" policies explicitly in UI and backend | Reduces role confusion and improves approval clarity | WF-06, WF-07 |
| 10 | Add exception dashboards for pending approvals, failed jobs, stock variances, overdue invoices | Converts hidden work into manageable queues | WF-04, WF-05, WF-06, WF-14, WF-16, WF-18 |

### Medium (Next Quarter)

| # | Recommendation | Why | Affected Workflows |
|---|---------------|-----|-------------------|
| 11 | Create unified control tower for workflow aging and bottlenecks | Leadership needs operational visibility | WF-03 onward |
| 12 | Add maker-checker rules consistently for finance and stock overrides | Stronger control design | WF-14, WF-16, WF-18 |
| 13 | Formalize feedback severity, category taxonomy, and closure SLA | Better continuous improvement loop | WF-12 |
| 14 | Add explicit KPI definitions in product/admin dashboards | Current KPIs present but not governed | WF-08, WF-09, WF-11, steel flows |
| 15 | Publish SOPs for attendance regularization, OCR review, dispatch completion | Supports mixed digital-skill environments | WF-04, WF-06, WF-17 |

### Low (Backlog)

| # | Recommendation | Why | Affected Workflows |
|---|---------------|-----|-------------------|
| 16 | Add multilingual workflow guidance and inline help for each critical module | Supports India SMB adoption model | Most end-user workflows |
| 17 | Add self-service customer/driver status links where appropriate | Reduces back-office calls | WF-17, WF-18 |
| 18 | Expand incident workflow beyond frontend error capture | Better support maturity | WF-20 |
| 19 | Align redesign documentation with actual backend maturity | Reduces stakeholder confusion | Portfolio/PMO governance |

---

## Section 6: Target-State Operating Model (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORGANIZATION LEVEL                        │
│  Owner + Admin: Governance, Billing, Cross-factory, Audit    │
├─────────────────────────────────────────────────────────────┤
│                    FACTORY LEVEL                             │
│  Manager: Factory operations owner, oversight, escalation    │
├──────────────────────┬──────────────────────────────────────┤
│   OPERATIONS DOMAIN  │         FINANCE DOMAIN               │
│  Supervisor (team)   │  Accountant (commercial)              │
│  Operator (execute)  │  → Customers, invoices, payments     │
│  → Attendance        │  → Credit, collections, finance OCR  │
│  → Entry/batch       │                                      │
│  → Dispatch ops      │                                      │
│  → Ops OCR           │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

**Key principles of target state:**
1. Supervisor and Accountant are **domain peers**, not linear rank neighbors
2. Manager is the **bridge role** connecting both domains
3. Admin is **platform/system governance**, not business operations
4. Owner is **org-level authority** with override and billing
5. All authorization uses **named permissions + scope**, not rank thresholds

---

## Section 7: Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|:----------:|:------:|------------|
| 1 | Role permission drift causes wrong data exposure | High | High | Unify RBAC source of truth; audit all routes |
| 2 | Factory isolation failure due to weak scoping | Medium | Critical | Enforce factory-scoped roles in all authorization |
| 3 | OCR pipeline trust undermined by mismatched policies | High | High | Align UI/backend policies; fix known mismatches |
| 4 | Failed async jobs go unnoticed | Medium | Medium | Surface job failures to admin dashboard |
| 5 | User onboarding blocked by invite bug | High | High | Fix known bug; add automated test |
| 6 | Financial leakage from over-credit or missing returns flow | Medium | High | Add credit note workflow; enforce hard credit checks |
| 7 | Audit trail gaps for denied actions | High | Medium | Add centralized denial logging |

---

## Section 8: Conclusion

DPR.ai is already structured like a real factory operating platform. Its business-critical value chain — workforce capture → operational entry → OCR digitization → approvals → analytics → alerts → steel order-to-cash — is functionally implemented and largely operational.

The most impactful improvements are **not about adding more features**. They are about:
1. **Tightening governance** — unified RBAC, explicit workflow ownership, and proper escalation paths
2. **Fixing known mismatches** — role policy drift, OCR inconsistencies, async reliability
3. **Completing the ERP loop** — procurement and returns/credit note support
4. **Improving test reliability** — stable regression suite for go-live confidence

A successful go-live requires resolving the Critical-priority items first, then systematically addressing High and Medium items through the first two release cycles.

---

*End of Report — Generated June 16, 2026*
