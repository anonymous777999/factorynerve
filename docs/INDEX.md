# 📚 FactoryNerve — Documentation Central Index

> **Single source of truth for all project documentation.**
> Last updated: July 2026

---

## 📂 Docs Structure

```
docs/
├── 1-customer-facing/          # Sales, onboarding, user training
├── 2-architecture/             # System architecture & technical design
├── 3-reference/                # Installation, setup, testing, troubleshooting
├── OCR_SYSTEM/                 # OCR pipeline — stabilization, plans, workflows
├── public/                     # Deployment guides
├── archive/                    # Historical artifacts, diffs, certificates
├── audit-screenshots/          # Visual audit evidence (dated folders)
├── tab-screenshots/            # Screenshot captures (dated folders)
└── internal/                   # Internal development documentation
    ├── architecture/           # Component hierarchy, layout maps
    ├── audits/                 # Bug reports, readiness, UX audits
    ├── authorization/          # Role/workflow matrices, RBAC specs
    ├── implementation/         # Phase plans, validation plans, fix plans
    ├── product/                # DPR AI product documentation
    ├── refactoring/            # Redesign roadmaps
    ├── reports/                # Simulation reports, billing analysis
    └── workflow-maps/          # Workflow catalogs & groups
```

---

## 📑 Complete File Index

### 🏢 1. Customer-Facing (Sales & Onboarding)

| File | Description |
|------|-------------|
| [`1-customer-facing/FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md`](./1-customer-facing/FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md) | **Sales proposal** — Complete pitch, pricing plans (₹10k/₹20k/₹35k), Day 1-30 onboarding timeline, role-by-role explanation, what's included vs what's not |
| [`1-customer-facing/QUICK_START_GUIDE.md`](./1-customer-facing/QUICK_START_GUIDE.md) | **1-page Quick Start** — Login → Dashboard → Attendance → Inventory → Approvals → PDF → AI. With screenshot placeholders |
| [`1-customer-facing/QUICK_START_GUIDE_HINDI.md`](./1-customer-facing/QUICK_START_GUIDE_HINDI.md) | **हिंदी Quick Start** — Same guide in simple Hinglish for floor operators |
| [`1-customer-facing/ROLE_TRAINING_GUIDE.md`](./1-customer-facing/ROLE_TRAINING_GUIDE.md) | **Role-by-role training** — Owner, Operator, Supervisor, Accountant, Store Keeper, Security Guard. Step-by-step daily tasks with field-by-field explanations |
| [`1-customer-facing/STEEL_FACTORY_ONBOARDING_CHECKLIST.md`](./1-customer-facing/STEEL_FACTORY_ONBOARDING_CHECKLIST.md) | **Onboarding checklist** — Pre-go-live setup steps for a steel factory |

---

### 🏗️ 2. Architecture & Technical Design

| File | Description |
|------|-------------|
| [`2-architecture/ARCHITECTURE.md`](./2-architecture/ARCHITECTURE.md) | **System architecture** — Component diagram, data flow, module boundaries |
| [`2-architecture/FACTORYNERVE_ENTERPRISE_ARCHITECTURE_REPORT.md`](./2-architecture/FACTORYNERVE_ENTERPRISE_ARCHITECTURE_REPORT.md) | **Enterprise-grade analysis** — Complete factory operations mapped to software: actors, business objects, material journey, department workflows, state machines, decision matrix, gap analysis, future evolution |
| [`2-architecture/FACTORYNERVE_CHAOS_TEST_REPORT.md`](./2-architecture/FACTORYNERVE_CHAOS_TEST_REPORT.md) | **Chaos testing results** — System resilience under failure scenarios |
| [`2-architecture/FACTORY_NERVE_BACKEND_AUDIT_REPORT.md`](./2-architecture/FACTORY_NERVE_BACKEND_AUDIT_REPORT.md) | **Backend audit** — Database schema, API endpoints, code quality assessment |

---

### 📖 3. Reference (Dev Setup, Testing, Troubleshooting)

| File | Description |
|------|-------------|
| [`3-reference/INSTALLATION.md`](./3-reference/INSTALLATION.md) | **Installation guide** — Full setup from scratch |
| [`3-reference/LOCAL_DEV_SETUP.md`](./3-reference/LOCAL_DEV_SETUP.md) | **Local development** — Environment config, seed data, running locally |
| [`3-reference/MCP_SETUP.md`](./3-reference/MCP_SETUP.md) | **MCP setup** — Model Context Protocol configuration |
| [`3-reference/TESTING_GUIDE.md`](./3-reference/TESTING_GUIDE.md) | **Testing guide** — How to run tests, testing philosophy |
| [`3-reference/TROUBLESHOOTING.md`](./3-reference/TROUBLESHOOTING.md) | **Troubleshooting** — Common issues and fixes |

---

### 🔧 4. Internal Development

#### 📋 Implementation Plans

| File | Description |
|------|-------------|
| [`internal/implementation/PHASE_1_ENTERPRISE_PLAN.md`](./internal/implementation/PHASE_1_ENTERPRISE_PLAN.md) | **Phase 1 enterprise plan** — First enterprise-ready milestone |
| [`internal/implementation/2WEEK_VALIDATION_PLAN.md`](./internal/implementation/2WEEK_VALIDATION_PLAN.md) | **2-week validation** — Quick validation sprint plan |
| [`internal/implementation/PLAN_P0_OCR_FIXES.md`](./internal/implementation/PLAN_P0_OCR_FIXES.md) | **P0 OCR fixes** — Critical OCR pipeline fixes plan |

#### 🔍 Audits & Bug Reports

| File | Description |
|------|-------------|
| [`internal/audits/BUG_REPORT.md`](./internal/audits/BUG_REPORT.md) | **Bug report** — Comprehensive bug inventory |
| [`internal/audits/BUG_REPORT_PRE_ONBOARDING.md`](./internal/audits/BUG_REPORT_PRE_ONBOARDING.md) | **Pre-onboarding bugs** — Issues to fix before first customer |
| [`internal/audits/FINAL_BUG_AUDIT.md`](./internal/audits/FINAL_BUG_AUDIT.md) | **Final bug audit** — Consolidated audit before launch |
| [`internal/audits/DPR_AI_BRUTAL_ASSESSMENT.md`](./internal/audits/DPR_AI_BRUTAL_ASSESSMENT.md) | **Brutal assessment** — Honest evaluation of DPR AI quality |
| [`internal/audits/UI_UX_AUDIT_REPORT.md`](./internal/audits/UI_UX_AUDIT_REPORT.md) | **UI/UX audit** — Frontend design & usability assessment |
| [`internal/audits/PROJECT_READINESS_REPORT.md`](./internal/audits/PROJECT_READINESS_REPORT.md) | **Project readiness** — Overall production readiness score |
| [`internal/audits/P0_HIGH_REMAINING_ISSUES.md`](./internal/audits/P0_HIGH_REMAINING_ISSUES.md) | **P0 remaining issues** — Critical unfixed items |

#### 📊 Reports & Simulations

| File | Description |
|------|-------------|
| [`internal/reports/30_DAY_FACTORY_SIMULATION_REPORT.md`](./internal/reports/30_DAY_FACTORY_SIMULATION_REPORT.md) | **30-day simulation** — Full factory simulation results |
| [`internal/reports/STEEL_FACTORY_SIMULATION_REPORT.md`](./internal/reports/STEEL_FACTORY_SIMULATION_REPORT.md) | **Steel factory simulation** — Steel-specific test outcomes |

#### 🔄 Workflow Maps

| File | Description |
|------|-------------|
| [`internal/workflow-maps/WORKFLOW_CATALOG.md`](./internal/workflow-maps/WORKFLOW_CATALOG.md) | **Workflow catalog** — Complete list of all system workflows |
| [`internal/workflow-maps/WORKFLOW_GROUPS.md`](./internal/workflow-maps/WORKFLOW_GROUPS.md) | **Workflow groups** — Logical grouping of workflows by department |

#### 🛠️ Operations & Handoff

| File | Description |
|------|-------------|
| [`internal/FACTORYNERVE_OPERATIONAL_PLAYBOOK.md`](./internal/FACTORYNERVE_OPERATIONAL_PLAYBOOK.md) | **Operations playbook** — Day-to-day operational procedures |
| [`internal/FACTORYNERVE_OPERATIONS_MANUAL.md`](./internal/FACTORYNERVE_OPERATIONS_MANUAL.md) | **Operations manual** — Detailed ops reference |
| [`internal/INTERNAL_HANDOFF_NOTES.md`](./internal/INTERNAL_HANDOFF_NOTES.md) | **Handoff notes** — Developer handoff documentation |

#### 🏛️ Architecture (Internal)

*See `docs/internal/architecture/` for component hierarchy and layout maps.*

#### 🔐 Authorization

*See `docs/internal/authorization/` for role/workflow matrices and RBAC specs.*

#### 📦 Product

*See `docs/internal/product/` for DPR AI product documentation.*

#### 🧹 Refactoring

*See `docs/internal/refactoring/` for redesign roadmaps.*

---

### 📸 5. Screenshots & Visual Evidence

| Directory | Description |
|-----------|-------------|
| [`audit-screenshots/`](./audit-screenshots/) | Visual UI audit captures (dated subdirectories) |
| [`tab-screenshots/`](./tab-screenshots/) | Tab/browser screenshots (dated subdirectories) |

### 🗂️ 6. Archive (Historical)

| Directory | Description |
|-----------|-------------|
| [`archive/`](./archive/) | Old git diffs, project certificates, zip files, historical artifacts |

### 🖥️ 7. OCR System

| Directory | Description |
|-----------|-------------|
| [`OCR_SYSTEM/`](./OCR_SYSTEM/) | OCR pipeline — technical docs, stabilization reports, implementation plans, workflows |

### 🌐 8. Public / Deployment

| Directory | Description |
|-----------|-------------|
| [`public/`](./public/) | Deployment QA guide, production readiness |

---

## 🧭 Quick Navigation

### I'm a... → Start here

| Who | Open This First |
|-----|----------------|
| **Customer / Factory Owner** | [`1-customer-facing/FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md`](./1-customer-facing/FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md) |
| **New User (English)** | [`1-customer-facing/QUICK_START_GUIDE.md`](./1-customer-facing/QUICK_START_GUIDE.md) |
| **New User (हिंदी)** | [`1-customer-facing/QUICK_START_GUIDE_HINDI.md`](./1-customer-facing/QUICK_START_GUIDE_HINDI.md) |
| **Operator / Worker** | [`1-customer-facing/ROLE_TRAINING_GUIDE.md`](./1-customer-facing/ROLE_TRAINING_GUIDE.md) |
| **Developer (new to project)** | [`3-reference/INSTALLATION.md`](./3-reference/INSTALLATION.md) |
| **Developer (setting up locally)** | [`3-reference/LOCAL_DEV_SETUP.md`](./3-reference/LOCAL_DEV_SETUP.md) |
| **Developer (running tests)** | [`3-reference/TESTING_GUIDE.md`](./3-reference/TESTING_GUIDE.md) |
| **Developer (architecture)** | [`2-architecture/ARCHITECTURE.md`](./2-architecture/ARCHITECTURE.md) |
| **Project Manager** | [`internal/implementation/PHASE_1_ENTERPRISE_PLAN.md`](./internal/implementation/PHASE_1_ENTERPRISE_PLAN.md) |
| **QA Tester** | [`internal/audits/BUG_REPORT.md`](./internal/audits/BUG_REPORT.md) |
| **Enterprise Architect** | [`2-architecture/FACTORYNERVE_ENTERPRISE_ARCHITECTURE_REPORT.md`](./2-architecture/FACTORYNERVE_ENTERPRISE_ARCHITECTURE_REPORT.md) |

---

## ⚠️ Navigation Note

> **Original root-level `.md` files have been moved here for centralization.**
> If you reached this file via a bookmarked path, please update your bookmark to point to the new location under `docs/`. All original files at the project root now contain a redirect notice pointing here.

---

*Maintained by the FactoryNerve team. Add new docs to the appropriate subdirectory and update this index.*
