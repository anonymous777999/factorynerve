"""Plans router for canonical pricing and limits."""

from __future__ import annotations

from fastapi import APIRouter

from backend.plans import PLAN_CATALOG, PRICING_META, serialize_addon_catalog


router = APIRouter(tags=["Plans"])


@router.get("")
def list_plans() -> dict:
    return {
        "pricing": PRICING_META,
        "plans": list(PLAN_CATALOG.values()),
        "addons": serialize_addon_catalog(),
    }
