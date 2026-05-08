"""
Structured OCR Failure Logging

Writes detailed failure logs in JSON format for debugging and monitoring.
Each failure is logged with full context for post-mortem analysis.

Log format: {timestamp}_{image_filename}_{doc_type}_{model}.json
"""

from __future__ import annotations

import json
import logging
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Controlled vocabulary for failure reasons (Fix for Bug #6)
FAILURE_REASONS = {
    "json_parse_error": "Response looked like JSON but failed to parse",
    "schema_mismatch": "Rows don't match any known schema",
    "empty_response": "Model returned empty or whitespace only",
    "export_validation_fail": "Cell-level validation failed before writing",
    "api_error_transient": "HTTP 429/503/504 or network timeout",
    "api_error_permanent": "HTTP 400/401/403 or unknown error",
    "unknown": "Catch-all - always investigate these",
}


def get_failure_log_directory() -> Path:
    """
    Get or create the OCR failure log directory.
    
    Returns Path object pointing to logs/ocr_failures/
    Creates directory if it doesn't exist.
    """
    # Use existing logs/ directory
    log_dir = Path("logs") / "ocr_failures"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def sanitize_filename_part(text: str) -> str:
    """
    Sanitize text for use in filename.
    
    Removes/replaces special characters that are invalid in filenames.
    """
    # Replace invalid filename chars with underscore
    sanitized = text
    for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        sanitized = sanitized.replace(char, '_')
    
    # Limit length
    if len(sanitized) > 50:
        sanitized = sanitized[:50]
    
    return sanitized


def determine_failure_reason(error: Exception, context: dict[str, Any]) -> tuple[str, bool]:
    """
    Determine failure reason code and whether it's retryable.
    
    Args:
        error: The exception that was raised
        context: Additional context dict
    
    Returns:
        (failure_reason_code, is_retryable)
    """
    error_msg = str(error).lower()
    error_type = type(error).__name__
    
    # Check for JSON parse errors
    if "json" in error_msg and "parse" in error_msg:
        return "json_parse_error", False
    if error_type in ("JSONDecodeError", "json.JSONDecodeError"):
        return "json_parse_error", False
    
    # Check for empty response
    if "empty" in error_msg:
        return "empty_response", False
    
    # Check for schema mismatch
    if "schema" in error_msg or "column" in error_msg:
        return "schema_mismatch", False
    
    # Check for export validation
    if "export" in error_msg or "validation" in error_msg:
        return "export_validation_fail", False
    
    # Check for HTTP errors
    status_code = getattr(error, 'status_code', None) or getattr(error, 'response', {}).get('status')
    if status_code:
        if status_code in {429, 503, 504}:
            return "api_error_transient", True
        if status_code in {400, 401, 403, 404}:
            return "api_error_permanent", False
    
    # Check for network errors
    if isinstance(error, (TimeoutError, ConnectionError, ConnectionResetError)):
        return "api_error_transient", True
    
    return "unknown", False


def log_ocr_failure(
    image_filename: str,
    doc_type: str,
    model: str,
    error: Exception,
    *,
    raw_ocr_response: str | None = None,
    parsed_response: Any = None,
    retry_count: int = 0,
    stage: str = "unknown",
    additional_context: dict[str, Any] | None = None,
) -> str:
    """
    Log OCR failure to structured JSON file.
    
    Args:
        image_filename: Name of source image
        doc_type: Document type hint
        model: Model name (normalized)
        error: Exception that was raised
        raw_ocr_response: Raw response text from OCR API
        parsed_response: Parsed response (if parsing succeeded)
        retry_count: Number of retries attempted
        stage: Pipeline stage where failure occurred
        additional_context: Additional context dict
    
    Returns:
        Path to created log file
    """
    try:
        log_dir = get_failure_log_directory()
        
        # Generate filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_filename = sanitize_filename_part(image_filename or "unknown")
        safe_doc_type = sanitize_filename_part(doc_type or "unknown")
        safe_model = sanitize_filename_part(model or "unknown")
        
        log_filename = f"{timestamp}_{safe_filename}_{safe_doc_type}_{safe_model}.json"
        log_path = log_dir / log_filename
        
        # Determine failure reason and retryability
        context = additional_context or {}
        failure_reason, is_retryable = determine_failure_reason(error, context)
        
        # Build log entry
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "image_filename": image_filename,
            "doc_type": doc_type,
            "model": model,
            "failure_reason": failure_reason,
            "failure_reason_description": FAILURE_REASONS.get(failure_reason, "Unknown"),
            "failure_stage": stage,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "raw_ocr_response": raw_ocr_response[:5000] if raw_ocr_response else None,  # Truncate long responses
            "parsed_response": str(parsed_response)[:1000] if parsed_response else None,
            "stack_trace": traceback.format_exc(),
            "retry_count": retry_count,
            "is_retryable": is_retryable,
            "additional_context": context,
        }
        
        # Write to file
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump(log_entry, f, indent=2, ensure_ascii=False)
        
        logger.error(
            f"OCR failure logged: {log_filename} "
            f"(reason={failure_reason}, stage={stage}, retries={retry_count})"
        )
        
        return str(log_path)
    
    except Exception as log_error:
        # Don't let logging failure crash the application
        logger.error(f"Failed to write OCR failure log: {log_error}", exc_info=True)
        return ""


def get_recent_failures(limit: int = 10) -> list[dict[str, Any]]:
    """
    Get recent failure logs for monitoring.
    
    Args:
        limit: Maximum number of logs to return
    
    Returns:
        List of failure log dicts (most recent first)
    """
    try:
        log_dir = get_failure_log_directory()
        
        # Get all JSON files, sorted by modification time (newest first)
        log_files = sorted(
            log_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        failures = []
        for log_file in log_files[:limit]:
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    failures.append(json.load(f))
            except Exception as error:
                logger.warning(f"Failed to read failure log {log_file}: {error}")
        
        return failures
    
    except Exception as error:
        logger.error(f"Failed to get recent failures: {error}", exc_info=True)
        return []
