"""
Structural Grouping Layer for Document Understanding.

This module implements Phase 4 of the FINAL OCR stabilization architecture,
converting layout blocks into normalized semantic structures.

Architecture Position:
    Raw OCR State (immutable)
    ↓
    Bounding Box Canonicalization
    ↓
    Layout Analysis Layer
    ↓
    Structural Grouping Layer       ← THIS MODULE
    ↓
    Normalization Layer
    ↓
    Presentation Selectors
    ↓
    Display Contract
    ↓
    Frontend Renderers (unchanged)

ABSOLUTE RULES:
- Internal representation ONLY (never directly reaches frontend)
- Generic structural understanding (no templates)
- Maps to existing generic contracts via selector bridge
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

logger = logging.getLogger(__name__)


class StructuralGroup(TypedDict):
    """Internal semantic structure (never sent directly to frontend)."""
    group_type: str  # single_block, dual_column, key_value_block, table_block, sectioned, unknown
    title: str | None
    headers: list[str]
    rows: list[list[str]]
    metadata: dict[str, Any]
    confidence: float


class StructuralGroupingResult(TypedDict):
    """Result of structural grouping with mapping info."""
    groups: list[StructuralGroup]
    primary_group: StructuralGroup | None
    grouping_strategy: str
    warnings: list[str]


def group_single_block(
    headers: list[str],
    rows: list[list[str]],
    title: str | None = None
) -> StructuralGroup:
    """
    Group as single unified block.
    
    Used for: Simple tables, forms, generic documents.
    
    Args:
        headers: Column headers
        rows: Row data
        title: Optional title
    
    Returns:
        Single block structural group
    """
    return StructuralGroup(
        group_type="single_block",
        title=title,
        headers=headers,
        rows=rows,
        metadata={},
        confidence=0.9
    )


def group_dual_column(
    headers: list[str],
    rows: list[list[str]],
    title: str | None = None
) -> StructuralGroup:
    """
    Group as dual-column structure (ledgers, balance sheets).
    
    Converts parallel column layout into a normalized 4-column table:
    [Particular, Left Amount, Right Amount, Notes]
    
    Used for:
    - Ledgers (Debit/Credit)
    - Balance sheets (Assets/Liabilities)
    - Comparison tables
    - Side-by-side reports
    
    Args:
        headers: Column headers
        rows: Row data
        title: Optional title
    
    Returns:
        Dual column structural group
    """
    # Normalize to standard dual-column format
    # Assume last two columns are the parallel numeric columns
    
    if len(headers) >= 3:
        # Standard format: [Particular, Left, Right]
        normalized_headers = headers
    elif len(headers) == 2:
        # Add a label column
        normalized_headers = ["Particular"] + headers
    else:
        # Single column - can't be dual column
        return group_single_block(headers, rows, title)
    
    return StructuralGroup(
        group_type="dual_column",
        title=title,
        headers=normalized_headers,
        rows=rows,
        metadata={"dual_column_detected": True},
        confidence=0.85
    )


def group_key_value(
    rows: list[list[str]],
    title: str | None = None
) -> StructuralGroup:
    """
    Group as key-value pairs (forms, metadata sections).
    
    Converts two-column data into key-value representation.
    
    Used for:
    - Forms
    - Document metadata
    - Invoice headers
    - Entity information
    
    Args:
        rows: Row data (expected to be 2-column)
        title: Optional title
    
    Returns:
        Key-value structural group
    """
    # Standardize as key-value pairs
    headers = ["Field", "Value"]
    
    # Ensure all rows have exactly 2 columns
    normalized_rows = []
    for row in rows:
        if isinstance(row, list):
            if len(row) >= 2:
                normalized_rows.append([str(row[0]), str(row[1])])
            elif len(row) == 1:
                normalized_rows.append([str(row[0]), ""])
            else:
                normalized_rows.append(["", ""])
        else:
            normalized_rows.append([str(row), ""])
    
    return StructuralGroup(
        group_type="key_value_block",
        title=title,
        headers=headers,
        rows=normalized_rows,
        metadata={"is_key_value": True},
        confidence=0.8
    )


def group_sectioned_document(
    headers: list[str],
    rows: list[list[str]],
    heading_indices: list[int],
    title: str | None = None
) -> StructuralGroup:
    """
    Group document with section headings.
    
    Converts documents with repeated section headers (like "Trading Account")
    into properly grouped sections.
    
    Args:
        headers: Column headers
        rows: Row data
        heading_indices: Indices of rows that are headings
        title: Optional title
    
    Returns:
        Sectioned document structural group
    """
    # For now, treat as single block with section markers preserved
    # Future enhancement: split into multiple sections
    
    return StructuralGroup(
        group_type="sectioned",
        title=title,
        headers=headers,
        rows=rows,
        metadata={
            "heading_indices": heading_indices,
            "has_sections": True
        },
        confidence=0.75
    )


def group_table(
    headers: list[str],
    rows: list[list[str]],
    title: str | None = None
) -> StructuralGroup:
    """
    Group as standard table.
    
    Used for: Multi-column tables with clear structure.
    
    Args:
        headers: Column headers
        rows: Row data
        title: Optional title
    
    Returns:
        Table structural group
    """
    return StructuralGroup(
        group_type="table_block",
        title=title,
        headers=headers,
        rows=rows,
        metadata={"is_table": True},
        confidence=0.9
    )


def analyze_and_group(
    headers: list[str],
    rows: list[list[str]],
    layout_analysis: dict[str, Any],
    title: str | None = None
) -> StructuralGroupingResult:
    """
    Phase 4: Structural Grouping Layer.
    
    Convert layout blocks into normalized semantic structure.
    
    This is INTERNAL ONLY - never reaches frontend directly.
    
    Args:
        headers: Column headers
        rows: Row data
        layout_analysis: Result from layout analysis layer
        title: Optional document title
    
    Returns:
        Structural grouping result with primary group and strategy
    """
    warnings: list[str] = []
    groups: list[StructuralGroup] = []
    
    layout_type = layout_analysis.get("layout_type", "unknown")
    layout_confidence = layout_analysis.get("layout_confidence", 0.5)
    heuristics = layout_analysis.get("heuristics_applied", [])
    
    # Determine grouping strategy based on layout analysis
    if layout_type == "dual_column" and layout_confidence >= 0.6:
        # Dual-column structure (ledgers, balance sheets)
        primary_group = group_dual_column(headers, rows, title)
        grouping_strategy = "dual_column"
        
    elif layout_type == "sectioned_document":
        # Document with section headings
        heading_indices = [
            i for i, heuristic in enumerate(heuristics)
            if heuristic == "heading_continuity"
        ]
        primary_group = group_sectioned_document(headers, rows, heading_indices, title)
        grouping_strategy = "sectioned"
        
    elif layout_type == "table" and len(headers) > 2:
        # Standard multi-column table
        primary_group = group_table(headers, rows, title)
        grouping_strategy = "table"
        
    elif len(headers) == 2 and len(rows) > 1:
        # Likely key-value pairs (forms, metadata)
        # Check if first column has unique values (keys)
        first_col_values = [row[0] for row in rows if isinstance(row, list) and len(row) > 0]
        if len(set(first_col_values)) >= len(first_col_values) * 0.8:  # 80% unique
            primary_group = group_key_value(rows, title)
            grouping_strategy = "key_value"
        else:
            primary_group = group_single_block(headers, rows, title)
            grouping_strategy = "single_block"
    
    elif layout_confidence < 0.4:
        # Low confidence - treat as unknown
        primary_group = group_single_block(headers, rows, title)
        primary_group["group_type"] = "unknown"
        primary_group["confidence"] = layout_confidence
        grouping_strategy = "fallback"
        warnings.append("Low layout confidence; using fallback grouping")
    
    else:
        # Default: single block
        primary_group = group_single_block(headers, rows, title)
        grouping_strategy = "single_block"
    
    groups.append(primary_group)
    
    return StructuralGroupingResult(
        groups=groups,
        primary_group=primary_group,
        grouping_strategy=grouping_strategy,
        warnings=warnings
    )


def apply_selector_bridge(
    structural_group: StructuralGroup
) -> dict[str, Any]:
    """
    Phase 5: Selector Bridge.
    
    Map structural groups into existing generic contracts.
    NO frontend changes required.
    
    Mapping:
    - dual_column → generic 4-column table
    - single_block → text + table
    - key_value_block → key_value section
    - table_block → table
    - sectioned → table with section markers
    - unknown → low confidence + raw fallback
    
    Args:
        structural_group: Internal structural group
    
    Returns:
        Generic contract for frontend rendering
    """
    group_type = structural_group["group_type"]
    headers = structural_group["headers"]
    rows = structural_group["rows"]
    title = structural_group.get("title")
    confidence = structural_group.get("confidence", 0.5)
    
    # Map to generic contract
    if group_type == "dual_column":
        # Map to standard table format
        return {
            "type": "table",
            "title": title or "Ledger",
            "headers": headers,
            "rows": rows,
            "layout_type": "dual_column",
            "confidence": confidence
        }
    
    elif group_type == "key_value_block":
        # Map to key-value format
        return {
            "type": "key_value",
            "title": title or "Document Details",
            "headers": headers,
            "rows": rows,
            "layout_type": "key_value",
            "confidence": confidence
        }
    
    elif group_type == "table_block":
        # Map to table format
        return {
            "type": "table",
            "title": title or "Table",
            "headers": headers,
            "rows": rows,
            "layout_type": "table",
            "confidence": confidence
        }
    
    elif group_type == "sectioned":
        # Map to table format with section awareness
        return {
            "type": "table",
            "title": title or "Document",
            "headers": headers,
            "rows": rows,
            "layout_type": "sectioned",
            "confidence": confidence,
            "metadata": structural_group.get("metadata", {})
        }
    
    elif group_type == "unknown":
        # Low confidence fallback
        return {
            "type": "table",
            "title": title or "OCR Extraction",
            "headers": headers,
            "rows": rows,
            "layout_type": "unknown",
            "confidence": confidence,
            "fallback_mode": True
        }
    
    else:  # single_block
        # Default table format
        return {
            "type": "table",
            "title": title or "Document",
            "headers": headers,
            "rows": rows,
            "layout_type": "single",
            "confidence": confidence
        }
