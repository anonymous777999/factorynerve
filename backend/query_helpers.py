"""Shared query helpers for org/factory scoping."""

from __future__ import annotations

from sqlalchemy.orm import Session, Query

from backend.models.entry import Entry
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.tenancy import resolve_factory_id, resolve_org_id


def factory_user_ids_query(db: Session, current_user: User) -> Query:
    """Returns a subquery of user IDs in the current user's active factory."""
    factory_id = resolve_factory_id(db, current_user)
    if not factory_id:
        return db.query(User.id).filter(User.id == current_user.id, User.is_active.is_(True))
    return (
        db.query(User.id)
        .join(UserFactoryRole, UserFactoryRole.user_id == User.id)
        .filter(UserFactoryRole.factory_id == factory_id, User.is_active.is_(True))
    )


def apply_org_scope(query: Query, current_user: User) -> Query:
    """Scopes an Entry query to the current user's org."""
    org_id = resolve_org_id(current_user)
    if org_id:
        return query.filter(Entry.org_id == org_id)
    return query


def apply_role_scope(query: Query, db: Session, current_user: User) -> Query:
    """Scopes an Entry query to what the current user's role can see."""
    if current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        return query

    factory_id = resolve_factory_id(db, current_user)
    if factory_id:
        query = query.filter(Entry.factory_id == factory_id)

    if current_user.role in {UserRole.ATTENDANCE, UserRole.OPERATOR}:
        return query.filter(Entry.user_id == current_user.id)
    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER}:
        return query.filter(Entry.user_id.in_(factory_user_ids_query(db, current_user)))
    if current_user.role == UserRole.ACCOUNTANT:
        return query.filter(Entry.user_id == current_user.id)
    return query.filter(Entry.user_id == current_user.id)


def can_view_entry(db: Session, current_user: User, entry: Entry) -> bool:
    """Single authoritative check for entry visibility."""
    org_id = resolve_org_id(current_user)
    if org_id and entry.org_id and entry.org_id != org_id:
        return False
    if current_user.role in {UserRole.ADMIN, UserRole.OWNER}:
        return True
    factory_id = resolve_factory_id(db, current_user)
    if factory_id and entry.factory_id and entry.factory_id != factory_id:
        return False
    if current_user.role in {UserRole.ATTENDANCE, UserRole.OPERATOR}:
        return entry.user_id == current_user.id
    if current_user.role == UserRole.ACCOUNTANT:
        return entry.user_id == current_user.id
    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER}:
        return (
            db.query(User.id)
            .filter(User.id == entry.user_id, User.id.in_(factory_user_ids_query(db, current_user)))
            .first()
            is not None
        )
    return entry.user_id == current_user.id
