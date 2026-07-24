"""rq worker for WhatsApp message sending.

Wraps the existing async-based ``backend.services.whatsapp_sender``
for execution in an rq worker process.

Usage::

    from backend.workers.whatsapp_sender_worker import enqueue_whatsapp_message

    enqueue_whatsapp_message(to="...", template_name="...", template_params={}, org_id="...")
"""

from __future__ import annotations

import logging
from typing import Any

from backend.workers import get_queue

logger = logging.getLogger(__name__)


def enqueue_whatsapp_message(
    to: str,
    template_name: str,
    template_params: dict[str, Any],
    org_id: str | int | None = None,
) -> str | None:
    """Enqueue a WhatsApp message send to the rq ``dpr:whatsapp`` queue.

    Returns the rq job id, or None if Redis is unavailable.
    """
    queue = get_queue("dpr:whatsapp")
    if queue is None:
        logger.warning("Cannot enqueue WhatsApp message — Redis unavailable.")
        return None
    job = queue.enqueue(
        "backend.workers.whatsapp_sender_worker.send_whatsapp_message",
        kwargs={
            "to": to,
            "template_name": template_name,
            "template_params": template_params,
            "org_id": org_id,
        },
    )
    logger.info("Enqueued WhatsApp message to %s (rq id=%s).", to, job.id)
    return job.id


def send_whatsapp_message(
    to: str,
    template_name: str,
    template_params: dict[str, Any],
    org_id: str | int | None = None,
) -> dict[str, Any]:
    """rq job: send a WhatsApp message.

    Wraps the existing ``send_message_blocking()`` from
    ``backend.services.whatsapp_sender``.  Initialises the asyncio
    event loop thread first, since rq worker processes don't run
    the FastAPI lifespan and thus don't have it set up automatically.
    """
    from backend.services.whatsapp_sender import (
        initialize_whatsapp_sender,
        send_message_blocking,
    )

    # The rq worker process does not run the FastAPI lifespan, so the
    # asyncio event loop thread must be started explicitly here.
    initialize_whatsapp_sender()

    result = send_message_blocking(
        to=to,
        template_name=template_name,
        template_params=template_params,
        org_id=org_id,
    )

    logger.info(
        "WhatsApp send completed: to=%s status=%s.",
        to,
        result.status,
    )
    return {
        "to": to,
        "template_name": template_name,
        "status": result.status,
        "provider_message_id": result.provider_message_id,
        "error_message": result.error_message,
    }
