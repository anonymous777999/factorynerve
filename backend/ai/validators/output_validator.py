"""Validation layer for AI JSON outputs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError, create_model


_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


@dataclass(slots=True)
class ValidationResult:
    ok: bool
    parsed_output: dict | None
    validation_errors: list[str] = field(default_factory=list)
    confidence_score: float | None = None
    is_partial: bool = False
    error_message: str | None = None


class AIOutputValidator:
    async def validate(
        self,
        raw_content: str,
        expected_schema: dict,
    ) -> ValidationResult:
        parsed = self._parse_json_payload(raw_content)
        if parsed is None:
            return ValidationResult(
                ok=False,
                parsed_output=None,
                validation_errors=["unparseable JSON"],
                confidence_score=0.0,
                is_partial=False,
                error_message="unparseable JSON",
            )

        parsed_output = parsed if isinstance(parsed, dict) else {}
        required_fields = list(expected_schema.get("required") or [])
        total_required_fields = max(1, len(required_fields))
        present_required_fields = [field for field in required_fields if parsed_output.get(field) not in (None, "", [], {})]
        confidence_score = len(present_required_fields) / total_required_fields
        is_partial = 0 < len(present_required_fields) < len(required_fields)

        schema_errors, safe_output = self._validate_with_pydantic(parsed_output, expected_schema)
        validation_errors = list(schema_errors)

        hallucination_errors = self._run_hallucination_checks(
            payload=safe_output,
            schema=expected_schema,
        )
        validation_errors.extend(hallucination_errors)

        if len(required_fields) > 0 and len(present_required_fields) / total_required_fields > 0.5 and safe_output:
            is_partial = len(present_required_fields) < len(required_fields)

        ok = not validation_errors and confidence_score >= 0.5
        if validation_errors and confidence_score > 0.5 and safe_output:
            missing_required = [
                error for error in validation_errors
                if error.startswith("Field required:")
            ]
            non_missing_errors = [error for error in validation_errors if error not in missing_required]
            if not non_missing_errors:
                ok = True
                is_partial = True
        if confidence_score < 0.5:
            ok = False

        return ValidationResult(
            ok=ok,
            parsed_output=safe_output or None,
            validation_errors=validation_errors,
            confidence_score=round(confidence_score, 4),
            is_partial=is_partial,
            error_message=None if ok else (validation_errors[0] if validation_errors else "validation_failed"),
        )

    def _parse_json_payload(self, raw_content: str) -> Any:
        try:
            return json.loads(raw_content)
        except json.JSONDecodeError:
            match = _JSON_BLOCK_RE.search(raw_content)
            if not match:
                return None
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                return None

    def _validate_with_pydantic(self, payload: dict[str, Any], expected_schema: dict) -> tuple[list[str], dict[str, Any]]:
        model = self._model_from_schema("DynamicAIOutput", expected_schema)
        try:
            validated = model.model_validate(payload)
            return [], validated.model_dump(exclude_none=True)
        except ValidationError as error:
            errors: list[str] = []
            safe_output: dict[str, Any] = {}
            required_fields = set(expected_schema.get("required") or [])
            field_definitions = expected_schema.get("properties") or {}
            for field_name in field_definitions:
                if field_name in payload and payload.get(field_name) not in (None, "", [], {}):
                    safe_output[field_name] = payload[field_name]
            for entry in error.errors():
                field_path = ".".join(str(part) for part in entry.get("loc", [])) or "root"
                error_type = str(entry.get("type", "validation_error"))
                if error_type == "missing":
                    errors.append(f"Field required: {field_path}")
                else:
                    errors.append(f"{field_path}: {entry.get('msg', 'invalid value')}")
            for field_name in required_fields:
                if field_name not in payload:
                    safe_output.pop(field_name, None)
            return errors, safe_output

    def _model_from_schema(self, model_name: str, schema: dict) -> type[BaseModel]:
        fields: dict[str, tuple[Any, Any]] = {}
        required_fields = set(schema.get("required") or [])
        properties = schema.get("properties") or {}
        for field_name, field_schema in properties.items():
            annotation = self._annotation_from_schema(f"{model_name}_{field_name}", field_schema)
            default = ... if field_name in required_fields else None
            fields[field_name] = (annotation, default)
        return create_model(
            model_name,
            __config__=ConfigDict(extra="ignore"),
            **fields,
        )

    def _annotation_from_schema(self, model_name: str, schema: dict) -> Any:
        schema_type = schema.get("type")
        if isinstance(schema_type, list):
            schema_type = next((item for item in schema_type if item != "null"), "string")
        if schema_type == "object":
            nested_model = self._model_from_schema(model_name, schema)
            return nested_model
        if schema_type == "array":
            item_schema = schema.get("items") or {}
            return list[self._annotation_from_schema(f"{model_name}Item", item_schema)]  # type: ignore[index]
        if schema_type == "integer":
            return int
        if schema_type == "number":
            return float
        if schema_type == "boolean":
            return bool
        return str

    def _run_hallucination_checks(self, *, payload: dict[str, Any], schema: dict) -> list[str]:
        errors: list[str] = []
        properties = schema.get("properties") or {}
        for field_name, field_schema in properties.items():
            if field_name not in payload:
                continue
            value = payload.get(field_name)
            field_type = field_schema.get("type")
            if field_type in {"integer", "number"}:
                if not self._numeric_within_bounds(value, field_schema):
                    errors.append(f"{field_name}: value outside declared range")
            if field_name in set(schema.get("required") or []) and field_type == "string":
                if str(value).strip().lower() in {"", "n/a", "unknown"}:
                    errors.append(f"{field_name}: required string is empty or placeholder")
            if field_schema.get("format") == "date-time" or field_schema.get("format") == "date":
                if not self._is_iso_date(value):
                    errors.append(f"{field_name}: value is not ISO 8601 parseable")
        return errors

    @staticmethod
    def _numeric_within_bounds(value: Any, schema: dict) -> bool:
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            return False
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and numeric_value < float(minimum):
            return False
        if maximum is not None and numeric_value > float(maximum):
            return False
        return True

    @staticmethod
    def _is_iso_date(value: Any) -> bool:
        try:
            datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return True
        except ValueError:
            return False
