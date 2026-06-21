"""Prompt sanitization to prevent prompt injection attacks.

Strips or neutralises common prompt-injection patterns from user-provided
strings before they are interpolated into AI system prompts.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Patterns that indicate a prompt-injection attempt
_INJECTION_PATTERNS: list[re.Pattern] = [
    # System-prompt override attempts
    re.compile(r"(?i)\b(ignore|override|bypass|disregard)\s+(all\s+)?(previous|above|prior|system|instructions|directives)\b"),
    re.compile(r"(?i)\bnew\s+(system\s+)?(prompt|instructions|directive)\b"),
    re.compile(r"(?i)\b(act\s+as|pretend\s+(to\s+)?be|you\s+are\s+now)\b"),
    # Role-playing / jailbreak patterns
    re.compile(r"(?i)\b(dan|do\s+anything\s+now|jailbreak|freedom)\b"),
    # Output format manipulation
    re.compile(r"(?i)\boutput\s+(only|just|exclusively)\s+(json|raw|without)\b"),
    re.compile(r"(?i)\bdon'?t\s+(output|include|show|display|add)\b"),
    re.compile(r"(?i)\b(repeat|say|echo|print)\s+(the\s+)?(word|following|above|below)\b"),
    # Extraction of system prompt
    re.compile(r"(?i)\b(show|reveal|display|tell\s+me)\s+(your|the)\s+(system\s+)?prompt\b"),
    re.compile(r"(?i)\b(what\s+(is|are)\s+(your|the)\s+(system\s+)?(instructions|prompt|rules))\b"),
    # Injection via encoded / obfuscated text
    re.compile(r"(?i)\b(base64|hex|rot13|binary|encode|decode)\s*(the\s+)?(following|above|below)\b"),
]


def sanitize_prompt_input(text: str | None, *, max_length: int = 2000) -> str | None:
    """Sanitise a user-supplied string that will be interpolated into an AI prompt.

    Strips content that matches known prompt-injection patterns and truncates
    to *max_length* characters.  Returns ``None`` when the input is empty or
    only contains whitespace after sanitisation.

    The sanitisation is **defence-in-depth** — it is *not* a replacement for
    proper input validation and output verification.
    """
    if not text:
        return None

    raw = str(text).strip()
    if not raw:
        return None

    original = raw

    # Strip injection patterns
    for pattern in _INJECTION_PATTERNS:
        raw = pattern.sub("", raw)

    # Collapse repeated whitespace
    raw = re.sub(r"\s+", " ", raw).strip()

    # Truncate to max_length
    if len(raw) > max_length:
        raw = raw[:max_length]

    if raw != original:
        logger.info("[prompt-sanitizer] Stripped injection patterns from caller input (len %d -> %d)", len(original), len(raw))

    return raw or None
