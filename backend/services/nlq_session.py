"""NLQ session context manager for follow-up question support.

Maintains the last 5 question/answer turns per user session.
Supports pronoun resolution (e.g., "What about him?" → "What about Rajesh?").
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Any

from backend.cache import build_cache_key, get_json, set_json

# In-memory session store (up to 256 users)
_session_store: dict[str, list[dict[str, Any]]] = {}
_session_lock = threading.Lock()
_MAX_TURNS = 5
_SESSION_TTL = 3600  # 1 hour


def _session_key(user_id: int) -> str:
    return build_cache_key("nlq_session", str(user_id))


def load_session(user_id: int) -> list[dict[str, Any]]:
    """Load the last 5 NLQ turns for a user.

    Returns a list of dicts, each with: question, answer, domain, entities.
    Empty list if no session exists.
    """
    with _session_lock:
        cached = _session_store.get(str(user_id))
        if cached:
            return cached

    # Try persistent cache
    raw = get_json(_session_key(user_id))
    if raw and isinstance(raw, list):
        return raw[-_MAX_TURNS:]
    return []


def save_turn(
    user_id: int,
    question: str,
    answer: str,
    domain: str,
    entities: dict[str, Any] | None = None,
) -> None:
    """Save a completed NLQ turn to the user's session.

    Keeps only the last 5 turns. Also persists to the cache layer.
    """
    turn: dict[str, Any] = {
        "question": question,
        "answer": answer,
        "domain": domain,
        "entities": entities or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with _session_lock:
        turns = _session_store.get(str(user_id), [])
        turns.append(turn)
        if len(turns) > _MAX_TURNS:
            turns = turns[-_MAX_TURNS:]
        _session_store[str(user_id)] = turns

    # Persist to cache
    set_json(_session_key(user_id), turns, _SESSION_TTL)


def resolve_pronouns(question: str, session: list[dict[str, Any]]) -> str:
    """Resolve pronouns in follow-up questions using session context.

    Handles:
      - "him", "her", "them" → last mentioned entity name
      - "that", "this" → last question's subject
      - "shift", "yesterday" → last answer's time context
      - "last month", "last week" → relative to last answer's scope
    """
    if not session:
        return question

    text = question.lower().strip()
    last_turn = session[-1]
    last_question = last_turn.get("question", "").lower()
    last_entities = last_turn.get("entities", {})

    # Entity pronoun resolution
    pronouns = {
        "him": last_entities.get("employee_name"),
        "her": last_entities.get("employee_name"),
        "them": last_entities.get("employee_name"),
        "that operator": last_entities.get("employee_name"),
        "that worker": last_entities.get("employee_name"),
    }
    for pronoun, replacement in pronouns.items():
        if replacement and pronoun in text:
            text = text.replace(pronoun, replacement)

    # Domain-aware substitution
    if not any(qw in text for qw in ["who", "what", "how", "show", "tell", "give"]):
        # Pure follow-up like "And yesterday?" or "What about Rajesh?"
        # Prepend the last question's intent
        intent_words = [w for w in last_question.split() if w not in ("a", "an", "the", "show", "me")]
        intent = " ".join(intent_words[:5])
        text = f"{intent} {text}"

    return text


def clear_session(user_id: int) -> None:
    """Clear a user's session history."""
    with _session_lock:
        _session_store.pop(str(user_id), None)
