"""Typed AI result dataclasses."""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.ai.providers.base import RawAIResponse


@dataclass(slots=True)
class AIResult:
    success: bool
    raw_response: RawAIResponse | None
    validated_output: dict | None
    error_message: str | None
    validation_errors: list[str] = field(default_factory=list)
    retry_count: int = 0
    total_latency_ms: int = 0

    def __post_init__(self) -> None:
        self.success = bool(self.validated_output is not None and not self.validation_errors)


@dataclass(slots=True)
class OCRResult(AIResult):
    extracted_fields: dict | None = None
    confidence_score: float | None = None
    partial_extraction: bool = False


@dataclass(slots=True)
class SummaryResult(AIResult):
    summary_text: str | None = None
    word_count: int | None = None
