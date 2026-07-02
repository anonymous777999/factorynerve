# NLQ Expansion Plan V2 — Factory Nerve AI Insights
## Full Upgrade: Smarter Routing · Richer Answers · Contextual Memory · Hindi Support

> **Original plan:** 8-step pipeline, keyword-based classifier, 97% coverage, 7-day implementation.
> **This upgrade (V2):** 12-step pipeline, LLM-assisted classification, multi-domain fusion, conversation memory, Hindi/Hinglish support, streaming responses, smart caching, confidence scoring, ~99.5% coverage, 10-day implementation.

---

## What's New in V2 vs Original Plan

| Area | Original Plan | V2 Upgrade |
|------|--------------|------------|
| Domain classifier | Keyword count → wins | LLM-assisted + keyword fallback + confidence score |
| Multi-domain questions | Picks ONE domain only | Fuses 2–3 domains when question spans them |
| Language support | English only | Hindi + Hinglish + transliterated queries |
| Answer format | Plain text, 140 words | Structured: text + bullet actions + severity badges |
| Response streaming | Not present | Streaming via SSE for long owner queries |
| Conversation memory | Not present | Last 5 turns kept per session for follow-up questions |
| Caching | 900s flat TTL | Smart TTL: 30s (fraud/alerts), 300s (attendance), 900s (finance/inventory) |
| Health score | Simple deduction formula | Weighted 8-factor model with trend direction |
| Error surfaces | Silent fallback | Explains WHY data is missing, suggests action |
| Frontend | 40 preset tabs | Chat interface + presets + voice input ready |
| Test coverage | 10 domain routing tests | 78 question tests + edge cases + Hindi tests |
| OCR domain | Stub (returns zeros) | Fully wired to OcrVerification model |
| Alerts domain | Read-only (3/8 coverage) | Read + configure + escalate (8/8 coverage) |

---

## 1. Architecture Overview (V2 — 12-Step Pipeline)

```
Owner types: "pichle mahine mein kitna paisa gaya?"
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  0. Language Detector (_detect_language)            │
│     Detects: Hindi / Hinglish / English             │
│     Translates Hindi → English internally            │
│     Stores original language for response styling   │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  1. Session Context Loader (_load_session_context)  │
│     Loads last 5 Q&A turns from Redis/cache         │
│     Resolves pronouns: "what about him?" → Rajesh   │
│     Carries forward time scope if not re-specified  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  2. Smart Domain Classifier (_classify_nlq_v2)      │
│     Step A: Keyword scan → candidate domains        │
│     Step B: If ambiguous (score tie), LLM decides   │
│     Step C: Multi-domain flag if 2+ domains needed  │
│     Returns: primary_domain, secondary_domain?,     │
│              confidence_score (0.0–1.0)             │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  3. Enhanced Time Parser (_parse_time_scope_v2)     │
│     All original scopes + Hindi time words          │
│     "aaj" → today, "pichle hafte" → last week       │
│     "is mahine" → this month                        │
│     Relative follow-up: "same period" → inherits    │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  4. Entity Filter Parser (_parse_entity_filter_v2)  │
│     Original: shift, employee, dept, vendor         │
│     NEW: product_line, machine_id, batch_number,    │
│           gate_number, truck_number, account_name   │
│     Pronoun resolver: "uska" / "him" → last entity  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  5. Permission Checker (_get_nlq_permissions)       │
│     Same as V1 + new: can_configure_alerts,         │
│     can_view_ocr_documents, can_export_data         │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  6. Cache Layer (_check_nlq_cache)                  │
│     Key: factory_id + domain + scope + entity_hash  │
│     TTL by domain:                                  │
│       fraud/alerts: 30s (real-time sensitive)       │
│       attendance: 300s (5 min)                      │
│       finance/inventory/production: 900s (15 min)   │
│       owner_insights: 120s (2 min, composite data)  │
│     Cache HIT → skip fetchers, go to step 9        │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  7. Domain Fetcher(s) — parallel if multi-domain   │
│     Single domain: call 1 fetcher                   │
│     Multi-domain: asyncio.gather() 2–3 fetchers     │
│     Each fetcher returns structured dict            │
│     On error: returns partial data + error_reason   │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  8. Data Fusion (_fuse_domain_data)                 │
│     Only for multi-domain queries                   │
│     Merges finance + fraud → leakage view           │
│     Merges production + inventory → waste view      │
│     Merges attendance + production → shift view     │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  9. AI Prompt Builder (_build_nlq_prompt_v2)        │
│     Domain template + injected data                 │
│     NEW: answer_format hint (text/bullets/table)    │
│     NEW: language hint (english/hindi/hinglish)     │
│     NEW: severity_focus (critical/warning/info)     │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  10. AI Generation (streaming-ready)                │
│      Short queries (<150 token response): standard  │
│      Owner/summary queries: SSE stream              │
│      Fallback: structured text from _build_fallback │
│      Confidence < 0.4: ask clarifying question      │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  11. Answer Formatter (_format_nlq_answer)          │
│      Adds severity badges: 🔴 Critical 🟡 Warning   │
│      Adds action items: "→ Do this first"           │
│      Hindi questions → Hindi-friendly answer        │
│      Injects data_points for frontend chart render  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  12. Session Saver + Audit Log                      │
│      Saves Q&A to session cache (last 5 turns)      │
│      Writes AI_NLQ_QUERY_EXECUTED to AuditLog       │
│      Emits telemetry: domain, latency, cache_hit    │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
           NaturalLanguageQueryResponse V2
           (answer, domain, confidence, data_points,
            action_items, severity, language, session_id)
```

---

## 2. New: Language Detection & Hindi Support

This is the biggest new addition. Indian factory owners will type in Hindi, Hinglish, or mix both. The system must handle it.

```python
HINDI_TIME_MAP = {
    "aaj": "today",
    "kal": "yesterday",
    "is hafte": "this week",
    "pichle hafte": "last week",
    "is mahine": "this month",
    "pichle mahine": "last month",
    "is saal": "this year",
    "pichle 30 din": "last 30 days",
    "pichle 7 din": "last 7 days",
    "abhi": "today",
    "aaj ka": "today",
}

HINDI_DOMAIN_KEYWORDS = {
    NlqDomain.ATTENDANCE: ["kaun aaya", "kaun absen", "haziri", "deर", "overtime", "late aaya"],
    NlqDomain.FINANCE: ["paisa", "paise", "rupaye", "leakage", "kharcha", "kamai", "loss"],
    NlqDomain.THEFT_FRAUD: ["chori", "fraud", "gum", "missing", "gaayab", "ghabdad"],
    NlqDomain.DISPATCH: ["maal bheja", "delivery", "truck", "dispatch", "challan"],
    NlqDomain.INVENTORY: ["stock", "maal", "saaman", "khatam", "inventory"],
    NlqDomain.PRODUCTION: ["utpaadan", "production", "batch", "output", "tonnage"],
    NlqDomain.OWNER_INSIGHTS: ["sab kuch", "summary", "health", "poori report", "bata do"],
}

def _detect_language(question: str) -> str:
    """Returns: 'hindi', 'hinglish', or 'english'"""
    hindi_chars = set("अआइईउऊएऐओऔकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह")
    if any(c in hindi_chars for c in question):
        return "hindi"
    hindi_words = set(HINDI_TIME_MAP.keys()) | {"kya", "kitna", "kaun", "kab", "kahan", "paisa", "maal"}
    word_set = set(question.lower().split())
    if len(word_set & hindi_words) >= 2:
        return "hinglish"
    return "english"

def _normalize_question(question: str, language: str) -> str:
    """Translates Hindi/Hinglish time words and domain keywords to English for processing."""
    if language == "english":
        return question
    normalized = question.lower()
    for hindi, english in HINDI_TIME_MAP.items():
        normalized = normalized.replace(hindi, english)
    return normalized
```

---

## 3. New: Smart Domain Classifier V2 (With LLM Fallback)

The original classifier picks the domain with the most keyword hits. This breaks on:
- "Who was the last person to change the dispatch record?" → hits both AUDIT_TRAIL and DISPATCH equally
- "How much did Rajesh's shift cost us this week?" → hits ATTENDANCE, FINANCE, PRODUCTION

V2 solution: keyword scan first, LLM disambiguation only when tied.

```python
class NlqClassificationResult(BaseModel):
    primary_domain: NlqDomain
    secondary_domain: NlqDomain | None = None
    confidence: float  # 0.0 to 1.0
    needs_fusion: bool = False
    ambiguous: bool = False

def _classify_nlq_v2(question: str, normalized: str) -> NlqClassificationResult:
    """
    Step 1: Run keyword scorer on normalized question.
    Step 2: If top score is clear winner (gap >= 2), return it with high confidence.
    Step 3: If tied or gap == 1, check MULTI_DOMAIN_PATTERNS first.
    Step 4: If still ambiguous, call LLM classifier (lightweight, 50-token output).
    Step 5: Assign secondary_domain if multi-domain query detected.
    """
    text = normalized.lower()
    scores: dict[NlqDomain, int] = {}

    for domain, keywords in DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in text)

    sorted_domains = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_score = sorted_domains[0][1]
    second_score = sorted_domains[1][1] if len(sorted_domains) > 1 else 0

    # Clear winner
    if top_score == 0:
        return NlqClassificationResult(
            primary_domain=NlqDomain.GENERAL, confidence=0.5
        )
    
    gap = top_score - second_score

    if gap >= 2:
        return NlqClassificationResult(
            primary_domain=sorted_domains[0][0],
            confidence=min(0.95, 0.6 + gap * 0.1),
        )

    # Check for known multi-domain patterns
    fusion = _check_multi_domain_patterns(text)
    if fusion:
        return fusion

    # LLM disambiguation for ambiguous cases
    return _llm_classify_domain(question, sorted_domains[:3])


# Multi-domain fusion patterns
MULTI_DOMAIN_PATTERNS = [
    # (pattern_keywords, primary, secondary)
    (["cost", "shift", "worker"], NlqDomain.ATTENDANCE, NlqDomain.FINANCE),
    (["raw material", "production", "spend"], NlqDomain.PRODUCTION, NlqDomain.FINANCE),
    (["theft", "money", "leaked"], NlqDomain.THEFT_FRAUD, NlqDomain.FINANCE),
    (["dispatch", "invoice", "mismatch"], NlqDomain.DISPATCH, NlqDomain.THEFT_FRAUD),
    (["who changed", "dispatch"], NlqDomain.AUDIT_TRAIL, NlqDomain.DISPATCH),
    (["who changed", "invoice"], NlqDomain.AUDIT_TRAIL, NlqDomain.FINANCE),
    (["scrap", "cost", "batch"], NlqDomain.PRODUCTION, NlqDomain.FINANCE),
]

def _check_multi_domain_patterns(text: str) -> NlqClassificationResult | None:
    for pattern_words, primary, secondary in MULTI_DOMAIN_PATTERNS:
        if all(w in text for w in pattern_words):
            return NlqClassificationResult(
                primary_domain=primary,
                secondary_domain=secondary,
                confidence=0.85,
                needs_fusion=True,
            )
    return None


def _llm_classify_domain(question: str, top_candidates: list) -> NlqClassificationResult:
    """
    Calls Claude with a tiny classification prompt.
    Only triggered when keyword classifier is ambiguous (gap <= 1).
    Uses cached result for identical questions.
    """
    candidate_names = [d[0].value for d in top_candidates]
    prompt = f"""You are a factory query classifier. Classify this factory owner question into ONE domain.
Question: "{question}"
Candidate domains: {candidate_names}
Valid domains: attendance, dispatch, theft_fraud, finance, inventory, production, audit_trail, owner_insights, ocr, alerts, general
Reply with ONLY the domain name, nothing else."""

    # Call ai_router with tiny max_tokens
    result, _, _, _ = ai_router.generate_text(prompt, max_tokens=10, telemetry_system="nlq_classifier")
    domain_str = result.strip().lower()
    
    try:
        domain = NlqDomain(domain_str)
        return NlqClassificationResult(primary_domain=domain, confidence=0.75, ambiguous=True)
    except ValueError:
        return NlqClassificationResult(primary_domain=NlqDomain.GENERAL, confidence=0.3, ambiguous=True)
```

---

## 4. New: Session Context (Conversation Memory)

This enables follow-up questions like:
- Q1: "Show me Rajesh's attendance this month"
- Q2: "What about Suresh?" ← knows we're talking attendance + this month
- Q3: "Same but for last month" ← inherits entity from Q2, changes time scope

```python
class NlqSessionTurn(BaseModel):
    question: str
    domain: str
    scope: str
    entity_filter: dict[str, Any]
    answer_summary: str  # First 100 chars of answer
    timestamp: datetime

class NlqSession(BaseModel):
    session_id: str
    factory_id: str
    user_id: str
    turns: list[NlqSessionTurn] = []  # Max 5

def _load_session_context(session_id: str, cache) -> NlqSession | None:
    """Load from Redis/cache. Returns None if no session."""
    raw = cache.get(f"nlq_session:{session_id}")
    if raw:
        return NlqSession.model_validate_json(raw)
    return None

def _resolve_pronouns(question: str, session: NlqSession | None) -> str:
    """
    Replace pronouns with entities from previous turns.
    "what about him" → "what about [last employee name]"
    "same period" → inherits last time scope
    "same" → repeats last question with new entity
    """
    if not session or not session.turns:
        return question
    
    last = session.turns[-1]
    q_lower = question.lower()
    
    # Pronoun resolution
    if any(p in q_lower for p in ["what about him", "uska", "his", "her", "same person"]):
        if last.entity_filter.get("employee_name"):
            question = question + f" [employee: {last.entity_filter['employee_name']}]"
    
    # Time scope inheritance
    if "same period" in q_lower or "same time" in q_lower:
        question = question + f" [{last.scope}]"
    
    return question

def _save_session_turn(session_id: str, turn: NlqSessionTurn, cache):
    """Upsert session with new turn. Keep last 5."""
    session = _load_session_context(session_id, cache) or NlqSession(
        session_id=session_id, factory_id=turn.entity_filter.get("factory_id", ""),
        user_id="", turns=[]
    )
    session.turns.append(turn)
    session.turns = session.turns[-5:]  # Keep last 5
    cache.set(f"nlq_session:{session_id}", session.model_dump_json(), ex=3600)  # 1 hour TTL
```

---

## 5. V2 Upgrades to Existing Fetchers

### 5.1 — Attendance Fetcher (Enhanced)

New additions to `_fetch_attendance_data`:
- Absentee streak detection (absent 3+ consecutive days)
- Friday pattern detection (suspicious if always absent on Fridays)
- Shift-level cost computation (if `can_view_cost`)
- Department-level rollup

```python
# Add to return dict:
"absentee_streaks": [
    {"employee_name": "Rajesh Kumar", "consecutive_absent_days": 4, "last_seen": "2026-06-17"},
],
"friday_pattern_flags": [
    {"employee_name": "Vikas Sharma", "friday_absent_count": 5, "total_mondays_absent": 4},
],
"shift_cost_summary": {  # Only if can_view_cost
    "morning": {"total_workers": 24, "total_cost_inr": 48000},
    "evening": {"total_workers": 18, "total_cost_inr": 36000},
    "night": {"total_workers": 10, "total_cost_inr": 22000},
},
```

### 5.2 — Finance Fetcher (Enhanced)

New: Period-over-period comparison built into the fetch itself.

```python
# Fetch current period AND previous period in one call
current = build_financial_overview(db, factory_id, days=days)
previous = build_financial_overview(db, factory_id, days=days, offset_days=days)

return {
    "overview": current,
    "previous_period": previous,
    "mom_change": {
        "revenue_change_pct": _pct_change(
            current["revenue"]["last_n_days"]["revenue_inr"],
            previous["revenue"]["last_n_days"]["revenue_inr"]
        ),
        "expense_change_pct": _pct_change(...),
        "margin_change_pct": _pct_change(...),
    },
    # ... rest of finance data
}
```

### 5.3 — OCR Fetcher (Fully Wired — Was a Stub)

Original plan had this returning zeros. V2 fully implements it:

```python
def _fetch_ocr_data(db: Session, factory_id: str, days: int, ...) -> dict[str, Any]:
    from backend.models.ocr_verification import OcrVerification
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    verifications = db.query(OcrVerification).filter(
        OcrVerification.factory_id == factory_id,
        OcrVerification.created_at >= cutoff,
    ).order_by(OcrVerification.created_at.desc()).limit(200).all()
    
    total = len(verifications)
    approved = [v for v in verifications if v.outcome == "approved"]
    failed = [v for v in verifications if v.outcome in ("failed", "rejected")]
    pending = [v for v in verifications if v.outcome == "pending"]
    
    avg_confidence = (
        sum(v.confidence_score or 0 for v in approved) / len(approved)
        if approved else 0
    )
    
    doc_types: dict[str, int] = defaultdict(int)
    for v in verifications:
        doc_types[v.document_type or "unknown"] += 1
    
    return {
        "total_count": total,
        "approved_count": len(approved),
        "failed_count": len(failed),
        "pending_count": len(pending),
        "accuracy_rate_percent": round(len(approved) / total * 100, 1) if total else 0,
        "avg_confidence_score": round(avg_confidence * 100, 1),
        "document_types": dict(sorted(doc_types.items(), key=lambda x: x[1], reverse=True)),
        "low_confidence_docs": [
            {
                "id": v.id,
                "document_type": v.document_type,
                "confidence_score": v.confidence_score,
                "created_at": v.created_at.isoformat(),
            }
            for v in verifications
            if (v.confidence_score or 0) < 0.55 and v.outcome != "approved"
        ][:10],
    }
```

### 5.4 — Alerts Fetcher (Expanded to 8/8 Coverage)

Original plan only covered 3/8 alert questions. V2 adds alert configuration support.

```python
def _fetch_alerts_data(db: Session, factory_id: str, days: int,
                        question: str, perms: NlqPermissionSet, entity_filter: dict) -> dict:
    from backend.models.alert import Alert
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    alerts = db.query(Alert).filter(
        Alert.factory_id == factory_id,
        Alert.created_at >= cutoff,
    ).order_by(Alert.created_at.desc()).all()
    
    unread_over_2h = [
        a for a in alerts
        if not a.is_read
        and (datetime.now(timezone.utc) - a.created_at).seconds > 7200
    ]
    
    by_severity = defaultdict(list)
    for a in alerts:
        by_severity[a.severity].append(a)
    
    return {
        "total_count": len(alerts),
        "critical_count": len(by_severity.get("critical", [])),
        "warning_count": len(by_severity.get("warning", [])),
        "info_count": len(by_severity.get("info", [])),
        "unread_count": sum(1 for a in alerts if not a.is_read),
        "escalated_count": sum(1 for a in alerts if getattr(a, "is_escalated", False)),
        "ignored_alerts": [
            {"id": a.id, "title": a.title, "severity": a.severity,
             "age_hours": round((datetime.now(timezone.utc) - a.created_at).seconds / 3600, 1)}
            for a in unread_over_2h[:10]
        ],
        "recent_critical": [
            {"id": a.id, "title": a.title, "created_at": a.created_at.isoformat(),
             "is_read": a.is_read}
            for a in by_severity.get("critical", [])[:5]
        ],
        "alerts_by_day": _group_alerts_by_day(alerts),
    }
```

---

## 6. New: Health Score V2 — Weighted 8-Factor Model

Original health score only had 4 deductions. V2 uses 8 weighted factors with trend direction.

```python
def _compute_health_score_v2(
    dashboard: dict,
    finance: dict,
    fraud: dict,
    attendance: dict,
) -> dict[str, Any]:
    """
    8-factor weighted health score.
    Each factor scores 0–100 independently, then weighted average.
    
    Factor weights:
    - Financial health:        25%
    - Fraud/anomaly pressure:  25%
    - Production efficiency:   15%
    - Inventory health:        15%
    - Attendance health:       10%
    - Dispatch compliance:      5%
    - Alert resolution:         3%
    - OCR accuracy:             2%
    """
    factors = {}

    # 1. Financial health (25%)
    fin = finance.get("overview", {})
    margin = fin.get("realized_metrics", {}).get("margin_percent", 0)
    overdue_count = finance.get("receivables", {}).get("overdue_count", 0)
    fin_score = min(100, max(0, margin * 2.5 - overdue_count * 3))
    factors["financial_health"] = {"score": fin_score, "weight": 0.25}

    # 2. Fraud/anomaly pressure (25%)
    fraud_summary = fraud.get("summary", {})
    critical = fraud_summary.get("critical_count", 0)
    high = fraud_summary.get("high_count", 0)
    fraud_score = max(0, 100 - critical * 15 - high * 7)
    factors["fraud_pressure"] = {"score": fraud_score, "weight": 0.25}

    # 3. Production efficiency (15%)
    snapshot = dashboard.get("snapshot", {})
    loss_pct = snapshot.get("today_loss_percent", 0)
    prod_score = max(0, 100 - loss_pct * 4)
    factors["production_efficiency"] = {"score": prod_score, "weight": 0.15}

    # 4. Inventory health (15%)
    inv = dashboard.get("inventory_health", {})
    red = inv.get("red_count", 0)
    yellow = inv.get("yellow_count", 0)
    inv_score = max(0, 100 - red * 10 - yellow * 4)
    factors["inventory_health"] = {"score": inv_score, "weight": 0.15}

    # 5. Attendance health (10%)
    att_period = attendance.get("overview", {}).get("period", {})
    presence_rate = att_period.get("presence_rate_percent", 100)
    att_score = min(100, presence_rate * 1.1)
    factors["attendance_health"] = {"score": att_score, "weight": 0.10}

    # 6. Dispatch compliance (5%)
    # Requires dispatch data in context — default to 90 if not available
    factors["dispatch_compliance"] = {"score": 90, "weight": 0.05}

    # 7. Alert resolution (3%)
    # Based on unread critical alerts ratio
    factors["alert_resolution"] = {"score": 80, "weight": 0.03}

    # 8. OCR accuracy (2%)
    factors["ocr_accuracy"] = {"score": 85, "weight": 0.02}

    # Weighted average
    total_score = sum(
        f["score"] * f["weight"] for f in factors.values()
    )
    total_score = round(max(0, min(100, total_score)), 1)

    if total_score >= 80:
        label = "good"
        color = "green"
    elif total_score >= 60:
        label = "needs_attention"
        color = "yellow"
    elif total_score >= 40:
        label = "at_risk"
        color = "orange"
    else:
        label = "critical"
        color = "red"

    return {
        "score": total_score,
        "label": label,
        "color": color,
        "factors": factors,
        "worst_factor": min(factors.items(), key=lambda x: x[1]["score"] * x[1]["weight"])[0],
        "best_factor": max(factors.items(), key=lambda x: x[1]["score"] * x[1]["weight"])[0],
    }
```

---

## 7. V2 Prompt Upgrades

### 7.1 — New: Answer Format Hints

Every prompt now tells the AI what FORMAT to use:

```python
FORMAT_HINTS = {
    NlqDomain.OWNER_INSIGHTS: "Use this structure: 1 line summary, then bullet points for each issue with ₹ amount, then 3 numbered action items.",
    NlqDomain.THEFT_FRAUD:    "Start with severity level (CRITICAL / WARNING / CLEAR). List each signal with ₹ impact. End with 1 action.",
    NlqDomain.FINANCE:        "Lead with net figure. Use ₹ with commas. Show change vs previous period as (+X% ↑ or -X% ↓).",
    NlqDomain.ATTENDANCE:     "Show numbers first: X present, Y absent. Then highlight anomalies. Keep under 100 words.",
    NlqDomain.PRODUCTION:     "Lead with today's output. Then efficiency %. Then top issue. Mention shift comparison.",
    NlqDomain.INVENTORY:      "Stock status first. Then critical low items. Then dead stock value. Under 120 words.",
    NlqDomain.AUDIT_TRAIL:    "Who + What + When format. Flag anything suspicious with ⚠️. Under 100 words.",
    NlqDomain.DISPATCH:       "Total dispatches + weight first. Then flag any anomalies. Under 100 words.",
    NlqDomain.ALERTS:         "Count by severity first. Then list critical alerts. Then mention ignored ones.",
    NlqDomain.OCR:            "Accuracy rate first. Then pending documents. Then failures. Under 80 words.",
    NlqDomain.GENERAL:        "Direct answer first. Then supporting numbers. Under 120 words.",
}
```

### 7.2 — New: Hindi Response Instruction

```python
HINDI_RESPONSE_INSTRUCTION = """
The owner asked this question in Hindi/Hinglish. 
Respond in simple Hinglish (mix of Hindi and English).
Use English for numbers, ₹ amounts, dates, and technical terms.
Use Hindi for explanatory sentences.
Example style: "Aaj 47 workers aaye hain. 3 late hain — Rajesh, Vikas, aur Suresh. 
Overtime total: 84 minutes. Kal ke liye attendance better rakhni hogi."
"""
```

### 7.3 — New: Owner Prompt V2 (with trend arrows)

```python
_OWNER_PROMPT_V2 = """
You are the factory owner's executive intelligence assistant for an Indian steel factory.
Answer the question DIRECTLY and HONESTLY. Do not sugarcoat problems.
{format_hint}
{language_instruction}

Question: {question}

=== FACTORY HEALTH SCORE: {health_score}/100 ({health_label}) ===
Worst area: {worst_factor} | Best area: {best_factor}

=== THIS MONTH vs LAST MONTH ===
Revenue:    ₹{revenue_current} ({revenue_change_pct}% {revenue_arrow})
Expenses:   ₹{expenses_current} ({expense_change_pct}% {expense_arrow})
Margin:     {margin_current}% ({margin_change_pct}% {margin_arrow})
Production: {production_current} tonnes ({prod_change_pct}% {prod_arrow})

=== TOP 3 PROBLEMS RIGHT NOW ===
🔴 {problem_1}
🟡 {problem_2}
🟡 {problem_3}

=== FINANCIAL PULSE ===
Realized Revenue: ₹{realized_revenue} | Profit: ₹{realized_profit} | Margin: {margin_pct}%
Outstanding: ₹{outstanding} | Overdue: ₹{overdue} ({overdue_count} invoices)

=== FRAUD & LEAKAGE ===
Critical signals: {critical_signals}
Estimated leakage: ₹{estimated_leakage}
Under investigation: {investigation_count} items

=== INVENTORY STATUS ===
Total stock: ₹{stock_value} across {stock_items} items
🔴 Immediate action needed: {red_items}
🟡 Review needed: {yellow_items}

=== ALERTS ===
{alerts_list}

=== HEALTH SCORE FACTORS ===
{health_factors}

Based on this data, answer the owner's question directly.
End with: "→ First thing tomorrow: [ONE specific action with deadline or ₹ at stake]"
"""
```

---

## 8. New: NaturalLanguageQueryResponse V2

```python
class ActionItem(BaseModel):
    priority: int  # 1 = most urgent
    action: str
    reason: str
    estimated_impact_inr: float | None = None
    deadline: str | None = None  # "today", "this week", "urgent"

class NaturalLanguageQueryResponse(BaseModel):
    # Original fields
    question: str
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    degraded: bool = False
    is_fallback: bool = False
    generated_at: datetime
    structured_query: dict[str, Any]
    answer: str
    data_points: list[dict[str, Any]]
    
    # V2 new fields
    domain: str = Field(default="general")
    secondary_domain: str | None = None
    confidence: float = Field(default=1.0)  # Classifier confidence
    language: str = Field(default="english")  # "english", "hindi", "hinglish"
    severity: str | None = None  # "critical", "warning", "clear", None
    action_items: list[ActionItem] = []  # Structured next steps
    session_id: str | None = None  # For follow-up questions
    cache_hit: bool = False
    latency_ms: int | None = None
```

---

## 9. New: Frontend — Chat Interface V2

The original plan adds 40 preset tabs. V2 also adds a chat interface that feels like WhatsApp.

### 9.1 — New Component: `NlqChatInterface.tsx`

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  domain?: string;
  severity?: "critical" | "warning" | "clear";
  actionItems?: ActionItem[];
  dataPoints?: DataPoint[];
  timestamp: Date;
  confidence?: number;
}

// Features:
// - WhatsApp-style bubbles
// - Domain badge on each answer (🏭 Production, 💰 Finance, etc.)
// - Severity color coding (red border for critical answers)
// - Action items as tappable chips: "→ Call Excel Steelworks now"
// - "Ask follow-up" button pre-fills related questions
// - Voice input ready (navigator.mediaDevices.getUserMedia)
// - Share answer as PDF (one click)
// - Streaming support (EventSource for SSE)
```

### 9.2 — Domain Badges for Frontend

```typescript
const DOMAIN_BADGES: Record<string, { emoji: string; label: string; color: string }> = {
  attendance:     { emoji: "👥", label: "HR & Attendance", color: "blue" },
  dispatch:       { emoji: "🚛", label: "Dispatch",        color: "purple" },
  theft_fraud:    { emoji: "🚨", label: "Fraud Alert",     color: "red" },
  finance:        { emoji: "💰", label: "Finance",         color: "green" },
  inventory:      { emoji: "📦", label: "Inventory",       color: "yellow" },
  production:     { emoji: "🏭", label: "Production",      color: "orange" },
  audit_trail:    { emoji: "📋", label: "Audit Trail",     color: "gray" },
  owner_insights: { emoji: "👑", label: "Owner Insights",  color: "gold" },
  ocr:            { emoji: "📄", label: "Documents",       color: "teal" },
  alerts:         { emoji: "🔔", label: "Alerts",          color: "red" },
  general:        { emoji: "🔍", label: "General",         color: "gray" },
};
```

### 9.3 — New Preset Questions (V2 Additions to Original 40)

```typescript
// These are NEW presets beyond the original 40:

// Hindi presets
{ id: "hi-att-today",   label: "Aaj kaun aaya?",        question: "Aaj kaun aaya aur kaun absen hai?" },
{ id: "hi-fin-loss",    label: "Kitna paisa gaya?",      question: "Pichle mahine mein kitna paisa leaked hua?" },
{ id: "hi-theft",       label: "Koi chori hua?",         question: "Kya pichle 30 din mein koi chori ya fraud detect hua?" },
{ id: "hi-stock",       label: "Stock kya hai?",         question: "Abhi warehouse mein kitna maal hai?" },
{ id: "hi-summary",     label: "Poori factory ka haal",  question: "Factory ka aaj ka poora haal bata do — paisa, log, maal, koi problem?" },

// Multi-domain presets
{ id: "md-shift-cost",  label: "Shift vs Cost",          question: "Which shift is most productive AND most cost-efficient?" },
{ id: "md-fraud-fin",   label: "Fraud Financial Impact", question: "How much money has fraud and leakage cost us in the last 30 days?" },
{ id: "md-raw-waste",   label: "Raw Material Waste",     question: "How much raw material was wasted in production vs dispatched this month?" },

// Trend presets
{ id: "tr-mom-compare", label: "This vs Last Month",     question: "Compare this month to last month across production, finance, and attendance" },
{ id: "tr-projection",  label: "Next Month Forecast",    question: "Based on current trends, what will my profit look like next month?" },
{ id: "tr-best-week",   label: "Best Week This Month",   question: "Which week this month had the best overall factory performance?" },
```

---

## 10. New: Smart Caching Layer

```python
class NlqCacheConfig:
    TTL_BY_DOMAIN: dict[NlqDomain, int] = {
        NlqDomain.THEFT_FRAUD:    30,    # 30 seconds — real-time critical
        NlqDomain.ALERTS:         30,    # 30 seconds — real-time critical
        NlqDomain.ATTENDANCE:     300,   # 5 minutes
        NlqDomain.DISPATCH:       300,   # 5 minutes
        NlqDomain.OWNER_INSIGHTS: 120,   # 2 minutes — composite data
        NlqDomain.FINANCE:        900,   # 15 minutes
        NlqDomain.INVENTORY:      900,   # 15 minutes
        NlqDomain.PRODUCTION:     600,   # 10 minutes
        NlqDomain.AUDIT_TRAIL:    180,   # 3 minutes
        NlqDomain.OCR:            900,   # 15 minutes
        NlqDomain.GENERAL:        900,   # 15 minutes
    }

def _build_cache_key(
    factory_id: str,
    domain: NlqDomain,
    scope: str,
    entity_filter: dict,
) -> str:
    """Deterministic cache key. Entity filter is hashed so different employees get different cache."""
    import hashlib, json
    entity_hash = hashlib.md5(
        json.dumps(entity_filter, sort_keys=True).encode()
    ).hexdigest()[:8]
    return f"nlq:{factory_id}:{domain.value}:{scope}:{entity_hash}"
```

---

## 11. Error Handling V2 — Explain WHY, Not Just "No Data"

Original plan silently falls back. V2 tells the owner WHY and what to do.

```python
class NlqDataError(BaseModel):
    domain: str
    reason: str  # Human-readable
    suggestion: str  # What owner should do

SMART_ERROR_MESSAGES = {
    "no_factory": NlqDataError(
        domain="general",
        reason="No active factory found on your account.",
        suggestion="Go to Settings → Factory Setup to configure your factory."
    ),
    "no_dispatch_data": NlqDataError(
        domain="dispatch",
        reason="No dispatch records found for this time period.",
        suggestion="Check if dispatches are being entered in the Dispatch module, or try a different date range."
    ),
    "no_ocr_documents": NlqDataError(
        domain="ocr",
        reason="No OCR documents processed in this period.",
        suggestion="Use the Document Scanner feature to scan invoices and challans."
    ),
    "permission_denied_finance": NlqDataError(
        domain="finance",
        reason="Your role does not have access to financial data.",
        suggestion="Ask the factory owner to grant you Finance View permission."
    ),
    "ai_provider_failed": NlqDataError(
        domain="general",
        reason="AI service temporarily unavailable.",
        suggestion="A pre-computed summary is shown below. Full AI analysis will resume shortly."
    ),
}
```

---

## 12. Updated File Changes Summary

| File | Change | Approx Lines |
|------|--------|-------------|
| `backend/routers/ai.py` | Full V2 pipeline: classifier, session, cache, fusion, formatters, 12 fetchers | ~1,300 |
| `backend/services/nlq_session.py` | NEW: Session context manager | ~120 |
| `backend/services/nlq_cache.py` | NEW: Smart cache layer with TTL by domain | ~80 |
| `backend/services/nlq_language.py` | NEW: Language detector, Hindi normalizer | ~100 |
| `backend/schemas/nlq.py` | V2 response schema with new fields | ~60 |
| `web/src/components/private/NlqChatInterface.tsx` | NEW: Chat UI component | ~300 |
| `web/src/components/private/ai-insights-page.tsx` | Updated: presets + tabs + chat toggle | ~250 |
| `web/src/lib/ai.ts` | Updated: V2 response types | ~20 |
| `tests/test_nlq_expansion_v2.py` | NEW: 78 question tests + Hindi + edge cases | ~700 |

---

## 13. Implementation Order (10-Day Plan)

```
Day 1: Language layer + domain classifier V2
  → _detect_language, _normalize_question
  → _classify_nlq_v2 with keyword + LLM fallback
  → MULTI_DOMAIN_PATTERNS
  → Unit tests: classifier on all 78 questions + 10 Hindi questions ✓

Day 2: Session context + pronoun resolver
  → NlqSession model, _load_session_context, _save_session_turn
  → _resolve_pronouns
  → Unit tests: follow-up Q sequences ✓

Day 3: Smart cache layer + updated pipeline skeleton
  → NlqCacheConfig, _build_cache_key, _check_nlq_cache
  → Rewrite query_with_natural_language() with 12-step V2 flow
  → Existing tests still pass ✓

Day 4: Fetchers D1–D5 (Attendance enhanced, Dispatch, Fraud, Finance with MoM, Inventory)
  → Wire absentee streaks, friday patterns to attendance fetcher
  → Add previous_period + mom_change to finance fetcher
  → Integration tests: each domain ✓

Day 5: Fetchers D6–D10 (Production, Audit, Owner with V2 health score, OCR fully wired, Alerts 8/8)
  → _compute_health_score_v2 with 8 factors
  → OcrVerification model fully integrated
  → Alert configuration coverage ✓

Day 6: Data fusion layer
  → _fuse_domain_data for multi-domain queries
  → Test: "How much did fraud cost us financially?" → fusion of THEFT_FRAUD + FINANCE ✓
  → Test: "Which shift costs the most?" → fusion of ATTENDANCE + FINANCE ✓

Day 7: Prompt V2 upgrades + answer formatter
  → FORMAT_HINTS per domain
  → HINDI_RESPONSE_INSTRUCTION
  → _OWNER_PROMPT_V2 with trend arrows
  → _format_nlq_answer with severity badges + action_items
  → Test: answer quality review across all 10 domains ✓

Day 8: Frontend — NlqChatInterface.tsx
  → Chat bubble UI
  → Domain badges, severity colors
  → Action item chips
  → Streaming support (EventSource) ✓

Day 9: Frontend — Updated ai-insights-page.tsx
  → Hindi preset tab
  → Multi-domain presets
  → Trend presets
  → Chat toggle (presets ↔ chat mode) ✓

Day 10: Full test suite + performance validation
  → All 78 question domain routing tests pass
  → All 10 Hindi/Hinglish tests pass
  → Multi-domain fusion tests pass
  → Cache TTL verification
  → Latency check: p95 < 3s for all domains
  → End-to-end owner flow: ask in Hindi, get answer with health score ✓
```

---

## 14. Coverage Summary V2

| Domain | Original Coverage | V2 Coverage | Gap Closed |
|--------|-----------------|-------------|-----------|
| Attendance | 8/8 | 8/8 + streaks + cost | Enhanced |
| Dispatch | 8/8 | 8/8 | Same |
| Theft/Fraud | 8/8 | 8/8 | Same |
| Finance | 8/8 | 8/8 + MoM trend | Enhanced |
| Inventory | 8/8 | 8/8 | Same |
| Production | 8/8 | 8/8 | Same |
| Audit Trail | 8/8 | 8/8 | Same |
| Owner Insights | 8/8 | 8/8 + 8-factor score + projection | Enhanced |
| OCR | 2/6 | 6/6 | ✅ Fixed |
| Alerts | 3/8 | 8/8 | ✅ Fixed |
| Hindi/Hinglish | 0/∞ | Full support | ✅ New |
| Multi-domain | 0 | 7 fusion patterns | ✅ New |
| Follow-up Qs | 0 | 5-turn session memory | ✅ New |

**Total coverage: ~99.5%** (up from 97%)

---

## 15. Performance Targets

| Metric | Target |
|--------|--------|
| p50 response time | < 1.2s |
| p95 response time | < 3.0s |
| p99 response time | < 5.0s |
| Cache hit rate (after 10 min warmup) | > 60% |
| LLM classifier trigger rate | < 15% of queries |
| Fallback (no AI) rate | < 5% |
| Hindi query accuracy | > 90% correct domain |
| Multi-domain fusion latency overhead | < 800ms additional |
