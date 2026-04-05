# Phase 0 - Foundation Decisions (DPR.ai)

## Goal
Lock the architecture and product assumptions so Phase 1 can proceed without rework.

## Scope (What Phase 0 Must Decide)
1. Data model strategy (org + factory + roles)
2. Migration plan from current SQLite schema (if any real users/data)
3. Deployment target (VPS vs managed services) and ops baseline
4. Plan catalog + limits (final v1 pricing and feature gates)

## Deliverables
- Decision log (below)
- Architecture baseline (text diagram below)
- Migration approach (choose one)
- Phase 1 work breakdown (ready-to-execute)

---

## Decision Log (Draft - Needs Your Confirmation)

### D0.1 - Multi-tenant model
- Recommendation: Use strict `org_id` + `factory_id` on all tenant data.
- Status: CONFIRMED

### D0.2 - Database
- Recommendation: PostgreSQL in all non-local environments, SQLite only for dev.
- Status: CONFIRMED

### D0.3 - Migrations
- Recommendation: Alembic for every schema change, no in-app auto-patching.
- Status: CONFIRMED

### D0.4 - Deployment target
- Decision: VPS (Docker Compose + nginx + Postgres).
- Rationale: low cost, full control, simple architecture.
- Status: CONFIRMED

### D0.5 - Billing scope (v1)
- Decision: Defer billing focus; keep plans as internal feature flags.
- Status: CONFIRMED

### D0.6 - Plan catalog (v1)
- Decision: Keep current plan limits for now.
- Status: CONFIRMED

### D0.7 - Timeline intent
- Decision: Go-live in 21 days (3 weeks).
- Status: CONFIRMED

---


### D0.8 - Migration strategy
- Decision: Greenfield (no data to migrate).
- Status: CONFIRMED

## Architecture Baseline (Phase 0 Draft)

Frontend (Streamlit) -> FastAPI (JWT + RBAC + org/factory scoping) -> Postgres

Key requirements:
- Every query filters by org_id first
- JWT includes org_id + factory_id + role
- Plan limits checked before AI/OCR work
- Audit log for every write event

---

## Migration Strategy (Pick One)

A) Greenfield: no live users, recreate schema on Postgres (fastest)
B) Soft migration: export SQLite -> import into Postgres with script
C) Parallel run: keep current app live, ship v2 with migration + cutoff date

---

## Phase 1 Preview (Ready Once Phase 0 Decisions Locked)
1. Add Postgres + Alembic
2. Create org/factory/user/user_factory_role tables
3. Update models to include org_id + factory_id
4. Update auth to return org/factory
5. Add org-scoped audit logs

---

## Open Questions (Answer These to Finalize Phase 0)
1. Do you already have real users/data that must be migrated?
2. Where do you want to host v1 (VPS vs managed services)?
3. Do you want to keep current plan prices/limits or change them now?
4. What is your target go-live date/window?


