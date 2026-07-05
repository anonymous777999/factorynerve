"""Notification service for in-app user notifications.

Provides functions to create, query, and manage notification records.
Used primarily for IP-2 bypass alerts and other system-wide notifications.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.notification import Notification

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    *,
    user_id: int,
    org_id: str | None = None,
    notification_type: str = "system",
    title: str,
    body: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Notification:
    """Create a new notification record.

    Args:
        db: Active database session.
        user_id: The user who should receive this notification.
        org_id: Org scope for the notification.
        notification_type: Type category (e.g. "approval_bypass", "system").
        title: Short notification title.
        body: Optional longer body text.
        metadata: Optional structured metadata (serialized to JSON).

    Returns:
        The created Notification instance.
    """
    notification = Notification(
        user_id=user_id,
        org_id=org_id,
        notification_type=notification_type,
        title=title,
        body=body,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(notification)
    db.flush()
    return notification


def notify_approval_bypass(
    db: Session,
    *,
    recipient_user_id: int,
    org_id: str | None,
    workflow_key: str,
    resource_type: str,
    resource_id: str,
    instance_id: str,
    details: str | None = None,
) -> None:
    """Send an in-app notification about an IP-2 conditional bypass.

    Called from complete_approval() when an approval instance has
    status="no_approval_required" (i.e., bypassed due to low risk).

    Args:
        db: Active database session.
        recipient_user_id: The user to notify.
        org_id: Org scope.
        workflow_key: The workflow key that was bypassed.
        resource_type: Type of resource (e.g. "SteelStockReconciliation").
        resource_id: String ID of the resource.
        instance_id: The bypassed approval instance ID.
        details: Optional human-readable detail about why bypass occurred.
    """
    title = f"Approval bypassed: {workflow_key}"
    body = (
        details
        or (
            f"The approval for {resource_type} #{resource_id} "
            f"was automatically bypassed because it met conditional thresholds. "
            f"Instance: {instance_id}"
        )
    )
    metadata = {
        "workflow_key": workflow_key,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "instance_id": instance_id,
        "bypass": True,
    }
    create_notification(
        db,
        user_id=recipient_user_id,
        org_id=org_id,
        notification_type="approval_bypass",
        title=title,
        body=body,
        metadata=metadata,
    )


def list_unread_notifications(
    db: Session,
    user_id: int,
    *,
    org_id: str | None = None,
    limit: int = 50,
) -> list[Notification]:
    """List unread notifications for a user, newest first.

    Args:
        db: Active database session.
        user_id: The user to fetch notifications for.
        org_id: Optional org filter.
        limit: Maximum number of results.

    Returns:
        List of Notification instances.
    """
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    )
    if org_id:
        query = query.filter(Notification.org_id == org_id)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> bool:
    """Mark a single notification as read.

    Args:
        db: Active database session.
        notification_id: The notification ID to mark.
        user_id: The owning user (for security).

    Returns:
        True if a row was updated, False otherwise.
    """
    row = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        .first()
    )
    if not row:
        return False
    row.is_read = True
    db.flush()
    return True


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    """Mark all unread notifications as read for a user.

    Args:
        db: Active database session.
        user_id: The owning user.

    Returns:
        Number of rows updated.
    """
    result = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .update({"is_read": True})
    )
    db.flush()
    return result or 0


def unread_count(db: Session, user_id: int) -> int:
    """Get the count of unread notifications for a user.

    Args:
        db: Active database session.
        user_id: The user to count for.

    Returns:
        Unread notification count.
    """
    result = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .scalar()
    )
    return result or 0
