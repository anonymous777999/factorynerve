"""Wrapper around OCR job queue for async processing."""

from __future__ import annotations

from typing import Any

from backend import ocr_jobs


def start_workers() -> None:
    ocr_jobs.start_workers()


def enqueue_job(kind: str, image_bytes: bytes, params: dict[str, Any]) -> ocr_jobs.OcrJob:
    return ocr_jobs.enqueue_job(kind, image_bytes, params)


def get_job_payload(job_id: str) -> dict[str, Any] | None:
    return ocr_jobs.get_job_payload(job_id)


def get_job(job_id: str) -> ocr_jobs.OcrJob | None:
    return ocr_jobs.get_job(job_id)
