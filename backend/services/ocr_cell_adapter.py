"""Minimal cell adapter for OCR cell structure upgrade (Phase 1 & 3).

Converts legacy string cells to structured objects with backward compatibility.
Phase 3: Adds safe numeric normalization.
"""

from typing import Any
import re
from backend.utils import normalize_confidence


def normalize_cell(
    cell: str | dict,
    confidence: float | None = None,
    add_normalized: bool = False
) -> dict[str, Any]:
    """
    Convert legacy string OR structured dict to CellObject with optional normalization.
    
    Fields:
    - value: str (display value - always preserved)
    - confidence: float (0-100)
    - normalized: float | None (Phase 3: safe numeric value)
    
    Args:
        cell: String (legacy) or dict (already structured)
        confidence: Optional confidence override
        add_normalized: If True, attempt to add normalized numeric value
    
    Returns:
        Dictionary with value, confidence, and optionally normalized
    """
    # Already structured - return as-is (preserve normalized if exists)
    if isinstance(cell, dict):
        result = {
            "value": str(cell.get("value", "")),
            "confidence": normalize_confidence(cell.get("confidence", confidence or 0.5)),
        }
        # Preserve existing normalized value
        if "normalized" in cell and cell["normalized"] is not None:
            result["normalized"] = cell["normalized"]
        elif add_normalized:
            # Try to add normalization
            normalized_value = _safe_normalize_numeric(result["value"])
            if normalized_value is not None:
                result["normalized"] = normalized_value
        return result
    
    # Legacy string - upgrade to minimal object
    result = {
        "value": str(cell),
        "confidence": normalize_confidence(confidence if confidence is not None else 0.5),
    }
    
    # Phase 3: Add safe numeric normalization if requested
    if add_normalized:
        normalized_value = _safe_normalize_numeric(result["value"])
        if normalized_value is not None:
            result["normalized"] = normalized_value
    
    return result


def _safe_normalize_numeric(value: str) -> float | None:
    """
    Phase 3: Safely parse numeric value from string.
    
    Reuses proven logic from table_scan.py:
    - Removes currency symbols (₹, $, €, £)
    - Removes commas and spaces
    - Handles decimal points
    - Handles negative numbers
    
    Rules:
    - If ambiguous → return None
    - If clearly numeric → return float
    - Preserve original display value always
    
    Args:
        value: String cell value
    
    Returns:
        Normalized float or None if not confidently numeric
    """
    if not value or not isinstance(value, str):
        return None
    
    text = value.strip()
    if not text:
        return None
    
    # Remove currency symbols, commas, and spaces (reuses table_scan logic)
    cleaned = re.sub(r"[\s,₹$€£]", "", text)
    
    # Skip percentage values (ambiguous for normalization)
    if "%" in cleaned:
        return None
    
    # Check if it matches numeric pattern: optional sign, digits, optional decimal
    if re.fullmatch(r"[+-]?\d+(\.\d+)?", cleaned):
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    
    return None


def infer_column_types(rows: list[list[str]]) -> list[str]:
    """
    Infer basic column types: 'numeric' or 'text'.
    
    Simple heuristic: if >60% of cells are numeric-like, mark as numeric.
    
    Args:
        rows: List of row data (strings)
    
    Returns:
        List of column types (same length as columns)
    """
    if not rows:
        return []
    
    # Determine column count
    column_count = max((len(row) for row in rows), default=0)
    if column_count == 0:
        return []
    
    column_types = []
    
    for col_idx in range(column_count):
        # Extract column values
        column_values = []
        for row in rows:
            if col_idx < len(row):
                value = str(row[col_idx]).strip()
                if value:  # Only non-empty cells
                    column_values.append(value)
        
        # No data = text
        if not column_values:
            column_types.append("text")
            continue
        
        # Count numeric-like cells
        numeric_count = sum(1 for v in column_values if _is_numeric_simple(v))
        numeric_ratio = numeric_count / len(column_values)
        
        # If >60% numeric, mark as numeric
        column_types.append("numeric" if numeric_ratio > 0.6 else "text")
    
    return column_types


def _is_numeric_simple(value: str) -> bool:
    """
    Simple check: does this look like a number?
    
    Accepts:
    - Pure numbers: "123", "45.67"
    - Numbers with commas: "1,234", "1,00,000"
    - Numbers with currency: "₹1234", "$45.67"
    
    Args:
        value: String to check
    
    Returns:
        True if looks numeric
    """
    # Remove common symbols and spaces
    cleaned = (
        value
        .replace("₹", "")
        .replace("$", "")
        .replace("€", "")
        .replace(",", "")
        .replace(" ", "")
        .strip()
    )
    
    if not cleaned:
        return False
    
    # Try to convert to float
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def estimate_confidence_simple(
    cell_value: str,
    column_type: str,
    base_confidence: float | None = None
) -> float:
    """
    Simple confidence heuristic.
    
    Logic:
    - Empty cells: 0.99 (certain)
    - Numeric column + numeric value: boost +0.1
    - Numeric column + non-numeric value: reduce -0.2
    - Otherwise: use base confidence
    
    Args:
        cell_value: Cell text content
        column_type: "numeric" or "text"
        base_confidence: Base OCR confidence (if available)
    
    Returns:
        Adjusted confidence (0.0 to 100.0)
    """
    # Standardize base confidence to 0-100
    base_confidence = normalize_confidence(base_confidence)
    if base_confidence is None:
        base_confidence = 70.0
    
    # Empty cell is certain
    if not cell_value.strip():
        return 99.0
    
    confidence = base_confidence
    
    # Column type adjustment
    if column_type == "numeric":
        if _is_numeric_simple(cell_value):
            confidence += 10.0  # Boost for consistent numeric
        else:
            confidence -= 20.0  # Penalize non-numeric in numeric column
    
    # Clamp to 0.0-100.0
    return max(0.0, min(100.0, confidence))
