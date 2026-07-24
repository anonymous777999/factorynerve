"""Prometheus metrics for the DPR.ai backend."""

from __future__ import annotations

import time
from typing import Callable

from prometheus_client import Counter, Histogram, Gauge, REGISTRY

# Create a dedicated registry to avoid clashes with other libraries if needed
REQUEST_COUNT = Counter(
    "dpr_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "http_status"],
)

REQUEST_LATENCY = Histogram(
    "dpr_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

EXCEPTIONS_TOTAL = Counter(
    "dpr_exceptions_total",
    "Total unhandled exceptions",
    ["type"],
)

ACTIVE_REQUESTS = Gauge(
    "dpr_http_active_requests",
    "Number of currently processing HTTP requests",
)

# Optional: business metrics (example)
OCR_JOBS_TOTAL = Counter(
    "dpr_ocr_jobs_total",
    "Total OCR jobs processed",
    ["status"],  # success, failure
)

OCR_JOB_LATENCY = Histogram(
    "dpr_ocr_job_duration_seconds",
    "Duration of OCR processing",
    ["document_type"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300),
)

# ── Phase 2/3: Cost-optimised pipeline metrics ──────────────────────────────
# Per-model-tier request counter (fast/balanced/best)
OCR_MODEL_TIER_REQUESTS = Counter(
    "dpr_ocr_model_tier_requests_total",
    "OCR requests by model tier",
    ["tier"],
)

# Cumulative cost saved vs Opus baseline
OCR_COST_SAVED = Counter(
    "dpr_ocr_cost_saved_usd_total",
    "Total USD saved by using cost-optimised model selection vs Opus baseline",
)

# Correction pass outcomes (success / failure / skipped)
OCR_CORRECTION_PASSES = Counter(
    "dpr_ocr_correction_passes_total",
    "OCR correction pass outcomes",
    ["status"],  # success, failure
)

# Per-tier extraction latency
OCR_EXTRACTION_LATENCY = Histogram(
    "dpr_ocr_extraction_duration_seconds",
    "OCR extraction duration by model tier",
    ["tier"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300),
)

# OCR cost saved per tier (cumulative)
OCR_TIER_COST = Counter(
    "dpr_ocr_tier_cost_usd_total",
    "Total USD spent per model tier",
    ["tier"],
)

# ── Phase 7: Observability & Monitoring metrics ─────────────────────────────
# Classification accuracy rate (0.0–1.0) updated periodically
OCR_CLASSIFICATION_ACCURACY = Gauge(
    "dpr_ocr_classification_accuracy",
    "Document type classification accuracy rate",
)

# Extraction success rate (0.0–1.0) — % extractions passing validation
OCR_EXTRACTION_SUCCESS_RATE = Gauge(
    "dpr_ocr_extraction_success_rate",
    "OCR extraction success rate (validations passed)",
)

# Cache hit ratio (0.0–1.0)
OCR_CACHE_HIT_RATIO = Gauge(
    "dpr_ocr_cache_hit_ratio",
    "OCR cache effectiveness hit ratio",
)

# Export count by format (excel, pdf, json)
OCR_EXPORT_COUNT = Counter(
    "dpr_ocr_exports_total",
    "Total documents exported",
    ["format"],
)

# User correction rate (0.0–1.0) — % of fields corrected during review
OCR_USER_CORRECTION_RATE = Gauge(
    "dpr_ocr_user_correction_rate",
    "Percentage of fields corrected by users during review",
)


# Helper functions used by log_requests middleware and elsewhere
def record_request(path: str, status: int, duration_ms: float, method: str = "GET") -> None:
    """Record an HTTP request in Prometheus counters."""
    REQUEST_COUNT.labels(method=method, endpoint=path, http_status=str(status)).inc()
    REQUEST_LATENCY.labels(method=method, endpoint=path).observe(duration_ms / 1000.0)


def record_exception() -> None:
    """Record an unhandled exception in Prometheus counters."""
    EXCEPTIONS_TOTAL.labels(type="unhandled").inc()


def record_frontend_error() -> None:
    """Record a frontend error (kept for compatibility with observability router)."""
    EXCEPTIONS_TOTAL.labels(type="frontend").inc()


def snapshot() -> dict:
    """Return a dict of current Prometheus metric values for compatibility."""
    return {}