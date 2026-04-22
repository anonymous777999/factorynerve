"""Authentication router for user registration and JWT auth flows."""

from __future__ import annotations

import hashlib
import io
import logging
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db, hash_ip_address
from backend.models.report import AuditLog, TokenBlacklist
from backend.models.email_verification_token import EmailVerificationToken
from backend.models.pending_registration import PendingRegistration
from backend.models.refresh_token import RefreshToken
from backend.models.user import User, UserReadSchema, UserRole
from backend.models.factory import Factory
from backend.models.organization import Organization
from backend.models.user_factory_role import UserFactoryRole
from backend.security import (
    create_access_token,
    decode_access_token,
    get_current_user,
    hash_password,
    is_admin,
    validate_password_strength,
    verify_password,
)
from backend.utils import get_config, normalize_identifier_code, normalize_phone_number, sanitize_text
from backend.plans import DEFAULT_PLAN, get_org_plan
from backend.models.subscription import Subscription
from backend.factory_profiles import get_factory_profile
from backend.factory_templates import (
    default_workflow_template_key,
    get_workflow_template,
    serialize_workflow_template,
)
from backend.services.email_verification_service import (
    build_verification_link,
    create_verification_token,
    verify_verification_token,
)
from backend.services.pending_registration_service import (
    create_or_update_pending_registration,
    verify_pending_registration_token,
)
from backend.services.password_reset_service import build_reset_link, create_reset_token, verify_reset_token
from backend.services.user_code_service import (
    MAX_USER_CODE_ATTEMPTS,
    is_user_code_collision,
    next_user_code,
)
from backend.email_service import send_email
from backend.services.registration_service import resolve_registration_context
from backend.auth_cookies import (
    clear_auth_cookies,
    get_access_cookie,
    get_refresh_cookie,
    require_csrf,
    set_auth_cookies,
    wants_cookie_auth,
)


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Authentication"])

LOGIN_ATTEMPT_LIMIT = 5
LOGIN_ATTEMPT_WINDOW_SECONDS = 60
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
PASSWORD_RESET_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "30"))
PASSWORD_RESET_EMAIL_SUBJECT = os.getenv("PASSWORD_RESET_EMAIL_SUBJECT", "Reset your DPR.ai password")
EMAIL_VERIFICATION_TTL_HOURS = int(os.getenv("EMAIL_VERIFICATION_TTL_HOURS", "24"))
EMAIL_VERIFICATION_EMAIL_SUBJECT = os.getenv(
    "EMAIL_VERIFICATION_EMAIL_SUBJECT",
    "Verify your DPR.ai email",
)
PROFILE_PHOTO_MAX_BYTES = int(os.getenv("PROFILE_PHOTO_MAX_BYTES", str(5 * 1024 * 1024)))
PROFILE_PHOTO_SIZE = max(256, int(os.getenv("PROFILE_PHOTO_SIZE", "512")))
PROFILE_PHOTO_DIR = Path(__file__).resolve().parents[2] / "var" / "profile_photos"
_rate_limit_lock = threading.Lock()
_login_attempts: dict[str, deque[float]] = defaultdict(deque)


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _should_expose_reset_link() -> bool:
    explicit = os.getenv("PASSWORD_RESET_EXPOSE_LINK")
    if explicit is not None:
        return _to_bool(explicit, False)
    return get_config().app_env != "production"


def _should_expose_verification_link() -> bool:
    explicit = os.getenv("EMAIL_VERIFICATION_EXPOSE_LINK")
    if explicit is not None:
        return _to_bool(explicit, False)
    return get_config().app_env != "production"


def _profile_photo_route(photo_name: str) -> str:
    return f"/auth/profile-photo/{photo_name}"


def _extract_local_profile_photo_name(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    path = parsed.path or value
    prefix = "/auth/profile-photo/"
    if not path.startswith(prefix):
        return None
    photo_name = path[len(prefix) :].strip()
    if not photo_name:
        return None
    safe_name = Path(photo_name).name
    if safe_name != photo_name:
        return None
    return safe_name


def _delete_local_profile_photo(value: str | None) -> None:
    photo_name = _extract_local_profile_photo_name(value)
    if not photo_name:
        return
    photo_path = PROFILE_PHOTO_DIR / photo_name
    try:
        photo_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete profile photo: %s", photo_path)


def _prepare_profile_photo(image_bytes: bytes) -> bytes:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="Upload a valid image file.") from error

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGBA")
        background = Image.new("RGBA", image.size, (11, 15, 25, 255))
        background.alpha_composite(image)
        image = background.convert("RGB")
    elif image.mode == "L":
        image = image.convert("RGB")

    width, height = image.size
    if width < 32 or height < 32:
        raise HTTPException(status_code=400, detail="Profile photo is too small.")

    crop_size = min(width, height)
    left = int((width - crop_size) / 2)
    top = int((height - crop_size) / 2)
    image = image.crop((left, top, left + crop_size, top + crop_size))
    image = image.resize((PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE), Image.Resampling.LANCZOS)

    output = io.BytesIO()
    image.save(output, format="JPEG", quality=88, optimize=True)
    return output.getvalue()


def _save_profile_photo(*, user_id: int, image_bytes: bytes) -> str:
    PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    photo_name = f"user-{user_id}-{secrets.token_hex(10)}.jpg"
    photo_path = PROFILE_PHOTO_DIR / photo_name
    photo_path.write_bytes(image_bytes)
    return _profile_photo_route(photo_name)


def _frontend_reset_link_from_request(request: Request, token: str) -> str | None:
    origin = (request.headers.get("origin") or "").strip()
    referer = (request.headers.get("referer") or "").strip()

    if origin.startswith(("http://", "https://")):
        return f"{origin.rstrip('/')}/reset-password?token={token}"

    if referer.startswith(("http://", "https://")):
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/reset-password?token={token}"

    return None


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


def _send_auth_email(
    *,
    subject: str,
    to_email: str,
    body: str,
    context: str,
) -> bool:
    try:
        send_email(subject=subject, to_emails=[to_email], body=body)
        return True
    except Exception:  # pylint: disable=broad-except
        logger.exception("Auth email delivery failed for %s.", context)
        return False


def _check_rate_limit(ip_address: str) -> bool:
    with _rate_limit_lock:
        now = time.time()
        attempts = _login_attempts[ip_address]
        while attempts and now - attempts[0] > LOGIN_ATTEMPT_WINDOW_SECONDS:
            attempts.popleft()
        return len(attempts) >= LOGIN_ATTEMPT_LIMIT


def _register_failed_attempt(ip_address: str) -> None:
    with _rate_limit_lock:
        _login_attempts[ip_address].append(time.time())


def _clear_attempts(ip_address: str) -> None:
    with _rate_limit_lock:
        _login_attempts.pop(ip_address, None)


def _log_auth_event(
    db: Session,
    action: str,
    details: str,
    user_id: int | None,
    request: Request,
    *,
    org_id: str | None = None,
    factory_id: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            org_id=org_id,
            factory_id=factory_id,
            action=action,
            details=details,
            ip_address=hash_ip_address(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
            timestamp=datetime.now(timezone.utc),
        )
    )


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: UserRole
    factory_name: str = Field(min_length=2, max_length=255)
    company_code: str | None = Field(default=None, max_length=32)
    phone_number: str | None = Field(default=None, max_length=32)

    @field_validator("company_code")
    @classmethod
    def validate_company_code(cls, value: str | None) -> str | None:
        return normalize_identifier_code(value, field_name="Company code")

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str | None) -> str | None:
        return normalize_phone_number(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone_number: str | None = Field(default=None, max_length=32)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str | None) -> str | None:
        return normalize_phone_number(value)


class FactoryAccess(BaseModel):
    factory_id: str
    name: str
    role: str
    factory_code: str | None = None
    industry_type: str = "general"
    industry_label: str = "General Manufacturing"
    workflow_template_key: str | None = None
    workflow_template_label: str | None = None
    location: str | None = None
    timezone: str | None = None


class OrganizationContext(BaseModel):
    org_id: str
    name: str
    plan: str
    total_factories: int
    accessible_factories: int


class AuthContextResponse(BaseModel):
    user: UserReadSchema
    active_factory_id: str | None = None
    active_factory: FactoryAccess | None = None
    factories: list[FactoryAccess] = Field(default_factory=list)
    organization: OrganizationContext | None = None
    model_config = ConfigDict(from_attributes=True)


class AuthResponse(AuthContextResponse):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class ActiveWorkflowTemplateResponse(BaseModel):
    factory_id: str | None = None
    factory_name: str | None = None
    factory_code: str | None = None
    industry_type: str
    industry_label: str
    workflow_template_key: str
    workflow_template_label: str
    starter_modules: list[str] = Field(default_factory=list)
    template: dict[str, object]


class SessionSummaryResponse(BaseModel):
    active_devices: int
    last_activity: datetime | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=32, max_length=2048)


class PasswordForgotRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=12, max_length=128)


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationTokenRequest(BaseModel):
    token: str


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    pending_factory_name: str
    verification_required: bool = True
    verification_link: str | None = None
    delivery_mode: str = "email"


class EmailVerificationResponse(BaseModel):
    message: str
    verification_link: str | None = None
    delivery_mode: str = "email"


class EmailVerificationValidateResponse(BaseModel):
    valid: bool
    message: str
    email: EmailStr | None = None


class PasswordForgotResponse(BaseModel):
    message: str
    reset_link: str | None = None
    delivery_mode: str = "email"


class PasswordResetValidateResponse(BaseModel):
    valid: bool
    message: str


class SelectFactoryRequest(BaseModel):
    factory_id: str = Field(min_length=4, max_length=36)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class FactoryListResponse(BaseModel):
    user_id: int
    user_code: int | None = None
    active_factory_id: str | None = None
    active_factory: FactoryAccess | None = None
    factories: list[FactoryAccess] = Field(default_factory=list)
    organization: OrganizationContext | None = None


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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


def _issue_refresh_token(
    db: Session, *, user: User, org_id: str | None, factory_id: str | None
) -> str:
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=REFRESH_TOKEN_DAYS)
    db.add(
        RefreshToken(
            token_hash=_hash_refresh_token(token),
            user_id=user.id,
            org_id=org_id,
            factory_id=factory_id,
            created_at=now,
            expires_at=expires_at,
        )
    )
    return token


def _get_factory_access(db: Session, *, user_id: int) -> list[FactoryAccess]:
    rows = (
        db.query(UserFactoryRole, Factory)
        .join(Factory, Factory.factory_id == UserFactoryRole.factory_id)
        .filter(UserFactoryRole.user_id == user_id, Factory.is_active.is_(True))
        .order_by(Factory.name.asc())
        .all()
    )
    access_rows: list[FactoryAccess] = []
    for role, factory in rows:
        profile = get_factory_profile(factory.industry_type)
        template = get_workflow_template(factory.workflow_template_key)
        access_rows.append(
            FactoryAccess(
                factory_id=factory.factory_id,
                name=factory.name,
                role=str(role.role.value),
                factory_code=factory.factory_code,
                industry_type=profile.key,
                industry_label=profile.label,
                workflow_template_key=factory.workflow_template_key,
                workflow_template_label=template.label if template else None,
                location=factory.location,
                timezone=factory.timezone,
            )
        )
    return access_rows


def _get_org_context(
    db: Session,
    *,
    org_id: str | None,
    fallback_user_id: int,
    accessible_factories: int,
) -> OrganizationContext | None:
    if not org_id:
        return None
    org = db.query(Organization).filter(Organization.org_id == org_id, Organization.is_active.is_(True)).first()
    if not org:
        return None
    total_factories = (
        db.query(Factory.factory_id)
        .filter(Factory.org_id == org_id, Factory.is_active.is_(True))
        .count()
    )
    return OrganizationContext(
        org_id=org.org_id,
        name=org.name,
        plan=get_org_plan(db, org_id=org.org_id, fallback_user_id=fallback_user_id),
        total_factories=total_factories,
        accessible_factories=accessible_factories,
    )


def _build_auth_context(
    db: Session,
    *,
    user: User,
    active_factory_id: str | None,
) -> dict[str, object]:
    factories = _get_factory_access(db, user_id=user.id)
    active_factory = next((item for item in factories if item.factory_id == active_factory_id), None)
    organization = _get_org_context(
        db,
        org_id=user.org_id,
        fallback_user_id=user.id,
        accessible_factories=len(factories),
    )
    return {
        "user": user,
        "active_factory_id": active_factory_id,
        "active_factory": active_factory,
        "factories": factories,
        "organization": organization,
    }


def _build_active_template_context(
    db: Session,
    *,
    user: User,
    active_factory_id: str | None,
) -> ActiveWorkflowTemplateResponse:
    factory: Factory | None = None
    if active_factory_id:
        factory = (
            db.query(Factory)
            .filter(Factory.factory_id == active_factory_id, Factory.is_active.is_(True))
            .first()
        )
    if not factory:
        factory = (
            db.query(Factory)
            .join(UserFactoryRole, UserFactoryRole.factory_id == Factory.factory_id)
            .filter(UserFactoryRole.user_id == user.id, Factory.is_active.is_(True))
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )

    profile = get_factory_profile(factory.industry_type if factory else None)
    template_key = (
        factory.workflow_template_key
        if factory and factory.workflow_template_key
        else default_workflow_template_key(profile.key)
    )
    template = get_workflow_template(template_key)
    if not template:
        template_key = default_workflow_template_key(profile.key)
        template = get_workflow_template(template_key)
    return ActiveWorkflowTemplateResponse(
        factory_id=factory.factory_id if factory else active_factory_id,
        factory_name=factory.name if factory else user.factory_name,
        factory_code=factory.factory_code if factory else user.factory_code,
        industry_type=profile.key,
        industry_label=profile.label,
        workflow_template_key=template_key,
        workflow_template_label=template.label if template else template_key,
        starter_modules=list(profile.starter_modules),
        template=serialize_workflow_template(template) if template else {},
    )


def _revoke_refresh_token(db: Session, *, token: str, user_id: int) -> None:
    token_hash = _hash_refresh_token(token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if record and record.user_id == user_id and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        db.add(record)


def _resolve_active_factory_id(
    db: Session, *, user_id: int, preferred_factory_id: str | None
) -> str | None:
    if preferred_factory_id:
        row = (
            db.query(UserFactoryRole)
            .filter(
                UserFactoryRole.user_id == user_id,
                UserFactoryRole.factory_id == preferred_factory_id,
            )
            .first()
        )
        if row:
            return preferred_factory_id
    row = (
        db.query(UserFactoryRole)
        .filter(UserFactoryRole.user_id == user_id)
        .order_by(UserFactoryRole.assigned_at.asc())
        .first()
    )
    return row.factory_id if row else None


def _preview_public_registration(
    db: Session,
    *,
    requested_factory: str,
    provided_code: str | None,
    requested_role: UserRole,
) -> tuple[str, str | None]:
    code = (provided_code or "").strip().upper()
    normalized_factory = requested_factory.strip()
    org_id: str | None = None

    if code:
        factory = (
            db.query(Factory)
            .filter(Factory.factory_code == code, Factory.is_active.is_(True))
            .first()
        )
        if factory:
            if factory.name.strip().lower() != normalized_factory.lower():
                raise HTTPException(status_code=400, detail="Company code does not match factory name.")
            org_id = factory.org_id
            normalized_factory = factory.name
        else:
            legacy = (
                db.query(User)
                .filter(User.factory_code == code, User.is_active.is_(True))
                .first()
            )
            if not legacy:
                raise HTTPException(status_code=400, detail="Invalid company code.")
            if legacy.factory_name.strip().lower() != normalized_factory.lower():
                raise HTTPException(status_code=400, detail="Company code does not match factory name.")
            org_id = legacy.org_id
            normalized_factory = legacy.factory_name
    else:
        existing_factory_user = (
            db.query(User)
            .filter(User.factory_name == normalized_factory, User.is_active.is_(True))
            .first()
        )
        if existing_factory_user:
            org_id = existing_factory_user.org_id

    has_existing_org_user = False
    if org_id:
        has_existing_org_user = (
            db.query(User.id)
            .filter(User.org_id == org_id, User.is_active.is_(True))
            .first()
            is not None
        )

    if has_existing_org_user and requested_role not in {UserRole.ATTENDANCE, UserRole.OPERATOR}:
        raise HTTPException(
            status_code=403,
            detail="Public registration is limited to attendance accounts. Ask an admin or owner to invite higher roles.",
        )

    return normalized_factory, org_id


def _activate_pending_registration(
    db: Session,
    *,
    pending: PendingRegistration,
    request: Request,
) -> None:
    existing_user = db.query(User).filter(User.email == pending.email.lower()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email is already registered.")

    requested_factory = (
        sanitize_text(pending.factory_name, max_length=255, preserve_newlines=False)
        or pending.factory_name.strip()
    )
    organization, factory, factory_code, requested_factory = resolve_registration_context(
        db,
        requested_factory=requested_factory,
        provided_code=pending.company_code,
    )
    resolved_org_id = organization.org_id
    has_existing_org_user = (
        db.query(User.id)
        .filter(User.org_id == resolved_org_id, User.is_active.is_(True))
        .first()
        is not None
    )
    if has_existing_org_user and pending.requested_role not in {UserRole.ATTENDANCE, UserRole.OPERATOR}:
        raise HTTPException(
            status_code=403,
            detail="Public registration is limited to attendance accounts. Ask an admin or owner to invite higher roles.",
        )
    assigned_role = UserRole.ADMIN if not has_existing_org_user else UserRole.ATTENDANCE

    user = User(
        name=sanitize_text(pending.name, max_length=120, preserve_newlines=False) or pending.name.strip(),
        email=pending.email.lower(),
        password_hash=pending.password_hash,
        role=assigned_role,
        factory_name=requested_factory,
        factory_code=factory_code,
        phone_number=pending.phone_number,
        org_id=resolved_org_id,
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    user = _persist_user_with_user_code(db, user)

    db.add(
        UserFactoryRole(
            user_id=user.id,
            factory_id=factory.factory_id,
            org_id=organization.org_id,
            role=assigned_role,
        )
    )

    if not db.query(Subscription).filter(Subscription.user_id == user.id).first():
        trial_days = int(os.getenv("TRIAL_DAYS", "7"))
        now = datetime.now(timezone.utc)
        db.add(
            Subscription(
                user_id=user.id,
                plan=DEFAULT_PLAN,
                status="trialing",
                trial_start_at=now,
                trial_end_at=now + timedelta(days=trial_days),
            )
        )

    pending.used_at = datetime.now(timezone.utc)
    pending.updated_at = datetime.now(timezone.utc)
    db.add(pending)

    _log_auth_event(
        db,
        "USER_REGISTERED_VERIFIED",
        "Pending public registration activated after email verification.",
        user.id,
        request,
        org_id=organization.org_id,
        factory_id=factory.factory_id,
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    try:
        if payload.role == UserRole.OWNER:
            raise HTTPException(status_code=403, detail="Owner accounts cannot be created from public registration.")
        validate_password_strength(payload.password)
        existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="Email is already registered.")

        requested_factory = (
            sanitize_text(payload.factory_name, max_length=255, preserve_newlines=False)
            or payload.factory_name.strip()
        )
        requested_factory, _org_id_hint = _preview_public_registration(
            db,
            requested_factory=requested_factory,
            provided_code=payload.company_code,
            requested_role=payload.role,
        )
        verification_token = create_or_update_pending_registration(
            db,
            name=sanitize_text(payload.name, max_length=120, preserve_newlines=False) or payload.name.strip(),
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            requested_role=payload.role,
            factory_name=requested_factory,
            company_code=payload.company_code,
            phone_number=payload.phone_number,
            ttl_hours=EMAIL_VERIFICATION_TTL_HOURS,
        )
        verification_link = (
            _frontend_verification_link_from_request(request, verification_token)
            or build_verification_link(verification_token)
        )
        delivery_mode = "preview" if _should_expose_verification_link() else "email"
        message = "Signup submitted. Verify the email to create and activate this account."
        if delivery_mode == "email":
            sent = _send_auth_email(
                subject=EMAIL_VERIFICATION_EMAIL_SUBJECT,
                to_email=payload.email.lower(),
                body=(
                    "Welcome to DPR.ai.\n\n"
                    "Verify your email address to activate your account.\n\n"
                    f"Verification link (valid {EMAIL_VERIFICATION_TTL_HOURS} hours):\n{verification_link}\n\n"
                    "If you did not create this account, you can ignore this email."
                ),
                context="registration_verification",
            )
            if not sent:
                delivery_mode = "email_failed"
                message = (
                    "Signup saved, but we could not send the verification email right now. "
                    "Please use resend verification in a moment."
                )
                _log_auth_event(
                    db,
                    "PUBLIC_SIGNUP_PENDING_VERIFICATION_EMAIL_FAILED",
                    "Pending signup saved, but the first verification email could not be delivered.",
                    None,
                    request,
                )

        if delivery_mode != "email_failed":
            _log_auth_event(
                db,
                "PUBLIC_SIGNUP_PENDING_VERIFICATION",
                "Public signup is waiting for email verification before account creation.",
                None,
                request,
            )
        db.commit()
        return RegisterResponse(
            message=message,
            email=payload.email.lower(),
            pending_factory_name=requested_factory,
            verification_required=True,
            verification_link=verification_link if delivery_mode == "preview" else None,
            delivery_mode=delivery_mode,
        )
    except HTTPException:
        db.rollback()
        raise
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("User registration failed.")
        raise HTTPException(status_code=500, detail="Could not complete registration.") from error


@router.post("/login", response_model=AuthResponse)
def login_user(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    ip_address = request.client.host if request.client else "unknown"
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if _check_rate_limit(ip_address):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    try:
        user = db.query(User).filter(User.email == payload.email.lower(), User.is_active.is_(True)).first()
        if not user:
            pending = (
                db.query(PendingRegistration)
                .filter(
                    PendingRegistration.email == payload.email.lower(),
                    PendingRegistration.used_at.is_(None),
                    PendingRegistration.expires_at > datetime.now(timezone.utc),
                )
                .first()
            )
            if pending and verify_password(payload.password, pending.password_hash):
                _register_failed_attempt(ip_address)
                _log_auth_event(
                    db,
                    "USER_LOGIN_BLOCKED_PENDING_VERIFICATION",
                    "Login blocked because signup is still waiting for email verification.",
                    None,
                    request,
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Verify your email before signing in.",
                )
            _register_failed_attempt(ip_address)
            _log_auth_event(db, "USER_LOGIN_FAILED", "Failed login attempt.", None, request)
            db.commit()
            raise generic_error
        if not verify_password(payload.password, user.password_hash):
            _register_failed_attempt(ip_address)
            _log_auth_event(db, "USER_LOGIN_FAILED", "Failed login attempt.", None, request)
            db.commit()
            raise generic_error
        if user.auth_provider == "local" and user.email_verified_at is None:
            _register_failed_attempt(ip_address)
            _log_auth_event(
                db,
                "USER_LOGIN_BLOCKED_UNVERIFIED",
                "Login blocked because email is not verified.",
                user.id,
                request,
                org_id=user.org_id,
                factory_id=None,
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Verify your email before signing in.",
            )

        user.last_login = datetime.now(timezone.utc)
        _clear_attempts(ip_address)
        role_row = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        active_factory_id = role_row.factory_id if role_row else None
        active_role = role_row.role.value if role_row else user.role.value
        _log_auth_event(
            db,
            "USER_LOGIN",
            "User login successful.",
            user.id,
            request,
            org_id=user.org_id,
            factory_id=active_factory_id,
        )
        refresh_token = _issue_refresh_token(
            db, user=user, org_id=user.org_id, factory_id=active_factory_id
        )
        db.commit()
        db.refresh(user)

        token = create_access_token(
            user_id=user.id,
            role=active_role,
            email=user.email,
            org_id=user.org_id,
            factory_id=active_factory_id,
        )
        auth_context = _build_auth_context(db, user=user, active_factory_id=active_factory_id)
        auth_response = AuthResponse(
            access_token=token,
            refresh_token=refresh_token,
            **auth_context,
        )
        if wants_cookie_auth(request):
            csrf_token = set_auth_cookies(
                response=response,
                access_token=token,
                refresh_token=refresh_token,
                request=request,
            )
            response.headers["X-CSRF-Token"] = csrf_token
        return auth_response
    except HTTPException:
        raise
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("User login failed.")
        raise HTTPException(status_code=500, detail="Could not process login.") from error


@router.post("/logout")
def logout_user(
    request: Request,
    response: Response,
    payload: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    credentials = request.headers.get("Authorization", "")
    token = credentials.replace("Bearer ", "").strip() if credentials else ""
    if not token:
        token = get_access_cookie(request) or ""
        if token:
            require_csrf(request)
    if token:
        token_payload = decode_access_token(token)
        jti = str(token_payload.get("jti"))
        exp = datetime.fromtimestamp(int(token_payload["exp"]), tz=timezone.utc)

        existing = db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first()
        if not existing:
            db.add(TokenBlacklist(token_jti=jti, user_id=current_user.id, expires_at=exp))

    refresh_token = payload.refresh_token if payload and payload.refresh_token else None
    if not refresh_token:
        refresh_token = get_refresh_cookie(request)
    if refresh_token:
        _revoke_refresh_token(db, token=refresh_token, user_id=current_user.id)
    clear_auth_cookies(response=response)

    _log_auth_event(db, "USER_LOGOUT", "User logged out.", current_user.id, request)
    db.commit()
    return {"message": "Logged out successfully."}


@router.post("/logout-all")
def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if get_access_cookie(request) or get_refresh_cookie(request):
        require_csrf(request)

    credentials = request.headers.get("Authorization", "")
    token = credentials.replace("Bearer ", "").strip() if credentials else ""
    if not token:
        token = get_access_cookie(request) or ""
    if token:
        token_payload = decode_access_token(token)
        jti = str(token_payload.get("jti"))
        exp = datetime.fromtimestamp(int(token_payload["exp"]), tz=timezone.utc)
        existing = db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first()
        if not existing:
            db.add(TokenBlacklist(token_jti=jti, user_id=current_user.id, expires_at=exp))

    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > now,
    ).update({"revoked_at": now}, synchronize_session=False)
    clear_auth_cookies(response=response)

    _log_auth_event(
        db,
        "USER_LOGOUT_ALL",
        "User logged out from all devices.",
        current_user.id,
        request,
        org_id=current_user.org_id,
        factory_id=None,
    )
    db.commit()
    return {"message": "Logged out from all devices successfully."}


@router.post("/refresh", response_model=AuthResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
) -> AuthResponse:
    refresh_token = payload.refresh_token if payload else None
    if not refresh_token:
        refresh_token = get_refresh_cookie(request)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing.")
    now = datetime.now(timezone.utc)
    token_hash = _hash_refresh_token(refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not record or record.revoked_at or record.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired.")

    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    role_row: UserFactoryRole | None = None
    factory_id = record.factory_id
    if factory_id:
        role_row = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id, UserFactoryRole.factory_id == factory_id)
            .first()
        )
        if not role_row:
            factory_id = None

    if not role_row:
        role_row = (
            db.query(UserFactoryRole)
            .filter(UserFactoryRole.user_id == user.id)
            .order_by(UserFactoryRole.assigned_at.asc())
            .first()
        )
        factory_id = role_row.factory_id if role_row else None

    org_id = record.org_id or user.org_id
    active_role = role_row.role.value if role_row else user.role.value

    access_token = create_access_token(
        user_id=user.id,
        role=active_role,
        email=user.email,
        org_id=org_id,
        factory_id=factory_id,
    )

    record.revoked_at = now
    record.last_used_at = now
    refresh_token = _issue_refresh_token(db, user=user, org_id=org_id, factory_id=factory_id)

    _log_auth_event(
        db,
        "TOKEN_REFRESH",
        "Access token refreshed.",
        user.id,
        request,
        org_id=org_id,
        factory_id=factory_id,
    )

    db.commit()
    auth_context = _build_auth_context(db, user=user, active_factory_id=factory_id)
    auth_response = AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        **auth_context,
    )
    if wants_cookie_auth(request) or get_refresh_cookie(request) or get_access_cookie(request):
        csrf_token = set_auth_cookies(
            response=response,
            access_token=access_token,
            refresh_token=refresh_token,
            request=request,
        )
        response.headers["X-CSRF-Token"] = csrf_token
    return auth_response


@router.post("/email/verification/resend", response_model=EmailVerificationResponse)
def resend_email_verification(
    payload: EmailVerificationRequest, request: Request, db: Session = Depends(get_db)
) -> EmailVerificationResponse:
    email = payload.email.lower().strip()
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    user = (
        db.query(User)
        .filter(
            User.email == email,
            User.is_active.is_(True),
            User.auth_provider == "local",
        )
        .first()
    )
    delivery_mode = "preview" if _should_expose_verification_link() else "email"
    verification_link: str | None = None

    if pending and pending.used_at is None:
        token = create_or_update_pending_registration(
            db,
            name=pending.name,
            email=pending.email,
            password_hash=pending.password_hash,
            requested_role=pending.requested_role,
            factory_name=pending.factory_name,
            company_code=pending.company_code,
            phone_number=pending.phone_number,
            ttl_hours=EMAIL_VERIFICATION_TTL_HOURS,
        )
        verification_link = (
            _frontend_verification_link_from_request(request, token)
            or build_verification_link(token)
        )
        delivered = True
        if delivery_mode == "email":
            delivered = _send_auth_email(
                subject=EMAIL_VERIFICATION_EMAIL_SUBJECT,
                to_email=pending.email,
                body=(
                    "You requested a new DPR.ai verification link.\n\n"
                    f"Verify your email within {EMAIL_VERIFICATION_TTL_HOURS} hours:\n{verification_link}\n\n"
                    "If you did not request this, you can ignore this email."
                ),
                context="resend_verification",
            )
        if delivered:
            _log_auth_event(
                db,
                "PUBLIC_SIGNUP_VERIFICATION_RESENT",
                "Verification email resent for pending signup.",
                None,
                request,
            )
            db.commit()
        else:
            db.rollback()
    elif user and user.email_verified_at is None:
        now = datetime.now(timezone.utc)
        token = create_verification_token(db, user=user, ttl_hours=EMAIL_VERIFICATION_TTL_HOURS)
        verification_link = (
            _frontend_verification_link_from_request(request, token)
            or build_verification_link(token)
        )
        user.verification_sent_at = now
        delivered = True
        if delivery_mode == "email":
            delivered = _send_auth_email(
                subject=EMAIL_VERIFICATION_EMAIL_SUBJECT,
                to_email=user.email,
                body=(
                    "You requested a new DPR.ai verification link.\n\n"
                    f"Verify your email within {EMAIL_VERIFICATION_TTL_HOURS} hours:\n{verification_link}\n\n"
                    "If you did not request this, you can ignore this email."
                ),
                context="resend_verification",
            )
        if delivered:
            _log_auth_event(
                db,
                "EMAIL_VERIFICATION_RESENT",
                "Verification email resent.",
                user.id,
                request,
                org_id=user.org_id,
                factory_id=None,
            )
            db.commit()
        else:
            db.rollback()

    return EmailVerificationResponse(
        message="If an account exists and still needs verification, we will send a new link.",
        verification_link=verification_link if verification_link and delivery_mode == "preview" else None,
        delivery_mode=delivery_mode,
    )


@router.get("/email/verify/validate", response_model=EmailVerificationValidateResponse)
def validate_email_verification_token(
    token: str, db: Session = Depends(get_db)
) -> EmailVerificationValidateResponse:
    pending = verify_pending_registration_token(db, token=token)
    if pending:
        return EmailVerificationValidateResponse(
            valid=True,
            message="Verification link verified. Confirm to create the account now.",
            email=pending.email,
        )

    record = verify_verification_token(db, token=token)
    if not record:
        return EmailVerificationValidateResponse(
            valid=False,
            message="This verification link is invalid or has expired. Request a new one.",
        )

    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        return EmailVerificationValidateResponse(
            valid=False,
            message="This verification link is invalid or has expired. Request a new one.",
        )
    if user.email_verified_at is not None:
        return EmailVerificationValidateResponse(
            valid=True,
            message="Email already verified. You can sign in now.",
            email=user.email,
        )
    return EmailVerificationValidateResponse(
        valid=True,
        message="Verification link verified. Confirm your email to activate the account.",
        email=user.email,
    )


@router.post("/email/verify", response_model=EmailVerificationResponse)
def verify_email_address(
    payload: EmailVerificationTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> EmailVerificationResponse:
    pending = verify_pending_registration_token(db, token=payload.token)
    if pending:
        _activate_pending_registration(db, pending=pending, request=request)
        db.commit()
        return EmailVerificationResponse(
            message="Email verified successfully. Your account is now created and ready to sign in.",
            delivery_mode="email",
        )

    record = verify_verification_token(db, token=payload.token)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    now = datetime.now(timezone.utc)
    if user.email_verified_at is None:
        user.email_verified_at = now
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)
    _log_auth_event(
        db,
        "EMAIL_VERIFIED",
        "Email verification completed.",
        user.id,
        request,
        org_id=user.org_id,
        factory_id=None,
    )
    db.commit()
    return EmailVerificationResponse(
        message="Email verified successfully. You can sign in now.",
        delivery_mode="email",
    )


@router.post("/password/forgot", response_model=PasswordForgotResponse)
def password_forgot(
    payload: PasswordForgotRequest, request: Request, db: Session = Depends(get_db)
) -> PasswordForgotResponse:
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    delivery_mode = "preview" if _should_expose_reset_link() else "email"
    reset_link: str | None = None
    if user:
        token = create_reset_token(db, user=user, ttl_minutes=PASSWORD_RESET_TTL_MINUTES)
        reset_link = _frontend_reset_link_from_request(request, token) or build_reset_link(token)
        delivered = True
        if delivery_mode == "email":
            delivered = _send_auth_email(
                subject=PASSWORD_RESET_EMAIL_SUBJECT,
                body=(
                    "We received a request to reset your DPR.ai password.\n\n"
                    f"Reset link (valid {PASSWORD_RESET_TTL_MINUTES} minutes):\n{reset_link}\n\n"
                    "If you did not request this, you can ignore this email."
                ),
                to_email=user.email,
                context="password_reset",
            )
        if delivered:
            _log_auth_event(
                db,
                "PASSWORD_RESET_REQUESTED",
                "Password reset requested.",
                user.id,
                request,
                org_id=user.org_id,
                factory_id=None,
            )
            db.commit()
        else:
            db.rollback()
    return PasswordForgotResponse(
        message="If an account exists for this email, you will receive a reset link.",
        reset_link=reset_link if user and delivery_mode == "preview" else None,
        delivery_mode=delivery_mode,
    )


@router.get("/password/reset/validate", response_model=PasswordResetValidateResponse)
def validate_password_reset_token(token: str, db: Session = Depends(get_db)) -> PasswordResetValidateResponse:
    record = verify_reset_token(db, token=token)
    if not record:
        return PasswordResetValidateResponse(
            valid=False,
            message="This reset link is invalid or has expired. Please request a new one.",
        )
    return PasswordResetValidateResponse(
        valid=True,
        message="Reset link verified. You can create a new password now.",
    )


@router.post("/password/reset")
def password_reset(
    payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)
) -> dict[str, str]:
    validate_password_strength(payload.new_password)
    record = verify_reset_token(db, token=payload.token)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    now = datetime.now(timezone.utc)
    user.password_hash = hash_password(payload.new_password)
    record.used_at = now

    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)

    _log_auth_event(
        db,
        "PASSWORD_RESET_COMPLETED",
        "Password reset completed.",
        user.id,
        request,
        org_id=user.org_id,
        factory_id=None,
    )
    db.commit()
    return {"message": "Password reset successful. Please log in again."}


@router.post("/factories", response_model=FactoryListResponse)
def list_factories(
    payload: RefreshRequest, db: Session = Depends(get_db)
) -> FactoryListResponse:
    now = datetime.now(timezone.utc)
    token_hash = _hash_refresh_token(payload.refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not record or record.revoked_at or record.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired.")

    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    active_factory_id = _resolve_active_factory_id(
        db, user_id=user.id, preferred_factory_id=record.factory_id
    )
    record.last_used_at = now
    db.commit()
    auth_context = _build_auth_context(db, user=user, active_factory_id=active_factory_id)
    return FactoryListResponse(
        user_id=user.id,
        user_code=user.user_code,
        active_factory_id=active_factory_id,
        active_factory=auth_context["active_factory"],  # type: ignore[index]
        factories=auth_context["factories"],  # type: ignore[index]
        organization=auth_context["organization"],  # type: ignore[index]
    )


@router.post("/select-factory", response_model=AuthResponse)
def select_factory(
    payload: SelectFactoryRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthResponse:
    role_row = (
        db.query(UserFactoryRole)
        .filter(
            UserFactoryRole.user_id == current_user.id,
            UserFactoryRole.factory_id == payload.factory_id,
        )
        .first()
    )
    if not role_row:
        raise HTTPException(status_code=403, detail="Access denied.")

    access_token = create_access_token(
        user_id=current_user.id,
        role=role_row.role.value,
        email=current_user.email,
        org_id=role_row.org_id,
        factory_id=payload.factory_id,
    )

    refresh_token: str | None = None
    if get_refresh_cookie(request) or get_access_cookie(request) or wants_cookie_auth(request):
        existing_refresh_token = get_refresh_cookie(request)
        if existing_refresh_token:
            _revoke_refresh_token(db, token=existing_refresh_token, user_id=current_user.id)
        refresh_token = _issue_refresh_token(
            db,
            user=current_user,
            org_id=role_row.org_id,
            factory_id=payload.factory_id,
        )
        csrf_token = set_auth_cookies(
            response=response,
            access_token=access_token,
            refresh_token=refresh_token,
            request=request,
        )
        response.headers["X-CSRF-Token"] = csrf_token

    _log_auth_event(
        db,
        "FACTORY_SWITCH",
        f"Switched to factory {payload.factory_id}.",
        current_user.id,
        request,
        org_id=role_row.org_id,
        factory_id=payload.factory_id,
    )
    db.commit()
    auth_context = _build_auth_context(db, user=current_user, active_factory_id=payload.factory_id)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        **auth_context,
    )


@router.get("/me", response_model=UserReadSchema)
def get_me(current_user: User = Depends(get_current_user)) -> UserReadSchema:
    return current_user


@router.get("/profile-photo/{photo_name}")
def get_profile_photo(
    photo_name: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    current_photo_name = _extract_local_profile_photo_name(current_user.profile_picture)
    if current_photo_name != photo_name:
        raise HTTPException(status_code=404, detail="Profile photo not found.")
    photo_path = PROFILE_PHOTO_DIR / photo_name
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Profile photo not found.")
    return FileResponse(
        photo_path,
        media_type="image/jpeg",
        filename=photo_name,
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


@router.get("/session-summary", response_model=SessionSummaryResponse)
def get_session_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionSummaryResponse:
    now = datetime.now(timezone.utc)
    active_tokens = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .all()
    )

    last_activity = current_user.last_login
    for token in active_tokens:
        candidate = token.last_used_at or token.created_at
        if candidate and (last_activity is None or candidate > last_activity):
            last_activity = candidate

    return SessionSummaryResponse(
        active_devices=len(active_tokens),
        last_activity=last_activity,
    )


@router.get("/context", response_model=AuthContextResponse)
def get_auth_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthContextResponse:
    active_factory_id = getattr(current_user, "active_factory_id", None)
    if not active_factory_id:
        active_factory_id = _resolve_active_factory_id(db, user_id=current_user.id, preferred_factory_id=None)
    return AuthContextResponse(**_build_auth_context(db, user=current_user, active_factory_id=active_factory_id))


@router.get("/active-workflow-template", response_model=ActiveWorkflowTemplateResponse)
def get_active_workflow_template(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActiveWorkflowTemplateResponse:
    active_factory_id = getattr(current_user, "active_factory_id", None)
    if not active_factory_id:
        active_factory_id = _resolve_active_factory_id(db, user_id=current_user.id, preferred_factory_id=None)
    return _build_active_template_context(db, user=current_user, active_factory_id=active_factory_id)


@router.put("/profile", response_model=UserReadSchema)
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserReadSchema:
    try:
        if payload.name is not None:
            cleaned_name = sanitize_text(payload.name, max_length=120, preserve_newlines=False) or ""
            if len(cleaned_name) < 2:
                raise HTTPException(status_code=400, detail="Full name must be at least 2 characters.")
            current_user.name = cleaned_name
        if payload.phone_number is not None:
            current_user.phone_number = payload.phone_number or None
        _log_auth_event(db, "PROFILE_UPDATED", "User updated their profile.", current_user.id, request)
        db.commit()
        db.refresh(current_user)
        return current_user
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Profile update failed.")
        raise HTTPException(status_code=500, detail="Could not update profile.") from error


@router.post("/profile-photo", response_model=UserReadSchema)
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserReadSchema:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload a profile photo to continue.")
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Profile photo must be an image.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(image_bytes) > PROFILE_PHOTO_MAX_BYTES:
        max_mb = PROFILE_PHOTO_MAX_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Profile photo must be {max_mb:.0f} MB or smaller.",
        )

    saved_photo_path: str | None = None
    previous_photo_path = current_user.profile_picture
    try:
        processed_photo = _prepare_profile_photo(image_bytes)
        saved_photo_path = _save_profile_photo(user_id=current_user.id, image_bytes=processed_photo)
        current_user.profile_picture = saved_photo_path
        _log_auth_event(
            db,
            "PROFILE_PHOTO_UPDATED",
            "User updated their profile photo.",
            current_user.id,
            request,
            org_id=current_user.org_id,
            factory_id=None,
        )
        db.commit()
        db.refresh(current_user)
    except HTTPException:
        db.rollback()
        if saved_photo_path:
            _delete_local_profile_photo(saved_photo_path)
        raise
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        if saved_photo_path:
            _delete_local_profile_photo(saved_photo_path)
        logger.exception("Profile photo upload failed.")
        raise HTTPException(status_code=500, detail="Could not upload profile photo.") from error

    if previous_photo_path and previous_photo_path != current_user.profile_picture:
        _delete_local_profile_photo(previous_photo_path)
    return current_user


@router.delete("/profile-photo", response_model=UserReadSchema)
def delete_profile_photo(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserReadSchema:
    previous_photo_path = current_user.profile_picture
    try:
        current_user.profile_picture = None
        _log_auth_event(
            db,
            "PROFILE_PHOTO_REMOVED",
            "User removed their profile photo.",
            current_user.id,
            request,
            org_id=current_user.org_id,
            factory_id=None,
        )
        db.commit()
        db.refresh(current_user)
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Profile photo removal failed.")
        raise HTTPException(status_code=500, detail="Could not remove profile photo.") from error

    _delete_local_profile_photo(previous_photo_path)
    return current_user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    try:
        validate_password_strength(payload.new_password)
        current_user.password_hash = hash_password(payload.new_password)
        _log_auth_event(db, "PASSWORD_CHANGED", "User changed password.", current_user.id, request)
        db.commit()
        return {"message": "Password changed successfully."}
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pylint: disable=broad-except
        db.rollback()
        logger.exception("Password change failed.")
        raise HTTPException(status_code=500, detail="Could not change password.") from error


@router.get("/admin-only")
def admin_only_route(current_user: User = Depends(get_current_user)) -> dict[str, str]:
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return {"message": "Admin access granted."}
