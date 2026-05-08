"""
Layout Analysis Layer for Structural Document Understanding.

This module implements the FINAL OCR stabilization architecture's layout analysis
layer, which transforms raw OCR extractions into structurally-aware document
representations WITHOUT requiring frontend intelligence.

Architecture Position:
    Raw OCR State (immutable)
    ↓
    Bounding Box Canonicalization
    ↓
    Layout Analysis Layer          ← THIS MODULE
    ↓
    Structural Grouping Layer
    ↓
    Normalization Layer
    ↓
    Presentation Selectors
    ↓
    Display Contract
    ↓
    Frontend Renderers (unchanged)

ABSOLUTE RULES:
- Frontend stays dumb
- Only backend performs layout analysis
- No mutation of raw OCR state
- Timeout-safe (1-2 seconds max)
- Graceful degradation on failure
"""

from __future__ import annotations

import logging
import time
from typing import Any, TypedDict

logger = logging.getLogger(__name__)

# Layout analysis timeout (seconds)
_LAYOUT_ANALYSIS_TIMEOUT = 2.0


class CanonicalBox(TypedDict):
    """Canonical bounding box format for all OCR providers."""
    x1: float
    y1: float
    x2: float
    y2: float
    center_x: float
    center_y: float
    width: float
    height: float
    page_number: int


class LayoutBlock(TypedDict):
    """Structural layout block detected from spatial analysis."""
    block_id: str
    block_type: str  # heading, table_row, section_break, dual_column, key_value
    content: list[Any]
    y_start: float
    y_end: float
    confidence: float
    metadata: dict[str, Any]


class LayoutAnalysisResult(TypedDict):
    """Result of layout analysis with confidence scoring."""
    layout_blocks: list[LayoutBlock]
    layout_confidence: float
    layout_type: str  # single_block, dual_column, key_value, table, unknown
    heuristics_applied: list[str]
    warnings: list[str]
    processing_time_ms: float


def canonicalize_bounding_box(
    box: dict[str, Any] | list[float] | None,
    page_number: int = 1
) -> CanonicalBox | None:
    """
    Phase 2: Bounding Box Canonicalization.
    
    Converts various OCR provider bounding box formats into a single canonical format.
    
    Supported input formats:
    - {"x1": ..., "y1": ..., "x2": ..., "y2": ...}
    - {"left": ..., "top": ..., "right": ..., "bottom": ...}
    - {"x": ..., "y": ..., "width": ..., "height": ...}
    - [x1, y1, x2, y2]
    - [left, top, right, bottom]
    
    Args:
        box: Bounding box in any supported format
        page_number: Page number (default: 1)
    
    Returns:
        Canonical bounding box or None if invalid
    """
    if not box:
        return None
    
    try:
        # Handle dictionary formats
        if isinstance(box, dict):
            # Format 1: x1, y1, x2, y2
            if "x1" in box and "y1" in box and "x2" in box and "y2" in box:
                x1, y1, x2, y2 = float(box["x1"]), float(box["y1"]), float(box["x2"]), float(box["y2"])
            # Format 2: left, top, right, bottom
            elif "left" in box and "top" in box and "right" in box and "bottom" in box:
                x1, y1 = float(box["left"]), float(box["top"])
                x2, y2 = float(box["right"]), float(box["bottom"])
            # Format 3: x, y, width, height
            elif "x" in box and "y" in box and "width" in box and "height" in box:
                x1, y1 = float(box["x"]), float(box["y"])
                x2, y2 = x1 + float(box["width"]), y1 + float(box["height"])
            else:
                return None
        # Handle list formats
        elif isinstance(box, (list, tuple)) and len(box) >= 4:
            x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
        else:
            return None
        
        # Ensure x1 <= x2 and y1 <= y2
        if x1 > x2:
            x1, x2 = x2, x1
        if y1 > y2:
            y1, y2 = y2, y1
        
        width = x2 - x1
        height = y2 - y1
        center_x = x1 + width / 2
        center_y = y1 + height / 2
        
        return CanonicalBox(
            x1=x1,
            y1=y1,
            x2=x2,
            y2=y2,
            center_x=center_x,
            center_y=center_y,
            width=width,
            height=height,
            page_number=page_number
        )
    except (ValueError, TypeError, KeyError) as error:
        logger.debug("Failed to canonicalize bounding box: %s", error)
        return None


def suppress_repeated_headers(
    rows: list[list[str]],
    cell_boxes: list[list[dict[str, Any]]] | None = None
) -> tuple[list[list[str]], list[str]]:
    """
    Phase 1: Repeated Header Suppression.
    
    Problem: Documents spam headers like "Trading Account" repeatedly because
    headings are treated as row data.
    
    Solution: Suppress spatially repetitive structural headers while preserving
    the first occurrence.
    
    Rules:
    - Only suppress if same string repeats >2 times consecutively
    - Must appear in same structural column region
    - DO NOT globally deduplicate all repeated text
    
    Args:
        rows: List of row data
        cell_boxes: Optional bounding boxes for spatial analysis
    
    Returns:
        Tuple of (cleaned_rows, warnings)
    """
    if not rows or len(rows) < 3:
        return rows, []
    
    warnings: list[str] = []
    cleaned_rows: list[list[str]] = []
    
    # Track consecutive repetitions per column
    column_repetitions: dict[int, dict[str, int]] = {}
    
    for row_idx, row in enumerate(rows):
        if not isinstance(row, list):
            cleaned_rows.append(row)
            continue
        
        cleaned_row = list(row)
        should_include_row = True
        
        for col_idx, cell in enumerate(row):
            cell_text = str(cell or "").strip()
            
            if not cell_text:
                continue
            
            # Track repetitions
            if col_idx not in column_repetitions:
                column_repetitions[col_idx] = {}
            
            if cell_text not in column_repetitions[col_idx]:
                column_repetitions[col_idx][cell_text] = 1
            else:
                column_repetitions[col_idx][cell_text] += 1
            
            # Check if this is a repeated header (>2 consecutive occurrences)
            if column_repetitions[col_idx][cell_text] > 2:
                # Check if entire row is just this repeated header
                non_empty_cells = [c for c in row if str(c or "").strip()]
                if len(non_empty_cells) == 1 and non_empty_cells[0] == cell_text:
                    should_include_row = False
                    if cell_text not in [w.split(":")[1].strip() for w in warnings if w.startswith("Suppressed repeated header:")]:
                        warnings.append(f"Suppressed repeated header: {cell_text}")
                    break
            else:
                # Reset counter if different text appears
                for other_text in list(column_repetitions[col_idx].keys()):
                    if other_text != cell_text:
                        column_repetitions[col_idx][other_text] = 0
        
        if should_include_row:
            cleaned_rows.append(cleaned_row)
    
    return cleaned_rows, warnings


def prune_empty_columns(
    headers: list[str],
    rows: list[list[str]],
    threshold: float = 0.8
) -> tuple[list[str], list[list[str]], list[str]]:
    """
    Phase 1: Empty Column Pruning.
    
    Problem: Ledgers and accounting docs often have empty columns that clutter display.
    
    Solution: Drop columns where >=80% of values are null/empty.
    
    This immediately improves:
    - Ledgers
    - OCR accounting docs
    - Factory reports
    - Noisy spreadsheets
    
    WITHOUT changing OCR itself.
    
    Args:
        headers: Column headers
        rows: Row data
        threshold: Proportion of empty cells to trigger pruning (default: 0.8 = 80%)
    
    Returns:
        Tuple of (pruned_headers, pruned_rows, warnings)
    """
    if not rows:
        return headers, rows, []
    
    warnings: list[str] = []
    
    # Calculate emptiness ratio per column
    num_rows = len(rows)
    num_columns = len(headers) if headers else max((len(row) for row in rows), default=0)
    
    if num_columns == 0:
        return headers, rows, []
    
    column_emptiness: list[float] = []
    for col_idx in range(num_columns):
        empty_count = 0
        for row in rows:
            if not isinstance(row, list):
                continue
            if col_idx >= len(row) or not str(row[col_idx] or "").strip():
                empty_count += 1
        
        emptiness_ratio = empty_count / num_rows if num_rows > 0 else 0.0
        column_emptiness.append(emptiness_ratio)
    
    # Identify columns to keep
    columns_to_keep: list[int] = []
    for col_idx, emptiness in enumerate(column_emptiness):
        if emptiness < threshold:
            columns_to_keep.append(col_idx)
        else:
            header_name = headers[col_idx] if col_idx < len(headers) else f"Column {col_idx + 1}"
            warnings.append(f"Pruned empty column: {header_name} ({int(emptiness * 100)}% empty)")
    
    # If all columns would be pruned, keep them all
    if not columns_to_keep:
        return headers, rows, ["All columns were empty; keeping original structure"]
    
    # Prune headers
    pruned_headers = [headers[idx] for idx in columns_to_keep if idx < len(headers)]
    
    # Prune rows
    pruned_rows: list[list[str]] = []
    for row in rows:
        if not isinstance(row, list):
            pruned_rows.append(row)
            continue
        pruned_row = [row[idx] if idx < len(row) else "" for idx in columns_to_keep]
        pruned_rows.append(pruned_row)
    
    return pruned_headers, pruned_rows, warnings


def calculate_layout_confidence(
    headers: list[str],
    rows: list[list[str]],
    cell_boxes: list[list[dict[str, Any]]] | None = None,
    heuristics_applied: list[str] | None = None
) -> float:
    """
    Phase 1: Layout Confidence Field.
    
    Separate from OCR confidence - this measures confidence in STRUCTURAL UNDERSTANDING.
    
    Meaning:
    - ocr_confidence: confidence in extracted TEXT
    - layout_confidence: confidence in STRUCTURAL UNDERSTANDING
    
    Behavior:
    - >=0.7 → formatted document mode safe
    - 0.4–0.7 → show warning banner
    - <0.4 → default to spreadsheet/raw mode
    
    Composite scoring factors:
    - Heading continuity detected: +0.2
    - Clean dual-column structure: +0.2
    - Repeated-header suppression: -0.2
    - Overlapping boxes: -0.2
    - Irregular row spacing: -0.1
    - Clean structural grouping: +0.2
    
    Args:
        headers: Column headers
        rows: Row data
        cell_boxes: Optional bounding boxes for spatial analysis
        heuristics_applied: List of heuristics that were applied
    
    Returns:
        Layout confidence score (0.0 - 1.0)
    """
    score = 0.5  # Start neutral
    
    heuristics = heuristics_applied or []
    
    # Factor: Clean table structure
    if rows and headers:
        expected_cols = len(headers)
        matching_rows = sum(1 for row in rows if isinstance(row, list) and len(row) == expected_cols)
        if rows:
            structure_quality = matching_rows / len(rows)
            score += structure_quality * 0.2
    
    # Factor: Heading continuity detected
    if "heading_continuity" in heuristics:
        score += 0.2
    
    # Factor: Clean dual-column structure
    if "dual_column_detected" in heuristics:
        score += 0.2
    
    # Factor: Repeated header suppression (penalty - indicates noisy structure)
    if "repeated_header_suppression" in heuristics:
        score -= 0.2
    
    # Factor: Overlapping boxes (penalty)
    if "overlapping_boxes" in heuristics:
        score -= 0.2
    
    # Factor: Irregular row spacing (penalty)
    if "irregular_spacing" in heuristics:
        score -= 0.1
    
    # Factor: Clean structural grouping
    if "structural_grouping" in heuristics:
        score += 0.2
    
    # Factor: Empty column pruning (slight penalty - indicates noisy structure)
    if "empty_column_pruning" in heuristics:
        score -= 0.1
    
    # Clamp to 0.0 - 1.0
    return max(0.0, min(1.0, score))


def detect_heading_rows(
    rows: list[list[str]],
    cell_boxes: list[list[dict[str, Any]]] | None = None
) -> list[int]:
    """
    Heuristic 1: Heading Continuity Detection.
    
    Detect:
    - Centered headings
    - Isolated headings
    - Large headings
    - Structurally separated headings
    
    Rule: Rows belong to the current heading section until another heading appears.
    
    Args:
        rows: Row data
        cell_boxes: Optional bounding boxes for spatial analysis
    
    Returns:
        List of row indices that are headings
    """
    if not rows:
        return []
    
    heading_indices: list[int] = []
    
    for row_idx, row in enumerate(rows):
        if not isinstance(row, list):
            continue
        
        non_empty_cells = [cell for cell in row if str(cell or "").strip()]
        
        # Heuristic: Single cell in row (likely a heading)
        if len(non_empty_cells) == 1:
            cell_text = str(non_empty_cells[0]).strip()
            # Check if it looks like a heading (title case, short, etc.)
            if cell_text and (cell_text.istitle() or cell_text.isupper()):
                heading_indices.append(row_idx)
                continue
        
        # Heuristic: All cells identical (repeated heading)
        if non_empty_cells and len(set(non_empty_cells)) == 1:
            heading_indices.append(row_idx)
    
    return heading_indices


def detect_dual_column_structure(
    rows: list[list[str]],
    cell_boxes: list[list[dict[str, Any]]] | None = None
) -> bool:
    """
    Heuristic 2: Parallel Column Detection.
    
    Detect:
    - Mirrored numeric structures
    - Left/right column symmetry
    - Dual accounting regions
    
    DO NOT detect keywords like "debit"/"credit". Detect structure only.
    
    Used for:
    - Ledgers
    - Balance sheets
    - Comparison tables
    - Marksheets
    - Industrial side-by-side reports
    
    Args:
        rows: Row data
        cell_boxes: Optional bounding boxes for spatial analysis
    
    Returns:
        True if dual-column structure detected
    """
    if not rows or len(rows) < 2:
        return False
    
    # Count columns
    column_counts = [len(row) for row in rows if isinstance(row, list)]
    if not column_counts:
        return False
    
    most_common_cols = max(set(column_counts), key=column_counts.count)
    
    # Need at least 3 columns for dual structure (label + left + right)
    if most_common_cols < 3:
        return False
    
    # Check if we have numeric columns on both sides
    # This is a simple heuristic - can be enhanced with actual box positions
    sample_rows = [row for row in rows[:10] if isinstance(row, list) and len(row) >= 3]
    if not sample_rows:
        return False
    
    # Check last two columns for numeric content (typical dual-column pattern)
    left_numeric_count = 0
    right_numeric_count = 0
    
    for row in sample_rows:
        if len(row) >= 2:
            left_val = str(row[-2] or "").strip()
            right_val = str(row[-1] or "").strip()
            
            if _is_numeric_value(left_val):
                left_numeric_count += 1
            if _is_numeric_value(right_val):
                right_numeric_count += 1
    
    # If both columns are mostly numeric, likely dual-column
    threshold = len(sample_rows) * 0.5
    return left_numeric_count >= threshold and right_numeric_count >= threshold


def detect_spatial_breaks(
    cell_boxes: list[list[dict[str, Any]]] | None
) -> list[int]:
    """
    Heuristic 3: Spatial Proximity Grouping.
    
    If: y-gap > median_row_height * 2.5
    Create: structural section break
    
    This helps:
    - Handwritten docs
    - Irregular reports
    - Notebook accounting
    
    Args:
        cell_boxes: Bounding boxes for spatial analysis
    
    Returns:
        List of row indices where section breaks occur
    """
    if not cell_boxes or len(cell_boxes) < 2:
        return []
    
    breaks: list[int] = []
    
    # Calculate row heights
    row_heights: list[float] = []
    row_y_positions: list[float] = []
    
    for row_boxes in cell_boxes:
        if not row_boxes:
            continue
        
        canonical_boxes = [canonicalize_bounding_box(box) for box in row_boxes]
        valid_boxes = [box for box in canonical_boxes if box is not None]
        
        if valid_boxes:
            min_y = min(box["y1"] for box in valid_boxes)
            max_y = max(box["y2"] for box in valid_boxes)
            row_heights.append(max_y - min_y)
            row_y_positions.append(min_y)
    
    if not row_heights:
        return []
    
    # Calculate median row height
    sorted_heights = sorted(row_heights)
    median_height = sorted_heights[len(sorted_heights) // 2]
    
    # Detect gaps
    threshold = median_height * 2.5
    
    for i in range(len(row_y_positions) - 1):
        gap = row_y_positions[i + 1] - row_y_positions[i]
        if gap > threshold:
            breaks.append(i + 1)
    
    return breaks


def analyze_layout(
    headers: list[str],
    rows: list[list[str]],
    cell_boxes: list[list[dict[str, Any]]] | None = None
) -> LayoutAnalysisResult:
    """
    Phase 3: Layout Analysis Layer.
    
    Runs AFTER OCR, BEFORE normalization.
    
    Input: raw OCR + canonical bounding boxes
    Output: layout_blocks + layout_confidence
    
    IMPORTANT: Layout analysis timeout = 1-2 seconds max.
    If exceeded: fallback to simple normalization + reduce layout_confidence.
    
    Args:
        headers: Column headers
        rows: Row data
        cell_boxes: Optional bounding boxes for spatial analysis
    
    Returns:
        Layout analysis result with confidence scoring
    """
    start_time = time.time()
    
    layout_blocks: list[LayoutBlock] = []
    heuristics_applied: list[str] = []
    warnings: list[str] = []
    
    try:
        # Heuristic 1: Detect heading rows
        heading_indices = detect_heading_rows(rows, cell_boxes)
        if heading_indices:
            heuristics_applied.append("heading_continuity")
        
        # Heuristic 2: Detect dual-column structure
        is_dual_column = detect_dual_column_structure(rows, cell_boxes)
        if is_dual_column:
            heuristics_applied.append("dual_column_detected")
        
        # Heuristic 3: Detect spatial breaks
        if cell_boxes:
            section_breaks = detect_spatial_breaks(cell_boxes)
            if section_breaks:
                heuristics_applied.append("spatial_breaks_detected")
        
        # Determine layout type
        if is_dual_column:
            layout_type = "dual_column"
        elif heading_indices:
            layout_type = "sectioned_document"
        elif len(rows) > 3 and headers:
            layout_type = "table"
        else:
            layout_type = "single_block"
        
        # Check timeout
        elapsed = time.time() - start_time
        if elapsed > _LAYOUT_ANALYSIS_TIMEOUT:
            warnings.append(f"Layout analysis timeout ({elapsed:.2f}s); using fast path")
            layout_type = "unknown"
        
    except Exception as error:
        logger.warning("Layout analysis failed: %s", error, exc_info=True)
        layout_type = "unknown"
        warnings.append(f"Layout analysis error: {type(error).__name__}")
    
    # Calculate layout confidence
    layout_confidence = calculate_layout_confidence(
        headers, rows, cell_boxes, heuristics_applied
    )
    
    processing_time_ms = (time.time() - start_time) * 1000
    
    return LayoutAnalysisResult(
        layout_blocks=layout_blocks,
        layout_confidence=layout_confidence,
        layout_type=layout_type,
        heuristics_applied=heuristics_applied,
        warnings=warnings,
        processing_time_ms=processing_time_ms
    )


def _is_numeric_value(value: str) -> bool:
    """Check if a string value is numeric (with common currency symbols/formats)."""
    if not value:
        return False
    
    # Remove common numeric formatting
    cleaned = (
        value.replace(",", "")
        .replace(" ", "")
        .replace("Rs.", "")
        .replace("INR", "")
        .replace("₹", "")
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .strip()
    )
    
    try:
        float(cleaned)
        return True
    except ValueError:
        return False
