"""Static workflow template catalog for factory control-tower setup."""

from __future__ import annotations

from dataclasses import dataclass

from backend.factory_profiles import DEFAULT_FACTORY_PROFILE, FACTORY_PROFILES, infer_factory_profile


@dataclass(frozen=True, slots=True)
class TemplateField:
    key: str
    label: str
    input_type: str
    required: bool
    help_text: str


@dataclass(frozen=True, slots=True)
class TemplateSection:
    key: str
    label: str
    description: str
    fields: tuple[TemplateField, ...]


@dataclass(frozen=True, slots=True)
class WorkflowTemplate:
    key: str
    label: str
    industry_type: str
    description: str
    modules: tuple[str, ...]
    sections: tuple[TemplateSection, ...]
    pack_level: str = "core"
    is_default: bool = False


def _field(key: str, label: str, input_type: str, required: bool, help_text: str) -> TemplateField:
    return TemplateField(
        key=key,
        label=label,
        input_type=input_type,
        required=required,
        help_text=help_text,
    )


COMMON_DPR_SECTION = TemplateSection(
    key="shift_handover",
    label="Shift Handover",
    description="Production, staffing, and downtime summary captured at the end of every shift.",
    fields=(
        _field("date", "Shift Date", "date", True, "Production date for the handover record."),
        _field("shift", "Shift", "select", True, "Morning, evening, or night."),
        _field("units_target", "Units Target", "number", True, "Planned output for the shift."),
        _field("units_produced", "Units Produced", "number", True, "Actual output achieved."),
        _field("manpower_present", "Manpower Present", "number", True, "Headcount present during the shift."),
        _field("downtime_minutes", "Downtime Minutes", "number", True, "Total downtime accumulated in minutes."),
    ),
)

COMMON_QUALITY_SECTION = TemplateSection(
    key="quality_gate",
    label="Quality Gate",
    description="Shared quality capture block for defects, holds, and release notes.",
    fields=(
        _field("quality_issues", "Quality Issues", "boolean", True, "Whether the shift logged any quality issue."),
        _field("quality_details", "Quality Details", "textarea", False, "Short description of defects or corrective action."),
        _field("materials_used", "Materials Used", "textarea", False, "Primary materials or consumables used during the shift."),
    ),
)

COMMON_DISPATCH_SECTION = TemplateSection(
    key="dispatch_summary",
    label="Dispatch Summary",
    description="Shared output movement block for dispatch-ready reporting.",
    fields=(
        _field("dispatch_ready_units", "Dispatch Ready Units", "number", False, "Units available for dispatch after the shift."),
        _field("blocked_units", "Blocked Units", "number", False, "Units held for quality or operational reasons."),
        _field("dispatch_notes", "Dispatch Notes", "textarea", False, "Dispatch exceptions, hold reasons, or customer notes."),
    ),
)

GENERAL_MANPOWER_SECTION = TemplateSection(
    key="manpower_rollup",
    label="Manpower Rollup",
    description="Simple workforce visibility for standard production floors.",
    fields=(
        _field("contract_staff", "Contract Staff", "number", False, "Additional contract manpower on shift."),
        _field("absentee_reason", "Absentee Reason", "textarea", False, "Why manpower dropped below target."),
        _field("handover_risk", "Handover Risk", "textarea", False, "Any issue the next shift must watch immediately."),
    ),
)

STEEL_TRACEABILITY_SECTION = TemplateSection(
    key="steel_traceability",
    label="Heat and Lot Traceability",
    description="Trace steel production against heat, lot, and certificate references.",
    fields=(
        _field("heat_number", "Heat Number", "text", True, "Primary heat number for the run."),
        _field("lot_number", "Lot Number", "text", False, "Secondary lot or batch reference."),
        _field("scrap_kg", "Scrap (kg)", "number", False, "Scrap generated in the run."),
        _field("certificate_reference", "Certificate Reference", "text", False, "Mill or QC certificate reference."),
    ),
)

CHEMICAL_SAFETY_SECTION = TemplateSection(
    key="chemical_safety",
    label="Process Safety Check",
    description="Chemical process checklist for safety, deviation, and release control.",
    fields=(
        _field("batch_number", "Batch Number", "text", True, "Batch or reactor reference for the process run."),
        _field("incident_flag", "Incident Logged", "boolean", True, "Whether the shift recorded a spill, deviation, or near miss."),
        _field("sds_reviewed", "SDS Reviewed", "boolean", False, "Confirms the relevant SDS was available and reviewed."),
        _field("release_status", "Release Status", "select", False, "Released, on hold, or rejected."),
    ),
)


WORKFLOW_TEMPLATES: dict[str, WorkflowTemplate] = {
    "general-ops-pack": WorkflowTemplate(
        key="general-ops-pack",
        label="General Operations Pack",
        industry_type="general",
        description="Starter operating template for standard production, manpower, downtime, quality, and dispatch.",
        modules=("dpr", "downtime", "quality", "dispatch", "manpower"),
        sections=(COMMON_DPR_SECTION, COMMON_QUALITY_SECTION, COMMON_DISPATCH_SECTION, GENERAL_MANPOWER_SECTION),
        pack_level="industry",
        is_default=True,
    ),
    "steel-core-pack": WorkflowTemplate(
        key="steel-core-pack",
        label="Steel Core Pack",
        industry_type="steel",
        description="Steel starter template focused on production traceability, scrap, and quality release readiness.",
        modules=("dpr", "quality", "traceability", "scrap", "certificates"),
        sections=(COMMON_DPR_SECTION, COMMON_QUALITY_SECTION, STEEL_TRACEABILITY_SECTION),
        pack_level="industry",
        is_default=True,
    ),
    "chemical-core-pack": WorkflowTemplate(
        key="chemical-core-pack",
        label="Chemical Core Pack",
        industry_type="chemical",
        description="Chemical starter template for shift logs, safety checks, incidents, and controlled release.",
        modules=("dpr", "safety", "incident", "compliance", "batch_log"),
        sections=(COMMON_DPR_SECTION, COMMON_QUALITY_SECTION, CHEMICAL_SAFETY_SECTION),
        pack_level="industry",
        is_default=True,
    ),
}


def list_workflow_templates(industry_type: str | None = None) -> list[WorkflowTemplate]:
    normalized = infer_factory_profile(industry_type, default=DEFAULT_FACTORY_PROFILE) if industry_type else None
    templates = list(WORKFLOW_TEMPLATES.values())
    if normalized:
        templates = [template for template in templates if template.industry_type == normalized]
    return sorted(templates, key=lambda template: (template.industry_type, template.label))


def get_workflow_template(template_key: str | None) -> WorkflowTemplate | None:
    key = (template_key or "").strip().lower()
    if not key:
        return None
    return WORKFLOW_TEMPLATES.get(key)


def default_workflow_template_key(industry_type: str | None) -> str:
    normalized = infer_factory_profile(industry_type, default=DEFAULT_FACTORY_PROFILE)
    for template in WORKFLOW_TEMPLATES.values():
        if template.industry_type == normalized and template.is_default:
            return template.key
    return "general-ops-pack"


def normalize_workflow_template_key(industry_type: str | None, template_key: str | None) -> str:
    normalized_industry = infer_factory_profile(industry_type, default=DEFAULT_FACTORY_PROFILE)
    if not template_key:
        return default_workflow_template_key(normalized_industry)
    template = get_workflow_template(template_key)
    if not template or template.industry_type != normalized_industry:
        profile = FACTORY_PROFILES[normalized_industry]
        raise ValueError(
            f"Workflow template does not match the {profile.label} profile."
        )
    return template.key


def serialize_workflow_template(template: WorkflowTemplate) -> dict[str, object]:
    return {
        "key": template.key,
        "label": template.label,
        "industry_type": template.industry_type,
        "description": template.description,
        "modules": list(template.modules),
        "pack_level": template.pack_level,
        "is_default": template.is_default,
        "sections": [
            {
                "key": section.key,
                "label": section.label,
                "description": section.description,
                "fields": [
                    {
                        "key": field.key,
                        "label": field.label,
                        "input_type": field.input_type,
                        "required": field.required,
                        "help_text": field.help_text,
                    }
                    for field in section.fields
                ],
            }
            for section in template.sections
        ],
    }
