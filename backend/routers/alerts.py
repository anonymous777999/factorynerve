"""Alerts API router for unread alerts and read actions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.alert import Alert, AlertReadSchema
from backend.models.entry import Entry
from backend.models.user import User, UserRole
from backend.security import get_current_user
from backend.rbac import require_any_role
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.query_helpers import factory_user_ids_query


router = APIRouter(tags=["Alerts"])


def _factory_user_ids_query(db: Session, current_user: User):
    return factory_user_ids_query(db, current_user)


def _scoped_alert_query(db: Session, current_user: User):
    query = db.query(Alert).join(Entry, Alert.entry_id == Entry.id)
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(Entry.org_id == org_id)
    if current_user.role in {
        UserRole.OPERATOR,
        UserRole.SUPERVISOR,
        UserRole.MANAGER,
        UserRole.ACCOUNTANT,
    }:
        factory_id = resolve_factory_id(db, current_user)
        if factory_id:
            query = query.filter(Entry.factory_id == factory_id)
    if current_user.role in {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ACCOUNTANT}:
        return query.filter(Alert.user_id == current_user.id)
    if current_user.role == UserRole.MANAGER:
        return query.filter(Alert.user_id.in_(_factory_user_ids_query(db, current_user)))
    return query


@router.get("", response_model=list[AlertReadSchema])
def list_unread_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    response: Response = Response(),
) -> list[Alert]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    response.headers["Cache-Control"] = "private, max-age=30"
    query = _scoped_alert_query(db, current_user).filter(Alert.is_read.is_(False))
    return query.order_by(Alert.created_at.desc()).all()


@router.put("/{alert_id}/read")
def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    require_any_role(
        current_user,
        {UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER},
    )
    alert = _scoped_alert_query(db, current_user).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read."}
