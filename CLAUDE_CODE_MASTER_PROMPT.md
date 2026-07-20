# Master Prompt: DPR.ai Client Readiness Audit

> Copy-paste the entire block below into a fresh Claude Code session opened at the repo root (`D:\DPR APP\DPR.ai`).

---

```
You are acting as a senior staff engineer doing a pre-onboarding audit. Your job is to determine whether this software is mature enough to onboard a paying client in a real production environment.

IMPORTANT CONTEXT FROM A PREVIOUS AUDIT (July 19, 2026):
I already ran a comprehensive audit and wrote PROJECT_READINESS_REPORT.md. The report already exists — READ IT FIRST. Then independently verify every claim in it by running the actual commands, reading the actual files, and checking the actual outputs. Do NOT copy the report blindly. Validate or correct every finding.

## Phase 1 — Quick scan the existing report & docs (10 min)

Read these files in order:
1. `PROJECT_READINESS_REPORT.md` — the previous audit findings
2. `FIX_GUIDE_FOR_AGENTS.md` — the bug-by-bug fix playbook
3. `BUG_REPORT_PRE_ONBOARDING.md` — if it exists, the original bug reports
4. `README.md` — understand the project purpose and stack
5. `ARCHITECTURE.md` — understand the system architecture

## Phase 2 — Verify the critical claims (30 min)

Run each of these commands and compare the output against what the report says. Correct any errors you find.

### 2a — Is there a LICENSE file?
```
ls -la LICENSE* 2>/dev/null; echo "---"; grep '"license"' package.json 2>/dev/null; grep '"license"' web/package.json 2>/dev/null
```

### 2b — Is .env.local tracked in git?
```
git ls-files .env.local .env .env.*
```

### 2c — Does .gitignore cover .env.local?
```
grep -n "env" .gitignore
```

### 2d — Test suite health
```
cd tests && PYTHONPATH=.. python -m pytest --collect-only -q 2>&1 | tail -20
```
Count errors vs collected. Then run a small targeted test:
```
cd tests && PYTHONPATH=.. python -m pytest test_main_root.py -q --tb=short 2>&1 | tail -20
```

### 2e — TypeScript compilation
```
cd web && npx tsc --noEmit 2>&1
```

### 2f — Check the known critical bugs
```
# S0-1: Steel invoice 500
grep -n "taxable_amount" backend/routers/steel.py | head -10

# WF-1: Missing imports in steel.py
grep -n "^import os$" backend/routers/steel.py
grep -n "^import logging$" backend/routers/steel.py
grep -n "^logger = " backend/routers/steel.py

# AN-1: Wrong column name
grep -n "SteelStockReconciliation.created_at" backend/services/steel_intelligence.py

# WF-5: Double /notifications prefix
grep -n "include_router.*notifications" backend/main.py
grep -n "^router = APIRouter" backend/routers/notifications.py

# AI-1: Missing db=db in check_rate_limit calls
grep -n "check_rate_limit" backend/services/intelligence/service.py backend/routers/entries.py backend/routers/emails.py backend/routers/coil_theft.py 2>/dev/null
```

### 2g — npm audit
```
cd web && npm audit 2>&1 | head -30
```

### 2h — CI/CD health
```
ls .github/workflows/
cat .github/workflows/quality-gate.yml | head -30
```

### 2i — Hardcoded localhost / secrets
```
grep -rn "api[_-]key\|secret\|password\|token" .env.local 2>/dev/null | head -20
grep -rn "http://127.0.0.1\|http://localhost" backend/services/password_reset_service.py backend/services/email_verification_service.py backend/routers/auth_*.py backend/middleware/security.py 2>/dev/null
```

## Phase 3 — Deeper investigation (30 min)

### 3a — HOW MANY TODO/FIXME/HACK are in production code (excluding tests)
```
grep -rn "TODO\|FIXME\|HACK\|XXX\|BUG\|TEMP\|WORKAROUND" backend/ web/src/ --include="*.py" --include="*.ts" --include="*.tsx" -l 2>/dev/null | grep -v test | grep -v __pycache__ | sort -u | wc -l
```
List the files:
```
grep -rn "TODO\|FIXME\|HACK" backend/ web/src/ --include="*.py" --include="*.ts" --include="*.tsx" -l 2>/dev/null | grep -v test | grep -v __pycache__ | sort -u
```

### 3b — Database migration health
```
ls alembic/versions/*.py 2>/dev/null | wc -l
```

### 3c — Check for a working build
```
cd web && npm run build 2>&1 | tail -30
```

### 3d — Run lint
```
cd web && timeout 30 npx eslint src/ --max-warnings 200 2>&1 | tail -30
```

### 3e — Check codeowners & branching strategy
```
ls CODEOWNERS .github/CODEOWNERS 2>/dev/null; echo "---"; git branch -a | head -10
```

### 3f — Check for incomplete ERP integration stubs
```
grep -c "TODO: Replace with actual" backend/services/ocr_document_types/__init__.py
```

### 3g — Check app name inconsistency
```
grep "APP_NAME" .env.example .env.local .env.production .env.testing render.yaml 2>/dev/null
grep "FactoryNerve\|DPR.ai\|Factory Nerve" web/src/app/layout.tsx 2>/dev/null | head -5
```

## Output Format

Write your findings to a file called `CLIENT_READINESS_VERDICT.md` with this structure:

```markdown
# Client Readiness Verdict — DPR.ai

**Date:** $(date +%Y-%m-%d)
**Auditor:** Claude Code autonomous audit

## 1. Verdict Summary

One sentence: READY / READY WITH FIXES / NOT READY. Be direct.

## 2. Command Outputs (Evidence)

For each command I ran in Phases 2-3, show:
- The command
- The raw output
- Whether it confirms or contradicts the existing PROJECT_READINESS_REPORT.md

## 3. Blockers vs the Previous Audit

List each critical blocker from the report and say:
- ✅ CONFIRMED — still broken
- ❌ ALREADY FIXED since the report
- ⚠️ DISAGREE — I found it's actually fine, here's why

Add any NEW blockers I found that the previous audit missed.

## 4. Top 5 Most Important Next Steps

Prioritized list of what to fix first before onboarding a client.

## 5. Honest Assessment

Would you personally put a paying client on this today? Why or why not?
```

## Guidelines

- Be HONEST even if the news is bad. This protects the user's reputation.
- Actually RUN the commands. Don't guess or speculate.
- If a command fails (e.g., build timeout, missing deps), report that as a finding.
- Don't sugarcoat. A client's trust is on the line.
- If something is genuinely production-ready, say so clearly.
```
