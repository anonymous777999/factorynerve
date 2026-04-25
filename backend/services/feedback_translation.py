"""Detection and optional translation helpers for feedback intake."""

from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import re
from typing import Any

import requests

from backend.utils import sanitize_text


logger = logging.getLogger(__name__)
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
_LATIN_RE = re.compile(r"[A-Za-z]")


@dataclass
class FeedbackTranslationResult:
    detected_language: str
    translated_text: str | None
    translation_status: str


def detect_feedback_language(text: str, *, hinted_language: str | None = None) -> str:
    cleaned = sanitize_text(text, max_length=4000) or ""
    hint = (sanitize_text(hinted_language, max_length=24, preserve_newlines=False) or "").lower()
    if _DEVANAGARI_RE.search(cleaned):
        return "hi"
    if _LATIN_RE.search(cleaned):
        return "en"
    return hint or "und"


def _translation_target(source_language: str) -> str | None:
    if source_language == "hi":
        return "en"
    if source_language == "en":
        return "hi"
    return None


def _translate_with_provider(
    *,
    text: str,
    source_language: str,
    target_language: str,
) -> str | None:
    provider = (os.getenv("FEEDBACK_TRANSLATION_PROVIDER") or "").strip().lower()
    api_url = (os.getenv("FEEDBACK_TRANSLATION_API_URL") or "").strip()
    api_key = (os.getenv("FEEDBACK_TRANSLATION_API_KEY") or "").strip()
    timeout_seconds = float(os.getenv("FEEDBACK_TRANSLATION_TIMEOUT_SECONDS", "4"))

    if not provider or not api_url:
        return None

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload: dict[str, Any]
    if provider == "libretranslate":
        payload = {
            "q": text,
            "source": source_language,
            "target": target_language,
            "format": "text",
        }
        if api_key:
            payload["api_key"] = api_key
    else:
        payload = {
            "text": text,
            "source_language": source_language,
            "target_language": target_language,
        }

    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=timeout_seconds)
        response.raise_for_status()
        data = response.json() if response.content else {}
        if provider == "libretranslate":
            translated = data.get("translatedText")
        else:
            translated = (
                data.get("translated_text")
                or data.get("translation")
                or data.get("translatedText")
            )
        cleaned = sanitize_text(str(translated) if translated is not None else None, max_length=4000)
        return cleaned if cleaned and cleaned != text else None
    except Exception:  # pylint: disable=broad-except
        logger.exception("Feedback translation failed.")
        return None


def enrich_feedback_message(
    *,
    message_original: str,
    detected_language: str | None = None,
    translated_text: str | None = None,
    translation_status: str | None = None,
) -> FeedbackTranslationResult:
    cleaned_original = sanitize_text(message_original, max_length=4000) or ""
    source_language = detect_feedback_language(cleaned_original, hinted_language=detected_language)
    cleaned_translated = sanitize_text(translated_text, max_length=4000)
    normalized_status = (
        sanitize_text(translation_status or "", max_length=24, preserve_newlines=False) or ""
    ).lower()

    if cleaned_translated:
        return FeedbackTranslationResult(
            detected_language=source_language,
            translated_text=cleaned_translated,
            translation_status=normalized_status or "provided",
        )

    target_language = _translation_target(source_language)
    if not target_language:
        return FeedbackTranslationResult(
            detected_language=source_language,
            translated_text=None,
            translation_status=normalized_status or "not_needed",
        )

    translated = _translate_with_provider(
        text=cleaned_original,
        source_language=source_language,
        target_language=target_language,
    )
    if translated:
        return FeedbackTranslationResult(
            detected_language=source_language,
            translated_text=translated,
            translation_status="translated",
        )

    return FeedbackTranslationResult(
        detected_language=source_language,
        translated_text=None,
        translation_status="pending" if source_language in {"en", "hi"} else (normalized_status or "not_needed"),
    )
