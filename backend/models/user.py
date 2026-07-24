"""User ORM model and Pydantic schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base, EncryptedString
from backend.models.phone_verification import PhoneVerificationStatus


class UserRole(str, Enum):
    ATTENDANCE = "attendance"
    OPERATOR = "operator"
    SUPERVISOR = "supervisor"
    ACCOUNTANT = "accountant"
    MANAGER = "manager"
    ADMIN = "admin"
    OWNER = "owner"


_ROLE_ORDER = {
    UserRole.ATTENDANCE: 0,
    UserRole.OPERATOR: 1,
    UserRole.SUPERVISOR: 2,
    UserRole.ACCOUNTANT: 2,
    UserRole.MANAGER: 3,
    UserRole.ADMIN: 4,
    UserRole.OWNER: 5,
}


def role_rank(role: UserRole) -> int:
    """Return numeric rank for a role. Higher = more privileged."""
    return _ROLE_ORDER.get(role, 0)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_factory_name", "factory_name"),
        Index("uq_users_org_user_code", "org_id", "user_code", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.org_id"), nullable=False, index=True)
    user_code: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    profile_picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="local")
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role"), nullable=False, default=UserRole.ATTENDANCE
    )
    role_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    factory_name: Mapped[str] = mapped_column(String(255), nullable=False)
    factory_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_e164: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_verification_status: Mapped[PhoneVerificationStatus] = mapped_column(
        SqlEnum(
            PhoneVerificationStatus,
            name="phone_verification_status",
            values_callable=lambda enum_cls: [str(member.value) for member in enum_cls],
            native_enum=False,
        ),
        nullable=False,
        default=PhoneVerificationStatus.PENDING,
    )
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    phone_last_otp_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    phone_otp_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_platform_admin: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # ── Auth consolidation fields (migrated from AuthUser) ────────────────
    password_hash_version: Mapped[str] = mapped_column(
        String(16), nullable=False, default="bcrypt"
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    mfa_secret_encrypted: Mapped[str | None] = mapped_column(
        EncryptedString, nullable=True
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    # ──────────────────────────────────────────────────────────────────────

    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    entries = relationship("Entry", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    email_queue = relationship("EmailQueue", back_populates="user")
    organization = relationship("Organization", back_populates="users")
    factory_roles = relationship("UserFactoryRole", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


# Late import ensures RefreshToken model is loaded before SQLAlchemy resolves
# the User.refresh_tokens relationship reference during mapper configuration.
from backend.models.refresh_token import RefreshToken as _RefreshToken  # noqa: F401,E402


class UserBaseSchema(BaseModel):
    org_id: str
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: UserRole
    factory_name: str = Field(min_length=2, max_length=255)
    factory_code: str | None = Field(default=None, max_length=32)
    phone_number: str | None = Field(default=None, max_length=32)
    phone_e164: str | None = Field(default=None, max_length=20)


class UserCreateSchema(UserBaseSchema):
    password: str = Field(min_length=12, max_length=128)


class UserUpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    factory_name: str | None = Field(default=None, min_length=2, max_length=255)
    is_active: bool | None = None
    phone_number: str | None = Field(default=None, max_length=32)


class UserReadSchema(UserBaseSchema):
    id: int
    user_code: int
    role_revision: int = 0
    is_platform_admin: bool = False
    is_active: bool
    phone_verification_status: str = PhoneVerificationStatus.PENDING.value
    phone_verified_at: datetime | None = None
    phone_last_otp_sent_at: datetime | None = None
    phone_otp_attempts: int = 0
    email_verified_at: datetime | None = None
    verification_sent_at: datetime | None = None
    created_at: datetime
    last_login: datetime | None = None
    profile_picture: str | None = None

    model_config = ConfigDict(from_attributes=True)
