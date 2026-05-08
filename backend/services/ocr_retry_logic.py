"""
Structured retry logic for OCR API calls

Implements exponential backoff with jitter for transient failures.
Distinguishes between retryable and non-retryable errors.

Architecture:
- Retry only on transient errors (HTTP 429/503/504, network timeouts)
- DO NOT retry on JSON parse errors, schema mismatches, empty responses
- Log every retry attempt with context
- Cap retries at configured max (default 3)
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

# Retry configuration
RETRY_CONFIG = {
    "max_retries": 3,
    "base_delay_seconds": 1.0,
    "max_delay_seconds": 30.0,
    "jitter": True,
    "backoff_multiplier": 2,
}

# HTTP status codes that are transient (retryable)
TRANSIENT_HTTP_ERRORS = {429, 503, 504}

# Exception types that are transient (retryable)
TRANSIENT_EXCEPTIONS = (TimeoutError, ConnectionError, ConnectionResetError)

# HTTP status codes that are NOT retryable
NON_RETRYABLE_HTTP_ERRORS = {400, 401, 403, 404}

# Failure reasons that are NOT retryable (structural issues, not transient)
NON_RETRYABLE_FAILURES = {
    "json_parse_error",
    "schema_mismatch",
    "empty_response",
    "export_validation_fail",
}

T = TypeVar('T')


def calculate_retry_delay(attempt: int, base_delay: float = 1.0, max_delay: float = 30.0, jitter: bool = True) -> float:
    """
    Calculate exponential backoff delay with optional jitter.
    
    Args:
        attempt: Retry attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds (cap)
        jitter: Add random jitter to avoid thundering herd
    
    Returns:
        Delay in seconds
    """
    # Exponential backoff: 1s → 2s → 4s → 8s (capped at max_delay)
    delay = min(base_delay * (2 ** attempt), max_delay)
    
    if jitter:
        # Add random jitter: delay ± random(0, base_delay)
        jitter_amount = random.random() * base_delay
        delay += jitter_amount
    
    return delay


def is_retryable_http_error(status_code: int | None) -> bool:
    """Check if HTTP status code is retryable"""
    if status_code is None:
        return False
    return status_code in TRANSIENT_HTTP_ERRORS


def is_retryable_exception(exception: Exception) -> bool:
    """Check if exception type is retryable"""
    return isinstance(exception, TRANSIENT_EXCEPTIONS)


def is_retryable_failure_reason(failure_reason: str) -> bool:
    """Check if failure reason is retryable"""
    return failure_reason not in NON_RETRYABLE_FAILURES


def retry_with_backoff(
    func: Callable[..., T],
    *args: Any,
    max_retries: int | None = None,
    context: str = "operation",
    **kwargs: Any,
) -> T:
    """
    Retry function with exponential backoff.
    
    Args:
        func: Function to call
        *args: Positional arguments for func
        max_retries: Maximum number of retries (None = use config default)
        context: Context string for logging
        **kwargs: Keyword arguments for func
    
    Returns:
        Result from func
    
    Raises:
        Last exception if all retries exhausted
    """
    if max_retries is None:
        max_retries = RETRY_CONFIG["max_retries"]
    
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return func(*args, **kwargs)
        
        except Exception as error:
            last_exception = error
            
            # Check if retryable
            is_retryable = False
            
            # Check HTTP status code (if available)
            status_code = getattr(error, 'status_code', None) or getattr(error, 'response', {}).get('status')
            if is_retryable_http_error(status_code):
                is_retryable = True
            elif status_code in NON_RETRYABLE_HTTP_ERRORS:
                is_retryable = False
            # Check exception type
            elif is_retryable_exception(error):
                is_retryable = True
            # Check failure reason in error message
            else:
                error_msg = str(error).lower()
                for reason in NON_RETRYABLE_FAILURES:
                    if reason.replace('_', ' ') in error_msg:
                        is_retryable = False
                        break
            
            # Don't retry on last attempt or non-retryable errors
            if attempt >= max_retries or not is_retryable:
                error_type = type(error).__name__
                logger.error(
                    f"{context} failed after {attempt + 1} attempts: {error_type}: {error}",
                    exc_info=True
                )
                raise
            
            # Calculate delay and log retry
            delay = calculate_retry_delay(
                attempt,
                base_delay=RETRY_CONFIG["base_delay_seconds"],
                max_delay=RETRY_CONFIG["max_delay_seconds"],
                jitter=RETRY_CONFIG["jitter"],
            )
            
            error_type = type(error).__name__
            logger.warning(
                f"{context} failed on attempt {attempt + 1}/{max_retries + 1}: {error_type}: {error}. "
                f"Retrying in {delay:.2f}s..."
            )
            
            time.sleep(delay)
    
    # Should never reach here, but just in case
    if last_exception:
        raise last_exception
    raise RuntimeError(f"{context} failed with no exception recorded")


class RetryContext:
    """Context manager for retry operations with logging"""
    
    def __init__(self, operation: str, image_filename: str = "", model: str = ""):
        self.operation = operation
        self.image_filename = image_filename
        self.model = model
        self.attempt = 0
        self.start_time = time.time()
    
    def log_attempt(self):
        """Log retry attempt"""
        self.attempt += 1
        logger.info(
            f"OCR retry attempt {self.attempt} for {self.operation} "
            f"(image={self.image_filename}, model={self.model})"
        )
    
    def log_success(self):
        """Log successful completion"""
        elapsed = time.time() - self.start_time
        logger.info(
            f"OCR {self.operation} succeeded after {self.attempt} attempts "
            f"in {elapsed:.2f}s (image={self.image_filename}, model={self.model})"
        )
    
    def log_failure(self, error: Exception):
        """Log final failure"""
        elapsed = time.time() - self.start_time
        logger.error(
            f"OCR {self.operation} failed after {self.attempt} attempts "
            f"in {elapsed:.2f}s: {type(error).__name__}: {error} "
            f"(image={self.image_filename}, model={self.model})"
        )
