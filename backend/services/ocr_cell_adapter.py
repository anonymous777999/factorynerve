"""Minimal cell adapter for OCR cell structure upgrade (Phase 1).

Converts legacy string cells to structured objects with backward compatibility.
"""

from typing import Any


def normalize_cell(
    cell: str | dict,
    confidence: float | None = None
) -> dict[str, Any]:
    """
    Convert legacy string OR structured dict to minimal CellObject.
    
    Minimal fields:
    - value: str (display value)
    - confidence: float (0.0-1.0)
    
    Args:
        cell: String (legacy) or dict (already structured)
        confidence: Optional confidence override
    
    Returns:
        Dictionary with value and confidence
    """
    # Already structured - return as-is
    if isinstance(cell, dict):
        return {
            "value": str(cell.get("value", "")),
            "confidence": float(cell.get("confidence", confidence or 0.5)),
        }
    
    # Legacy string - upgrade to minimal object
    return {
        "value": str(cell),
        "confidence": confidence if confidence is not None else 0.5,
    }


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
        Adjusted confidence (0.0 to 1.0)
    """
    # Default base confidence
    if base_confidence is None:
        base_confidence = 0.7
    
    # Empty cell is certain
    if not cell_value.strip():
        return 0.99
    
    confidence = base_confidence
    
    # Column type adjustment
    if column_type == "numeric":
        if _is_numeric_simple(cell_value):
            confidence += 0.1  # Boost for consistent numeric
        else:
            confidence -= 0.2  # Penalize non-numeric in numeric column
    
    # Clamp to 0.0-1.0
    return max(0.0, min(1.0, confidence))
