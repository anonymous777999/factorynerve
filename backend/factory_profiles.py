"""Factory industry profile catalog and normalization helpers."""

from __future__ import annotations

from dataclasses import dataclass


DEFAULT_FACTORY_PROFILE = "general"


@dataclass(frozen=True, slots=True)
class FactoryProfile:
    key: str
    label: str
    description: str
    starter_modules: tuple[str, ...]


FACTORY_PROFILES: dict[str, FactoryProfile] = {
    "general": FactoryProfile(
        key="general",
        label="General Manufacturing",
        description="Balanced operations profile for standard production, dispatch, and quality workflows.",
        starter_modules=("dpr", "downtime", "quality", "dispatch", "reports"),
    ),
    "steel": FactoryProfile(
        key="steel",
        label="Steel Industry",
        description="Traceability-first profile for heats, scrap, quality release, and line performance.",
        starter_modules=("dpr", "traceability", "quality", "scrap", "certificates"),
    ),
    "chemical": FactoryProfile(
        key="chemical",
        label="Chemical Plant",
        description="Compliance-heavy profile for SDS, incident tracking, deviations, and process logs.",
        starter_modules=("dpr", "safety", "incident", "compliance", "batch_log"),
    ),
}

_PROFILE_ALIASES = {
    "general": "general",
    "general manufacturing": "general",
    "normal": "general",
    "normal factory": "general",
    "factory": "general",
    "manufacturing": "general",
    "steel": "steel",
    "steel industry": "steel",
    "steel plant": "steel",
    "metal": "steel",
    "chemical": "chemical",
    "chemical company": "chemical",
    "chemical plant": "chemical",
    "process plant": "chemical",
}


def _clean_profile_value(value: str | None) -> str:
    if not value:
        return ""
    lowered = value.strip().lower().replace("&", "and").replace("/", " ")
    return " ".join("".join(char if char.isalnum() or char.isspace() else " " for char in lowered).split())


def list_factory_profiles() -> list[FactoryProfile]:
    return [FACTORY_PROFILES[key] for key in ("general", "steel", "chemical")]


def get_factory_profile(profile_key: str | None) -> FactoryProfile:
    normalized = infer_factory_profile(profile_key, default=DEFAULT_FACTORY_PROFILE)
    return FACTORY_PROFILES[normalized]


def infer_factory_profile(value: str | None, *, default: str = DEFAULT_FACTORY_PROFILE) -> str:
    cleaned = _clean_profile_value(value)
    if not cleaned:
        return default
    return _PROFILE_ALIASES.get(cleaned, cleaned if cleaned in FACTORY_PROFILES else default)


def normalize_factory_profile(value: str | None, *, default: str = DEFAULT_FACTORY_PROFILE) -> str:
    cleaned = _clean_profile_value(value)
    if not cleaned:
        return default
    profile_key = _PROFILE_ALIASES.get(cleaned, cleaned)
    if profile_key not in FACTORY_PROFILES:
        supported = ", ".join(profile.label for profile in list_factory_profiles())
        raise ValueError(f"Factory industry must be one of: {supported}.")
    return profile_key
