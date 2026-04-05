"""Typed orchestration payloads for Factory Intelligence."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


TaskComplexity = Literal["simple", "medium", "complex"]
ModelTier = Literal["haiku", "sonnet", "opus"]


@dataclass(slots=True)
class PreprocessedDocument:
    request_id: str
    document_hash: str
    source_filename: str
    content_type: str
    document_kind: str
    size_bytes: int
    raw_text: str = ""
    reduced_text: str = ""
    ocr_rows: list[list[str]] = field(default_factory=list)
    segments: dict[str, list[str]] = field(default_factory=dict)
    extracted_fields: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ClassificationResult:
    complexity: TaskComplexity
    reasons: list[str] = field(default_factory=list)
    score: int = 0


@dataclass(slots=True)
class ModelSelection:
    tier: ModelTier
    provider_chain: list[str]
    reasoning: str


@dataclass(slots=True)
class StageResult:
    stage_name: str
    payload: dict[str, Any]
    confidence: float
    model_tier: str
    model_name: str
    provider: str
    prompt_hash: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    latency_ms: int
    cache_hit: bool = False
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class OrchestrationResult:
    request_id: str
    job_id: str
    task_classification: TaskComplexity
    selected_model_tier: str
    final_model_tier: str
    confidence_score: float
    cached_result: bool
    document_hash: str
    pipeline_state: dict[str, Any]
    normalized_result: dict[str, Any]
    total_tokens: int
    total_cost_usd: float
