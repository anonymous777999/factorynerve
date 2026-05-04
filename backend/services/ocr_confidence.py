"""Deterministic structural confidence scoring for OCR output."""

from __future__ import annotations

from typing import Any


_WEIGHTS = {
    "empty_cell_ratio": 0.20,
    "column_consistency": 0.25,
    "numeric_validity": 0.15,
    "row_alignment": 0.20,
    "header_quality": 0.10,
    "anomaly_penalty": 0.10,
}


def calculate_structural_confidence(extracted_data: dict[str, Any] | None) -> dict[str, Any]:
    """Score OCR quality from measurable table structure only."""
    if not extracted_data:
        return _zero_result("No data provided")

    headers = extracted_data.get("headers", [])
    rows = extracted_data.get("rows", [])

    if not headers and not rows:
        return _zero_result("Empty headers and rows")
    if not rows:
        return _zero_result("No rows extracted")

    metrics = {
        "empty_cell_ratio": _calc_empty_cell_ratio(rows),
        "column_consistency": _calc_column_consistency(rows, headers),
        "numeric_validity": _calc_numeric_validity(rows, headers),
        "row_alignment": _calc_row_alignment(rows),
        "header_quality": _calc_header_quality(headers),
    }

    anomalies = _detect_anomalies(rows, headers)
    metrics["anomaly_penalty"] = max(0.0, 1.0 - (len(anomalies) * 0.2))

    weighted_scores = {
        "empty_cell_ratio": (1 - metrics["empty_cell_ratio"]) * 100,
        "column_consistency": metrics["column_consistency"] * 100,
        "numeric_validity": metrics["numeric_validity"] * 100,
        "row_alignment": metrics["row_alignment"] * 100,
        "header_quality": metrics["header_quality"] * 100,
        "anomaly_penalty": metrics["anomaly_penalty"] * 100,
    }

    composite = sum(weighted_scores[key] * _WEIGHTS[key] for key in _WEIGHTS)
    composite = max(0.0, min(100.0, composite))

    total_cells = sum(len(row) for row in rows if isinstance(row, list))
    return {
        "score": round(composite, 1),
        "method": "structural_analysis",
        "breakdown": {
            "raw_metrics": metrics,
            "weighted_scores": {key: round(value, 1) for key, value in weighted_scores.items()},
            "weights": dict(_WEIGHTS),
        },
        "flags": anomalies,
        "explanation": _generate_explanation(metrics, anomalies),
        "data_stats": {
            "rows_count": len(rows),
            "columns_count": len(headers) if isinstance(headers, list) else 0,
            "total_cells": total_cells,
        },
    }


def calculate_ledger_confidence(rows: list[dict[str, Any]] | None) -> dict[str, Any]:
    normalized_rows = [
        [
            "" if row.get("particular") is None else str(row.get("particular")).strip(),
            "" if row.get("dr") is None else str(row.get("dr")).strip(),
            "" if row.get("cr") is None else str(row.get("cr")).strip(),
        ]
        for row in (rows or [])
        if isinstance(row, dict)
    ]
    return calculate_structural_confidence(
        {
            "headers": ["particular", "dr", "cr"],
            "rows": normalized_rows,
        }
    )


def _zero_result(reason: str) -> dict[str, Any]:
    return {
        "score": 0.0,
        "method": "structural_analysis",
        "breakdown": {},
        "flags": [reason],
        "explanation": reason,
        "data_stats": {"rows_count": 0, "columns_count": 0, "total_cells": 0},
    }


def _calc_empty_cell_ratio(rows: list[Any]) -> float:
    total_cells = 0
    empty_cells = 0
    for row in rows:
        if not isinstance(row, list):
            continue
        for cell in row:
            total_cells += 1
            if cell is None or str(cell).strip() == "":
                empty_cells += 1
    if total_cells == 0:
        return 1.0
    return empty_cells / total_cells


def _calc_column_consistency(rows: list[Any], headers: list[Any]) -> float:
    candidate_rows = [row for row in rows if isinstance(row, list)]
    if not candidate_rows:
        return 0.0
    expected_columns = len(headers) if isinstance(headers, list) and headers else max(len(row) for row in candidate_rows)
    if expected_columns == 0:
        return 0.0
    matching = sum(1 for row in candidate_rows if len(row) == expected_columns)
    return matching / len(candidate_rows)


def _calc_numeric_validity(rows: list[Any], headers: list[Any]) -> float:
    candidate_rows = [row for row in rows if isinstance(row, list)]
    if not candidate_rows:
        return 0.5
    column_count = len(headers) if isinstance(headers, list) and headers else max(len(row) for row in candidate_rows)
    if column_count == 0:
        return 0.5

    valid_count = 0
    assessed = 0
    for column_index in range(column_count):
        column_values = [
            str(row[column_index]).strip()
            for row in candidate_rows
            if column_index < len(row)
        ]
        if not column_values:
            continue
        numeric_count = sum(1 for value in column_values if _is_numeric(value))
        if numeric_count / len(column_values) <= 0.5:
            continue
        for value in column_values:
            assessed += 1
            if _is_numeric(value) or value in {"", "[unclear]"}:
                valid_count += 1
    if assessed == 0:
        return 1.0
    return valid_count / assessed


def _calc_row_alignment(rows: list[Any]) -> float:
    candidate_rows = [row for row in rows if isinstance(row, list)]
    if not candidate_rows:
        return 0.0
    lengths = [len(row) for row in candidate_rows]
    most_common = max(set(lengths), key=lengths.count)
    aligned = sum(1 for length in lengths if length == most_common)
    return aligned / len(lengths)


def _calc_header_quality(headers: list[Any]) -> float:
    if not isinstance(headers, list) or not headers:
        return 0.0
    non_empty = [str(header).strip() for header in headers if str(header).strip()]
    if not non_empty:
        return 0.0
    unique = {header.lower() for header in non_empty}
    return ((len(non_empty) / len(headers)) + (len(unique) / len(non_empty))) / 2


def _detect_anomalies(rows: list[Any], headers: list[Any]) -> list[str]:
    candidate_rows = [row for row in rows if isinstance(row, list)]
    anomalies: list[str] = []

    if len(candidate_rows) == 1:
        anomalies.append("single_row_only")

    if len(candidate_rows) > 2:
        unique_rows = {str(row) for row in candidate_rows}
        if len(unique_rows) < len(candidate_rows) * 0.7:
            anomalies.append("excessive_duplicate_rows")

    if candidate_rows and isinstance(headers, list) and headers:
        for column_index in range(len(headers)):
            column_values = [
                str(row[column_index]).strip()
                for row in candidate_rows
                if column_index < len(row)
            ]
            if len(column_values) > 2 and len(set(column_values)) == 1:
                anomalies.append(f"uniform_column_{column_index}")
                break

    empty_rows = sum(
        1 for row in candidate_rows if all(str(cell).strip() == "" for cell in row)
    )
    if candidate_rows and empty_rows > len(candidate_rows) * 0.3:
        anomalies.append("many_empty_rows")

    if isinstance(headers, list) and headers and candidate_rows:
        first_row = [str(cell).strip().lower() for cell in candidate_rows[0] if str(cell).strip()]
        header_row = [str(header).strip().lower() for header in headers if str(header).strip()]
        if first_row == header_row:
            anomalies.append("header_duplicated_as_first_row")

    return anomalies


def _generate_explanation(metrics: dict[str, float], anomalies: list[str]) -> str:
    issues: list[str] = []
    if metrics["empty_cell_ratio"] > 0.3:
        issues.append(f"High empty cell rate ({metrics['empty_cell_ratio']:.0%})")
    if metrics["column_consistency"] < 0.7:
        issues.append("Inconsistent column counts across rows")
    if metrics["numeric_validity"] < 0.7:
        issues.append("Numeric columns contain invalid values")
    if metrics["row_alignment"] < 0.8:
        issues.append("Rows have inconsistent structure")
    if metrics["header_quality"] < 0.5:
        issues.append("Headers are missing or duplicated")
    for anomaly in anomalies:
        if anomaly == "excessive_duplicate_rows":
            issues.append("Many duplicate rows detected")
        elif anomaly == "single_row_only":
            issues.append("Only one data row extracted")
        elif anomaly == "many_empty_rows":
            issues.append("Many completely empty rows")
    return "; ".join(issues) if issues else "Good quality extraction"


def _is_numeric(value: str) -> bool:
    if not value:
        return False
    cleaned = (
        value.replace(",", "")
        .replace(" ", "")
        .replace("Rs.", "")
        .replace("INR", "")
        .replace("₹", "")
        .replace("$", "")
    )
    try:
        float(cleaned)
        return True
    except ValueError:
        return False
