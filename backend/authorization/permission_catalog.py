"""Permission catalog — single source of truth for every permission key in the system.

Each permission entry defines:
- label: human-readable name shown in admin UIs.
- description: what action or access this permission grants.
- scope_level: FACTORY (scoped to a specific factory), ORG (scoped to the org), or PLATFORM (system-wide, internal staff only).
- default_roles: set of UserRole values that receive this permission by default.
- requires_mfa: whether MFA verification is required before this action can be performed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from backend.models.user import UserRole


class ScopeLevel(str, Enum):
    FACTORY = "FACTORY"
    ORG = "ORG"
    PLATFORM = "PLATFORM"


@dataclass(frozen=True)
class PermissionDef:
    """Definition of a single permission key in the catalog."""

    key: str
    label: str
    description: str
    scope_level: ScopeLevel
    default_roles: frozenset[UserRole]
    requires_mfa: bool = False


@dataclass(frozen=True)
class ResourceContext:
    """Context that identifies the resource being acted upon.

    Used by the PDP to check whether the actor has the right scope.
    """

    factory_id: str | None = None
    org_id: str | None = None


# ── Helper to build a frozenset of roles ─────────────────────────────────────
def _roles(*roles: UserRole) -> frozenset[UserRole]:
    return frozenset(roles)


# ── Common role groupings ─────────────────────────────────────────────────────
_OPERATOR_PLUS = _roles(
    UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER,
    UserRole.ADMIN, UserRole.OWNER,
)
_SUPERVISOR_PLUS = _roles(
    UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER,
)
_MANAGER_PLUS = _roles(
    UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER,
)
_ADMIN_PLUS = _roles(
    UserRole.ADMIN, UserRole.OWNER,
)
_FINANCIAL_ROLES = _roles(
    UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT,
)
_EVERYONE_BUT_ATTENDANCE = _roles(
    UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER,
    UserRole.ACCOUNTANT, UserRole.ADMIN, UserRole.OWNER,
)
_INTERNAL_STAFF = _roles(
    UserRole.ADMIN, UserRole.OWNER,
)


# ── The Permission Catalog ────────────────────────────────────────────────────
# This is deliberately a plain dict (not a DB table) so it is:
#   1) Fast — no DB query needed on every PDP call.
#   2) Immutable by runtime code — permissions are defined at deploy time.
#   3) Single source of truth — one place to add, change, or review permissions.
# When the approval-engine PDP mode is active, the permission check additionally
# looks up the approval rule engine to decide whether maker-checker is required.

PERMISSION_CATALOG: dict[str, PermissionDef] = {
    # ── Production / Entry ──────────────────────────────────────────────────
    "production.entry.create": PermissionDef(
        key="production.entry.create",
        label="Create entry",
        description="Create a new DPR production entry.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "production.entry.view": PermissionDef(
        key="production.entry.view",
        label="View entry",
        description="View production entry details.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_EVERYONE_BUT_ATTENDANCE,
    ),
    "production.entry.edit": PermissionDef(
        key="production.entry.edit",
        label="Edit entry",
        description="Edit an existing production entry.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "production.entry.approve": PermissionDef(
        key="production.entry.approve",
        label="Approve entry",
        description="Approve or reject submitted production entries.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "production.entry.delete": PermissionDef(
        key="production.entry.delete",
        label="Delete entry",
        description="Delete a production entry.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),

    # ── Production / Analytics ────────────────────────────────────────────
    "production.analytics.view": PermissionDef(
        key="production.analytics.view",
        label="View production analytics",
        description="View production intelligence dashboards: shift throughput, batch quality, downtime, and operator performance.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),

    # ── Production / Fraud Intelligence ────────────────────────────────────
    "production.fraud_intelligence.view": PermissionDef(
        key="production.fraud_intelligence.view",
        label="View fraud intelligence",
        description="View theft/fraud intelligence: inventory loss signals, dispatch mismatches, transaction anomalies, and operational fraud summaries.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "production.fraud_financial.view": PermissionDef(
        key="production.fraud_financial.view",
        label="View fraud financial exposure",
        description="View the financial impact of fraud: estimated loss INR, value-at-risk, cost impact of anomalies.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "production.fraud_investigation.view": PermissionDef(
        key="production.fraud_investigation.view",
        label="View fraud investigation detail",
        description="View user behavior profiles, approver detail, and named investigation-level fraud signals.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),

    # ── Production / Scrap & Loss Intelligence ──────────────────────────────
    "production.scrap_intelligence.view": PermissionDef(
        key="production.scrap_intelligence.view",
        label="View scrap intelligence",
        description="View scrap and loss intelligence: scrap volumes, rates, trends, and operator/machine/line/process breakdowns.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "production.scrap_cost.view": PermissionDef(
        key="production.scrap_cost.view",
        label="View scrap cost",
        description="View the financial impact of scrap: scrap cost INR, cost leaderboards by machine/line/operator/process.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),

    # ── Production / Batch ──────────────────────────────────────────────────
    "production.batch.view": PermissionDef(
        key="production.batch.view",
        label="View batches",
        description="View steel production batches.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "production.batch.create": PermissionDef(
        key="production.batch.create",
        label="Create batch",
        description="Record a new steel production batch.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "production.batch.variance.approve": PermissionDef(
        key="production.batch.variance.approve",
        label="Approve batch variance",
        description="Approve or reject a batch production variance.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),

    # ── Attendance ──────────────────────────────────────────────────────────
    "attendance.record.view": PermissionDef(
        key="attendance.record.view",
        label="View attendance",
        description="View attendance records.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "attendance.record.approve": PermissionDef(
        key="attendance.record.approve",
        label="Approve attendance",
        description="Approve attendance records and regularization requests.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "attendance.review.reject": PermissionDef(
        key="attendance.review.reject",
        label="Reject attendance",
        description="Reject attendance regularization requests with a reason.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "attendance.self.view": PermissionDef(
        key="attendance.self.view",
        label="View own attendance",
        description="View own attendance records and status.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "attendance.self.punch": PermissionDef(
        key="attendance.self.punch",
        label="Self punch",
        description="Punch in/out for attendance.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "attendance.self.regularization.request": PermissionDef(
        key="attendance.self.regularization.request",
        label="Request regularization",
        description="Request attendance regularization.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "attendance.team.view": PermissionDef(
        key="attendance.team.view",
        label="View team attendance",
        description="View live team attendance status.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "attendance.profile.manage": PermissionDef(
        key="attendance.profile.manage",
        label="Manage profiles",
        description="Manage employee attendance profiles.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "attendance.shift_template.manage": PermissionDef(
        key="attendance.shift_template.manage",
        label="Manage shift templates",
        description="Create and edit attendance shift templates.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "attendance.review.queue.view": PermissionDef(
        key="attendance.review.queue.view",
        label="View review queue",
        description="View the attendance regularization review queue.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "attendance.report.view": PermissionDef(
        key="attendance.report.view",
        label="View attendance reports",
        description="View attendance summary reports.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),

    # ── OCR ─────────────────────────────────────────────────────────────────
    "ocr.verification.view": PermissionDef(
        key="ocr.verification.view",
        label="View OCR data",
        description="View OCR verification results.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ocr.verification.approve": PermissionDef(
        key="ocr.verification.approve",
        label="Approve OCR verification",
        description="Approve or reject OCR-verified data.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ocr.verification.approve_ops": PermissionDef(
        key="ocr.verification.approve_ops",
        label="Approve OCR (operations)",
        description="Approve or reject operations-domain OCR verification data.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ocr.verification.approve_finance": PermissionDef(
        key="ocr.verification.approve_finance",
        label="Approve OCR (finance)",
        description="Approve or reject finance-domain OCR verification data (invoices, receipts, ledgers).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "ocr.verification.reject": PermissionDef(
        key="ocr.verification.reject",
        label="Reject OCR verification",
        description="Reject OCR verification results with a reason.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ocr.template.view": PermissionDef(
        key="ocr.template.view",
        label="View OCR templates",
        description="View OCR processing templates.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "ocr.template.manage": PermissionDef(
        key="ocr.template.manage",
        label="Manage OCR templates",
        description="Create and edit OCR processing templates.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "ocr.job.view": PermissionDef(
        key="ocr.job.view",
        label="View OCR jobs",
        description="View OCR verification jobs and results.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "ocr.document.upload": PermissionDef(
        key="ocr.document.upload",
        label="Upload documents",
        description="Upload documents for OCR processing.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "ocr.verification.edit": PermissionDef(
        key="ocr.verification.edit",
        label="Edit verification",
        description="Edit OCR verification results before submission.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "ocr.verification.submit": PermissionDef(
        key="ocr.verification.submit",
        label="Submit verification",
        description="Submit OCR verification results for review.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),

    # ── Steel / Inventory ───────────────────────────────────────────────────
    "inventory.ledger.view": PermissionDef(
        key="inventory.ledger.view",
        label="View ledger",
        description="View the steel inventory overview, stock summary, and ledger.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "inventory.item.view": PermissionDef(
        key="inventory.item.view",
        label="View items",
        description="View steel inventory items and stock levels.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "inventory.item.manage": PermissionDef(
        key="inventory.item.manage",
        label="Manage items",
        description="Create and edit steel inventory items.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "inventory.transaction.create": PermissionDef(
        key="inventory.transaction.create",
        label="Create transaction",
        description="Record inventory ledger transactions.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "inventory.reconciliation.create": PermissionDef(
        key="inventory.reconciliation.create",
        label="Start reconciliation",
        description="Initiate a stock reconciliation count.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "inventory.reconciliation.approve": PermissionDef(
        key="inventory.reconciliation.approve",
        label="Approve reconciliation",
        description="Approve or reject stock reconciliation results.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),
    "inventory.reconciliation.view": PermissionDef(
        key="inventory.reconciliation.view",
        label="View reconciliations",
        description="View stock reconciliation history.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),

    # ── Steel / Customer ────────────────────────────────────────────────────
    "customer.record.view": PermissionDef(
        key="customer.record.view",
        label="View customers",
        description="View steel customer records and lifecycle data.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "customer.record.create": PermissionDef(
        key="customer.record.create",
        label="Create customer",
        description="Create new steel customer records.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "customer.record.edit": PermissionDef(
        key="customer.record.edit",
        label="Edit customer",
        description="Edit steel customer details, credit limits, and status.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "customer.verification.review": PermissionDef(
        key="customer.verification.review",
        label="Review verification",
        description="Review and approve/reject customer PAN/GST verification.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),
    "customer.record.delete": PermissionDef(
        key="customer.record.delete",
        label="Delete customer",
        description="Deactivate a steel customer record.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),

    # ── Steel / Invoice ─────────────────────────────────────────────────────
    "invoice.record.view": PermissionDef(
        key="invoice.record.view",
        label="View invoices",
        description="View steel sales invoices.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "invoice.record.create": PermissionDef(
        key="invoice.record.create",
        label="Create invoices",
        description="Create steel sales invoices.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "invoice.record.edit": PermissionDef(
        key="invoice.record.edit",
        label="Edit invoices",
        description="Edit existing steel sales invoices (pre-dispatch).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "invoice.record.void": PermissionDef(
        key="invoice.record.void",
        label="Void invoices",
        description="Void or reverse a steel sales invoice (post-dispatch).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
        requires_mfa=True,
    ),

    # ── Steel / Dispatch ────────────────────────────────────────────────────
    "dispatch.record.view": PermissionDef(
        key="dispatch.record.view",
        label="View dispatches",
        description="View steel dispatch records.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "dispatch.record.create": PermissionDef(
        key="dispatch.record.create",
        label="Create dispatches",
        description="Create steel dispatch records.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "dispatch.record.update": PermissionDef(
        key="dispatch.record.update",
        label="Update dispatches",
        description="Update dispatch status (entry/exit/delivery).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),
    "dispatch.record.cancel": PermissionDef(
        key="dispatch.record.cancel",
        label="Cancel dispatches",
        description="Cancel a steel dispatch.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
        requires_mfa=True,
    ),

    # ── Steel / Payment & Follow-up ─────────────────────────────────────────
    "payment.record.create": PermissionDef(
        key="payment.record.create",
        label="Record payment",
        description="Record customer payment and allocate to invoices.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "payment.record.reverse": PermissionDef(
        key="payment.record.reverse",
        label="Reverse payment",
        description="Reverse a customer payment entry.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
        requires_mfa=True,
    ),
    "followup.task.manage": PermissionDef(
        key="followup.task.manage",
        label="Manage follow-ups",
        description="Create, assign, and update customer follow-up tasks.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),

    # ── AI ──────────────────────────────────────────────────────────────────
    "ai.suggestions.view": PermissionDef(
        key="ai.suggestions.view",
        label="AI suggestions",
        description="Generate AI-powered DPR shift suggestions.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ai.anomalies.view": PermissionDef(
        key="ai.anomalies.view",
        label="AI anomalies",
        description="View AI-detected production anomalies.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ai.nlq.query": PermissionDef(
        key="ai.nlq.query",
        label="AI natural language queries",
        description="Ask natural language questions about production data.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ai.executive.view": PermissionDef(
        key="ai.executive.view",
        label="AI executive summary",
        description="Generate AI-powered executive summaries.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "ai.usage.view": PermissionDef(
        key="ai.usage.view",
        label="View AI usage",
        description="View AI feature usage and quotas.",
        scope_level=ScopeLevel.ORG,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "intelligence.request.create": PermissionDef(
        key="intelligence.request.create",
        label="Create intelligence request",
        description="Submit a factory intelligence analysis request.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "intelligence.request.view": PermissionDef(
        key="intelligence.request.view",
        label="View intelligence",
        description="View factory intelligence analysis results.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),

    # ── Analytics & Reporting ────────────────────────────────────────────────
    "analytics.operations.view": PermissionDef(
        key="analytics.operations.view",
        label="View operations analytics",
        description="View operations analytics (weekly, monthly, trends, manager).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "audit.log.view": PermissionDef(
        key="audit.log.view",
        label="View audit logs",
        description="View audit trail and activity logs.",
        scope_level=ScopeLevel.ORG,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "reporting.executive.export": PermissionDef(
        key="reporting.executive.export",
        label="Export executive reports",
        description="Export executive PDF reports.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "reporting.email.summary.view": PermissionDef(
        key="reporting.email.summary.view",
        label="View email summaries",
        description="View email summary reports.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "reporting.email.summary.generate": PermissionDef(
        key="reporting.email.summary.generate",
        label="Generate email summaries",
        description="Generate AI-powered email summary content.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "reporting.insights.view": PermissionDef(
        key="reporting.insights.view",
        label="View insights",
        description="View aggregated report insights and dashboards.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "reporting.export.view": PermissionDef(
        key="reporting.export.view",
        label="Export reports",
        description="Export production reports (PDF, Excel).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_EVERYONE_BUT_ATTENDANCE,
    ),
    "analytics.premium.view": PermissionDef(
        key="analytics.premium.view",
        label="View premium analytics",
        description="Access premium analytics dashboards (plan-gated).",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),

    # ── Billing & Subscription ──────────────────────────────────────────────
    "billing.config.view": PermissionDef(
        key="billing.config.view",
        label="View billing config",
        description="View billing/Razorpay configuration.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
    ),
    "billing.status.view": PermissionDef(
        key="billing.status.view",
        label="View billing status",
        description="View subscription and usage status.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
    ),
    "billing.invoice.view": PermissionDef(
        key="billing.invoice.view",
        label="View invoices",
        description="View billing invoice history.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
    ),
    "billing.plan.change": PermissionDef(
        key="billing.plan.change",
        label="Change plan",
        description="Change or downgrade the organization's billing plan.",
        scope_level=ScopeLevel.ORG,
        default_roles=_INTERNAL_STAFF,
        requires_mfa=True,
    ),
    "billing.plan.downgrade": PermissionDef(
        key="billing.plan.downgrade",
        label="Downgrade plan",
        description="Schedule or cancel a plan downgrade.",
        scope_level=ScopeLevel.ORG,
        default_roles=_INTERNAL_STAFF,
        requires_mfa=True,
    ),
    "billing.order.create": PermissionDef(
        key="billing.order.create",
        label="Create order",
        description="Create a Razorpay checkout order.",
        scope_level=ScopeLevel.ORG,
        default_roles=_INTERNAL_STAFF,
        requires_mfa=True,
    ),
    "billing.order.sync": PermissionDef(
        key="billing.order.sync",
        label="Sync payment",
        description="Sync a payment order status with Razorpay.",
        scope_level=ScopeLevel.ORG,
        default_roles=_INTERNAL_STAFF,
    ),
    "admin.billing.quota.reset": PermissionDef(
        key="admin.billing.quota.reset",
        label="Reset quota",
        description="Reset an org's OCR/usage quota (admin only).",
        scope_level=ScopeLevel.PLATFORM,
        default_roles=_INTERNAL_STAFF,
        requires_mfa=True,
    ),

    # ── Settings / User Management ──────────────────────────────────────────
    "user.role.assign": PermissionDef(
        key="user.role.assign",
        label="Assign roles",
        description="Change a user's role or membership.",
        scope_level=ScopeLevel.ORG,
        default_roles=_MANAGER_PLUS,
        requires_mfa=True,
    ),
    "user.manage": PermissionDef(
        key="user.manage",
        label="Manage users",
        description="Create, invite, or deactivate org users.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
    ),
    "user.invite": PermissionDef(
        key="user.invite",
        label="Invite users",
        description="Invite new users to the organization.",
        scope_level=ScopeLevel.ORG,
        default_roles=_MANAGER_PLUS,
        requires_mfa=True,
    ),
    "user.deactivate": PermissionDef(
        key="user.deactivate",
        label="Deactivate users",
        description="Deactivate or remove users from the organization.",
        scope_level=ScopeLevel.ORG,
        default_roles=_MANAGER_PLUS,
        requires_mfa=True,
    ),
    "user.membership.assign": PermissionDef(
        key="user.membership.assign",
        label="Assign factory access",
        description="Assign or revoke a user's factory membership.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
        requires_mfa=True,
    ),
    "user.directory.view": PermissionDef(
        key="user.directory.view",
        label="View user directory",
        description="View the organization's user directory.",
        scope_level=ScopeLevel.ORG,
        default_roles=_MANAGER_PLUS,
    ),

    # ── Master Data (lookup tables) ─────────────────────────────────────────
    "factory.master_data.manage": PermissionDef(
        key="factory.master_data.manage",
        label="Manage master data",
        description="Manage factory lookup data: defect reasons and other master tables.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),

    # ── Factory ─────────────────────────────────────────────────────────────
    "factory.create": PermissionDef(
        key="factory.create",
        label="Create factories",
        description="Create new factory locations.",
        scope_level=ScopeLevel.ORG,
        default_roles=_ADMIN_PLUS,
        requires_mfa=True,
    ),
    "factory.profile.manage": PermissionDef(
        key="factory.profile.manage",
        label="Manage factory profiles",
        description="View and update factory profiles and settings.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_MANAGER_PLUS,
    ),

    # ── Alerts & Ops ────────────────────────────────────────────────────────
    "ops.alerts.view": PermissionDef(
        key="ops.alerts.view",
        label="View alerts",
        description="View operational alerts and notifications.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_OPERATOR_PLUS,
    ),
    "ops.alerts.manage": PermissionDef(
        key="ops.alerts.manage",
        label="Manage alerts",
        description="Configure alert recipients and notification channels.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),

    # ── Observability ───────────────────────────────────────────────────────
    "system.observability.view": PermissionDef(
        key="system.observability.view",
        label="View system observability",
        description="View AI system dashboard, governance, and tracing data.",
        scope_level=ScopeLevel.PLATFORM,
        default_roles=_ADMIN_PLUS,
    ),

    # ── Background Jobs ─────────────────────────────────────────────────────
    "background_jobs.view": PermissionDef(
        key="background_jobs.view",
        label="View jobs",
        description="View and manage background job status.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_EVERYONE_BUT_ATTENDANCE,
    ),

    # ── Feedback ────────────────────────────────────────────────────────────
    "feedback.submit": PermissionDef(
        key="feedback.submit",
        label="Submit feedback",
        description="Submit bug reports and feature requests.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_EVERYONE_BUT_ATTENDANCE,
    ),
    "feedback.manage": PermissionDef(
        key="feedback.manage",
        label="Manage feedback",
        description="Read, export, and manage user feedback (admin/owner only).",
        scope_level=ScopeLevel.PLATFORM,
        default_roles=_INTERNAL_STAFF,
    ),

    # ── Workforce Intelligence ──────────────────────────────────────────────
    "workforce.overview.view": PermissionDef(
        key="workforce.overview.view",
        label="View workforce overview",
        description="View workforce intelligence overview: attendance KPIs, overtime, shift comparison, and labour cost summary.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "workforce.workers.view": PermissionDef(
        key="workforce.workers.view",
        label="View worker analytics",
        description="View ranked worker performance, attendance trends, and individual productivity estimates.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_SUPERVISOR_PLUS,
    ),
    "workforce.cost.view": PermissionDef(
        key="workforce.cost.view",
        label="View labour cost",
        description="View labour cost breakdown: regular wages, overtime, absenteeism impact.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_FINANCIAL_ROLES,
    ),
    "workforce.cost.manage": PermissionDef(
        key="workforce.cost.manage",
        label="Manage labour rates",
        description="Configure labour cost rates: regular hourly rates, overtime multipliers, and rate overrides.",
        scope_level=ScopeLevel.FACTORY,
        default_roles=_ADMIN_PLUS,
    ),

    # ── System / Platform Admin ──────────────────────────────────────────────
    "system.admin": PermissionDef(
        key="system.admin",
        label="System admin access",
        description="Generic platform-level admin gate. Grants access to admin-only diagnostic and management endpoints.",
        scope_level=ScopeLevel.PLATFORM,
        default_roles=_ADMIN_PLUS,
    ),
}

# Deduplicate permission keys that were accidentally added twice
PERMISSION_CATALOG = {
    k: v for k, v in sorted(PERMISSION_CATALOG.items(), key=lambda item: item[0])
}

# Rebuild the dict to remove duplicate keys (last duplicate wins, but they should be identical)
PERMISSION_CATALOG_UNIQUE: dict[str, PermissionDef] = {}
for k, v in PERMISSION_CATALOG.items():
    PERMISSION_CATALOG_UNIQUE[k] = v
PERMISSION_CATALOG = PERMISSION_CATALOG_UNIQUE


class PermissionCatalog:
    """Accessor for the permission catalog.

    Provides lookup, role-grant resolution, and default-permission-set computation.
    """

    @staticmethod
    def get(key: str) -> PermissionDef | None:
        return PERMISSION_CATALOG.get(key)

    @staticmethod
    def require(key: str) -> PermissionDef:
        entry = PERMISSION_CATALOG.get(key)
        if entry is None:
            raise KeyError(f"Unknown permission key: {key}")
        return entry

    @staticmethod
    def all_keys() -> list[str]:
        return list(PERMISSION_CATALOG.keys())

    @staticmethod
    def permissions_for_role(role: UserRole) -> list[PermissionDef]:
        """Return all permission definitions granted to the given role by default."""
        return [
            entry for entry in PERMISSION_CATALOG.values()
            if role in entry.default_roles
        ]

    @staticmethod
    def permission_keys_for_role(role: UserRole, *, scope: ScopeLevel | None = None) -> list[str]:
        """Return permission keys granted to the role, optionally filtered by scope."""
        return [
            entry.key for entry in PERMISSION_CATALOG.values()
            if role in entry.default_roles
            and (scope is None or entry.scope_level == scope)
        ]

    @staticmethod
    def has_permission(role: UserRole, permission_key: str) -> bool:
        entry = PERMISSION_CATALOG.get(permission_key)
        if entry is None:
            return False
        return role in entry.default_roles

    @staticmethod
    def keys_by_scope(scope: ScopeLevel) -> list[str]:
        return [
            entry.key for entry in PERMISSION_CATALOG.values()
            if entry.scope_level == scope
        ]
