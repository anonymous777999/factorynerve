"""Settings router for factory profile and user management."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.factory_templates import (
    default_workflow_template_key,
    get_workflow_template,
    list_workflow_templates,
    normalize_workflow_template_key,
    serialize_workflow_template,
)
from backend.models.factory_settings import FactorySettings
from backend.models.entry import Entry, ShiftType
from backend.models.user import User, UserRole
from backend.models.factory import Factory
from backend.models.user_factory_role import UserFactoryRole
from backend.models.report import AuditLog
from backend.models.ocr_template import OcrTemplate
from backend.models.email_queue import EmailQueue
from backend.models.user_plan import UserPlan
from backend.models.organization import Organization
from backend.models.pending_registration import PendingRegistration
from backend.security import get_current_user, hash_password
from backend.utils import sanitize_text
from backend.ocr_limits import get_usage_summary, get_org_usage_summary
from backend.rbac import is_admin_or_owner, require_role, role_rank
from backend.plans import (
    ALLOWED_PLANS,
    DEFAULT_PLAN,
    enforce_factory_limit,
    get_org_plan,
    has_org_feature,
    normalize_plan,
)
from backend.plans import get_effective_factory_plan, enforce_user_limit
from backend.usage_reconcile import reconcile_org_usage
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.factory_profiles import (
    get_factory_profile,
    list_factory_profiles,
    normalize_factory_profile,
)
from backend.services.user_code_service import (
    MAX_USER_CODE_ATTEMPTS,
    is_user_code_collision,
    next_user_code,
)
from backend.utils import generate_company_code
from backend.services.pending_registration_service import create_or_update_pending_registration
from backend.services.email_verification_service import build_verification_link
from backend.email_service import send_email
from backend.services.invite_email_service import build_invite_email_payload


router = APIRouter(tags=["Settings"])
INVITE_VERIFICATION_TTL_HOURS = int(os.getenv("EMAIL_VERIFICATION_TTL_HOURS", "24"))


def _frontend_verification_link_from_request(request: Request, token: str) -> str | None:
    origin = (request.headers.get("origin") or "").strip()
    referer = (request.headers.get("referer") or "").strip()

    if origin.startswith(("http://", "https://")):
        return f"{origin.rstrip('/')}/verify-email?token={token}"

    if referer.startswith(("http://", "https://")):
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/verify-email?token={token}"

    return None


def _send_invite_email(*, to_email: str, subject: str, body: str, html_body: str | None = None) -> bool:
    try:
        send_email(subject=subject, to_emails=[to_email], body=body, html_body=html_body)
        return True
    except Exception:  # pylint: disable=broad-except
        return False


def _manual_plan_override_enabled() -> bool:
    value = str(os.getenv("ENABLE_BILLING_PLAN_OVERRIDE", "")).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _has_other_privileged_user(db: Session, *, org_id: str | None, exclude_user_id: int) -> bool:
    query = db.query(User.id).filter(
        User.is_active.is_(True),
        User.role.in_([UserRole.ADMIN, UserRole.OWNER]),
        User.id != exclude_user_id,
    )
    if org_id:
        query = query.filter(User.org_id == org_id)
    return query.first() is not None


def _can_assign_owner_role(db: Session, *, current_user: User) -> bool:
    if current_user.role == UserRole.OWNER:
        return True
    if current_user.role != UserRole.ADMIN:
        return False
    org_id = resolve_org_id(current_user)
    owner_exists = db.query(User.id).filter(
        User.is_active.is_(True),
        User.role == UserRole.OWNER,
        User.org_id == org_id,
    ).first()
    return owner_exists is None


def _assert_owner_assignment_allowed(db: Session, *, current_user: User, target_role: UserRole) -> None:
    if target_role != UserRole.OWNER:
        return
    if _can_assign_owner_role(db, current_user=current_user):
        return
    raise HTTPException(
        status_code=403,
        detail="Owner role can only be assigned by an existing owner, or by the first admin while no owner exists.",
    )


def _assert_role_assignment_allowed(db: Session, *, current_user: User, target_role: UserRole) -> None:
    if current_user.role == UserRole.MANAGER and target_role in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(
            status_code=403,
            detail="Managers cannot assign admin or owner roles.",
        )
    _assert_owner_assignment_allowed(db, current_user=current_user, target_role=target_role)


def _assert_role_update_allowed(
    db: Session,
    *,
    current_user: User,
    current_target_role: UserRole,
    new_target_role: UserRole,
) -> None:
    if current_user.role == UserRole.MANAGER and current_target_role in {UserRole.ADMIN, UserRole.OWNER}:
        raise HTTPException(
            status_code=403,
            detail="Managers cannot modify admin or owner accounts.",
        )
    _assert_role_assignment_allowed(db, current_user=current_user, target_role=new_target_role)


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


def _active_factory(db: Session, current_user: User) -> Factory | None:
    factory_id = resolve_factory_id(db, current_user)
    if factory_id:
        return db.query(Factory).filter(Factory.factory_id == factory_id).first()
    if current_user.factory_name:
        query = db.query(Factory).filter(Factory.name == current_user.factory_name)
        org_id = resolve_org_id(current_user)
        if org_id:
            query = query.filter(Factory.org_id == org_id)
        return query.first()
    return None


def _active_factory_name(db: Session, current_user: User) -> str:
    factory = _active_factory(db, current_user)
    if factory:
        return factory.name
    return current_user.factory_name


def _scoped_users_query(db: Session, current_user: User):
    query = db.query(User).filter(User.is_active.is_(True))
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(User.org_id == org_id)
    if current_user.role == UserRole.MANAGER:
        factory_id = resolve_factory_id(db, current_user)
        if factory_id:
            query = query.join(UserFactoryRole, UserFactoryRole.user_id == User.id).filter(
                UserFactoryRole.factory_id == factory_id
            )
    return query


class FactorySettingsRequest(BaseModel):
    factory_name: str = Field(min_length=2, max_length=255)
    address: str | None = None
    industry_type: str | None = Field(default=None, max_length=40)
    factory_type: str | None = Field(default=None, max_length=120)
    workflow_template_key: str | None = Field(default=None, max_length=64)
    target_morning: int = 0
    target_evening: int = 0
    target_night: int = 0


class CreateFactoryRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    location: str | None = Field(default=None, max_length=300)
    address: str | None = Field(default=None, max_length=255)
    timezone: str | None = Field(default="Asia/Kolkata", max_length=60)
    industry_type: str | None = Field(default=None, max_length=40)
    workflow_template_key: str | None = Field(default=None, max_length=64)


class InviteUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: UserRole
    factory_name: str = Field(min_length=2, max_length=255)
    custom_note: str | None = Field(default=None, max_length=1200)


class RoleUpdateRequest(BaseModel):
    role: UserRole
    confirm_action: str | None = None


class FactoryAccessUpdateRequest(BaseModel):
    factory_ids: list[str] = Field(default_factory=list)


class PlanUpdateRequest(BaseModel):
    plan: str


class UsageReconcileRequest(BaseModel):
    period: str | None = None  # YYYY-MM
    allow_decrease: bool | None = None
    dry_run: bool = False
    seed_from_user: bool = False


def _write_admin_audit(
    db: Session,
    *,
    actor_id: int | None,
    org_id: str | None,
    factory_id: str | None,
    action: str,
    details: str,
    request: Request,
) -> None:
    ip_address = request.client.host if request.client else None
    db.add(
        AuditLog(
            user_id=actor_id,
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=ip_address,
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc),
        )
    )


def _issue_factory_code(db: Session) -> str:
    while True:
        candidate = generate_company_code()
        user_collision = db.query(User.id).filter(User.factory_code == candidate).first()
        factory_collision = db.query(Factory.factory_id).filter(Factory.factory_code == candidate).first()
        if not user_collision and not factory_collision:
            return candidate


def _invite_delivery_mode() -> str:
    return "preview" if str(os.getenv("EMAIL_VERIFICATION_EXPOSE_LINK", "")).strip().lower() in {"1", "true", "yes", "on"} else "email"


def _sanitize_invite_note(custom_note: str | None) -> str | None:
    if not custom_note:
        return None
    return sanitize_text(custom_note, max_length=1200, preserve_newlines=True) or None


def _build_invite_preview(
    *,
    current_user: User,
    organization: Organization,
    factory: Factory,
    payload: InviteUserRequest,
    verification_link: str | None,
) -> dict[str, object]:
    return build_invite_email_payload(
        recipient_name=sanitize_text(payload.name, max_length=120, preserve_newlines=False) or payload.name,
        invited_email=payload.email.lower().strip(),
        role=payload.role,
        organization_name=organization.name,
        factory_name=factory.name,
        factory_location=factory.location,
        company_code=factory.factory_code,
        inviter_name=current_user.name,
        custom_note=_sanitize_invite_note(payload.custom_note),
        verification_link=verification_link,
        expires_in_hours=INVITE_VERIFICATION_TTL_HOURS,
    )


def _factory_template_payload(factory: Factory | None) -> dict:
    profile = get_factory_profile(factory.industry_type if factory else None)
    active_key = normalize_workflow_template_key(
        profile.key,
        factory.workflow_template_key if factory else default_workflow_template_key(profile.key),
    )
    active_template = get_workflow_template(active_key)
    templates = [serialize_workflow_template(template) for template in list_workflow_templates(profile.key)]
    return {
        "industry_type": profile.key,
        "industry_label": profile.label,
        "starter_modules": list(profile.starter_modules),
        "active_template_key": active_key,
        "active_template_label": active_template.label if active_template else active_key,
        "active_template": serialize_workflow_template(active_template) if active_template else None,
        "templates": templates,
    }


def _org_factories(db: Session, current_user: User) -> list[Factory]:
    org_id = resolve_org_id(current_user)
    query = db.query(Factory).filter(Factory.is_active.is_(True))
    if org_id:
        query = query.filter(Factory.org_id == org_id)
    else:
        factory_id = resolve_factory_id(db, current_user)
        if factory_id:
            query = query.filter(Factory.factory_id == factory_id)
    return query.order_by(Factory.name.asc()).all()


def _normalize_factory_ids(factory_ids: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_factory_id in factory_ids:
        factory_id = (raw_factory_id or "").strip()
        if not factory_id or factory_id in seen:
            continue
        seen.add(factory_id)
        normalized.append(factory_id)
    return normalized


def _serialize_user_factory_access(
    db: Session,
    *,
    current_user: User,
    target_user: User,
) -> dict:
    factories = _org_factories(db, current_user)
    if not factories:
        return {
            "user": {
                "id": target_user.id,
                "user_code": target_user.user_code,
                "name": target_user.name,
                "email": target_user.email,
                "role": target_user.role.value,
                "factory_name": target_user.factory_name,
                "primary_factory_id": None,
                "factory_count": 0,
            },
            "factories": [],
        }

    factory_ids = [factory.factory_id for factory in factories]
    memberships = (
        db.query(UserFactoryRole)
        .filter(
            UserFactoryRole.user_id == target_user.id,
            UserFactoryRole.factory_id.in_(factory_ids),
        )
        .all()
    )
    membership_map = {membership.factory_id: membership for membership in memberships}
    member_counts = {
        factory_id: count
        for factory_id, count in (
            db.query(UserFactoryRole.factory_id, func.count(UserFactoryRole.user_id))
            .filter(UserFactoryRole.factory_id.in_(factory_ids))
            .group_by(UserFactoryRole.factory_id)
            .all()
        )
    }

    primary_factory_id = next(
        (
            factory.factory_id
            for factory in factories
            if factory.name == target_user.factory_name and factory.factory_id in membership_map
        ),
        None,
    )
    if primary_factory_id is None:
        primary_factory_id = next((factory.factory_id for factory in factories if factory.factory_id in membership_map), None)

    return {
        "user": {
            "id": target_user.id,
            "user_code": target_user.user_code,
            "name": target_user.name,
            "email": target_user.email,
            "role": target_user.role.value,
            "factory_name": target_user.factory_name,
            "primary_factory_id": primary_factory_id,
            "factory_count": len(membership_map),
        },
        "factories": [
            {
                "factory_id": factory.factory_id,
                "name": factory.name,
                "factory_code": factory.factory_code,
                "industry_type": profile.key,
                "industry_label": profile.label,
                "location": factory.location,
                "timezone": factory.timezone,
                "member_count": int(member_counts.get(factory.factory_id, 0)),
                "has_access": factory.factory_id in membership_map,
                "is_primary": factory.factory_id == primary_factory_id,
                "role": membership_map[factory.factory_id].role.value if factory.factory_id in membership_map else None,
            }
            for factory in factories
            for profile in [get_factory_profile(factory.industry_type)]
        ],
    }


def _serialize_factory_summaries(
    db: Session,
    *,
    factories: list[Factory],
    current_user: User,
) -> list[dict]:
    if not factories:
        return []
    org_id = resolve_org_id(current_user)
    factory_ids = [factory.factory_id for factory in factories]
    role_rows = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.factory_id.in_(factory_ids), UserFactoryRole.user_id == current_user.id)
        .all()
    )
    role_map = {row.factory_id: row.role.value for row in role_rows}
    member_counts = {
        factory_id: count
        for factory_id, count in (
            db.query(UserFactoryRole.factory_id, func.count(UserFactoryRole.user_id))
            .filter(UserFactoryRole.factory_id.in_(factory_ids))
            .group_by(UserFactoryRole.factory_id)
            .all()
        )
    }
    active_factory_id = resolve_factory_id(db, current_user)
    summaries: list[dict] = []
    for factory in factories:
        profile = get_factory_profile(factory.industry_type)
        template_key = normalize_workflow_template_key(factory.industry_type, factory.workflow_template_key)
        template = get_workflow_template(template_key)
        summaries.append(
            {
                "factory_id": factory.factory_id,
                "org_id": factory.org_id,
                "name": factory.name,
                "factory_code": factory.factory_code,
                "location": factory.location,
                "timezone": factory.timezone,
                "industry_type": profile.key,
                "industry_label": profile.label,
                "workflow_template_key": template_key,
                "workflow_template_label": template.label if template else template_key,
                "starter_modules": list(profile.starter_modules),
                "member_count": int(member_counts.get(factory.factory_id, 0)),
                "my_role": role_map.get(factory.factory_id, current_user.role.value if org_id == factory.org_id else None),
                "is_active_context": factory.factory_id == active_factory_id,
                "created_at": factory.created_at,
            }
        )
    return summaries


@router.get("/factory-profiles")
def get_factory_profiles(
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    del current_user
    return [
        {
            "key": profile.key,
            "label": profile.label,
            "description": profile.description,
            "starter_modules": list(profile.starter_modules),
        }
        for profile in list_factory_profiles()
    ]


@router.get("/factory")
def get_factory_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    factory = _active_factory(db, current_user)
    factory_name = _active_factory_name(db, current_user)
    settings = db.query(FactorySettings).filter(FactorySettings.factory_name == factory_name).first()
    profile = get_factory_profile(
        factory.industry_type if factory else settings.factory_type if settings else None
    )
    if not settings:
        return {
            "factory_name": factory_name,
            "address": "",
            "factory_type": profile.label,
            "industry_type": profile.key,
            "industry_label": profile.label,
            "workflow_template_key": default_workflow_template_key(profile.key),
            "workflow_template_label": get_workflow_template(default_workflow_template_key(profile.key)).label,
            "starter_modules": list(profile.starter_modules),
            "target_morning": 0,
            "target_evening": 0,
            "target_night": 0,
        }
    template_key = normalize_workflow_template_key(profile.key, factory.workflow_template_key if factory else None)
    template = get_workflow_template(template_key)
    return {
        "factory_name": settings.factory_name,
        "address": settings.address or "",
        "factory_type": settings.factory_type or profile.label,
        "industry_type": profile.key,
        "industry_label": profile.label,
        "workflow_template_key": template_key,
        "workflow_template_label": template.label if template else template_key,
        "starter_modules": list(profile.starter_modules),
        "target_morning": settings.target_morning,
        "target_evening": settings.target_evening,
        "target_night": settings.target_night,
    }


@router.get("/factory/templates")
def get_factory_templates(
    industry_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    factory = _active_factory(db, current_user)
    if industry_type:
        profile = get_factory_profile(industry_type)
        template_key = default_workflow_template_key(profile.key)
        active_template = get_workflow_template(template_key)
        return {
            "industry_type": profile.key,
            "industry_label": profile.label,
            "starter_modules": list(profile.starter_modules),
            "active_template_key": template_key,
            "active_template_label": active_template.label if active_template else template_key,
            "active_template": serialize_workflow_template(active_template) if active_template else None,
            "templates": [serialize_workflow_template(template) for template in list_workflow_templates(profile.key)],
        }
    return _factory_template_payload(factory)


@router.get("/factories")
def list_factories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    require_role(current_user, UserRole.ADMIN)
    return _serialize_factory_summaries(db, factories=_org_factories(db, current_user), current_user=current_user)


@router.post("/factories", status_code=status.HTTP_201_CREATED)
def create_factory(
    payload: CreateFactoryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    try:
        enforce_factory_limit(db, org_id=org_id, plan=plan)
    except ValueError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    name = sanitize_text(payload.name, max_length=255, preserve_newlines=False) or payload.name.strip()
    existing = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == org_id, func.lower(Factory.name) == name.lower())
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Factory already exists in this organization.")
    global_settings_conflict = (
        db.query(FactorySettings.id)
        .filter(func.lower(FactorySettings.factory_name) == name.lower())
        .first()
    )
    if global_settings_conflict:
        raise HTTPException(
            status_code=409,
            detail="Factory name already exists. Please use a distinct factory name for the new location.",
        )

    industry_type = normalize_factory_profile(payload.industry_type)
    workflow_template_key = normalize_workflow_template_key(industry_type, payload.workflow_template_key)
    profile = get_factory_profile(industry_type)
    template = get_workflow_template(workflow_template_key)

    factory = Factory(
        org_id=org_id,
        name=name,
        location=sanitize_text(payload.location, max_length=300, preserve_newlines=False) if payload.location else None,
        timezone=sanitize_text(payload.timezone, max_length=60, preserve_newlines=False) or "Asia/Kolkata",
        industry_type=industry_type,
        workflow_template_key=workflow_template_key,
        factory_code=_issue_factory_code(db),
    )
    db.add(factory)
    db.flush()

    db.add(
        FactorySettings(
            factory_name=name,
            address=sanitize_text(payload.address, max_length=255, preserve_newlines=False) if payload.address else None,
            factory_type=profile.label,
            target_morning=0,
            target_evening=0,
            target_night=0,
        )
    )

    existing_access = (
        db.query(UserFactoryRole.id)
        .filter(UserFactoryRole.user_id == current_user.id, UserFactoryRole.factory_id == factory.factory_id)
        .first()
    )
    if not existing_access:
        db.add(
            UserFactoryRole(
                user_id=current_user.id,
                factory_id=factory.factory_id,
                org_id=org_id,
                role=current_user.role,
            )
        )

    _write_admin_audit(
        db,
        actor_id=current_user.id,
        org_id=org_id,
        factory_id=factory.factory_id,
        action="FACTORY_CREATED",
        details=f"factory={factory.name} industry={industry_type} template={workflow_template_key}",
        request=request,
    )
    db.commit()
    return {
        "message": "Factory created.",
        "factory": {
            "factory_id": factory.factory_id,
            "name": factory.name,
            "factory_code": factory.factory_code,
            "industry_type": industry_type,
            "industry_label": profile.label,
            "workflow_template_key": workflow_template_key,
            "workflow_template_label": template.label if template else workflow_template_key,
            "location": factory.location,
            "timezone": factory.timezone,
        },
    }


@router.get("/control-tower")
def get_control_tower(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    factories = _org_factories(db, current_user)
    summaries = _serialize_factory_summaries(db, factories=factories, current_user=current_user)
    industry_breakdown: dict[str, dict] = {}
    for item in summaries:
        key = item["industry_type"]
        bucket = industry_breakdown.setdefault(
            key,
            {"industry_type": key, "industry_label": item["industry_label"], "count": 0},
        )
        bucket["count"] += 1
    return {
        "organization": {
            "org_id": org_id,
            "name": current_user.organization.name if current_user.organization else current_user.factory_name,
            "plan": get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id),
            "total_factories": len(summaries),
            "industry_breakdown": list(industry_breakdown.values()),
        },
        "active_factory_id": resolve_factory_id(db, current_user),
        "factories": summaries,
    }


@router.put("/factory")
def update_factory_settings(
    payload: FactorySettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    try:
        factory = _active_factory(db, current_user)
        factory_id = factory.factory_id if factory else None
        org_id = resolve_org_id(current_user)
        old_name = factory.name if factory else _active_factory_name(db, current_user)
        new_name = sanitize_text(payload.factory_name, max_length=255, preserve_newlines=False) or payload.factory_name

        if new_name != old_name:
            existing_settings = db.query(FactorySettings).filter(FactorySettings.factory_name == new_name).first()
            if existing_settings:
                raise HTTPException(status_code=400, detail="Factory name already exists.")
            conflict_user = (
                db.query(User.id)
                .filter(User.factory_name == new_name)
                .first()
            )
            if conflict_user:
                raise HTTPException(status_code=400, detail="Factory name already exists.")

        settings = db.query(FactorySettings).filter(FactorySettings.factory_name == old_name).first()
        if not settings:
            settings = FactorySettings(factory_name=old_name)
            db.add(settings)
        industry_type = normalize_factory_profile(payload.industry_type or payload.factory_type)
        industry_profile = get_factory_profile(industry_type)
        requested_template_key = payload.workflow_template_key
        if requested_template_key is None and factory and factory.industry_type == industry_type:
            requested_template_key = factory.workflow_template_key
        workflow_template_key = normalize_workflow_template_key(
            industry_type,
            requested_template_key,
        )
        workflow_template = get_workflow_template(workflow_template_key)
        settings.factory_name = new_name
        settings.address = sanitize_text(payload.address, max_length=255, preserve_newlines=False) if payload.address else None
        settings.factory_type = industry_profile.label
        settings.target_morning = payload.target_morning
        settings.target_evening = payload.target_evening
        settings.target_night = payload.target_night
        settings.updated_at = datetime.now(timezone.utc)
        if factory:
            factory.industry_type = industry_type
            factory.workflow_template_key = workflow_template_key
        if new_name != old_name:
            user_query = db.query(User).filter(User.factory_name == old_name)
            if org_id:
                user_query = user_query.filter(User.org_id == org_id)
            user_query.update(
                {User.factory_name: new_name},
                synchronize_session="fetch",
            )
            db.query(OcrTemplate).filter(OcrTemplate.factory_name == old_name).update(
                {OcrTemplate.factory_name: new_name},
                synchronize_session=False,
            )
            db.query(EmailQueue).filter(EmailQueue.factory_name == old_name).update(
                {EmailQueue.factory_name: new_name},
                synchronize_session=False,
            )
            if factory_id:
                db.query(Factory).filter(Factory.factory_id == factory_id).update(
                    {Factory.name: new_name},
                    synchronize_session=False,
                )
            else:
                factory_query = db.query(Factory).filter(Factory.name == old_name)
                if org_id:
                    factory_query = factory_query.filter(Factory.org_id == org_id)
                factory_query.update(
                    {Factory.name: new_name},
                    synchronize_session=False,
                )
            current_user.factory_name = new_name
        db.commit()
        return {
            "message": "Factory settings updated.",
            "industry_type": industry_type,
            "industry_label": industry_profile.label,
            "workflow_template_key": workflow_template_key,
            "workflow_template_label": workflow_template.label if workflow_template else workflow_template_key,
        }
    except HTTPException:
        db.rollback()
        raise
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    require_role(current_user, UserRole.ADMIN)
    users = _scoped_users_query(db, current_user).all()
    plan_rows = db.query(UserPlan).filter(UserPlan.user_id.in_([u.id for u in users])).all() if users else []
    plan_map = {row.user_id: row.plan for row in plan_rows}
    membership_counts = (
        {
            user_id: int(count)
            for user_id, count in (
                db.query(UserFactoryRole.user_id, func.count(UserFactoryRole.factory_id))
                .filter(UserFactoryRole.user_id.in_([u.id for u in users]))
                .group_by(UserFactoryRole.user_id)
                .all()
            )
        }
        if users
        else {}
    )
    return [
        {
            "id": user.id,
            "user_code": user.user_code,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "factory_name": user.factory_name,
            "factory_count": membership_counts.get(user.id, 0),
            "is_active": user.is_active,
            "plan": plan_map.get(user.id, DEFAULT_PLAN),
        }
        for user in users
    ]

def _handle_existing_org_invite(
    *,
    db: Session,
    existing: User,
    org_id: str,
    factory: Factory | None,
    factory_name: str,
) -> dict[str, object]:
    if not factory:
        raise HTTPException(status_code=400, detail="Active factory could not be resolved for this invite.")
    existing_membership = (
        db.query(UserFactoryRole)
        .filter(
            UserFactoryRole.user_id == existing.id,
            UserFactoryRole.factory_id == factory.factory_id,
            UserFactoryRole.org_id == org_id,
        )
        .first()
    )
    if existing_membership:
        if existing.is_active:
            raise HTTPException(status_code=409, detail="User already has access to this factory.")
        existing.is_active = True
        db.commit()
        return {
            "message": "Existing user reactivated for this factory.",
            "user_code": existing.user_code,
        }
    db.add(
        UserFactoryRole(
            user_id=existing.id,
            factory_id=factory.factory_id,
            org_id=org_id,
            role=existing.role,
        )
    )
    existing.is_active = True
    db.commit()
    return {
        "message": f"Existing user added to {factory_name}. Current role kept as {existing.role.value}.",
        "user_code": existing.user_code,
    }


def _validate_invite_request(
    *,
    db: Session,
    current_user: User,
    payload: InviteUserRequest,
) -> tuple[Factory | None, str, str | None, str, Organization, User | None]:
    require_role(current_user, UserRole.ADMIN)
    _assert_role_assignment_allowed(db, current_user=current_user, target_role=payload.role)
    factory = _active_factory(db, current_user)
    factory_name = factory.name if factory else _active_factory_name(db, current_user)
    normalized_email = payload.email.lower().strip()
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=500, detail="Organization could not be resolved.")
    organization = db.query(Organization).filter(Organization.org_id == org_id).first()
    if not organization:
        raise HTTPException(status_code=500, detail="Organization could not be resolved.")
    plan = get_effective_factory_plan(
        db,
        factory_name,
        org_id=org_id,
        factory_id=factory.factory_id if factory else None,
    )
    if payload.role == UserRole.ACCOUNTANT and not has_org_feature(
        db,
        org_id=org_id,
        fallback_user_id=current_user.id,
        feature_key="accountant",
    ):
        raise HTTPException(
            status_code=403,
            detail=f"Accountant role is not available on the {normalize_plan(plan).title()} plan. Upgrade to Growth or higher to unlock this.",
        )
    try:
        enforce_user_limit(
            db,
            factory_name,
            plan,
            org_id=org_id,
            factory_id=factory.factory_id if factory else None,
        )
    except ValueError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing and existing.org_id != org_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "This email already belongs to another organization. "
                "Cross-organization invites are blocked. Ask the user to use a different email or leave the other organization first."
            ),
        )

    pending = db.query(PendingRegistration).filter(PendingRegistration.email == normalized_email).first()
    if pending and pending.used_at is None and pending.org_id and pending.org_id != org_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "This email already has a pending signup or invitation in another organization. "
                "Cross-organization invites are blocked until that pending request is completed or expires."
            ),
        )

    return factory, factory_name, org_id, normalized_email, organization, existing


@router.post("/users/invite/preview")
def preview_invite_user(
    payload: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory, factory_name, org_id, normalized_email, organization, existing = _validate_invite_request(
        db=db,
        current_user=current_user,
        payload=payload,
    )
    if existing and existing.org_id == org_id:
        if not factory:
            raise HTTPException(status_code=400, detail="Active factory could not be resolved for this invite.")
        existing_membership = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == existing.id,
                UserFactoryRole.factory_id == factory.factory_id,
                UserFactoryRole.org_id == org_id,
            )
            .first()
        )
        if existing_membership and existing.is_active:
            raise HTTPException(status_code=409, detail="User already has access to this factory.")
        action = "reactivate_existing_user" if existing_membership else "add_existing_user_to_factory"
        return {
            "action": action,
            "can_send": True,
            "message": (
                "This existing user will be reactivated for the current factory."
                if existing_membership
                else f"This existing user will be added to {factory_name} immediately when you confirm."
            ),
            "existing_user": {
                "user_id": existing.id,
                "user_code": existing.user_code,
                "email": existing.email,
                "role": existing.role.value,
            },
        }

    if not factory or not factory.factory_code:
        raise HTTPException(status_code=400, detail="Active factory could not be resolved for this invite.")

    preview = _build_invite_preview(
        current_user=current_user,
        organization=organization,
        factory=factory,
        payload=payload,
        verification_link=None,
    )
    return {
        "action": "invite_preview",
        "can_send": True,
        "message": "Preview ready. No account will be created until the recipient accepts the invitation.",
        "delivery_mode": _invite_delivery_mode(),
        "preview": preview,
        "invite_summary": preview["summary"],
        "email": normalized_email,
    }


@router.post("/users/invite", status_code=status.HTTP_201_CREATED)
def invite_user(
    request: Request,
    payload: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    factory, factory_name, org_id, normalized_email, organization, existing = _validate_invite_request(
        db=db,
        current_user=current_user,
        payload=payload,
    )
    if existing and existing.org_id == org_id:
        return _handle_existing_org_invite(
            db=db,
            existing=existing,
            org_id=org_id,
            factory=factory,
            factory_name=factory_name,
        )

    if not factory or not factory.factory_code:
        raise HTTPException(status_code=400, detail="Active factory could not be resolved for this invite.")

    verification_token = create_or_update_pending_registration(
        db,
        name=sanitize_text(payload.name, max_length=120, preserve_newlines=False) or payload.name,
        email=normalized_email,
        org_id=org_id,
        invited_by_user_id=current_user.id,
        password_hash=hash_password(os.urandom(16).hex()),
        requested_role=payload.role,
        factory_name=factory_name,
        company_code=factory.factory_code,
        phone_number=None,
        custom_note=_sanitize_invite_note(payload.custom_note),
        ttl_hours=INVITE_VERIFICATION_TTL_HOURS,
    )
    verification_link = _frontend_verification_link_from_request(request, verification_token) or build_verification_link(verification_token)
    preview = _build_invite_preview(
        current_user=current_user,
        organization=organization,
        factory=factory,
        payload=payload,
        verification_link=verification_link,
    )
    delivery_mode = _invite_delivery_mode()
    delivered = True
    if delivery_mode == "email":
        delivered = _send_invite_email(
            to_email=normalized_email,
            subject=str(preview["subject"]),
            body=str(preview["text_body"]),
            html_body=str(preview["html_body"]),
        )
    if not delivered:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Invite was prepared, but the verification email could not be delivered. Try again in a moment.",
        )

    _write_admin_audit(
        db,
        actor_id=current_user.id,
        org_id=org_id,
        factory_id=factory.factory_id,
        action="USER_INVITED_PENDING_ACCEPTANCE",
        details=f"email={normalized_email} role={payload.role.value}",
        request=request,
    )
    db.commit()
    return {
        "message": "Invitation sent. No account will be created until the recipient accepts.",
        "delivery_mode": delivery_mode,
        "verification_link": verification_link if delivery_mode == "preview" else None,
        "preview": preview,
    }


@router.get("/users/{user_id}/factory-access")
def get_user_factory_access(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.org_id == org_id,
            User.is_active.is_(True),
        )
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return _serialize_user_factory_access(db, current_user=current_user, target_user=user)


@router.put("/users/{user_id}/factory-access")
def update_user_factory_access(
    user_id: int,
    payload: FactoryAccessUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.org_id == org_id,
            User.is_active.is_(True),
        )
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    selected_factory_ids = _normalize_factory_ids(payload.factory_ids)
    if not selected_factory_ids:
        raise HTTPException(status_code=400, detail="Select at least one factory.")

    factories = (
        db.query(Factory)
        .filter(
            Factory.org_id == org_id,
            Factory.is_active.is_(True),
            Factory.factory_id.in_(selected_factory_ids),
        )
        .all()
    )
    factories_by_id = {factory.factory_id: factory for factory in factories}
    invalid_factory_ids = [factory_id for factory_id in selected_factory_ids if factory_id not in factories_by_id]
    if invalid_factory_ids:
        raise HTTPException(status_code=400, detail="One or more factories are not part of this organization.")

    memberships = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == user.id, UserFactoryRole.org_id == org_id)
        .all()
    )
    membership_map = {membership.factory_id: membership for membership in memberships}
    selected_factory_id_set = set(selected_factory_ids)
    added_factory_ids = [factory_id for factory_id in selected_factory_ids if factory_id not in membership_map]
    removed_factory_ids = [factory_id for factory_id in membership_map if factory_id not in selected_factory_id_set]

    for membership in memberships:
        if membership.factory_id in selected_factory_id_set:
            membership.role = user.role
        else:
            db.delete(membership)

    for factory_id in added_factory_ids:
        db.add(
            UserFactoryRole(
                user_id=user.id,
                factory_id=factory_id,
                org_id=org_id,
                role=user.role,
            )
        )

    current_primary_factory_id = next(
        (
            factory_id
            for factory_id in selected_factory_ids
            if factories_by_id[factory_id].name == user.factory_name
        ),
        None,
    )
    primary_factory_id = current_primary_factory_id or selected_factory_ids[0]
    primary_factory = factories_by_id[primary_factory_id]
    user.factory_name = primary_factory.name
    user.factory_code = primary_factory.factory_code

    if added_factory_ids or removed_factory_ids:
        _write_admin_audit(
            db,
            actor_id=current_user.id,
            org_id=org_id,
            factory_id=resolve_factory_id(db, current_user),
            action="FACTORY_ACCESS_UPDATED",
            details=(
                f"user_id={user.id} "
                f"added={','.join(added_factory_ids) or '-'} "
                f"removed={','.join(removed_factory_ids) or '-'} "
                f"total={len(selected_factory_ids)}"
            ),
            request=request,
        )

    db.commit()
    response = _serialize_user_factory_access(db, current_user=current_user, target_user=user)
    response["message"] = "Factory access updated."
    return response


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    if payload.role == UserRole.ACCOUNTANT and not has_org_feature(
        db,
        org_id=org_id,
        fallback_user_id=current_user.id,
        feature_key="accountant",
    ):
        current_plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
        raise HTTPException(
            status_code=403,
            detail=f"Accountant role is not available on the {current_plan.title()} plan. Upgrade to Growth or higher to unlock this.",
        )
    factory_id = resolve_factory_id(db, current_user)
    user = _scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    _assert_role_update_allowed(
        db,
        current_user=current_user,
        current_target_role=user.role,
        new_target_role=payload.role,
    )
    if role_rank(payload.role) < role_rank(user.role):
        if (payload.confirm_action or "").strip().upper() != "DOWNGRADE":
            raise HTTPException(status_code=400, detail="Type DOWNGRADE to confirm role downgrade.")
    if user.id == current_user.id and payload.role != current_user.role and not is_admin_or_owner(current_user):
        raise HTTPException(status_code=400, detail="You cannot change your own role.")
    if user.role in {UserRole.ADMIN, UserRole.OWNER} and payload.role != user.role:
        if not _has_other_privileged_user(db, org_id=org_id, exclude_user_id=user.id):
            raise HTTPException(status_code=400, detail="Cannot remove the last owner/admin account.")
    if payload.role == user.role:
        return {
            "message": (
                f"No role change applied. User #{user.user_code} "
                f"({user.name}) is already {user.role.value}."
            )
        }
    old_role = user.role
    user.role = payload.role
    memberships = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == user.id, UserFactoryRole.org_id == org_id)
        .all()
    )
    for membership in memberships:
        membership.role = payload.role
    if old_role != payload.role:
        _write_admin_audit(
            db,
            actor_id=current_user.id,
            org_id=org_id,
            factory_id=factory_id,
            action="ROLE_UPDATED",
            details=f"user_id={user.id} old_role={old_role.value} new_role={payload.role.value}",
            request=request,
        )
    db.commit()
    return {"message": "Role updated."}


@router.put("/users/{user_id}/plan")
def update_user_plan(
    user_id: int,
    payload: PlanUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    plan = normalize_plan(payload.plan)
    if plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail=f"Plan must be one of: {', '.join(sorted(ALLOWED_PLANS))}.")
    org_id = resolve_org_id(current_user)
    factory_id = resolve_factory_id(db, current_user)
    user = _scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    plan_row = db.query(UserPlan).filter(UserPlan.user_id == user_id).first()
    old_plan = plan_row.plan if plan_row else DEFAULT_PLAN
    if not plan_row:
        plan_row = UserPlan(user_id=user_id, plan=plan)
        db.add(plan_row)
    else:
        plan_row.plan = plan
        plan_row.updated_at = datetime.now(timezone.utc)
    if old_plan != plan:
        _write_admin_audit(
            db,
            actor_id=current_user.id,
            org_id=org_id,
            factory_id=factory_id,
            action="PLAN_UPDATED",
            details=f"user_id={user.id} old_plan={old_plan} new_plan={plan}",
            request=request,
        )
    db.commit()
    return {"message": "Plan updated.", "plan": plan}


@router.put("/org/plan")
def update_org_plan(
    payload: PlanUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.OWNER)
    if not _manual_plan_override_enabled():
        raise HTTPException(status_code=403, detail="Manual plan override is disabled.")
    plan = normalize_plan(payload.plan)
    if plan not in ALLOWED_PLANS:
        raise HTTPException(status_code=400, detail=f"Plan must be one of: {', '.join(sorted(ALLOWED_PLANS))}.")
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    org = db.query(Organization).filter(Organization.org_id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    old_plan = org.plan or DEFAULT_PLAN
    org.plan = plan
    org.plan_expires_at = None
    if old_plan != plan:
        _write_admin_audit(
            db,
            actor_id=current_user.id,
            org_id=org_id,
            factory_id=resolve_factory_id(db, current_user),
            action="ORG_PLAN_UPDATED",
            details=f"org_id={org_id} old_plan={old_plan} new_plan={plan}",
            request=request,
        )
    db.commit()
    return {"message": "Organization plan updated.", "plan": plan}


@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    factory_id = resolve_factory_id(db, current_user)
    user = _scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
    if user.role in {UserRole.ADMIN, UserRole.OWNER}:
        if not _has_other_privileged_user(db, org_id=org_id, exclude_user_id=user.id):
            raise HTTPException(status_code=400, detail="Cannot deactivate the last owner/admin account.")
    user.is_active = False
    _write_admin_audit(
        db,
        actor_id=current_user.id,
        org_id=org_id,
        factory_id=factory_id,
        action="USER_DEACTIVATED",
        details=f"user_id={user.id} role={user.role.value}",
        request=request,
    )
    db.commit()
    return {"message": "User deactivated."}


@router.get("/users/lookup")
def lookup_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    query = _scoped_users_query(db, current_user)
    return [{"id": user.id, "user_code": user.user_code, "name": user.name} for user in query.all()]


@router.get("/usage")
def get_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    org_id = resolve_org_id(current_user)
    if org_id:
        plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
        return get_org_usage_summary(db, org_id=org_id, plan=plan)
    return get_usage_summary(db, user_id=current_user.id)


@router.get("/plan/last-upgrade")
def last_plan_upgrade(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    org_id = resolve_org_id(current_user)
    query = db.query(AuditLog).filter(AuditLog.action == "PLAN_UPGRADED")
    if org_id:
        query = query.filter(AuditLog.org_id == org_id)
    query = query.filter(AuditLog.user_id == current_user.id)
    log = query.order_by(AuditLog.timestamp.desc()).first()
    if not log:
        return {"timestamp": None, "details": None, "plan": None}
    plan = None
    if log.details:
        for part in log.details.split(";"):
            part = part.strip()
            if part.startswith("plan="):
                plan = part.split("=", 1)[-1].strip() or None
                break
    return {"timestamp": log.timestamp, "details": log.details, "plan": plan}


@router.post("/usage/reconcile")
def reconcile_usage_endpoint(
    payload: UsageReconcileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, UserRole.ADMIN)
    if payload.period and (len(payload.period) != 7 or payload.period[4] != "-"):
        raise HTTPException(status_code=400, detail="Period must be in YYYY-MM format.")
    allow_decrease = payload.allow_decrease
    if allow_decrease is None:
        allow_decrease = os.getenv("USAGE_RECONCILE_ALLOW_DECREASE", "1") == "1"
    return reconcile_org_usage(
        db,
        period=payload.period,
        allow_decrease=bool(allow_decrease),
        dry_run=payload.dry_run,
        seed_from_user=payload.seed_from_user,
    )


@router.post("/demo/load")
def load_demo_data(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    require_role(current_user, UserRole.ADMIN)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization not found for current user.")
    factory = _active_factory(db, current_user)
    if not factory:
        raise HTTPException(status_code=400, detail="Select an active factory before loading demo data.")

    today = date.today()
    created_rows: list[Entry] = []
    touched_ids: list[int] = []
    created_count = 0
    updated_count = 0

    shift_templates = [
        {
            "shift": ShiftType.MORNING,
            "department": "Rolling",
            "target": 5200,
            "produced": 5050,
            "downtime": 18,
            "downtime_reason": "Changeover",
            "present": 34,
            "absent": 3,
            "materials": "Billets, consumables",
        },
        {
            "shift": ShiftType.EVENING,
            "department": "Melt Shop",
            "target": 5000,
            "produced": 4860,
            "downtime": 24,
            "downtime_reason": "Ladle prep delay",
            "present": 31,
            "absent": 2,
            "materials": "Scrap mix, flux",
        },
        {
            "shift": ShiftType.NIGHT,
            "department": "Dispatch",
            "target": 4600,
            "produced": 4490,
            "downtime": 16,
            "downtime_reason": "Vehicle queue",
            "present": 28,
            "absent": 2,
            "materials": "Finished coils",
        },
    ]

    for day_offset in range(6, -1, -1):
        entry_date = today - timedelta(days=day_offset)
        for index, template in enumerate(shift_templates):
            variation = ((day_offset + index) % 5 - 2) * 35
            target = max(1200, int(template["target"]) + variation)
            produced = max(0, int(template["produced"]) + variation - (day_offset % 3) * 10)
            downtime_minutes = max(0, int(template["downtime"]) + (day_offset + index) % 4 * 3)
            manpower_present = max(1, int(template["present"]) - (day_offset % 2))
            manpower_absent = max(0, int(template["absent"]) + ((day_offset + index) % 3 == 0))
            quality_issues = downtime_minutes >= 28 or produced < int(target * 0.92)

            client_request_id = (
                f"demo:{org_id}:{factory.factory_id}:{entry_date.isoformat()}:{template['shift'].value}"
            )
            existing = (
                db.query(Entry)
                .filter(
                    Entry.org_id == org_id,
                    Entry.factory_id == factory.factory_id,
                    Entry.client_request_id == client_request_id,
                    Entry.is_active.is_(True),
                )
                .first()
            )

            if existing:
                existing.user_id = current_user.id
                existing.date = entry_date
                existing.shift = template["shift"]
                existing.units_target = target
                existing.units_produced = produced
                existing.manpower_present = manpower_present
                existing.manpower_absent = manpower_absent
                existing.downtime_minutes = downtime_minutes
                existing.downtime_reason = str(template["downtime_reason"])
                existing.department = str(template["department"])
                existing.materials_used = str(template["materials"])
                existing.quality_issues = quality_issues
                existing.quality_details = (
                    "Variance detected; supervisor review suggested." if quality_issues else None
                )
                existing.notes = "System-seeded demo production record."
                existing.ai_summary = (
                    f"{template['shift'].value.title()} shift at {factory.name}: "
                    f"{produced}/{target} units, downtime {downtime_minutes} min."
                )
                existing.status = "submitted"
                updated_count += 1
                touched_ids.append(existing.id)
                continue

            entry = Entry(
                user_id=current_user.id,
                org_id=org_id,
                factory_id=factory.factory_id,
                date=entry_date,
                shift=template["shift"],
                units_target=target,
                units_produced=produced,
                manpower_present=manpower_present,
                manpower_absent=manpower_absent,
                downtime_minutes=downtime_minutes,
                downtime_reason=str(template["downtime_reason"]),
                department=str(template["department"]),
                materials_used=str(template["materials"]),
                quality_issues=quality_issues,
                quality_details="Variance detected; supervisor review suggested." if quality_issues else None,
                notes="System-seeded demo production record.",
                client_request_id=client_request_id,
                ai_summary=(
                    f"{template['shift'].value.title()} shift at {factory.name}: "
                    f"{produced}/{target} units, downtime {downtime_minutes} min."
                ),
                status="submitted",
                is_active=True,
            )
            db.add(entry)
            created_rows.append(entry)
            created_count += 1

    if created_rows:
        db.flush()
        touched_ids.extend(entry.id for entry in created_rows)

    _write_admin_audit(
        db,
        actor_id=current_user.id,
        org_id=org_id,
        factory_id=factory.factory_id,
        action="DEMO_DATA_LOADED",
        details=f"created={created_count};updated={updated_count};records=7x3",
        request=request,
    )
    db.commit()
    return {
        "message": "Demo data loaded successfully.",
        "factory_id": factory.factory_id,
        "factory_name": factory.name,
        "created_count": created_count,
        "updated_count": updated_count,
        "entry_ids": touched_ids,
        "window": {
            "from": (today - timedelta(days=6)).isoformat(),
            "to": today.isoformat(),
            "days": 7,
        },
    }
