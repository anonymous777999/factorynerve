OCR Pipeline Module — Comprehensive Audit Report
Architecture Overview
The OCR pipeline has three tiers of operation:

Tier	Endpoint(s)	Quota Check	Subscription Check	Persistence
Preview	POST /logbook	None	None	In-memory only
Direct Export	/logbook-excel, /table-excel	require_ocr_quota	require_active_subscription	Excel returned as response
Async Export	/logbook-excel-async, /table-excel-async	require_ocr_quota	require_active_subscription	Background job, Excel stored as artifact
Verification	POST /verifications, PUT /verifications/{id}, submit/approve/reject	None	None	DB (ocr_verifications table)
1. File Upload Validation
Extension Whitelist
No explicit extension whitelist exists. Validation relies on:

The HTTP Content-Type header starting with "image/" (line 293 of ocr.py)
Magic byte inspection via _validate_image_bytes() (line 278)
The Content-Type header is client-supplied and trivially spoofable. The magic byte check is the effective gate.

Magic Byte Coverage (_IMAGE_MAGIC_SIGNATURES, line 116)
Format	Magic Bytes	Status
PNG	\x89PNG\r\n\x1a\n	Covered
JPEG	\xff\xd8\xff	Covered
GIF	GIF87a / GIF89a	Covered
BMP	BM	Covered
TIFF (LE)	II*\x00	Covered
TIFF (BE)	MM\x00*	Covered
WEBP	RIFF + bytes 8-12 WEBP	Covered (line 281-282)
HEIC/HEIF	ftypheic / ftypheif in first 32 bytes	Covered (line 285)
PDF	Not checked	Not supported
Size Limit
Backend: 5,242,880 bytes (5 MB) — hardcoded in _read_validated_image_upload() (line 296)
Frontend: OCR_MAX_SOURCE_BYTES = 5 * 1024 * 1024 (5 MB) in ocr-access.ts (line 1)
Mock Upload (_read_image_upload_for_mock, line 302)
No validation at all — no Content-Type check, no magic byte check, only size check. Used only when mock=true is set.

Frontend Mismatches
BUG-OCR-002 — Frontend error message says 8 MB but limit is 5 MB:

// web/src/lib/ocr-access.ts, line 44-45
if (input.size > OCR_MAX_SOURCE_BYTES) {  // 5 MB
    return "Image must be under 8 MB. Try compressing the photo.";  // Says 8MB!
}
BUG-OCR-005 — Frontend allows PDF (with allowPdf: true option), but backend always rejects PDFs because _read_validated_image_upload() requires Content-Type starting with "image/".

2. OCR Quota Enforcement
Who Gets Enforced?
Endpoint	require_ocr_quota	require_active_subscription	Notes
POST /logbook	NOT USED	NOT USED	Unlimited previews
POST /verifications	NOT USED	NOT USED	Unlimited draft saves
POST /logbook-excel	Yes	Yes	
POST /logbook-excel-async	Yes	Yes	
POST /table-excel	Yes	Yes	
POST /table-excel-async	Yes	Yes	
QUOTA-001: The POST /logbook (preview) endpoint has no quota gating, no rate limiting, and no subscription check. Any user with operator+ role can call it unlimited times. The functions check_rate_limit, check_and_record_usage, and check_and_record_org_usage are imported (line 63) but never called anywhere in ocr.py — grep confirmed zero invocations. This represents a significant cost exposure if the AI-pipeline path (Anthropic API) is invoked.

QUOTA-002: The POST /verifications endpoint (creating a verification draft) also has no quota check. Users can create unlimited draft verification records.

Quota Consumption Timing — QUOTA-001 and QUOTA-002 are Risk Items
For the endpoints that do enforce quota, require_ocr_quota (in quota.py line 97) consumes quota before any processing using an atomic SQL UPDATE with RETURNING:

UPDATE org_ocr_usage
SET request_count = request_count + 1
WHERE org_id = :org_id
  AND request_count < ocr_limit
  AND period_end > CURRENT_TIMESTAMP
RETURNING request_count, ocr_limit, period_end
This is correct for preventing overuse (the atomic increment prevents race conditions as noted in the comment on line 152), but it means the quota is debited before the AI call is made.

3. Quota Refund on Failure
Sync Endpoints (good coverage)
/logbook-excel — All caught exception types refund:

Exception	Refund Reason	Status
ValueError (JSON parse)	ocr_logbook_excel_validation	Refunds then raises 400 ✓
AuthenticationError	ocr_logbook_excel_auth	Refunds then raises 401 ✓
BadRequestError	ocr_logbook_excel_bad_request	Refunds then raises 400/429 ✓
RuntimeError	ocr_logbook_excel_runtime	Refunds then raises 500 ✓
Any other Exception	ocr_logbook_excel_unexpected	Refunds then raises 500 ✓
/table-excel:

Exception	Refund Reason	Status
TableExcelRouteError (upload)	ocr_table_excel_upload_failed	Refunds + JSONResponse ✓
TableExcelRouteError (pipeline)	ocr_table_excel_pipeline_failed	Refunds + JSONResponse ✓
Any other Exception	ocr_table_excel_unexpected	Refunds + JSONResponse ✓
Async Endpoints (incomplete coverage)
BUG-OCR-004: Quota consumed but never refunded on background job failure

When the async endpoints succeed in queueing the job, the quota is already consumed. But if the background job itself fails (Anthropic timeout, invalid response, etc.), _run_ocr_excel_job (line 2126) has no refund logic whatsoever. The quota is permanently lost.

The refunds on async endpoints only handle failures before the job is queued:

/logbook-excel-async: Refunds ocr_logbook_excel_async_failed if queueing fails (line 3465)
/table-excel-async: Refunds ocr_table_excel_async_upload_failed (line 3564), ocr_table_excel_async_quality_failed (line 3567), ocr_table_excel_async_queue_failed (line 3591)
But if the job is queued successfully and later fails in the background runner:

def _run_ocr_excel_job(progress, *, job_id: str) -> dict[str, object]:
    # ... reads image, calls Anthropic API ...
    # NO refund_ocr_quota call anywhere in this function
    # Any exception here (API timeout, bad response, etc.) is uncaught
Refund Implementation Concern — BUG-OCR-006
The refund_ocr_quota function (line 68 in quota.py) does a safe decrement:

UPDATE org_ocr_usage
SET request_count = CASE WHEN request_count > 0 THEN request_count - 1 ELSE 0 END
...
This prevents negative values but could mask a race condition: if two concurrent refunds attempt to decrement the same record, the floor at zero prevents underflow but silently hides the logic error.

4. Verification Workflow
State Machine
Draft ──submit──> Pending ──approve──> Approved
                    │
                    └──reject──> Rejected ──(edit)──> Draft
Transition	Endpoint	Role Required	Side Effects
Create (→ Draft)	POST /verifications	operator+	Sets status="draft", timestamps
Update (stays Draft)	PUT /verifications/{id}	operator+	If creator edits pending/rejected, auto-reverts to draft
Submit (→ Pending)	POST /verifications/{id}/submit	operator+	Clears approval/rejection fields
Approve (→ Approved)	POST /verifications/{id}/approve	manager/admin/owner	Sets approved_by, approved_at
Reject (→ Rejected)	POST /verifications/{id}/reject	manager/admin/owner	Sets rejected_by, rejected_at, rejection_reason
Status Guard in Update (line 2915)
When the creator of a verification updates it while it is in pending or rejected state, the status is reverted to draft:

if current_user.id == verification.user_id and verification.status in {"pending", "rejected"}:
    verification.status = "draft"
    verification.submitted_at = None
    # ... clears all approval/rejection fields
This is a good safety measure — it prevents an editor from modifying data while it's under review without the reviewer knowing.

5. Self-Approval Check
BUG-OCR-001: No self-approval guard on verification approve/reject

The approve_verification function (line 2971) checks is_manager_or_admin(current_user) but never checks whether current_user.id == verification.user_id. A manager-level user can approve their own submitted verification.

The codebase already has an assert_not_self_approval function in rbac.py (line 37):

def assert_not_self_approval(record_user_id: int, current_user_id: int) -> None:
    if record_user_id == current_user_id:
        raise HTTPException(status_code=403, detail="You cannot approve or reject your own record.")
This function is defined but never called anywhere in the OCR router. It was clearly written for this purpose but the call site was missed.

6. Role Guards
Backend Role Authorization
Access	Required Role(s)	Function
Scan / Preview	operator, supervisor, manager, admin, owner	_require_ocr_access() → require_any_role()
Templates	operator+ (if plan allows)	_require_templates_access()
Approve/Reject	manager, admin, owner	is_manager_or_admin()
View all in org	admin, owner	_verification_query()
View factory-scoped	manager	_verification_query()
View own only	operator, supervisor	_verification_query()
Frontend Role Checks (ocr-access.ts)
Capability	Required Role(s)
canUseOcrScan	operator, supervisor, manager, admin, owner
canUseOcrWorkspace	supervisor, manager, admin, owner
canUseOcrVerification	supervisor, manager, admin, owner
canApproveOcrVerification	manager, admin, owner
The frontend and backend role checks are consistent.

7. Audit Logging
Implementation
_log_ocr_event() (line 2304) writes to the AuditLog table with:

user_id, org_id, factory_id
action (event type string)
details (human-readable summary)
ip_address (hashed via hash_ip_address)
user_agent
timestamp
Events Logged
Event	When
OCR_VERIFICATION_CREATED	Verification draft created
OCR_VERIFICATION_UPDATED	Verification draft updated
OCR_VERIFICATION_EXCEL_EXPORT	Excel export downloaded
OCR_LEDGER_EXCEL	Sync ledger Excel generated
OCR_TABLE_EXCEL	Sync table Excel generated
OCR_LEDGER_EXCEL_ASYNC	Async ledger Excel completed
OCR_TABLE_EXCEL_ASYNC	Async table Excel completed
Events NOT logged (gaps in coverage):

OCR_VERIFICATION_SUBMITTED — submit action is not logged
OCR_VERIFICATION_APPROVED — approve action is not logged
OCR_VERIFICATION_REJECTED — reject action is not logged
OCR_LOG_PREVIEW — /logbook preview is not logged
OCR_QUOTA_REFUND — (handled separately in billing_logger)
AUDIT-001: The submit, approve, and reject verification transitions are not audit-logged. Only the AuditLog from billing and the billing_logger events capture some of this activity, but the business-relevant status transitions themselves have no audit trail.

8. Factory Isolation
Verification Queries
_verification_query() (line 1663) applies factory-scoped filtering:

User Role	Scope
Admin / Owner	All factories in org (org_id filter)
Manager	Single factory (factory_id filter), fallback to org
Operator / Supervisor	Own records only (user_id filter)
Template Queries
_template_query() (line 2033) applies similar scoping by factory.

Verification: OK — properly scoped by org and factory for all roles.

9. AI/OCR Service Failure Behavior
/logbook Preview
Table route (_run_table_preview_pipeline): Catches TableExcelRouteError (→ 400 status) and broad Exception (→ 500 status)
Local OCR route (_run_ocr_with_fallback): Catches RuntimeError (→ 400) and broad Exception (→ 500)
The build_structured_ocr_result step (line 3174) catches RuntimeError (→ 502) and broad Exception (→ 500)
No retry logic. On failure, the user gets an error and must retry.
/logbook-excel Sync
Fine-grained exception handlers, each refunds quota and raises a typed HTTP error.
/table-excel Sync
Fine-grained exception handlers, but returns JSONResponse instead of raising (line 3509, 3513). The HTTP status is preserved but the error is returned as a JSON body rather than an exception.
Async Jobs
No error handling in _run_ocr_excel_job. If the Anthropic API call in ledger_extract_data or the _run_table_excel_pipeline fails, the exception propagates to the background job framework. The job is marked as failed, but the quota is permanently consumed (BUG-OCR-004).
10. Original File Preservation
Endpoint	File Preserved?	Where
POST /logbook (preview)	No	Processed in memory, discarded
POST /logbook-excel	No	Processed in memory, discarded
POST /logbook-excel-async	Yes	Written as job input file (write_job_file), referenced for retry
POST /table-excel	No	Processed in memory, discarded
POST /table-excel-async	Yes	Written as job input file
POST /verifications	Yes	Saved to exports/ocr_verifications/ via _save_verification_source()
Path Traversal Protection
The source-image endpoint (line 2771) resolves the path with strict=True and verifies it is within OCR_VERIFICATION_DIR using parent checks (line 2789). This is correct.

11. Can OCR Output Be Saved Without Review?
YES — BUG-OCR-007: Verification records can be created with arbitrary data, bypassing the OCR pipeline entirely.

The POST /verifications endpoint (line 2656) accepts original_rows and reviewed_rows as form fields with no validation that the data came from the actual OCR pipeline. A user could:

Write any JSON payload as original_rows
Submit it to POST /verifications
The system creates a "draft" verification record with arbitrary data
There is no requirement or check that the data was generated by the system's OCR pipeline.

Similarly, PUT /verifications/{id} (line 2867) allows overwriting original_rows and reviewed_rows at any time with no pipeline validation.

Bug Summary
ID	Severity	Category	Description
BUG-OCR-001	HIGH	Authorization	Self-approval possible. assert_not_self_approval() exists in rbac.py but is never called in approve_verification or reject_verification. A manager can approve their own verification.
BUG-OCR-002	LOW	Frontend	Misleading file size error. OCR_MAX_SOURCE_BYTES is 5 MB but the validation message says "under 8 MB."
BUG-OCR-003	HIGH	Cost/Quota	Preview endpoint has no quota enforcement. POST /logbook only checks role — no subscription check, no OCR quota check, no rate limiting. Unlimited AI-powered previews. The check_rate_limit, check_and_record_usage, check_and_record_org_usage imports are unused.
BUG-OCR-004	HIGH	Cost/Quota	Async job failures never refund quota. Quota is consumed at request time. If the background runner (_run_ocr_excel_job) fails, the quota is permanently lost — no refund_ocr_quota call exists in the async job runner.
BUG-OCR-005	MEDIUM	Validation	Frontend sends PDFs that backend rejects. Frontend validateOcrImageFile allows PDF when allowPdf: true, but backend _read_validated_image_upload rejects application/pdf Content-Type.
BUG-OCR-006	LOW	Race Condition	refund_ocr_quota silently masks concurrent decrement issues. The CASE WHEN request_count > 0 floor prevents negative values but could hide logic errors from concurrent refunds.
BUG-OCR-007	MEDIUM	Data Integrity	Verification records accept arbitrary data. POST /verifications and PUT /verifications/{id} accept user-supplied original_rows / reviewed_rows with no validation that data came from the OCR pipeline.
BUG-OCR-008	LOW	Audit	Submit/approve/reject status transitions are not audit-logged. _log_ocr_event is not called in submit_verification, approve_verification, or reject_verification.
BUG-OCR-009	LOW	Validation	_read_image_upload_for_mock has zero file validation. No Content-Type check, no magic byte check — only a size check. Exploitable only if ALLOW_OCR_MOCK is enabled in production.
Summary Risk Assessment
Area	Assessment
File Validation	Adequate magic-byte checking. No extension whitelist but the magic bytes are the authoritative check.
Quota Enforcement	Gap: The /logbook preview endpoint bypasses all quota/rate/subscription checks — major cost exposure.
Quota Refunds	Good coverage for sync endpoints. Gap: Async background job failures permanently lose quota.
Authorization	Role-based access is layered and consistent. Gap: Missing self-approval check (despite existing helper function).
Factory Isolation	Properly scoped.
Audit Trail	Most operations are logged. Gap: Submit/approve/reject transitions are not.
Data Integrity	Gap: Verification records accept unvalidated row data, breaking the trusted pipeline guarantee.
Error Handling	Sync endpoints return helpful errors. Async job failures silently consume quota with no user notification mechanism.
Path Traversal	Safeguarded with resolve(strict=True) and parent-directory verification.
