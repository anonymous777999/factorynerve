"""Plans router for canonical pricing and limits."""

from __future__ import annotations

from fastapi import APIRouter

from backend.plans import PLAN_CATALOG, PRICING_META, min_plan_for_feature, serialize_addon_catalog


router = APIRouter(tags=["Plans"])


def _feature_label(feature_key: str) -> str:
    label_chars: list[str] = []
    for index, char in enumerate(feature_key):
        if index > 0 and char.isupper() and not feature_key[index - 1].isupper():
            label_chars.append(" ")
        label_chars.append(char)
    return "".join(label_chars).replace("_", " ").strip().title()


def _plan_features() -> list[dict[str, str]]:
    feature_keys = sorted(
        {
            str(feature_key)
            for plan in PLAN_CATALOG.values()
            for feature_key in (plan.get("features", {}) or {}).keys()
        }
    )
    return [
        {
            "key": feature_key,
            "label": _feature_label(feature_key),
            "min_plan": min_plan_for_feature(feature_key),
        }
        for feature_key in feature_keys
    ]


@router.get("")
def list_plans() -> dict:
    return {
        "pricing": PRICING_META,
        "plans": list(PLAN_CATALOG.values()),
        "features": _plan_features(),
        "addons": serialize_addon_catalog(),
    }
