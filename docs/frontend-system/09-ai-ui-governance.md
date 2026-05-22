# 09. AI-UI Governance

## 1. Purpose: Trusted Machine Intelligence
DPR.ai uses AI for capture (OCR) and intelligence (Insights). The UI MUST govern how AI-generated content is presented to ensure human trust and ledger accuracy.

## 2. The Human-in-the-Loop Standard
**Law:** No AI-generated data shall reach the official source of record without explicit human review or approval.
*   **Implementation:** All AI results MUST start in a `Draft` or `Pending` state.

## 3. Visual Signaling for AI Data

### 3.1 Confidence Tiering
**Rule:** AI-generated cells and records MUST be visually distinct based on their confidence score.
*   **High Confidence (>90%):** Standard styling.
*   **Medium Confidence (70-90%):** Warning background (`var(--warning)`).
*   **Review Required (<70%):** Critical background (`var(--critical)`).

### 3.2 Source Distinction
**Rule:** Fields corrected by humans after AI extraction MUST be marked with a "Human Corrected" metadata flag.
*   **Audit Ref:** OCR UI Audit found desyncs in corrected data; fix by tracking `source: "ai" | "human"` in cell metadata.

## 4. Engineering Guardrails (AI Safety)

### 4.1 Pattern Drift Prevention
**Law:** AI coding tools (Codex, Claude, etc.) are FORBIDDEN from inventing new UI patterns.
*   **Requirement:** All new AI-generated components MUST be checked against the `01. Screen Taxonomy`.
*   **Finding:** AI tool re-invented `apiFetch` retry logic (Governance Audit finding).
*   **Resolution:** Provide `lib/api.ts` as mandatory context for all AI prompts.

### 4.2 Supervised Logic
AI tools MUST NOT autonomously modify:
*   **Ledger Calculations** (Tonnage, Yield).
*   **RBAC Middleware** (Permissions).
*   **Security Contexts**.

## 5. Review Workflow Standards
*   **Bulk Approval:** AI Review screens MUST provide an "Approve All High Confidence" accelerator.
*   **Evidence Display:** Every AI decision MUST have a "Why?" affordance (e.g., tooltip showing the original image crop for an OCR cell).

## 6. Audit Regression Fixes
*   **Finding:** Reviewed OCR data mismatch with exported data.
*   **Correction:** UI MUST export from `reviewed_rows` entity, never from raw AI output.
