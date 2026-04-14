"""Shared product analytics writers for server and client-originated monitoring events."""

from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any, Iterable

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.product_event import ProductEvent
from backend.tenancy import resolve_factory_id, resolve_org_id


logger = logging.getLogger(__name__)
MAX_DEFERRED_EVENTS = 500
_DEFERRED_EVENTS: deque[dict[str, Any]] = deque(maxlen=MAX_DEFERRED_EVENTS)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_route(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return trimmed[:300]


def _clean_session_id(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return trimmed[:120]


def _serialize_properties(properties: dict[str, Any] | None, *, occurred_at: datetime) -> dict[str, Any]:
    payload = dict(properties or {})
    payload.setdefault("server_timestamp", occurred_at.isoformat())
    return payload


def _build_event_payload(
    db: Session,
    *,
    event_name: str,
    properties: dict[str, Any] | None,
    current_user: Any | None,
    user_id: int | None = None,
    factory_id: str | None = None,
    org_id: str | None = None,
    source: str = "server",
) -> dict[str, Any]:
    occurred_at = _utc_now()
    resolved_user_id = int(user_id) if user_id is not None else int(getattr(current_user, "id", 0) or 0) or None
    resolved_org_id = org_id if org_id is not None else (resolve_org_id(current_user) if current_user is not None else None)
    resolved_factory_id = factory_id
    if resolved_factory_id is None and current_user is not None and resolved_user_id is not None:
        try:
            resolved_factory_id = resolve_factory_id(db, current_user)
        except Exception:  # pragma: no cover - best effort only
            resolved_factory_id = getattr(current_user, "active_factory_id", None)

    serialized_properties = _serialize_properties(properties, occurred_at=occurred_at)
    serialized_properties.setdefault("user_id", resolved_user_id)
    serialized_properties.setdefault("factory_id", resolved_factory_id)
    serialized_properties.setdefault("org_id", resolved_org_id)

    return {
        "event_name": str(event_name).strip()[:120],
        "org_id": resolved_org_id,
        "factory_id": resolved_factory_id,
        "user_id": resolved_user_id,
        "route": _clean_route(serialized_properties.get("route")),
        "session_id": _clean_session_id(serialized_properties.get("session_id")),
        "source": (source or "server").strip()[:24],
        "properties": serialized_properties,
        "occurred_at": occurred_at,
    }


def _persist_rows(db: Session, rows: Iterable[dict[str, Any]]) -> int:
    created = 0
    for row in rows:
        if not row.get("event_name"):
            continue
        db.add(ProductEvent(**row))
        created += 1
    if created:
        db.commit()
    return created


def flush_deferred_product_events(db: Session | None = None) -> int:
    if not _DEFERRED_EVENTS:
        return 0

    owns_session = db is None
    working_db = db or SessionLocal()
    try:
        drained = [_DEFERRED_EVENTS.popleft() for _ in range(len(_DEFERRED_EVENTS))]
        created = _persist_rows(working_db, drained)
        logger.info("flushed_deferred_product_events count=%s", created)
        return created
    except Exception:  # pragma: no cover - best effort only
        logger.exception("Failed to flush deferred product analytics events.")
        for row in reversed(drained):
            _DEFERRED_EVENTS.appendleft(row)
        return 0
    finally:
        if owns_session:
            working_db.close()


def persist_product_event_batch(
    db: Session,
    *,
    current_user: Any | None,
    events: Iterable[dict[str, Any]],
    source: str = "client",
) -> int:
    rows = [
        _build_event_payload(
            db,
            event_name=str(event.get("event_name") or ""),
            properties=event.get("properties") if isinstance(event, dict) else None,
            current_user=current_user,
            source=source,
        )
        for event in events
        if isinstance(event, dict)
    ]
    created = _persist_rows(db, rows)
    flush_deferred_product_events(db)
    return created


def track_product_event(
    *,
    event_name: str,
    properties: dict[str, Any] | None,
    current_user: Any | None = None,
    user_id: int | None = None,
    factory_id: str | None = None,
    org_id: str | None = None,
    source: str = "server",
) -> None:
    if not str(event_name or "").strip():
        return

    db = SessionLocal()
    try:
        row = _build_event_payload(
            db,
            event_name=event_name,
            properties=properties,
            current_user=current_user,
            user_id=user_id,
            factory_id=factory_id,
            org_id=org_id,
            source=source,
        )
        _persist_rows(db, [row])
        flush_deferred_product_events(db)
    except Exception:  # pragma: no cover - tracking must never block actions
        logger.exception("Failed to persist product analytics event event_name=%s", event_name)
        try:
            fallback_row = _build_event_payload(
                db,
                event_name=event_name,
                properties=properties,
                current_user=current_user,
                user_id=user_id,
                factory_id=factory_id,
                org_id=org_id,
                source=source,
            )
            _DEFERRED_EVENTS.append(fallback_row)
        except Exception:
            logger.exception("Failed to queue deferred product analytics event event_name=%s", event_name)
    finally:
        db.close()
