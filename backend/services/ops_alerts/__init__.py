"""Operational alerting entrypoints."""

from backend.services.ops_alerts.service import (
    build_alert_settings,
    emit_alert_candidate,
    initialize_ops_alerting,
    is_ops_alerting_enabled,
    record_auth_failure,
    record_ocr_failure,
    record_payment_failure,
    record_payment_webhook_error,
    record_request_exception,
    record_request_outcome,
    resolve_client_ip,
    run_daily_summary_once,
    send_alert,
    shutdown_ops_alerting,
)

__all__ = [
    "build_alert_settings",
    "emit_alert_candidate",
    "initialize_ops_alerting",
    "is_ops_alerting_enabled",
    "record_auth_failure",
    "record_ocr_failure",
    "record_payment_failure",
    "record_payment_webhook_error",
    "record_request_exception",
    "record_request_outcome",
    "resolve_client_ip",
    "run_daily_summary_once",
    "send_alert",
    "shutdown_ops_alerting",
]
