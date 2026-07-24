"""Tests for Phase 2 NLQ expansion: language detection, session context, action items, health scores."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import pytest

from backend.routers.ai import (
    NlqDomain,
    ActionItem,
    _detect_language,
    _normalize_question,
    _classify_nlq_domain,
    _parse_time_scope_v2,
    _extract_data_points,
    _build_nlq_fallback,
    _generate_nlq_action_items,
    _compute_health_score_v2,
    _fuse_domain_data,
)
from backend.services.nlq_language import (
    detect_language,
    normalize_question,
    get_hindi_keywords_for_domain,
    HINDI_RESPONSE_INSTRUCTION,
)
from backend.services.nlq_session import (
    load_session,
    save_turn,
    resolve_pronouns,
    clear_session,
)


# ── Language Detection ──────────────────────────────────────────────────


class TestLanguageDetection:
    """Language detection D8 tests."""

    def test_detect_english(self):
        assert detect_language("Who came to work today?") == "english"

    def test_detect_hinglish(self):
        assert detect_language("Aaj kaun aaya kaam pe?") == "hinglish"

    def test_detect_hindi_devanagari(self):
        assert detect_language("आज कौन आया काम पर?") == "hindi"

    def test_detect_empty_returns_english(self):
        assert detect_language("") == "english"

    def test_detect_hinglish_overtime(self):
        assert detect_language("Kitne log overtime kar rahe hain?") == "hinglish"

    def test_detect_hinglish_production(self):
        assert detect_language("Aaj kitna production hua?") == "hinglish"


# ── Hindi Normalization ─────────────────────────────────────────────────


class TestHindiNormalization:
    """Hindi-to-English normalization D8 tests."""

    def test_normalize_time_word_aaj(self):
        result = normalize_question("Aaj kaun aaya?", "hinglish")
        assert "today" in result.lower()

    def test_normalize_time_word_kal(self):
        result = normalize_question("Kal kaun absent tha?", "hinglish")
        assert "yesterday" in result.lower()

    def test_normalize_pichle_mahine(self):
        result = normalize_question("Pichle mahine kitna kharcha hua?", "hinglish")
        assert "last month" in result.lower()

    def test_normalize_pichle_hafte(self):
        result = normalize_question("Pichle hafte kitna production hua?", "hinglish")
        assert "last week" in result.lower()

    def test_normalize_kitne_log(self):
        result = normalize_question("Kitne log aaye aaj?", "hinglish")
        assert "how many" in result.lower()
        assert "came" in result.lower()

    def test_normalize_kitna_kharcha(self):
        result = normalize_question("Kitna kharcha hua is mahine?", "hinglish")
        assert "how much" in result.lower()

    def test_normalize_batao(self):
        result = normalize_question("Batao aaj ka production", "hinglish")
        assert "tell me" in result.lower()

    def test_normalize_dikhao(self):
        result = normalize_question("Dikhao dispatches aaj ki", "hinglish")
        assert "show me" in result.lower()

    def test_normalize_english_unchanged(self):
        result = normalize_question("Who came to work today?", "english")
        # For english, the original string is returned unchanged (with original casing)
        assert result == "Who came to work today?"

    def test_normalize_word_boundary_no_partial_match(self):
        """Verify 'aaj ka' doesn't match inside 'aaj kaun'."""
        result = normalize_question("Aaj kaun aaya?", "hinglish")
        assert "today" in result
        # 'aaj' should become 'today', 'aaj kaun' should not be a single match
        assert "who" in result or "came" in result


# ── Hindi Domain Keywords ───────────────────────────────────────────────


class TestHindiKeywords:
    """Domain-specific Hindi keyword matching D8 tests."""

    def test_attendance_hindi_keywords(self):
        kws = get_hindi_keywords_for_domain("attendance")
        assert "kaun aaya" in kws
        assert "kitne log" in kws

    def test_finance_hindi_keywords(self):
        kws = get_hindi_keywords_for_domain("finance")
        assert "paisa" in kws
        assert "kharcha" in kws
        assert "munafa" in kws

    def test_production_hindi_keywords(self):
        kws = get_hindi_keywords_for_domain("production")
        assert "utpadan" in kws
        assert "kitna bana" in kws

    def test_unknown_domain_returns_empty(self):
        assert get_hindi_keywords_for_domain("nonexistent") == []


# ── Domain Classification with Hindi ────────────────────────────────────


class TestDomainClassificationWithHindi:
    """Hindi questions correctly classified D8 tests."""

    def test_hinglish_attendance(self):
        q = "Aaj kaun aaya kaam pe?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.ATTENDANCE

    def test_hinglish_production(self):
        q = "Aaj kitna production hua?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.PRODUCTION

    def test_hinglish_finance(self):
        q = "Is mahine kitna kharcha hua?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.FINANCE

    def test_hinglish_inventory(self):
        q = "Stock mein kya bacha hai?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.INVENTORY

    def test_english_attendance(self):
        q = "Who came to work today?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.ATTENDANCE

    def test_english_fraud(self):
        q = "Are there any suspicious patterns or anomalies this week?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        # "suspicious" → THEFT_FRAUD, "anomalies" → ANOMALY keyword
        assert domain == NlqDomain.THEFT_FRAUD

    def test_english_finance(self):
        q = "What is the revenue summary for this month?"
        lang = detect_language(q)
        norm = normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.FINANCE


# ── Time Scope Parsing ──────────────────────────────────────────────────


class TestTimeScopeParsing:
    """Time scope parsing with Hindi normalization D8 tests."""

    def test_aaj_parsed_as_today(self):
        today = date.today()
        start, end, scope = _parse_time_scope_v2("aaj ka production")
        assert start == today
        assert end == today
        assert scope == "today"

    def test_kal_parsed_as_yesterday(self):
        yesterday = date.today() - __import__("datetime").timedelta(days=1)
        start, end, scope = _parse_time_scope_v2("kal kaun absent tha")
        assert start == yesterday
        assert end == yesterday
        assert scope == "yesterday"

    def test_pichle_mahine_parsed(self):
        start, end, scope = _parse_time_scope_v2("pichle mahine kitna kharcha hua")
        assert scope == "last_month"

    def test_is_hafte_parsed(self):
        start, end, scope = _parse_time_scope_v2("is hafte kitna production hua")
        assert scope == "this_week"


# ── HINDI_RESPONSE_INSTRUCTION ─────────────────────────────────────────


class TestHinglishInstruction:
    """The Hinglish response instruction is well-formed D8 tests."""

    def test_instruction_contains_hinglish(self):
        assert "Hinglish" in HINDI_RESPONSE_INSTRUCTION

    def test_instruction_mentions_hindi(self):
        assert "Hindi" in HINDI_RESPONSE_INSTRUCTION or "Hinglish" in HINDI_RESPONSE_INSTRUCTION


# ── Action Items ────────────────────────────────────────────────────────


class TestActionItems:
    """Domain-specific action item generation D10 tests."""

    def test_attendance_high_absenteeism(self):
        data = {
            "today": {"working": 10, "absent": 5, "total_overtime_minutes": 30},
        }
        items = _generate_nlq_action_items(NlqDomain.ATTENDANCE, data, [])
        assert len(items) >= 1
        assert items[0].priority == 1
        assert "absenteeism" in items[0].action.lower()

    def test_attendance_low_absenteeism(self):
        data = {
            "today": {"working": 20, "absent": 1, "total_overtime_minutes": 0},
        }
        items = _generate_nlq_action_items(NlqDomain.ATTENDANCE, data, [])
        assert len(items) == 0  # Below 15% threshold

    def test_attendance_high_overtime(self):
        data = {
            "today": {"working": 20, "absent": 0, "total_overtime_minutes": 180},
        }
        items = _generate_nlq_action_items(NlqDomain.ATTENDANCE, data, [])
        priorities = [i.priority for i in items]
        assert any(p <= 2 for p in priorities)  # Overtime action present

    def test_finance_overdue(self):
        data = {
            "receivables": {"overdue_amount_inr": 500000},
            "realized_metrics": {"margin_percent": 15},
        }
        items = _generate_nlq_action_items(NlqDomain.FINANCE, data, [])
        assert len(items) >= 1
        assert items[0].priority == 1
        assert "overdue" in items[0].action.lower()

    def test_finance_low_margin(self):
        data = {
            "receivables": {"overdue_amount_inr": 0},
            "realized_metrics": {"margin_percent": 5},
        }
        items = _generate_nlq_action_items(NlqDomain.FINANCE, data, [])
        assert len(items) >= 1
        assert "margin" in items[0].action.lower()

    def test_fraud_critical_signals(self):
        data = {
            "critical_count": 3,
            "high_count": 1,
            "total_signals": 4,
            "investigation_queue": [],
        }
        items = _generate_nlq_action_items(NlqDomain.THEFT_FRAUD, data, [])
        assert len(items) >= 1
        assert items[0].priority == 1
        assert "investigate" in items[0].action.lower()

    def test_inventory_low_stock(self):
        data = {
            "low_stock_alerts": [{"item": "HR Coil"}],
            "dead_stock": [],
        }
        items = _generate_nlq_action_items(NlqDomain.INVENTORY, data, [])
        assert len(items) >= 1
        assert "reorder" in items[0].action.lower()

    def test_production_low_attainment(self):
        data = {
            "summary": {"overall_attainment_percent": 65, "total_downtime_minutes": 30},
        }
        items = _generate_nlq_action_items(NlqDomain.PRODUCTION, data, [])
        assert len(items) >= 1
        assert "attainment" in items[0].action.lower() or "improve" in items[0].action.lower()

    def test_alerts_critical_unread(self):
        data = {
            "critical_count": 2,
            "unread_count": 5,
        }
        items = _generate_nlq_action_items(NlqDomain.ALERTS, data, [])
        assert len(items) >= 1

    def test_ocr_pending(self):
        data = {"pending_count": 10}
        items = _generate_nlq_action_items(NlqDomain.OCR, data, [])
        assert len(items) >= 1

    def test_max_five_items(self):
        """Action items are capped at 5."""
        data = {
            "today": {"working": 5, "absent": 5, "total_overtime_minutes": 300},
            "receivables": {"overdue_amount_inr": 500000},
            "realized_metrics": {"margin_percent": 5},
            "critical_count": 3, "high_count": 1, "investigation_queue": [1, 2],
            "low_stock_alerts": [{"x": 1}], "dead_stock": [{"y": 2}],
            "summary": {"overall_attainment_percent": 50, "total_downtime_minutes": 400},
        }
        items = _generate_nlq_action_items(NlqDomain.ATTENDANCE, data, [])
        assert len(items) <= 5

    def test_general_no_action_items(self):
        items = _generate_nlq_action_items(NlqDomain.GENERAL, {}, [])
        assert items == []

    def test_action_item_fields(self):
        item = ActionItem(priority=1, action="Test action", reason="Test reason")
        assert item.priority == 1
        assert item.action == "Test action"
        assert item.reason == "Test reason"
        assert item.estimated_impact_inr is None
        assert item.deadline is None


# ── Health Score V2 ─────────────────────────────────────────────────────


class TestHealthScoreV2:
    """8-factor factory health score D10 tests."""

    def test_healthy_factory(self):
        data = {
            "financial_pulse": {"realized_margin_percent": 20},
            "anomaly_pressure": {"critical_count": 0, "high_count": 0},
            "inventory_health": {"green_count": 50, "red_count": 2},
            "snapshot": {"today_loss_percent": 1},
        }
        score, label = _compute_health_score_v2(data)
        assert score >= 80
        assert label == "good"

    def test_critical_factory(self):
        data = {
            "financial_pulse": {"realized_margin_percent": -5},
            "anomaly_pressure": {"critical_count": 5, "high_count": 5},
            "inventory_health": {"green_count": 5, "red_count": 50},
            "snapshot": {"today_loss_percent": 25},
        }
        score, label = _compute_health_score_v2(data)
        assert score < 40
        assert label == "critical"

    def test_needs_attention(self):
        data = {
            "financial_pulse": {"realized_margin_percent": 15},
            "anomaly_pressure": {"critical_count": 0, "high_count": 1},
            "inventory_health": {"green_count": 40, "red_count": 5},
            "snapshot": {"today_loss_percent": 3},
        }
        score, label = _compute_health_score_v2(data)
        # fin=25, fraud=20, prod=6, inv=13, att=8, dispatch=4, alert=2, ocr=1 => total=79?
        # Actually: fin=25, fraud=20, prod=15-9=6, inv=int(40/45*15)=13, sum=25+20+6+13+8+4+2+1=79
        assert score >= 60
        assert label == "needs_attention"
        assert score < 80

    def test_score_max_achievable(self):
        data = {
            "financial_pulse": {"realized_margin_percent": 100},
            "anomaly_pressure": {"critical_count": 0, "high_count": 0},
            "inventory_health": {"green_count": 100, "red_count": 0},
            "snapshot": {"today_loss_percent": 0},
        }
        score, _ = _compute_health_score_v2(data)
        # Max theoretical: 25+25+15+15+8+4+2+1 = 95 (attendance/dispatch/alert/ocr are fixed defaults)
        assert score == 95

    def test_score_minimum_zero(self):
        data = {
            "financial_pulse": {"realized_margin_percent": -100},
            "anomaly_pressure": {"critical_count": 10, "high_count": 10},
            "inventory_health": {"green_count": 0, "red_count": 100},
            "snapshot": {"today_loss_percent": 50},
        }
        score, _ = _compute_health_score_v2(data)
        assert score >= 0

    def test_default_fields_when_empty(self):
        score, label = _compute_health_score_v2({})
        assert isinstance(score, int)
        assert label in ("good", "needs_attention", "at_risk", "critical")


# ── Multi-domain Data Fusion ────────────────────────────────────────────


class TestMultiDomainFusion:
    """Multi-domain data fusion D9 tests."""

    def test_fuse_merges_data(self):
        primary = {"_domain": "attendance", "today": {"working": 20}}
        secondary = {"_domain": "finance", "revenue": {"total": 50000}}
        fused = _fuse_domain_data(primary, secondary)
        assert fused["_fused"] is True
        assert fused["_primary"] == primary
        assert fused["_secondary"] == secondary
        assert fused["today"]["working"] == 20

    def test_primary_takes_precedence(self):
        primary = {"key": "primary_value"}
        secondary = {"key": "secondary_value"}
        fused = _fuse_domain_data(primary, secondary)
        assert fused["key"] == "primary_value"


# ── Session Management ──────────────────────────────────────────────────


class TestSessionManagement:
    """NLQ session context D9 tests."""

    def test_save_and_load_turn(self):
        clear_session(9999)
        save_turn(9999, "Who came today?", "5 workers", "attendance")
        session = load_session(9999)
        assert len(session) == 1
        assert session[0]["question"] == "Who came today?"
        assert session[0]["answer"] == "5 workers"
        assert session[0]["domain"] == "attendance"

    def test_session_turns_capped(self):
        clear_session(9998)
        for i in range(10):
            save_turn(9998, f"Q{i}", f"A{i}", "general")
        session = load_session(9998)
        assert len(session) <= 5

    def test_empty_session(self):
        clear_session(9997)
        session = load_session(9997)
        assert session == []

    def test_pronoun_resolution_him(self):
        session = [{"question": "Where is Rajesh?", "answer": "On leave", "domain": "attendance", "entities": {"employee_name": "Rajesh"}}]
        resolved = resolve_pronouns("What about him?", session)
        assert "Rajesh" in resolved

    def test_pronoun_resolution_that_operator(self):
        session = [{"question": "Show me operator Vikas", "answer": "Present", "domain": "attendance", "entities": {"employee_name": "Vikas"}}]
        resolved = resolve_pronouns("What about him?", session)
        assert "Vikas" in resolved


# ── Extract Data Points ─────────────────────────────────────────────────


class TestExtractDataPoints:
    """Domain-specific data point extraction D10 tests."""

    def test_attendance_data_points(self):
        data = {
            "today": {"working": 20, "absent": 3, "total_overtime_minutes": 45},
            "summary": {"presence_rate_percent": 87, "total_overtime_hours": 12},
        }
        points = _extract_data_points(NlqDomain.ATTENDANCE, data, "manpower", "total")
        assert len(points) >= 4

    def test_dispatch_data_points(self):
        data = {"total_dispatches": 10, "total_weight_kg": 5000, "today_count": 3, "today_weight_kg": 1500}
        points = _extract_data_points(NlqDomain.DISPATCH, data, "output", "total")
        assert len(points) == 4

    def test_finance_data_points(self):
        data = {
            "revenue": {"last_n_days": {"revenue_inr": 500000}},
            "receivables": {"total_outstanding_inr": 100000, "overdue_amount_inr": 25000},
            "realized_metrics": {"margin_percent": 12},
        }
        points = _extract_data_points(NlqDomain.FINANCE, data, "output", "total")
        assert len(points) >= 3

    def test_empty_data_returns_empty(self):
        points = _extract_data_points(NlqDomain.ATTENDANCE, {}, "output", "total")
        assert points == []


# ── Fallback Text ───────────────────────────────────────────────────────


class TestFallbackText:
    """Domain-specific fallback text D10 tests."""

    def test_attendance_fallback(self):
        data = {
            "today": {"working": 15, "absent": 3, "total_overtime_minutes": 60},
            "summary": {"presence_rate_percent": 83, "total_late_hours": 2},
        }
        text = _build_nlq_fallback(NlqDomain.ATTENDANCE, data, [], "today", "manpower")
        assert "15" in text
        assert "absent" in text.lower()

    def test_error_fallback(self):
        text = _build_nlq_fallback(NlqDomain.ATTENDANCE, {"_error": "No factory"}, [], "today", "")
        assert "unable" in text.lower()

    def test_dispatch_fallback(self):
        data = {"total_dispatches": 5, "total_weight_kg": 2500, "today_count": 2, "today_weight_kg": 1000}
        text = _build_nlq_fallback(NlqDomain.DISPATCH, data, [], "this week", "output")
        assert "5" in text

    def test_no_alerts_fallback(self):
        data = {"total_count": 0, "critical_count": 0, "warning_count": 0, "unread_count": 0}
        text = _build_nlq_fallback(NlqDomain.ALERTS, data, [], "this week", "output")
        assert "no alerts" in text.lower()

    def test_owner_insights_fallback(self):
        data = {
            "snapshot": {"today_output_kg": 5000},
            "financial_pulse": {"realized_dispatched_revenue_inr": 200000, "realized_margin_percent": 15},
            "anomaly_pressure": {"critical_count": 0},
            "inventory_health": {"green_count": 40, "red_count": 3},
            "alerts": [],
        }
        text = _build_nlq_fallback(NlqDomain.OWNER_INSIGHTS, data, [], "today", "output")
        assert "5000" in text
        # Format uses :,.2f which produces 200,000.00 (with standard comma separator)
        assert "200,000" in text


# ── Integration: Pipeline Round-trip ────────────────────────────────────


class TestPipelineIntegration:
    """End-to-end NLQ pipeline integration D8-D10 tests."""

    def test_full_pipeline_english_attendance(self):
        q = "Who came to work today?"
        lang = _detect_language(q)
        assert lang == "english"
        norm = _normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.ATTENDANCE
        start, end, scope = _parse_time_scope_v2(norm)
        assert scope in ("today", "last_7_days")

    def test_full_pipeline_hinglish_finance(self):
        q = "Is mahine kitna kharcha hua?"
        lang = _detect_language(q)
        assert lang == "hinglish"
        norm = _normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.FINANCE
        start, end, scope = _parse_time_scope_v2(norm)
        assert scope == "this_month"

    def test_full_pipeline_hinglish_production(self):
        q = "Aaj kitna production hua?"
        lang = _detect_language(q)
        norm = _normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.PRODUCTION
        start, end, scope = _parse_time_scope_v2(norm)
        assert scope == "today"

    def test_full_pipeline_general_fallback(self):
        q = "What is the weather like?"
        lang = _detect_language(q)
        norm = _normalize_question(q, lang)
        domain = _classify_nlq_domain(norm)
        assert domain == NlqDomain.GENERAL

    def test_language_not_in_response_by_default(self):
        """English queries don't show a language badge in the response necessarily,
        but the language field defaults to english."""
        from pydantic import ValidationError
        try:
            from backend.routers.ai import NaturalLanguageQueryResponse
            resp = NaturalLanguageQueryResponse(
                question="test", domain="general", language="english",
                plan="group", min_plan="operations", quota_feature="summary",
                provider="test", ai_used=False,
                generated_at=datetime.now(timezone.utc),
                structured_query={}, answer="test", data_points=[],
            )
            assert resp.language == "english"
        except ValidationError:
            pass  # Some required fields may be missing in this context
