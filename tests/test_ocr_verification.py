import json
from http import HTTPStatus
from io import BytesIO

from openpyxl import load_workbook

from backend.database import SessionLocal
from backend.models.report import AuditLog
from tests.utils import register_user


def _verification_form():
    return {
        "source_filename": "ocr-check.png",
        "columns": "3",
        "language": "eng",
        "avg_confidence": "88.5",
        "warnings": json.dumps(["low contrast"]),
        "document_hash": "abc123",
        "doc_type_hint": "logbook",
        "routing_meta": json.dumps(
            {
                "clarity_score": 91,
                "score_reason": "known document type",
                "model_tier": "fast",
                "forced": False,
                "scorer_used": True,
                "actual_cost_usd": 0.0008,
                "cost_saved_usd": 0.0132,
            }
        ),
        "raw_text": "2026-03-29 | 125 | 125 / ok",
        "headers": json.dumps(["Date", "Output", "Raw"]),
        "original_rows": json.dumps([["2026-03-29", "120", "120 / ok"]]),
        "reviewed_rows": json.dumps([["2026-03-29", "125", "125 / ok"]]),
        "raw_column_added": "true",
        "reviewer_notes": "Initial QA draft",
    }


def _verification_form_with_rows(reviewed_rows: list[list[str]], *, original_rows: list[list[str]] | None = None):
    payload = _verification_form()
    payload["reviewed_rows"] = json.dumps(reviewed_rows)
    payload["original_rows"] = json.dumps(original_rows or reviewed_rows)
    return payload


def test_ocr_verification_draft_submit_approve(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    created_payload = created.json()
    assert created_payload["status"] == "draft"
    assert created_payload["created_by_name"] == "QA User"
    assert created_payload["document_hash"] == "abc123"
    assert created_payload["doc_type_hint"] == "logbook"
    assert created_payload["raw_text"] == "2026-03-29 | 125 | 125 / ok"
    assert created_payload["routing_meta"]["model_tier"] == "fast"
    verification_id = created_payload["id"]

    listing = http_client.get("/ocr/verifications", headers=headers)
    assert listing.status_code == HTTPStatus.OK, listing.text
    assert any(item["id"] == verification_id for item in listing.json())

    submitted = http_client.post(
        f"/ocr/verifications/{verification_id}/submit",
        json={"reviewer_notes": "Ready for manager review"},
        headers=headers,
    )
    assert submitted.status_code == HTTPStatus.OK, submitted.text
    assert submitted.json()["status"] == "pending"

    approved = http_client.post(
        f"/ocr/verifications/{verification_id}/approve",
        json={"reviewer_notes": "Approved by QA admin"},
        headers=headers,
    )
    assert approved.status_code == HTTPStatus.OK, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by"] == user["user_id"]
    assert approved.json()["approved_by_name"] == "QA User"


def test_ocr_verification_reject_requires_reason(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification_id = created.json()["id"]

    submitted = http_client.post(
        f"/ocr/verifications/{verification_id}/submit",
        json={"reviewer_notes": "Submit before reject"},
        headers=headers,
    )
    assert submitted.status_code == HTTPStatus.OK, submitted.text

    missing_reason = http_client.post(
        f"/ocr/verifications/{verification_id}/reject",
        json={"reviewer_notes": "Needs fixes", "rejection_reason": ""},
        headers=headers,
    )
    assert missing_reason.status_code == HTTPStatus.BAD_REQUEST, missing_reason.text

    rejected = http_client.post(
        f"/ocr/verifications/{verification_id}/reject",
        json={"reviewer_notes": "Needs fixes", "rejection_reason": "Date column mismatch"},
        headers=headers,
    )
    assert rejected.status_code == HTTPStatus.OK, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["rejection_reason"] == "Date column mismatch"
    assert rejected.json()["rejected_by_name"] == "QA User"


def test_operator_can_submit_own_ocr_verification_but_cannot_approve(http_client):
    operator = register_user(http_client, role="operator")
    manager = register_user(
        http_client,
        role="manager",
        factory_name=operator["factory_name"],
        company_code=operator["company_code"],
    )
    operator_headers = {"Authorization": f"Bearer {operator['access_token']}"}
    manager_headers = {"Authorization": f"Bearer {manager['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=operator_headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification_id = created.json()["id"]

    submitted = http_client.post(
        f"/ocr/verifications/{verification_id}/submit",
        json={"reviewer_notes": "Ready for supervisor review"},
        headers=operator_headers,
    )
    assert submitted.status_code == HTTPStatus.OK, submitted.text
    assert submitted.json()["status"] == "pending"
    assert submitted.json()["user_id"] == operator["user_id"]

    operator_approve = http_client.post(
        f"/ocr/verifications/{verification_id}/approve",
        json={"reviewer_notes": "Operator should not approve"},
        headers=operator_headers,
    )
    assert operator_approve.status_code == HTTPStatus.FORBIDDEN, operator_approve.text

    approved = http_client.post(
        f"/ocr/verifications/{verification_id}/approve",
        json={"reviewer_notes": "Manager approved the OCR check"},
        headers=manager_headers,
    )
    assert approved.status_code == HTTPStatus.OK, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by"] == manager["user_id"]


def test_ocr_verification_export_uses_reviewed_rows(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification = created.json()

    exported = http_client.get(f"/ocr/verifications/{verification['id']}/export", headers=headers)
    assert exported.status_code == HTTPStatus.OK, exported.text
    assert exported.headers["x-ocr-trusted-export"] == "false"
    assert exported.headers["x-ocr-export-source"] == "draft_review"

    workbook = load_workbook(BytesIO(exported.content))
    sheet = workbook.active
    assert sheet["A1"].value == "Date"
    assert sheet["B1"].value == "Output"
    assert sheet["A2"].value == "2026-03-29"
    assert str(sheet["B2"].value) == "125"
    assert str(sheet["C2"].value) == "125 / ok"


def test_approved_ocr_verification_export_is_marked_trusted(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification_id = created.json()["id"]

    submitted = http_client.post(
        f"/ocr/verifications/{verification_id}/submit",
        json={"reviewer_notes": "Ready for trusted export"},
        headers=headers,
    )
    assert submitted.status_code == HTTPStatus.OK, submitted.text

    approved = http_client.post(
        f"/ocr/verifications/{verification_id}/approve",
        json={"reviewer_notes": "Approved for trusted export"},
        headers=headers,
    )
    assert approved.status_code == HTTPStatus.OK, approved.text

    exported = http_client.get(f"/ocr/verifications/{verification_id}/export", headers=headers)
    assert exported.status_code == HTTPStatus.OK, exported.text
    assert exported.headers["x-ocr-trusted-export"] == "true"
    assert exported.headers["x-ocr-export-source"] == "approved_review"
    assert "approved" in exported.headers["content-disposition"].lower()


def test_ocr_verification_update_persists_scan_quality_and_audit_log(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification_id = created.json()["id"]

    updated = http_client.put(
        f"/ocr/verifications/{verification_id}",
        json={
            "avg_confidence": 61.2,
            "warnings": ["blurred edge", "manual fix applied"],
            "document_hash": "updated-hash",
            "doc_type_hint": "dispatch-note",
            "routing_meta": {
                "clarity_score": 63,
                "score_reason": "blur lowered clarity",
                "model_tier": "balanced",
                "forced": False,
                "scorer_used": True,
                "actual_cost_usd": 0.0035,
                "cost_saved_usd": 0.0105,
            },
            "raw_text": "updated raw text",
            "scan_quality": {
                "confidence_band": "medium",
                "quality_signals": ["low light", "tilt corrected"],
                "auto_processing": ["deskew", "contrast boost"],
                "fallback_used": True,
                "correction_count": 3,
                "page_count": 2,
                "adjustment_count": 1,
                "retake_count": 1,
                "manual_review_recommended": True,
                "outcome": "partial",
                "next_action": "manager_review",
                "notes": "Second row required manual cleanup",
                "cell_boxes": [
                    [
                        {"x": 0.1, "y": 0.2, "width": 0.25, "height": 0.08},
                        None,
                        {"x": 0.62, "y": 0.2, "width": 0.2, "height": 0.08},
                    ]
                ],
            },
        },
        headers=headers,
    )
    assert updated.status_code == HTTPStatus.OK, updated.text
    payload = updated.json()
    assert payload["avg_confidence"] == 61.2
    assert payload["warnings"] == ["blurred edge", "manual fix applied"]
    assert payload["document_hash"] == "updated-hash"
    assert payload["doc_type_hint"] == "dispatch-note"
    assert payload["routing_meta"]["model_tier"] == "balanced"
    assert payload["raw_text"] == "updated raw text"
    assert payload["scan_quality"] == {
        "confidence_band": "medium",
        "quality_signals": ["low light", "tilt corrected"],
        "auto_processing": ["deskew", "contrast boost"],
        "fallback_used": True,
        "correction_count": 3,
        "page_count": 2,
        "adjustment_count": 1,
        "retake_count": 1,
        "manual_review_recommended": True,
        "outcome": "partial",
        "next_action": "manager_review",
        "notes": "Second row required manual cleanup",
        "cell_boxes": [
            [
                {"x": 0.1, "y": 0.2, "width": 0.25, "height": 0.08},
                None,
                {"x": 0.62, "y": 0.2, "width": 0.2, "height": 0.08},
            ]
        ],
    }

    with SessionLocal() as db:
        audit_log = (
            db.query(AuditLog)
            .filter(AuditLog.action == "OCR_VERIFICATION_UPDATED")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert audit_log is not None
        assert f"id={verification_id}" in (audit_log.details or "")
        assert "band=medium" in (audit_log.details or "")
        assert "corrections=3" in (audit_log.details or "")


def test_ocr_verification_summary_uses_only_approved_documents_as_trusted(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    trusted_created = http_client.post(
        "/ocr/verifications",
        data=_verification_form_with_rows(
            [
                ["2026-03-29", "125", "125 / ok"],
                ["2026-03-30", "150", "150 / ok"],
            ]
        ),
        headers=headers,
    )
    assert trusted_created.status_code == HTTPStatus.CREATED, trusted_created.text
    trusted_id = trusted_created.json()["id"]
    submitted = http_client.post(
        f"/ocr/verifications/{trusted_id}/submit",
        json={"reviewer_notes": "Ready for trusted summary"},
        headers=headers,
    )
    assert submitted.status_code == HTTPStatus.OK, submitted.text
    approved = http_client.post(
        f"/ocr/verifications/{trusted_id}/approve",
        json={"reviewer_notes": "Approved for trusted summary"},
        headers=headers,
    )
    assert approved.status_code == HTTPStatus.OK, approved.text

    pending_created = http_client.post(
        "/ocr/verifications",
        data=_verification_form_with_rows([["2026-03-31", "175", "175 / pending"]]),
        headers=headers,
    )
    assert pending_created.status_code == HTTPStatus.CREATED, pending_created.text
    pending_id = pending_created.json()["id"]
    submitted_pending = http_client.post(
        f"/ocr/verifications/{pending_id}/submit",
        json={"reviewer_notes": "Waiting on manager"},
        headers=headers,
    )
    assert submitted_pending.status_code == HTTPStatus.OK, submitted_pending.text

    draft_created = http_client.post(
        "/ocr/verifications",
        data=_verification_form_with_rows([["2026-04-01", "190", "190 / draft"]]),
        headers=headers,
    )
    assert draft_created.status_code == HTTPStatus.CREATED, draft_created.text

    summary = http_client.get("/ocr/verifications/summary", headers=headers)
    assert summary.status_code == HTTPStatus.OK, summary.text
    payload = summary.json()
    assert payload["total_documents"] == 3
    assert payload["trusted_documents"] == 1
    assert payload["trusted_rows"] == 2
    assert payload["pending_documents"] == 1
    assert payload["pending_rows"] == 1
    assert payload["draft_documents"] == 1
    assert payload["draft_rows"] == 1
    assert payload["export_ready_documents"] == 1
    assert payload["approval_rate"] == 100.0
    assert payload["last_trusted_at"] is not None


def test_ocr_verification_share_link_exports_without_auth(http_client):
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    created = http_client.post("/ocr/verifications", data=_verification_form(), headers=headers)
    assert created.status_code == HTTPStatus.CREATED, created.text
    verification_id = created.json()["id"]

    share = http_client.post(
        f"/ocr/verifications/{verification_id}/share-link",
        headers=headers,
    )
    assert share.status_code == HTTPStatus.OK, share.text
    share_payload = share.json()
    assert share_payload["url"].startswith("/api/ocr/shared/")
    assert share_payload["expires_at"]

    exported = http_client.get(share_payload["url"].replace("/api", ""))
    assert exported.status_code == HTTPStatus.OK, exported.text
    assert exported.headers["x-ocr-verification-id"] == str(verification_id)
