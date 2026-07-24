# DPR.ai: MASTER SYSTEM AUDIT & WORKFLOW INTELLIGENCE
## Operational Operating System Architecture & Governance Report
**Version:** 1.0.0
**Date:** June 10, 2026
**Auditor:** Gemini CLI Architect

---

## 1. COMPLETE SYSTEM MAP

### 1.1 Architecture Topology
DPR.ai is architected as a **Cognitive Industrial ERP**. It consists of three primary layers:
- **Interaction Layer (Frontend):** Next.js 16 / React 19 optimized for high-density operational data capture and review.
- **Orchestration Layer (Backend):** FastAPI-driven service architecture managing AI routing, OCR pipelines, and business state transitions.
- **Intelligence Layer (AI):** A multi-model cognitive engine (Claude 3.5, Gemini 1.5, Groq) that interprets raw industrial input into structured ERP records.

### 1.2 Component Relationship Map
| Module | Responsibilities | Upstream Dependencies | Downstream Systems |
| :--- | :--- | :--- | :--- |
| **Auth & RBAC** | Identity, Tenancy, Factory Switching | User Model, Session Store | Every API route (via Depends) |
| **OCR Pipeline** | Image Capture -> Extraction -> Validation | Mobile Camera, Tesseract, LLMs | Steel Inventory, Production Entries |
| **Steel Module** | ERP for Steel (Batches, Dispatches, Invoices) | Production Entries, OCR Verifications | Reports, Customer Ledger, Billing |
| **Ops Alerts** | Real-time monitoring & WA dispatch | HTTP Middleware, OCR Failure Hooks | WhatsApp Sender, Admin Dashboard |
| **Billing/Plans** | Subscription state & feature gating | Razorpay Webhook, Plan Resolver | Feature availability across app |

### 1.3 Trigger & Event Map
- **Trigger:** OCR Upload -> **Event:** `ocr_processing_started` -> **Consumer:** `background_jobs.py`.
- **Trigger:** Dispatch Approved -> **Event:** `InventoryDeductionTriggered` -> **Consumer:** `steel_service.py`.
- **Trigger:** 5xx Spike Detected -> **Event:** `SERVER_5XX_SPIKE` -> **Consumer:** `OpsAlertService` -> `WhatsAppSender`.

---

## 2. FULL WORKFLOW AUDIT

### 2.1 OCR Verification Workflow (Primary)
- **Lifecycle:** `Capture -> Local Enhancement -> Routing -> Extraction -> Enrichment -> Human Review -> Commit`.
- **Frontend States:** `idle` -> `uploading` -> `processing` -> `partial` -> `completed` -> `error`.
- **Backend States:** `draft` (initial scan) -> `pending` (supervisor queue) -> `approved` (ERP committed).
- **Risk:** Silent async export failures if `logbook-excel-async` fails after UI marks "Completed".
- **Recovery:** Users can retry from the `JobsDrawer` if the background job fails.

### 2.2 Dispatch Lifecycle (Steel ERP)
- **Step 1:** Manager plans dispatch against a Sales Invoice.
- **Step 2:** Operator records actual loading (Weight Slips/Photos).
- **Step 3:** System cross-references loaded weight vs. Invoice limits (Anomaly detection).
- **Step 4:** Approval triggers Inventory deduction and Customer Ledger entry.
- **Risk:** Race condition if multiple operators load the same Batch simultaneously (Locked via SQL transactions).

### 2.3 User Onboarding & On-Ramping
- **Flow:** `Register -> Verify Email -> Select Organization -> Setup Factory -> Assign Roles`.
- **Governance:** Users are isolated by `org_id`. Factory switching requires a fresh JWT revision to prevent role-injection attacks.

---

## 3. PAGE PURPOSE AUDIT

### 3.1 Primary Operational Pages
- **`ocr-scan-page.tsx`**: High-speed floor capture. Optimized for mobile/low-light.
- **`ocr-verification-page.tsx`**: Supervisor quality control desk. Purpose: ensure 100% data accuracy.
- **`steel-command-center-page.tsx`**: Owner/Manager dashboard. Purpose: 30,000ft view of plant health.
- **`work-queue-page.tsx`**: Universal inbox for supervisors. Aggregates OCR, Entry, and Attendance reviews.

### 3.2 System Governance Pages
- **`settings-users-tab.tsx`**: Access control. Risk: UI allows adding roles that Backend might reject based on plan limits.
- **`billing-page.tsx`**: Revenue management. Purpose: Transparency of AI usage and plan value.

---

## 4. FRONTEND ARCHITECTURE AUDIT

### 4.1 State & Interaction
- **Success:** Use of `FSM` (Finite State Machines) for complex OCR flows prevents "impossible states."
- **Inconsistency:** Some older components (in `frontend/` legacy) use local state for global data; active `web/` components correctly use `useSession` and `TanStack Query` (inferred).
- **UI Architecture:** Standardized via `OperationalPageShell` and `GlassPanel`.

### 4.2 Critical UX Gaps
- **Offline Visibility:** While background sync exists, the user often lacks visual cues on "Pending Sync" items during poor connectivity.

---

## 5. BACKEND ARCHITECTURE AUDIT

### 5.1 Service Boundaries
- **Strength:** Excellent separation of concerns in `backend/services`. AI routing is abstracted from business logic.
- **Risk:** `steel.py` is a "Mega-Router" (4000+ lines). It should be decomposed into `steel_inventory`, `steel_sales`, and `steel_finance` for maintainability.

### 5.2 Async & Scalability
- **Queue Logic:** Uses `ThreadPoolExecutor` for AI. While effective for small scale, high-volume factories will require a dedicated Task Queue (e.g., Celery/Redis).

---

## 6. OCR PIPELINE AUDIT

### 6.1 Extraction Intelligence
- **Clarity Scorer:** Uses blur/brightness/glare variance. High-risk images are routed to "Best" tier (Claude 3.5).
- **Normalizer:** Converts messy OCR strings into strict Pydantic types before human review.
- **Confidence Thresholds:**
    - `> 0.95`: Field turns green, low friction.
    - `< 0.70`: Field turns red, forces supervisor validation.

---

## 7. AI ORCHESTRATION AUDIT

### 7.1 Provider Fallback Chain
- **Chain:** `Groq (Llama 3)` -> `Anthropic (Claude 3.5)` -> `OpenAI (GPT-4o)`.
- **Logic:** Optimized for **Latency First**, falling back to **Reasoning Strength** on failure.
- **Risk:** Hallucination in numeric extraction. Mitigated by `ocr_schema_validator.py` which rejects logically impossible values (e.g., negative production).

---

## 8. DATABASE & ENTITY RELATIONSHIP AUDIT

### 8.1 Key Relationships
- **User -> UserFactoryRole <- Factory**: The central RBAC junction.
- **OcrVerification -> SteelProductionBatch**: Links AI extraction to the ERP core.
- **OpsAlertEvent -> Recipient**: Manages the WhatsApp notification fan-out.

### 8.2 Tenancy Isolation
- Every query MUST filter by `org_id` or `factory_id`. 
- **Audit Note:** Recommend adding a `tenant_id` at the SQL level to enforce global Row-Level Security (RLS).

---

## 9. EVENT SYSTEM AUDIT

### 9.1 Propagation Chains
1. **Source:** `FastAPI Middleware` records a 500 error.
2. **Detection:** `OpsAlertService` detects a 5xx spike (e.g., 10 errors in 5 mins).
3. **Dispatch:** `AlertDispatcher` selects WA recipients based on `org_id`.
4. **Execution:** `WhatsAppSender` calls Meta Cloud API.

---

## 10. TESTING & OPERATIONAL AUDIT PLAYBOOK

### 10.1 Production Readiness Checklist
- [ ] **Auth:** Verify factory switching invalidates previous factory permissions.
- [ ] **OCR:** Test extraction on 200kb vs 8MB images.
- [ ] **Billing:** Verify `trial_expired` state blocks AI routing.
- [ ] **Alerts:** Simulate a 5xx spike and verify WA delivery within 60s.

### 10.2 Workflow Stress Tests
- **The "High-Volume Shift":** Simulate 50 OCR uploads in 1 minute.
- **The "Disconnected Operator":** Record 10 entries offline and verify sync sequence integrity.

---

**AUDIT SUMMARY:**
DPR.ai is a highly mature industrial system with sophisticated AI orchestration and operational monitoring. The primary architectural risk is the **monolithic nature of the Steel module** and **manual dependency gaps** in the backend. Workflow integrity is high, protected by a robust human-in-the-loop verification system.
