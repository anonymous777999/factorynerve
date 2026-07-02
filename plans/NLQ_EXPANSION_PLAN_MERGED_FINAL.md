# NLQ Expansion — Merged Final Plan
## Factory Nerve AI Insights — Phase 1 (Core) + Phase 2 (Advanced)

> **Bridging two plans:**
> - **V1 (original):** Pragmatic, grounded in existing services, 7-day implementation, 97% coverage
> - **V2 (upgrade):** Ambitious — Hindi support, session memory, multi-domain fusion, chat UI, smart caching
> - **Merged (this plan):** Ship core value FAST (Phase 1), then layer V2 polish (Phase 2), defer scope-creep items to Phase 3

---

## Guiding Principle

> **Phase 1 first — get the 78 questions answered TODAY.**
> Phase 2 makes it smarter, faster, and multilingual. Phase 3 adds a chat interface.
> We ship real value after Phase 1, then iterate.

| Phase | What Ships | Timeline | Coverage |
|-------|-----------|----------|----------|
| **Phase 1** (Core) | Domain classifier, 10 fetchers, 11 prompt templates, 40 presets, category tabs | **7 days** | ~95% questions |
| **Phase 2** (Advanced) | Hindi/Hinglish, session memory, multi-domain fusion, smart TTL cache, 8-factor health, OCR+Alerts wired, action items | **+4 days** | ~99% + smarter |
| **Phase 3** (Future) | Chat interface, streaming SSE, voice input, PDF export | *Later sprint* | UX polish |

---

## Complete Architecture (Phases 1+2 Combined)

```
User Question (English / Hindi / Hinglish)
    │
    ▼
┌──────────────────────────────────────┐  Phase 2
│ 0. Language Detector + Normalizer    │
│    _detect_language()                │  +3 days
│    _normalize_question()             │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐  Phase 2
│ 1. Session Context Loader            │
│    _load_session_context()           │  +3 days
│    _resolve_pronouns()               │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐  Phase 1
│ 2. Domain Classifier                 │  Day 1
│    _classify_nlq_domain()            │
│    Keyword-based → NlqDomain enum    │
└──────────────────────────────────────┘
    │
    ▼             ┌── Phase 2: MULTI_DOMAIN_PATTERNS
    │             │   + secondary_domain fusion
    ▼             ▼
┌──────────────────────────────────────┐  Phase 1
│ 3. Time Parser + Entity Extractor    │  Day 1
│    _parse_time_scope_v2()            │
│    _parse_entity_filter()            │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐  Phase 2
│ 4. Smart Cache Check                 │  +3 days
│    TTL per domain (30s–900s)         │
│    Cache HIT → skip to step 7       │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐  Phase 1
│ 5. Domain Fetcher (one of 10)        │  Days 3-5
│    Calls intelligence service        │
│    Returns structured data dict      │
└──────────────────────────────────────┘
    │
    ▼             ┌── Phase 2: _fuse_domain_data()
    │             │   merges 2 domains
    ▼             ▼
┌──────────────────────────────────────┐  Phase 1
│ 6. AI Prompt Builder + Fallback      │  Days 3-5
│    _build_nlq_prompt()               │
│    _build_nlq_fallback()             │
└──────────────────────────────────────┘
    │         Phase 2: + FORMAT_HINTS
    │         Phase 2: + language instruction
    ▼
┌──────────────────────────────────────┐  Phase 1
│ 7. ai_router.generate_text()         │  (exists)
│    Returns answer + metadata         │
└──────────────────────────────────────┘
    │
    ▼             ┌── Phase 2: _format_nlq_answer()
    │             │   adds badges + action_items
    ▼             ▼
┌──────────────────────────────────────┐  Phase 1
│ 8. NaturalLanguageQueryResponse      │  Day 1
│    Phase 1: domain field             │
│    Phase 2: + language, confidence,  │
│    action_items, session_id          │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐  Phase 2
│ 9. Session Saver + Audit Log         │  +3 days
│    Save last 5 turns                 │
│    Write AI_NLQ_QUERY_EXECUTED       │
└──────────────────────────────────────┘
```

---

## Phase 1 — Core Implementation (7 Days)

### Day 1: Domain Classifier + Time Parser + Entity Parser

**Files: `backend/routers/ai.py`**

**What we build:**
1. `NlqDomain` enum (11 domains from V1)
2. `DOMAIN_KEYWORDS` dict with keyword lists per domain (from V1)
3. `_classify_nlq_domain()` — keyword-count-based, highest score wins, fallback to GENERAL
4. `_parse_time_scope_v2()` — all time scopes from V1 (today, yesterday, this/last week/month, last N days, this/last quarter/year, date patterns)
5. `_parse_entity_filter()` — shift, employee name, amount threshold, after-hours (from V1)
6. Add `domain` field to `NaturalLanguageQueryResponse` model

**Why V1's keyword approach (not V2's LLM classifier):**
- 0 AI cost per query
- 0 additional latency
- 0 provider dependency
- Handles 90%+ of cases correctly
- Multi-domain detection deferred to Phase 2

**Tests:**
- 16 classifier tests (every domain + GENERAL fallback) — from V1 §8.1
- 8 time parser tests — from V1 §8.1
- 5 entity filter tests — from V1 §8.1

### Day 2: Main NLQ Pipeline Refactor

**Files: `backend/routers/ai.py`**

**What we build:**
1. Extract existing NLQ logic into `_fetch_general_entry_data()` (V1 §4.11)
2. Build `NlqPermissionSet` model + `_get_nlq_permissions()` (V1 §3.5)
3. Build `_extract_data_points()` — flatten domain data for frontend (V1 §3.6)
4. Build `_build_nlq_fallback()` — per-domain fallback text (V1 §5.3)
5. Build `_build_nlq_prompt()` — template selection + data injection (V1 §5.4)
6. Rewrite `query_with_natural_language()` with the 11-step pipeline (V1 §6.1)

**Critical: Existing tests must still pass.** The GENERAL domain must work identically to before.

### Days 3-4: Domain Fetchers D1-D5

**Files: `backend/routers/ai.py`**

**D1 — Attendance (`_fetch_attendance_data`):**
- Call `build_workforce_overview(db, factory_id, days, can_view_cost)` — V1 §4.1
- Call `build_workers(db, factory_id, days, limit=50, can_view_cost)`
- Return: overview + workers + total_workers

**D2 — Dispatch (`_fetch_dispatch_data`):**
- Direct DB queries on `SteelDispatch`, `SteelDispatchLine`, `SteelSalesInvoice`, `SteelCustomer`, `AuditLog` — V1 §4.2
- Compute: total_weight, truck_counts, after_hours, weight_mismatches, authorizations

**D3 — Fraud (`_fetch_fraud_data`):**
- Call `build_fraud_intelligence(db, factory_id, days=days, can_view_financials, can_view_user_details)` — V1 §4.3

**D4 — Finance (`_fetch_finance_data`):**
- Call `build_financial_overview()`, `build_receivables_summary()`, `build_payables_summary()`, `build_expenses_summary()`, `build_cash_flow_summary()`, `build_product_profitability()` — V1 §4.4

**D5 — Inventory (`_fetch_inventory_data`):**
- Call `build_inventory_intelligence(db, factory_id, low_stock_days=min(days, 30), dead_stock_days=90)` — V1 §4.5

**Prompt templates for each domain** (V1 §5.2):
- `_ATTENDANCE_PROMPT` — with today's stats, period overview, worker list, shift comparison
- `_DISPATCH_PROMPT` — with total dispatches, weight, vehicle, customer, mismatches
- `_FRAUD_PROMPT` — with signal counts by category, investigation queue
- `_FINANCE_PROMPT` — with revenue, realized metrics, receivables, expenses, cash
- `_INVENTORY_PROMPT` — with valuation, low stock, dead stock, ABC, slow-moving

**Integration tests per domain** (V1 §8.2):
- Each domain question returns 200 + correct domain + non-empty answer

### Day 5: Domain Fetchers D6-D10

**D6 — Production (`_fetch_production_data`):**
- Call `build_production_intelligence()` + `build_scrap_loss_intelligence(can_view_financials)` — V1 §4.6

**D7 — Audit Trail (`_fetch_audit_data`):**
- Direct queries on `AuditLog` + `User` — V1 §4.7
- Filter by today/24h, employee name, after-hours

**D8 — Owner Insights (`_fetch_owner_insights`):**
- Call `build_owner_dashboard()` + `build_financial_overview()` + `build_fraud_intelligence()` — V1 §4.8
- **Includes `_compute_health_score()`** — 4-factor deduction model from V1 §4.8
  - V2's 8-factor model deferred to Phase 2

**D9 — OCR (`_fetch_ocr_data`):**
- **Phase 1 stub** — returns zeros + "OCR data integration requires OcrVerification model access"
- **Phase 2** — fully wired (V2 §5.3)

**D10 — Alerts (`_fetch_alerts_data`):**
- **Phase 1 basic** — query `Alert` model, return count by severity, recent alerts
- **Phase 2 enhanced** — add `ignored_alerts`, `escalated_count` (V2 §5.4)

**Prompt templates** (V1 §5.2):
- `_PRODUCTION_PROMPT` — with throughput, shift analysis, downtime, scrap/rejection
- `_AUDIT_PROMPT` — with action counts, most active user, recent logs
- `_OWNER_PROMPT` — with full dashboard, health score, alerts
- `_OCR_PROMPT` — basic
- `_ALERTS_PROMPT` — basic

### Day 6: Frontend — 40+ Categorized Presets

**Files: `web/src/components/private/ai-insights-page.tsx`**

**What we build:**
1. `CATEGORIES` constant — 11 categories (All, Attendance, Dispatch, Theft & Fraud, Finance, Inventory, Production, Audit Trail, Owner Insights, Alerts & OCR, General) — V1 §7.1
2. `expandedPresets` array — all 40+ presets from V1 §7.1
3. Category tab UI — pill-shaped buttons that filter presets by prefix — V1 §7.2
4. Display `domain` in answer details section — V1 §7.3
5. `activeCategory` state with filtering logic

**No chat interface in Phase 1** — that's Phase 3.

### Day 7: Test Suite + Review + Polish

**Files: `tests/test_nlq_expansion.py` (new)**

**What we build:**
1. Full unit test suite from V1 §8.1:
   - `TestDomainClassifier` (16 tests)
   - `TestTimeParserV2` (8 tests)
   - `TestEntityFilter` (5 tests)
   - `TestHealthScore` (2 tests)
2. Integration tests from V1 §8.2:
   - `TestNlqEndpoint.test_domain_routing` — parametrized over all 10 domains
   - `TestNlqEndpoint.test_financial_redaction_for_non_finance_user`
   - `TestNlqEndpoint.test_no_factory_fallback_to_general`
   - `TestNlqEndpoint.test_plan_gating`
3. Run all existing tests — confirm no regressions
4. Code review by agent

---

## Phase 2 — Advanced Enhancements (+4 Days)

### Day 8: Language Detection + Hindi Support

**New file: `backend/services/nlq_language.py`**

**What we build:**
1. `_detect_language(question: str) -> str` — returns "hindi", "hinglish", or "english"
   - Check for Devanagari Unicode characters → "hindi"
   - Check for Hindi/Hinglish words (aaj, kal, kitna, paisa, etc.) → "hinglish"
   - Otherwise → "english" — V2 §2
2. `_normalize_question(question: str, language: str) -> str`:
   - Replace Hindi time words with English (aaj→today, pichle mahine→last month)
   - Pass through for English — V2 §2
3. `HINDI_DOMAIN_KEYWORDS` dict — Hindi keywords per domain — V2 §2
4. `HINDI_RESPONSE_INSTRUCTION` — prompt instruction telling AI to answer in Hinglish — V2 §7.2
5. Update `_build_nlq_prompt()` to inject language instruction when `language != "english"`
6. Update `NaturalLanguageQueryResponse` with `language` field

**Approach:** Normalize Hindi→English for processing, but tell the AI to answer in Hinglish. This means the classifier, time parser, and entity extractor all work unchanged.

### Day 9: Session Context + Multi-Domain Fusion + Smart Cache

**New file: `backend/services/nlq_session.py`**
**Modified: `backend/routers/ai.py`**

**Session Context:**
1. `NlqSessionTurn`, `NlqSession` models — V2 §4
2. `_load_session_context(session_id) -> NlqSession | None` — reads from existing cache layer
3. `_resolve_pronouns(question, session) -> str` — replaces pronouns with last entity — V2 §4
4. `_save_session_turn(session_id, turn)` — upserts session, keeps last 5 turns
5. Generate `session_id` per user (from `current_user.id`) — reused across queries

**Multi-Domain Fusion:**
1. Add `secondary_domain` and `needs_fusion` to classification return — V2 §3
2. `MULTI_DOMAIN_PATTERNS` — 7 patterns from V2 §3:
   - cost + shift + worker → ATTENDANCE + FINANCE
   - raw material + production + spend → PRODUCTION + FINANCE
   - theft + money + leaked → THEFT_FRAUD + FINANCE
   - dispatch + invoice + mismatch → DISPATCH + THEFT_FRAUD
   - who changed + dispatch → AUDIT_TRAIL + DISPATCH
   - who changed + invoice → AUDIT_TRAIL + FINANCE
   - scrap + cost + batch → PRODUCTION + FINANCE
3. `_fuse_domain_data(primary_data, secondary_data) -> dict` — merges data from both domains
4. Update `_build_nlq_prompt()` to accept and format data from both domains

**Smart Caching:**
1. `NlqCacheConfig.TTL_BY_DOMAIN` — per-domain TTL from V2 §10:
   - THEFT_FRAUD, ALERTS: 30s
   - ATTENDANCE, DISPATCH: 300s
   - OWNER_INSIGHTS: 120s
   - FINANCE, INVENTORY, OCR, GENERAL: 900s
   - PRODUCTION: 600s
   - AUDIT_TRAIL: 180s
2. `_build_cache_key(factory_id, domain, scope, entity_filter)` — deterministic key with MD5 hash of entity filter
3. Cache layer inserted into the NLQ pipeline (step 4 in architecture)

### Day 10: Health Score V2 + OCR Full Wire + Alerts 8/8 + Action Items

**Modified: `backend/routers/ai.py`** (fetchers + health score + response model)

**Health Score V2 (`_compute_health_score_v2`):**
- 8 weighted factors from V2 §6:
  - Financial health (25%) — margin + overdue
  - Fraud pressure (25%) — critical + high signals
  - Production efficiency (15%) — loss percent
  - Inventory health (15%) — red + yellow items
  - Attendance health (10%) — presence rate
  - Dispatch compliance (5%) — default 90
  - Alert resolution (3%) — unread critical ratio
  - OCR accuracy (2%) — default 85
- Returns: score, label (good/needs_attention/at_risk/critical), color, worst_factor, best_factor

**OCR Fetcher (Full):**
- Query `OcrVerification` model — V2 §5.3
- Compute total, approved, failed, pending counts
- Compute accuracy rate, avg confidence score
- Return document type breakdown, low confidence docs

**Alerts Fetcher (Enhanced):**
- Add `ignored_alerts` — unread over 2 hours — V2 §5.4
- Add `escalated_count`
- Add `alerts_by_day` — grouped by date for trend

**Action Items:**
- `ActionItem` model with priority, action, reason, estimated_impact_inr, deadline — V2 §8
- Added to `NaturalLanguageQueryResponse`
- AI prompt now instructed to extract action items from the answer

### Day 11: Frontend Polish + Full Test Suite

**Files: `web/src/components/private/ai-insights-page.tsx`, `tests/test_nlq_expansion_v2.py`**

**Frontend:**
1. Add Hindi preset tab — 5 Hindi questions from V2 §9.3
2. Add multi-domain presets — 3 questions (shift+cost, fraud+finance, raw waste)
3. Add trend presets — 3 questions (MoM compare, projection, best week)
4. Display `language`, `confidence`, `action_items` in answer details

**Tests:**
1. All 78 question domain routing tests — V2 mentions, V1 §8.2 has framework
2. 10 Hindi/Hinglish tests — classifier correctly identifies domain from Hindi questions
3. Multi-domain fusion tests — responses contain data from both domains
4. Cache behavior tests
5. Financial redaction tests (Phase 1 already has this)

---

## Phase 3 — Future (Deferred)

| Feature | Reason Deferred | When |
|---------|----------------|------|
| Chat interface (NlqChatInterface.tsx) | Duplicates existing preset UI; Phase 1 presets ship faster | Next sprint |
| SSE streaming | Massive backend change; Phase 1 response time < 2s p95 is sufficient | Next sprint |
| Voice input | Requires WebRTC + speech-to-text infrastructure | Later |
| PDF export | Phase 1 copy-paste works; export is nice-to-have | Later |
| LLM-based classifier fallback | < 5% ambiguous cases; V1 keyword handles 95% correctly | Phase 2.5 |

---

## File Changes Summary (All Phases)

| Phase | File | Change | Lines |
|-------|------|--------|-------|
| 1 | `backend/routers/ai.py` | Domain classifier, time parser, entity parser, 10 fetchers, 11 prompt templates, permission checks, updated NLQ flow | +900 |
| 1 | `backend/routers/ai.py` | `NaturalLanguageQueryResponse` — add `domain` field | +3 |
| 1 | `web/src/components/private/ai-insights-page.tsx` | 40+ categorized presets, category tab UI | +200 |
| 1 | `web/src/lib/ai.ts` | Export `domain` field type | +3 |
| 1 | `tests/test_nlq_expansion.py` | NEW: Unit + integration tests | +500 |
| 2 | `backend/services/nlq_language.py` | NEW: Language detector, Hindi normalizer | +100 |
| 2 | `backend/services/nlq_session.py` | NEW: Session manager, pronoun resolver | +120 |
| 2 | `backend/routers/ai.py` | Multi-domain fusion, smart cache layer, Health Score V2 | +300 |
| 2 | `backend/routers/ai.py` | OCR fully wired, Alerts enhanced, ActionItems model | +100 |
| 2 | `web/src/components/private/ai-insights-page.tsx` | Hindi, multi-domain, trend presets; action items display | +100 |
| 2 | `tests/test_nlq_expansion_v2.py` | NEW: 78 question tests + Hindi + edge cases | +700 |
| 3 | `web/src/components/private/NlqChatInterface.tsx` | NEW: Chat UI (deferred) | +300 |

**Total Phase 1: ~1,600 lines across 5 files**
**Total Phase 2: ~1,320 lines across 6 files**
**Total all phases: ~3,220 lines**

---

## What We Ship When

### After Phase 1 (Day 7):
✅ Owner types "Who came to work today?" → AI answers with attendance data
✅ Owner types "Show me suspicious transactions" → AI answers with fraud data
✅ Owner types "Give me business health summary" → AI answers with dashboard + health score
✅ All 40+ preset buttons organized by category
✅ ~95% of 78 owner questions answered
✅ Financial data redacted for non-finance roles
✅ Factory not found → falls back to GENERAL (Entry-based)
✅ AI provider fails → structured fallback text

### After Phase 2 (Day 11):
✅ Hindi/Hinglish: "Aaj kaun aaya?" → answer in Hinglish
✅ Follow-up: "What about Rajesh?" → from same session context
✅ Multi-domain: "Which shift costs the most?" → fuses attendance + finance
✅ Smart caching: fraud answers real-time (30s TTL), finance answers cached 15min
✅ 8-factor health score with worst/best area
✅ OCR documents fully wired
✅ Alerts with ignored/escalated tracking
✅ Action items: "→ Call Excel Steelworks now"

### After Phase 3 (Future):
✅ Chat interface with WhatsApp-style bubbles
✅ Streaming answers for long owner queries
✅ Voice input
✅ PDF export

---

## Summary: V1 vs V2 vs Merged

| Feature | V1 (Original) | V2 (Upgrade) | Merged (This) |
|---------|--------------|-------------|---------------|
| Domain classifier | Keyword | Keyword + LLM | Phase 1: Keyword only |
| Hindi support | ❌ | ✅ Full | Phase 2 |
| Session memory | ❌ | ✅ 5 turns | Phase 2 |
| Multi-domain fusion | ❌ | ✅ 7 patterns | Phase 2 |
| Smart caching | 900s flat | Per-domain TTL | Phase 2 |
| Health score | 4-factor | 8-factor | Phase 2 |
| OCR | Stub | Full wire | Phase 2 |
| Alerts | 3/8 | 8/8 | Phase 2 |
| Chat interface | ❌ | ✅ New component | Phase 3 |
| Streaming SSE | ❌ | ✅ | Phase 3 |
| Voice input | ❌ | ✅ Ready | Phase 3 |
| Timeline | 7 days | 10 days | **7 + 4 = 11 days** |
| Questions covered | ~97% | ~99.5% | Phase 1: ~95%, Phase 2: ~99% |
| Risk | Low | Medium (Hindi + streaming) | **Low (Phase 1 ships fast)** |

---

## Ready to Start

**Phase 1 (7 days) is ready to implement now.** It builds on existing intelligence services, requires no new infrastructure, and delivers 95% of the value.

Phase 2 can begin immediately after Phase 1 ships — the architecture is designed for incremental addition.

Shall we start implementing Phase 1, Day 1: the domain classifier, enhanced time parser, and entity filter parser?
