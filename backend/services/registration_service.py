"""Registration helpers for resolving org/factory context safely."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.factory import Factory
from backend.models.organization import Organization
from backend.models.user import User
from backend.plans import DEFAULT_PLAN, enforce_user_limit, get_effective_factory_plan
from backend.utils import generate_company_code


MAX_FACTORY_CODE_ATTEMPTS = 6


def _looks_like_factory_code_collision(error: IntegrityError) -> bool:
    message = str(getattr(error, "orig", error)).lower()
    return "factory_code" in message or "factories.factory_code" in message


def resolve_registration_context(
    db: Session,
    *,
    requested_factory: str,
    provided_code: str | None,
) -> tuple[Organization, Factory, str, str]:
    factory_code: str | None = None
    organization: Organization | None = None
    factory: Factory | None = None
    requested = requested_factory.strip()
    code = (provided_code or "").strip().upper()

    if code:
        factory = (
            db.query(Factory)
            .filter(Factory.factory_code == code, Factory.is_active.is_(True))
            .first()
        )
        if not factory:
            legacy = (
                db.query(User)
                .filter(User.factory_code == code, User.is_active.is_(True))
                .first()
            )
            if legacy:
                requested = legacy.factory_name
            else:
                raise HTTPException(status_code=400, detail="Invalid company code.")
        if not factory and requested:
            organization = Organization(name=requested, plan=DEFAULT_PLAN)
            db.add(organization)
            db.flush()
            factory = Factory(
                org_id=organization.org_id,
                name=requested,
                factory_code=code,
            )
            db.add(factory)
            db.flush()
        if factory and not requested.strip():
            raise HTTPException(status_code=400, detail="Factory name is required to verify company code.")
        if factory and factory.name.strip().lower() != requested.strip().lower():
            raise HTTPException(status_code=400, detail="Company code does not match factory name.")
        if factory:
            factory_code = factory.factory_code
            organization = db.query(Organization).filter(Organization.org_id == factory.org_id).first()
            requested = factory.name
        plan = get_effective_factory_plan(
            db,
            requested,
            org_id=organization.org_id if organization else None,
            factory_id=factory.factory_id if factory else None,
        )
        try:
            enforce_user_limit(
                db,
                requested,
                plan,
                org_id=organization.org_id if organization else None,
                factory_id=factory.factory_id if factory else None,
            )
        except ValueError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
    else:
        existing_factory_user = (
            db.query(User)
            .filter(User.factory_name == requested, User.is_active.is_(True))
            .first()
        )
        if existing_factory_user:
            existing_factory = (
                db.query(Factory)
                .filter(
                    Factory.org_id == existing_factory_user.org_id,
                    Factory.name == requested,
                    Factory.is_active.is_(True),
                )
                .first()
            )
            plan = get_effective_factory_plan(
                db,
                requested,
                org_id=existing_factory_user.org_id,
                factory_id=existing_factory.factory_id if existing_factory else None,
            )
            try:
                enforce_user_limit(
                    db,
                    requested,
                    plan,
                    org_id=existing_factory_user.org_id,
                    factory_id=existing_factory.factory_id if existing_factory else None,
                )
            except ValueError as error:
                raise HTTPException(status_code=403, detail=str(error)) from error
        if existing_factory_user and existing_factory_user.factory_code:
            factory_code = existing_factory_user.factory_code

        attempts = 0
        while True:
            attempts += 1
            if not factory_code or attempts > 1:
                while True:
                    candidate = generate_company_code()
                    collision = (
                        db.query(User.id)
                        .filter(User.factory_code == candidate)
                        .first()
                    )
                    factory_collision = (
                        db.query(Factory.factory_id)
                        .filter(Factory.factory_code == candidate)
                        .first()
                    )
                    if not collision and not factory_collision:
                        factory_code = candidate
                        break

            if not organization:
                organization = Organization(name=requested, plan=DEFAULT_PLAN)
                db.add(organization)
                try:
                    db.flush()
                except IntegrityError as error:
                    db.rollback()
                    organization = None
                    if attempts >= MAX_FACTORY_CODE_ATTEMPTS:
                        raise HTTPException(
                            status_code=500,
                            detail="Could not create organization. Please try again.",
                        ) from error
                    continue
            if not factory:
                factory = Factory(
                    org_id=organization.org_id,
                    name=requested,
                    factory_code=factory_code,
                )
                db.add(factory)
                try:
                    db.flush()
                except IntegrityError as error:
                    db.rollback()
                    organization = None
                    factory = None
                    if _looks_like_factory_code_collision(error) and attempts < MAX_FACTORY_CODE_ATTEMPTS:
                        factory_code = None
                        continue
                    if _looks_like_factory_code_collision(error):
                        raise HTTPException(
                            status_code=500,
                            detail="Could not generate a unique company code. Please retry.",
                        ) from error
                    raise HTTPException(
                        status_code=500, detail="Could not create factory. Please try again."
                    ) from error
            break

    if not organization or not factory or not factory_code:
        raise HTTPException(status_code=500, detail="Organization could not be resolved.")

    return organization, factory, factory_code, requested
