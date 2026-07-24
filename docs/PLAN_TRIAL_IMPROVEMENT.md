# Plan: Fix Free Trial for Real Factory Use (30 Days)

## Problem Statement

The free Pilot plan is too restrictive for a real factory to evaluate properly:
- **7 users** → Owner + Manager + Supervisor + Accountant + Store Keeper + 2 Operators = no room
- **No Accountant role** → Can't test invoicing, payments, vendor bills
- **No PDF export** → Can't generate or download invoices
- **Frontend says "14-day trial"** → Backend already has `TRIAL_DAYS = 30`, but the marketing pages still say 14 days

## Files That Need Changes

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | `backend/plans.py` | Increase Pilot users 7→12, enable Accountant role, enable PDF | Backend plan enforcement |
| 2 | `web/src/components/public/pricing-page.tsx` | Update hardcoded plan limits for Pilot (users, features) | Public pricing page |
| 3 | `web/src/components/public/landing/hero-section.tsx` | "14-day" → "30-day" | Hero CTA section |
| 4 | `web/src/components/public/landing/final-cta.tsx` | "14-day" → "30-day" | Bottom CTA section |
| 5 | `web/src/components/public/landing/data.ts` | "14" → "30" | Stats, pricing tiers, FAQ |
| 6 | `scripts/seed_dev.py` | trial_end 14→30 days | Seed data consistency |
| 7 | `docs/1-customer-facing/FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md` | Update 14→30 days in proposal | Sales docs accuracy |

---

## Change 1: `backend/plans.py` — Pilot Plan Improvements

### User limit: 7 → 12

```python
"pilot": {
    ...
    "user_limit": 12,  # was 7
    ...
}
```

**Why 12?** A factory evaluating the system needs:
- 1 Owner
- 1 Manager/Admin
- 2 Supervisors
- 1 Accountant ← *currently blocked*
- 1 Store Keeper
- 1 Security (Gate)
- 4 Operators
- 1 Extra (buffer for testing)

### Feature flags to enable on Pilot:

```python
"features": {
    "accountant": True,   # was False — MUST fix for any factory trial
    "emailSummary": True,
    "whatsapp": True,
    "priority": False,
    "pdf": True,           # was False — need invoices for trial
    "excel": True,
    "analytics": True,
    "templates": True,     # was False — need OCR templates for trial
    "api": False,
    "onPremise": False,
    "nlq": True,
}
```

### Limits update:

```python
"limits": {"ocr": 200, "summary": 100, "email": 100, "smart": 200, "nlq": 20},
# OCR: 150→200 — more docs to test during trial
# Summary: 50→100
# Email: 50→100
# Smart: 100→200
# NLQ: 10→20
```

---

## Change 2: `web/src/components/public/pricing-page.tsx` — Frontend Pricing Display

Currently the frontend has HARDCODED plan data that doesn't match `backend/plans.py`. Update the Pilot plan limits:

```typescript
{
    id: "pilot",
    badge: "FREE PILOT",
    name: "Factory Pilot",
    tagline: "Use everything. Test real workflows. No card required.",
    price: "₹0",
    priceSuffix: "/ 30 days",  // was "/ 14 days"
    ...
    limits: {
      users: "Up to 12",           // was "Up to 7"
      workspace: "1",
      ocrScans: "200 pages",       // was "150 pages"
      aiOperations: "200 actions", // was "100 actions"
      dispatchWorkflows: "Included",
      reportsExports: "Included",  // was "Limited" — PDF now included
      whatsappAlerts: "100 messages",
      emailSummaries: "100",       // was "50"
      operationalDashboards: "Included",  // was "Limited"
      workflowApprovals: "Included",      // was "Limited"
      analytics: "Included",               // was "Limited"
      anomalyDetection: "Included",        // was "Limited"
      sla: "None",
    },
}
```

---

## Change 3-5: Landing Page — "14-day" → "30-day"

All three files say "14-day free trial" and "14-day pilot". Change to "30-day":

| File | Current Text | New Text |
|------|-------------|----------|
| `hero-section.tsx` | "Start Free 14-Day Trial" | "Start Free 30-Day Trial" |
| | "No credit card required. Free 14-day pilot with full access." | "No credit card required. Free 30-day pilot with full access." |
| `final-cta.tsx` | "Start your 14-day free pilot with full access to all features." | "Start your 30-day free trial with full access to all features." |
| | "Start free trial" (same) | (keep same) |
| `data.ts` | `{ value: "14", suffix: " days", label: "Free pilot — no card required" }` | `{ value: "30", suffix: " days", label: "Free pilot — no card required" }` |
| | pricingTiers[0].tagline: "Full access. Your real data. No time limit during pilot." | (keep same - no change) |

---

## Change 6: `scripts/seed_dev.py`

Current: `trial_end_at=now + timedelta(days=14)`
Change to: `trial_end_at=now + timedelta(days=30)`

---

## Change 7: Sales Proposal

Update `FACTORYNERVE_SALES_ONBOARDING_PROPOSAL.md`:
- Search for "14" or "14-day" and change to "30-day"
- Update Pilot user count from 7 to 12 where mentioned

---

## Risks & Edge Cases

| Risk | Mitigation |
|------|-----------|
| **Existing free users** already under old 7-user limit | Limit is only enforced on NEW invite — existing users are unaffected |
| **Frontend hardcoded data** will drift from backend again | Add a TODO comment to sync from backend API in future |
| **Accountant role** unlocks invoicing — but Pilot has no API access | Accountant can use the app UI, just not API. Fine for trial. |
| **TRIAL_DAYS=30 already in backend** but frontend shows 14 | This PR fixes the frontend to match — no backend change needed for days |

---

## Execution Order

```
1. backend/plans.py           ← core change (plan limits + features)
2. web/pricing-page.tsx        ← frontend plan display
3. web/hero-section.tsx        ← landing page hero
4. web/final-cta.tsx           ← landing page CTA
5. web/data.ts                 ← landing page stats/data
6. scripts/seed_dev.py         ← dev seed consistency
7. docs/sales proposal         ← documentation
```

**Testing:** After changes, register a new user, verify:
- Accountant role can be assigned ✓
- PDF invoice can be downloaded ✓
- Up to 12 users can be invited ✓
- All landing pages show "30-day" ✓
