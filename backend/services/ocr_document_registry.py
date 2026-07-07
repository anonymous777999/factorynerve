from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Any
from enum import Enum


class DocumentCategory(Enum):
    FINANCIAL = "financial"  # Invoice, Credit Note, Receipt
    LOGISTICS = "logistics"  # Delivery Note, Packing List, Gate Entry
    PRODUCTION = "production"  # Production Log, Work Order, Job Card
    QUALITY = "quality"  # Test Certificate, Inspection Report
    INVENTORY = "inventory"  # Stock Transfer, Material Receipt
    ACCOUNTING = "accounting"  # Ledger, Bank Statement, Voucher
    GENERAL = "general"  # Handwritten forms, chat transcripts, unstructured docs


@dataclass
class ExtractionPrompt:
    system: str
    user: str
    schema: dict  # JSON schema for structured output
    few_shot_examples: list[dict] = field(default_factory=list)


@dataclass
class ValidationRule:
    name: str
    fn: Callable[[dict], list[str]]  # Returns list of error messages
    severity: str = "error"  # error | warning | info


@dataclass
class ExportFormat:
    name: str
    mime_type: str
    generator: Callable[[dict], bytes]  # Returns file bytes
    filename_template: str


@dataclass
class DownstreamAction:
    key: str
    label: str
    description: str
    handler: Callable[[dict, str], Any]  # (verified_data, org_id) -> result
    required_permissions: list[str] = field(default_factory=list)
    confirmation_required: bool = True


@dataclass
class DocumentTypeConfig:
    # ── Required fields (no defaults) ──────────────────────────────────────
    type_id: str  # "gst_invoice", "delivery_note", etc.
    display_name: str  # "GST Invoice"
    category: DocumentCategory
    icon: str  # Lucide icon name
    description: str
    extraction_prompt: ExtractionPrompt
    classifier_keywords: list[str]
    ui_component: str  # Frontend component name

    # ── Optional fields (with defaults) ────────────────────────────────────
    classifier_weight: float = 1.0
    preview_fields: list[str] = field(default_factory=list)
    validation_rules: list[ValidationRule] = field(default_factory=list)
    export_formats: list[ExportFormat] = field(default_factory=list)
    default_export: str = "pdf"
    downstream_actions: list[DownstreamAction] = field(default_factory=list)
    min_confidence_auto_approve: float = 0.90
    min_confidence_review: float = 0.60
    block_below_confidence: float = 0.40


# Global registry
_DOCUMENT_TYPES: dict[str, DocumentTypeConfig] = {}


def register_document_type(config: DocumentTypeConfig) -> None:
    _DOCUMENT_TYPES[config.type_id] = config


def get_document_type(type_id: str) -> DocumentTypeConfig | None:
    return _DOCUMENT_TYPES.get(type_id)


def list_document_types(category: DocumentCategory | None = None) -> list[DocumentTypeConfig]:
    types = list(_DOCUMENT_TYPES.values())
    if category:
        types = [t for t in types if t.category == category]
    return sorted(types, key=lambda t: t.display_name)