"""Auth helper services for OAuth user provisioning."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.organization import Organization
from backend.models.factory import Factory
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.plans import DEFAULT_PLAN
from backend.security import make_unusable_password_hash
from backend.services.user_code_service import (
    MAX_USER_CODE_ATTEMPTS,
    is_user_code_collision,
    next_user_code,
)


logger = logging.getLogger(__name__)


def _persist_user_with_user_code(db: Session, user: User) -> User:
    last_error: IntegrityError | None = None
    for _ in range(MAX_USER_CODE_ATTEMPTS):
        user.user_code = next_user_code(db, org_id=user.org_id)
        try:
            with db.begin_nested():
                db.add(user)
                db.flush()
            return user
        except IntegrityError as error:
            last_error = error
            if not is_user_code_collision(error):
                raise
    raise HTTPException(
        status_code=500,
        detail="Could not generate a unique user ID. Please try again.",
    ) from last_error


def _org_name_from_email(email: str) -> str:
    if "@" in email:
        domain = email.split("@", 1)[1]
        return domain.split(".")[0].replace("-", " ").title()
    return "DPR.ai Org"


def get_or_create_google_user(
    db: Session,
    *,
    email: str,
    name: str,
    google_id: str,
    picture: str | None,
) -> tuple[User, str, str]:
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        if picture:
            user.profile_picture = picture
        user.auth_provider = "google"
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
        db.add(user)
        db.flush()
        return user, user.org_id, _resolve_factory_id(db, user)

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.google_id = google_id
        user.auth_provider = "google"
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
        if picture:
            user.profile_picture = picture
        db.add(user)
        db.flush()
        return user, user.org_id, _resolve_factory_id(db, user)

    org_name = _org_name_from_email(email)
    org_id = str(uuid.uuid4())
    factory_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    org = Organization(org_id=org_id, name=org_name, plan=DEFAULT_PLAN, created_at=now, is_active=True)
    factory = Factory(factory_id=factory_id, org_id=org_id, name=f"{org_name} Factory", timezone="Asia/Kolkata")
    user = User(
        org_id=org_id,
        name=name or org_name,
        email=email,
        password_hash=make_unusable_password_hash("google"),
        role=UserRole.ADMIN,
        factory_name=factory.name,
        is_active=True,
        google_id=google_id,
        profile_picture=picture,
        auth_provider="google",
        email_verified_at=now,
    )
    db.add_all([org, factory])
    db.flush()
    user = _persist_user_with_user_code(db, user)
    db.add(
        UserFactoryRole(
            id=str(uuid.uuid4()),
            user_id=user.id,
            factory_id=factory_id,
            org_id=org_id,
            role=user.role,
            assigned_at=now,
        )
    )
    db.flush()
    return user, org_id, factory_id


def _resolve_factory_id(db: Session, user: User) -> str:
    row = (
        db.query(UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user.id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    if row:
        return row[0]
    factory = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == user.org_id)
        .order_by(Factory.created_at.asc())
        .first()
    )
    return factory[0] if factory else ""
