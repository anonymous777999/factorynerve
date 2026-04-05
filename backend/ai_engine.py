"""AI helper functions for summary generation and smart input parsing."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import date
from typing import Any

from backend.utils import get_config
from backend.services import ai_router


logger = logging.getLogger(__name__)
config = get_config()


def _retry_attempts() -> int:
    return max(1, int(os.getenv("AI_PROVIDER_RETRY_ATTEMPTS", "2")))


def _retry_backoff_seconds() -> float:
    return float(os.getenv("AI_PROVIDER_RETRY_BACKOFF_SECONDS", "1"))


def _call_with_retry(fn, *, provider: str) -> str:
    attempts = _retry_attempts()
    backoff = _retry_backoff_seconds()
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            if attempt < attempts:
                time.sleep(backoff * attempt)
            else:
                raise
    if last_error:
        raise last_error
    raise RuntimeError(f"{provider} provider failed unexpectedly.")


def _normalize_provider(provider: str | None) -> str:
    key = (provider or "").strip().lower()
    if key in {"claude", "anthropic"}:
        return "anthropic"
    if key in {"google", "gemini"}:
        return "gemini"
    if key == "groq":
        return "groq"
    return ""


def _provider_chain(primary: str | None) -> list[str]:
    chain_env = os.getenv("AI_PROVIDER_CHAIN")
    if chain_env:
        raw = [item.strip() for item in chain_env.split(",")]
        seen: set[str] = set()
        chain: list[str] = []
        for item in raw:
            normalized = _normalize_provider(item)
            if normalized and normalized not in seen:
                chain.append(normalized)
                seen.add(normalized)
        if chain:
            return chain
    first = _normalize_provider(primary) or "groq"
    chain = [first]
    if first != "groq":
        chain.append("groq")
    return chain


def _has_provider_key(provider: str) -> bool:
    if provider == "groq":
        return bool((config.groq_api_key or "").strip())
    if provider == "anthropic":
        return bool((config.anthropic_api_key or "").strip())
    if provider == "gemini":
        return bool((config.gemini_api_key or "").strip())
    return False


def has_any_ai_key() -> bool:
    return ai_router.has_any_key()


def _call_groq(prompt: str, *, temperature: float, max_tokens: int | None = None) -> str:
    import groq  # type: ignore

    client = groq.Groq(api_key=config.groq_api_key)
    resp = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


def _call_anthropic(prompt: str, *, max_tokens: int) -> str:
    import anthropic  # type: ignore

    client = anthropic.Anthropic(api_key=config.anthropic_api_key)
    resp = client.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text.strip()


def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai  # type: ignore

    genai.configure(api_key=config.gemini_api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content(prompt)
    return str(resp.text).strip()


def build_summary_prompt(payload: dict[str, Any]) -> str:
    return ai_router.build_summary_prompt(payload)


def build_email_prompt(summary: dict[str, Any]) -> str:
    return ai_router.build_email_prompt(summary)


def estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / 4))


def _normalize_extracted_fields(raw: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "date",
        "shift",
        "units_target",
        "units_produced",
        "manpower_present",
        "manpower_absent",
        "downtime_minutes",
        "downtime_reason",
        "materials_used",
        "quality_issues",
        "quality_details",
        "notes",
    }
    result: dict[str, Any] = {}
    for key in allowed_keys:
        if key not in raw:
            continue
        value = raw.get(key)
        if key in {"units_target", "units_produced", "manpower_present", "manpower_absent", "downtime_minutes"}:
            try:
                if value is None or value == "":
                    continue
                result[key] = int(float(value))
            except Exception:
                continue
        elif key == "quality_issues":
            if isinstance(value, bool):
                result[key] = value
            elif isinstance(value, str):
                result[key] = value.strip().lower() in {"true", "yes", "1"}
        elif key == "shift":
            if isinstance(value, str):
                shift_val = value.strip().lower()
                if shift_val in {"morning", "evening", "night"}:
                    result[key] = shift_val
        elif key == "date":
            if isinstance(value, str) and value.strip():
                result[key] = value.strip()
        else:
            if value is not None:
                result[key] = str(value)
    return result


def _confidence_from_fields(extracted: dict[str, Any]) -> tuple[float, list[str]]:
    weights = {
        "shift": 0.15,
        "units_target": 0.2,
        "units_produced": 0.2,
        "manpower_present": 0.15,
        "manpower_absent": 0.1,
        "downtime_minutes": 0.1,
        "notes": 0.1,
    }
    score = 0.0
    missing: list[str] = []
    for key, weight in weights.items():
        if extracted.get(key) not in (None, "", 0):
            score += weight
        else:
            missing.append(key)
    score = min(1.0, score)
    return score, missing


def compute_confidence(extracted: dict[str, Any]) -> tuple[float, list[str]]:
    return _confidence_from_fields(extracted)


def _extract_json_blob(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    blob = text[start : end + 1]
    try:
        return json.loads(blob)
    except Exception:
        return None


def generate_entry_summary(payload: dict[str, Any], *, scope: str | None = None) -> str:
    """Generate AI summary using router with multi-provider fallback."""
    return ai_router.generate_summary(payload, scope=scope)


def generate_email_summary(summary: dict[str, Any], *, scope: str | None = None) -> str:
    """Generate a professional email body from summary data."""
    return ai_router.generate_email(summary, scope=scope)


def _regex_parse_input(text: str) -> dict[str, Any]:
    """Very lightweight parser for smart input text."""
    cleaned = text.lower()
    result: dict[str, Any] = {
        "date": date.today().isoformat(),
        "shift": None,
        "units_target": None,
        "units_produced": None,
        "manpower_present": None,
        "manpower_absent": None,
        "downtime_minutes": None,
        "downtime_reason": "",
        "materials_used": "",
        "quality_issues": False,
        "quality_details": "",
        "notes": text[:2000],
    }

    if "evening" in cleaned:
        result["shift"] = "evening"
    if "night" in cleaned:
        result["shift"] = "night"
    if result["shift"] is None and "morning" in cleaned:
        result["shift"] = "morning"

    def _find_number(pattern: str) -> int | None:
        match = re.search(pattern, cleaned)
        if match:
            try:
                return int(match.group(1))
            except Exception:
                return None
        return None

    target = _find_number(r"target\s*[:=]?\s*(\d+)")
    produced = _find_number(r"(produced|production)\s*[:=]?\s*(\d+)")
    present = _find_number(r"present\s*[:=]?\s*(\d+)")
    absent = _find_number(r"absent\s*[:=]?\s*(\d+)")
    downtime = _find_number(r"downtime\s*[:=]?\s*(\d+)")
    if target:
        result["units_target"] = target
    if produced:
        result["units_produced"] = produced
    if present:
        result["manpower_present"] = present
    if absent is not None:
        result["manpower_absent"] = absent
    if downtime:
        result["downtime_minutes"] = downtime
    if "quality" in cleaned and ("issue" in cleaned or "problem" in cleaned):
        result["quality_issues"] = True
    return result


def parse_unstructured_input_with_confidence(text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    extracted = _regex_parse_input(text)
    confidence, missing_fields = _confidence_from_fields(extracted)
    return extracted, {"confidence": confidence, "missing_fields": missing_fields}


def parse_unstructured_input_ai(text: str) -> tuple[dict[str, Any] | None, str | None]:
    if not _normalize_provider(config.ai_provider):
        return None, "AI provider not configured."
    prompt = (
        "Extract DPR fields from the text. Return ONLY valid JSON with keys: "
        "date (YYYY-MM-DD), shift (morning/evening/night), units_target, units_produced, "
        "manpower_present, manpower_absent, downtime_minutes, downtime_reason, materials_used, "
        "quality_issues (true/false), quality_details, notes.\n\n"
        f"Text:\n{text}"
    )
    content = ""
    last_error = ""
    failures: list[str] = []
    for provider in _provider_chain(config.ai_provider):
        if not _has_provider_key(provider):
            continue
        try:
            if provider == "groq":
                content = _call_groq(prompt, temperature=0.1, max_tokens=420)
            elif provider == "anthropic":
                content = _call_anthropic(prompt, max_tokens=400)
            elif provider == "gemini":
                content = _call_gemini(prompt)
            else:
                continue
            if failures:
                logger.info("Smart input fallback succeeded with %s after %s", provider, failures)
            break
        except Exception as error:  # pylint: disable=broad-except
            logger.warning("Smart input AI failed (%s): %s", provider, error)
            last_error = str(error)[:200]
            content = ""
            failures.append(provider)

    if not content:
        return None, last_error or "AI provider error."

    raw_json = _extract_json_blob(content) or {}
    if not isinstance(raw_json, dict):
        return None, "AI response was not valid JSON."
    return _normalize_extracted_fields(raw_json), None


def parse_unstructured_input(text: str) -> dict[str, Any]:
    """Backward compatible parser (regex only)."""
    extracted, _meta = parse_unstructured_input_with_confidence(text)
    return extracted
