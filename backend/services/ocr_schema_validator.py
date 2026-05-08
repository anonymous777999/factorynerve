"""
Central OCR Schema Validator and Normalizer

This is the single entry point for all OCR row normalization.
Handles all document types via runtime-loaded schemas from config/schemas.yml.

Architecture: Response Format Detection → JSON Parsing → Type Detection → 
              Schema Lookup → Canonical Normalization → Metadata Attachment → Validation
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


logger = logging.getLogger(__name__)

# Document type detection keywords (keyword matching only, no ML)
DETECTION_KEYWORDS = {
    "ledger": ["dr", "cr", "debit", "credit", "particulars", "journal",
               "folio", "ledger", "narration"],
    "invoice": ["invoice", "invoice no", "bill to", "hsn", "gst", "igst",
                "cgst", "sgst", "tax invoice", "qty", "rate"],
    "receipt": ["receipt", "received from", "cash receipt", "payment receipt",
                "total amount received"],
    "bank_statement": ["account statement", "opening balance", "closing balance",
                       "transaction date", "value date", "chq no"],
    "generic_table": [],
    "unknown_document": [],
}


@dataclass
class RowMetadata:
    """OCR metadata - never written to data columns"""
    confidence: float | None = None
    model: str = "unknown"
    source_image: str = ""
    source_page: int | None = None
    bbox_json: str | None = None
    schema_version: str = "unknown"
    doc_type: str = "unknown_document"
    extraction_timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class NormalizedRow:
    """Two-part row structure: data fields + metadata"""
    data: dict[str, Any]
    meta: RowMetadata


class SchemaValidator:
    """Loads and applies schemas from config/schemas.yml"""
    
    def __init__(self, config_path: str | None = None):
        self.config_path = config_path or self._find_config_path()
        self.schemas: dict[str, Any] = {}
        self.schema_version = "unknown"
        self._load_schemas()
    
    def _find_config_path(self) -> str:
        """Find config/schemas.yml relative to project root"""
        # Start from current file location and walk up to find config/
        current = Path(__file__).resolve()
        for parent in [current.parent, *current.parents]:
            config_file = parent / "config" / "schemas.yml"
            if config_file.exists():
                return str(config_file)
        # Fallback to relative path from backend/
        return str(Path(__file__).parent.parent.parent / "config" / "schemas.yml")
    
    def _load_schemas(self):
        """Load schemas from YAML config file"""
        try:
            config_path = Path(self.config_path)
            if not config_path.exists():
                logger.warning(f"Schema config not found at {self.config_path}, using empty schemas")
                self.schemas = {}
                return
            
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            self.schema_version = config.get("schema_version", "unknown")
            self.schemas = config.get("schemas", {})
            logger.info(f"Loaded {len(self.schemas)} schemas from {self.config_path} (version {self.schema_version})")
        
        except Exception as error:
            logger.error(f"Failed to load schemas from {self.config_path}: {error}", exc_info=True)
            self.schemas = {}
    
    def get_schema(self, doc_type: str) -> dict[str, Any]:
        """Get schema for document type"""
        schema = self.schemas.get(doc_type, {})
        if not schema:
            logger.warning(f"No schema found for doc_type={doc_type}, using unknown_document")
            return self.schemas.get("unknown_document", {"columns": [], "optional_columns": []})
        return schema
    
    def get_columns(self, doc_type: str) -> tuple[list[str], list[str]]:
        """Get required and optional columns for a document type"""
        schema = self.get_schema(doc_type)
        required = schema.get("columns", [])
        optional = schema.get("optional_columns", [])
        return required, optional


def detect_response_format(raw_response: str) -> str:
    """
    Returns 'json' or 'text'
    
    This is the FIRST step - must happen before any parsing.
    Fixes Bug #16 (root cause of JSON blob exports).
    """
    if not raw_response:
        return 'text'
    
    stripped = raw_response.strip()
    if not stripped:
        return 'text'
    
    # Check if response starts with JSON structure markers
    if stripped.startswith('{') or stripped.startswith('['):
        return 'json'
    
    return 'text'


def parse_json_response(raw_response: str) -> list[dict[str, Any]] | None:
    """
    Parse JSON response and extract rows.
    
    Looks for common keys: entries, rows, line_items, items, data
    Returns list of row dicts or None if parsing fails.
    """
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError as error:
        logger.error(f"JSON parse error: {error}")
        return None
    
    # Look for rows in common keys
    row_keys = ["entries", "rows", "line_items", "items", "data"]
    
    if isinstance(data, list):
        return data
    
    if isinstance(data, dict):
        for key in row_keys:
            if key in data and isinstance(data[key], list):
                return data[key]
        
        # If dict has "headers" and "rows", extract rows
        if "rows" in data:
            return data["rows"] if isinstance(data["rows"], list) else None
    
    return None


def parse_text_response(raw_response: str) -> list[dict[str, Any]]:
    """
    Parse text response by splitting lines and detecting delimiters.
    
    Supports tab, pipe, comma delimiters.
    """
    lines = [line.strip() for line in raw_response.split('\n') if line.strip()]
    if not lines:
        return []
    
    # Detect delimiter from first line
    first_line = lines[0]
    delimiter = '\t'
    if '|' in first_line:
        delimiter = '|'
    elif ',' in first_line and '\t' not in first_line:
        delimiter = ','
    
    # Parse lines
    rows = []
    headers = None
    for line in lines:
        cells = [cell.strip() for cell in line.split(delimiter)]
        if headers is None:
            headers = cells
        else:
            row_dict = {headers[i]: cells[i] if i < len(cells) else "" 
                       for i in range(len(headers))}
            rows.append(row_dict)
    
    return rows


def detect_document_type(ocr_text: str) -> str:
    """
    Detect document type using keyword matching only.
    
    Returns one of: ledger, invoice, receipt, bank_statement, generic_table, unknown_document
    """
    if not ocr_text:
        return "unknown_document"
    
    text_lower = ocr_text.lower()
    scores = {doc_type: 0 for doc_type in DETECTION_KEYWORDS}
    
    for doc_type, keywords in DETECTION_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[doc_type] += 1
    
    best_type = max(scores, key=scores.get)
    if scores[best_type] == 0:
        return "unknown_document"
    
    return best_type


def flatten_value(value: Any) -> str | int | float | None:
    """
    Flatten nested objects/lists before export.
    
    Never writes raw JSON strings or Python repr to cells.
    Fixes Bug #13 (nested objects in cells).
    """
    if value is None:
        return None
    
    if isinstance(value, (str, int, float, bool)):
        return value
    
    if isinstance(value, dict):
        # Flatten: {"tax": 18, "type": "IGST"} → "tax:18 type:IGST"
        parts = [f"{k}:{v}" for k, v in value.items()]
        return " ".join(parts)
    
    if isinstance(value, list):
        # Flatten: ["item1", "item2"] → "item1, item2"
        return ", ".join(str(v) for v in value)
    
    # Fallback to string
    return str(value)


def normalize_column_name(raw_name: str) -> str:
    """
    Normalize column name: lowercase, strip, replace spaces with _, remove special chars
    """
    # Lowercase and strip
    normalized = raw_name.lower().strip()
    
    # Replace spaces and special chars with underscore
    normalized = re.sub(r'[^a-z0-9]+', '_', normalized)
    
    # Remove leading/trailing underscores
    normalized = normalized.strip('_')
    
    return normalized or "column"


def normalize_rows_generic_table(
    raw_rows: list[dict[str, Any] | list[Any]],
    validator: SchemaValidator,
    metadata_base: dict[str, Any],
) -> list[NormalizedRow]:
    """
    Normalize generic table - use first row as headers.
    
    Fixes Bug #12 (generic_table handling).
    """
    if not raw_rows:
        return []
    
    # Determine headers from first row
    first_row = raw_rows[0]
    if isinstance(first_row, dict):
        headers = list(first_row.keys())
    elif isinstance(first_row, list):
        headers = first_row
        raw_rows = raw_rows[1:]  # Skip header row
    else:
        headers = ["column"]
    
    # Normalize header names
    normalized_headers = [normalize_column_name(str(h)) for h in headers]
    
    # Normalize data rows
    normalized = []
    for raw_row in raw_rows:
        if isinstance(raw_row, dict):
            data = {normalized_headers[i]: flatten_value(raw_row.get(headers[i]))
                   for i in range(len(headers))}
        elif isinstance(raw_row, list):
            data = {normalized_headers[i]: flatten_value(raw_row[i] if i < len(raw_row) else None)
                   for i in range(len(normalized_headers))}
        else:
            data = {normalized_headers[0]: flatten_value(raw_row)}
        
        meta = RowMetadata(
            **metadata_base,
            doc_type="generic_table",
            schema_version=validator.schema_version,
        )
        normalized.append(NormalizedRow(data=data, meta=meta))
    
    return normalized


def normalize_rows_unknown_document(
    raw_rows: list[dict[str, Any] | list[Any]],
    validator: SchemaValidator,
    metadata_base: dict[str, Any],
) -> list[NormalizedRow]:
    """
    Normalize unknown document - preserve raw structure safely.
    
    Fixes Bug #13 (unknown_document handling).
    """
    normalized = []
    
    for raw_row in raw_rows:
        if isinstance(raw_row, dict):
            # Flatten all values in the dict
            data = {str(k): flatten_value(v) for k, v in raw_row.items()}
        elif isinstance(raw_row, list):
            # Convert list to dict with indexed keys
            data = {f"col_{i}": flatten_value(v) for i, v in enumerate(raw_row)}
        else:
            data = {"value": flatten_value(raw_row)}
        
        meta = RowMetadata(
            **metadata_base,
            doc_type="unknown_document",
            schema_version=validator.schema_version,
        )
        normalized.append(NormalizedRow(data=data, meta=meta))
    
    return normalized


def normalize_rows(
    raw_rows: list[dict[str, Any] | list[Any]],
    doc_type: str,
    validator: SchemaValidator | None = None,
    metadata_base: dict[str, Any] | None = None,
) -> list[NormalizedRow]:
    """
    Central normalization entry point.
    
    Maps raw rows to canonical schema columns, attaches metadata.
    This is the ONLY normalization code path.
    
    Args:
        raw_rows: Raw row data from OCR
        doc_type: Document type (ledger, invoice, etc.)
        validator: SchemaValidator instance (created if None)
        metadata_base: Base metadata dict (confidence, model, etc.)
    
    Returns:
        List of NormalizedRow objects with data + metadata
    """
    if validator is None:
        validator = SchemaValidator()
    
    if metadata_base is None:
        metadata_base = {}
    
    # Handle special document types
    if doc_type == "generic_table":
        return normalize_rows_generic_table(raw_rows, validator, metadata_base)
    
    if doc_type == "unknown_document":
        return normalize_rows_unknown_document(raw_rows, validator, metadata_base)
    
    # Get schema for document type
    required_cols, optional_cols = validator.get_columns(doc_type)
    all_cols = required_cols + optional_cols
    
    # Normalize rows to schema
    normalized = []
    for raw_row in raw_rows:
        # Convert to dict if list
        if isinstance(raw_row, list):
            # Map by position to schema columns
            row_dict = {all_cols[i]: raw_row[i] if i < len(raw_row) else None
                       for i in range(min(len(all_cols), len(raw_row)))}
        elif isinstance(raw_row, dict):
            row_dict = raw_row
        else:
            row_dict = {"value": raw_row}
        
        # Map to canonical columns (case-insensitive)
        data = {}
        for col in all_cols:
            # Try exact match first
            if col in row_dict:
                data[col] = flatten_value(row_dict[col])
            else:
                # Try case-insensitive match
                for key, value in row_dict.items():
                    if str(key).lower().strip() == col.lower().strip():
                        data[col] = flatten_value(value)
                        break
                else:
                    # Not found - use None if optional, warn if required
                    if col in required_cols:
                        logger.debug(f"Required column '{col}' not found in row")
                    data[col] = None
        
        meta = RowMetadata(
            **metadata_base,
            doc_type=doc_type,
            schema_version=validator.schema_version,
        )
        normalized.append(NormalizedRow(data=data, meta=meta))
    
    return normalized


def validate_rows_before_export(rows: list[NormalizedRow]) -> list[str]:
    """
    Validate rows before export.
    
    Returns list of validation errors.
    Raises ExportValidationError if critical errors found.
    """
    errors = []
    
    if not rows:
        errors.append("No rows to export")
        return errors
    
    # Check: All rows have same columns
    first_keys = set(rows[0].data.keys())
    for i, row in enumerate(rows[1:], start=1):
        row_keys = set(row.data.keys())
        if row_keys != first_keys:
            errors.append(f"Row {i} has different columns: {row_keys} vs {first_keys}")
    
    # Check: No raw JSON in cells
    for i, row in enumerate(rows):
        for key, value in row.data.items():
            if value is not None:
                value_str = str(value).strip()
                if value_str.startswith('{') or value_str.startswith('['):
                    errors.append(f"Row {i}, column '{key}' contains raw JSON: {value_str[:50]}...")
    
    return errors


class ExportValidationError(Exception):
    """Raised when export validation fails"""
    pass
