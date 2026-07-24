"""Shared dataclasses for the OCR validation pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


Severity = Literal["error", "warning", "info"]


@dataclass(slots=True)
class ValidationIssue:
    """A single validation finding.

    Attributes:
        field: Dot-path to the problematic field, e.g. ``"line_items.0.taxable_value"``.
        message: Human-readable description of the issue.
        severity: ``"error"`` blocks export; ``"warning"`` allows export with caution; ``"info"`` is advisory.
        suggested_value: Optional correction suggestion for the user.
    """
    field: str
    message: str
    severity: Severity = "error"
    suggested_value: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "field": self.field,
            "message": self.message,
            "severity": self.severity,
        }
        if self.suggested_value is not None:
            d["suggested_value"] = self.suggested_value
        return d


@dataclass(slots=True)
class ValidationStageResult:
    """Result of a single validation stage.

    Attributes:
        stage_name: Human-readable stage name, e.g. ``"structural"``, ``"schema"``.
        passed: True if no errors were found.
        issues: All issues found in this stage.
    """
    stage_name: str
    passed: bool
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]

    @property
    def infos(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "info"]

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "issues": [i.to_dict() for i in self.issues],
        }


@dataclass(slots=True)
class ValidationResult:
    """Top-level validation result containing all stages.

    Attributes:
        passed: True if no errors across any stage.
        summary: Short human-readable summary, e.g. ``"3 errors, 2 warnings"``.
        stages: Dict mapping stage names to their results.
        blockers: True if validation errors prevent further action (export/approve).
        can_export_with_warnings: True if only warnings exist (no errors), allowing export.
    """
    passed: bool
    summary: str
    stages: dict[str, ValidationStageResult] = field(default_factory=dict)
    blockers: bool = False
    can_export_with_warnings: bool = True

    @property
    def all_issues(self) -> list[ValidationIssue]:
        result: list[ValidationIssue] = []
        for stage in self.stages.values():
            result.extend(stage.issues)
        return result

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == "warning")

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "summary": self.summary,
            "stages": {name: stage.to_dict() for name, stage in self.stages.items()},
            "blockers": self.blockers,
            "can_export_with_warnings": self.can_export_with_warnings,
        }
