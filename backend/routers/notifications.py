"""Notifications API router for in-app notification badge and read actions."""

from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.notification import Notification, NotificationReadSchema, UnreadCountSchema
from backend.models.user import User
from backend.security import get_current_user
from backend.services.notification_service import (
    list_unread_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    unread_count,
)


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/unread-count", response_model=UnreadCountSchema)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountSchema:
    """Get the number of unread notifications for the current user.
    
    Used by the frontend to show a notification badge.
    """
    count = unread_count(db, user_id=current_user.id)
    return UnreadCountSchema(count=count)


class PaginatedNotificationsResponse(BaseModel):
    items: list[NotificationReadSchema]
    total: int
    page: int
    page_size: int


@router.get("", response_model=PaginatedNotificationsResponse)
def list_notifications(
    page: int = 1,
    page_size: int = 20,
    notification_type: str | None = None,
    is_read: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedNotificationsResponse:
    """List notifications for the current user with pagination and optional filters.

    Supports:
    - Pagination via `page` and `page_size` (default 1, 20).
    - Filter by `notification_type` (e.g. "approval_bypass").
    - Filter by `is_read` status (true/false).
    - Results are newest-first.
    """
    from backend.models.notification import Notification

    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    if is_read is not None:
        query = query.filter(Notification.is_read.is_(is_read))

    total = query.count()
    items = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedNotificationsResponse(
        items=[NotificationReadSchema.model_validate(n) for n in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{notification_id}", response_model=NotificationReadSchema)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    """Fetch a single notification by ID for the current user.

    Used by the notification detail page to display full notification content.
    """
    from backend.models.notification import Notification

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return notification


@router.get("/unread", response_model=list[NotificationReadSchema])
def list_unread_notifications_endpoint(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    """List unread notifications for the current user, newest first.
    
    Used by the notification bell dropdown.
    """
    return list_unread_notifications(db, user_id=current_user.id, limit=limit)


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Mark a single notification as read."""
    ok = mark_notification_read(db, notification_id, user_id=current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    db.commit()
    return {"message": "Notification marked as read."}


@router.patch("/read-all")
def mark_read_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    """Mark all unread notifications as read for the current user."""
    count = mark_all_notifications_read(db, user_id=current_user.id)
    db.commit()
    return {"message": f"Marked {count} notification(s) as read.", "count": count}
