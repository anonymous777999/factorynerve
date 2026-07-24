COMPREHENSIVE ROLE & PERMISSION SYSTEM AUDIT -- DPR.ai
1. WHAT ROLES EXIST
File: D:\DPR APP\DPR.ai\backend\models\user.py (lines 16-23)

class UserRole(str, Enum):
    ATTENDANCE = "attendance"
    OPERATOR = "operator"
    SUPERVISOR = "supervisor"
    ACCOUNTANT = "accountant"
    MANAGER = "manager"
    ADMIN = "admin"
    OWNER = "owner"
Frontend counterpart: web\src\lib\role-navigation.ts (lines 1-8) lists the same 7 roles plus a "superadmin" role allowed in auth-guard.tsx (line 8), but superadmin is not a UserRole enum value -- it is a separate is_platform_admin boolean flag on the User model (model line 63-68).

2. ROLE HIERARCHY
File: D:\DPR APP\DPR.ai\backend\rbac.py (lines 10-18)

ROLE_ORDER = {
    ATTENDANCE: 0,
    OPERATOR: 1,
    ACCOUNTANT: 2,
    SUPERVISOR: 3,
    MANAGER: 4,
    ADMIN: 5,
    OWNER: 6,
}
File: D:\DPR APP\DPR.ai\backend\routers\settings.py (lines 1116-1124) -- DUPLICATE hierarchy with different values:

role_order = {
    ATTENDANCE: 0,
    OPERATOR: 1,
    SUPERVISOR: 2,
    ACCOUNTANT: 2,
    MANAGER: 3,
    ADMIN: 4,
    OWNER: 5,
}
BUG-PERM-001 -- Inconsistent role hierarchies between rbac.py and settings.py | Severity: MEDIUM | | Root Cause: The role_order dict in settings.py (line 1116) assigns ACCOUNTANT=2 (same as SUPERVISOR) and MANAGER=3, while rbac.py assigns ACCOUNTANT=2, SUPERVISOR=3, MANAGER=4. | | Impact: A user who is rank-checked via require_role() uses rbac.py ROLE_ORDER, but the role-change authorization in update_user_role() uses a different order. update_user_role only checks role_order[payload.role] >= role_order[current_user.role] (setting.py line 1141), which is weaker. An ACCOUNTANT (rank 2 in settings.py) would be treated as lower than SUPERVISOR (rank 2 in settings.py, i.e., equal, meaning you cannot assign it), but in rbac.py SUPERVISOR(3) > ACCOUNTANT(2). | | Fix: Centralize the hierarchy in rbac.py and import it into settings.py instead of redefining it. |

3. IS ROLE CHECKED SERVER-SIDE ON EVERY MUTATION ENDPOINT?
Most routers are well-guarded with require_role() or require_any_role() after get_current_user(). The following routers have comprehensive role guards:

attendance.py, billing.py, analytics.py, alert_recipients.py, alerts.py, entries.py, emails.py, observability.py, ocr.py, premium.py, reports.py, settings.py, steel.py
Routers with get_current_user but WITHOUT require_role/require_any_role:

Router	Endpoints	Issue
ai.py	8 endpoints at lines 585, 613, 712, 738, 794, 909, 945, 965	Authenticated but any role can call AI endpoints
feedback.py	6 endpoints at lines 372, 479, 541, 586, 611, 641	Authenticated but no role restriction
intelligence.py	4 endpoints at lines 27, 50, 59, 71	Authenticated but no role restriction
jobs.py	4 endpoints at lines 18, 26, 37, 52	Authenticated but no role restriction
phone_auth.py	2 endpoints at lines 58, 85	Authenticated but no role restriction
BUG-PERM-002 -- Missing role guards on AI endpoints | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\ai.py (lines 585-965) | | Root Cause: 8 endpoints use get_current_user but never call require_role() or require_any_role(). Any authenticated user (ATTENDANCE, OPERATOR, etc.) can call AI features. | | Fix: Add require_any_role(current_user, {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}) or similar to AI endpoints that should be restricted. |

BUG-PERM-003 -- Missing role guards on feedback endpoints | Severity: LOW | | File: D:\DPR APP\DPR.ai\backend\routers\feedback.py (lines 372-641) | | Root Cause: Same pattern -- authenticated but no role check. Feedback is likely meant to be accessible to all roles, but this should be explicit. | | Fix: Either document that feedback is all-role, or add require_any_role() with the appropriate set. |

BUG-PERM-004 -- Missing role guards on intelligence endpoints | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\intelligence.py (lines 27-71) | | Root Cause: No role check. | | Fix: Add role guard as appropriate for business intelligence features. |

BUG-PERM-005 -- Missing role guards on jobs endpoints | Severity: LOW | | File: D:\DPR APP\DPR.ai\backend\routers\jobs.py (lines 18-52) | | Root Cause: No role check on background job endpoints. | | Fix: Add role guard. |

BUG-PERM-006 -- Missing role guards on phone_auth endpoints | Severity: LOW | | File: D:\DPR APP\DPR.ai\backend\routers\phone_auth.py (lines 58, 85) | | Root Cause: Phone verification endpoints are authenticated but not role-restricted. | | Fix: This may be intentional (all users should verify phones), but the lack of guard is a consistency gap. |

Routers without any auth (public):

plans.py -- Public (no get_current_user), listing plans is intentional.
whatsapp_webhook.py -- Public webhook endpoint, intentional.
auth_google.py -- Public OAuth login/callback, intentional.
auth.py register/login/password-reset/email-verify endpoints -- all public, intentional.
4. CAN A USER CHANGE THEIR OWN ROLE?
File: D:\DPR APP\DPR.ai\backend\routers\settings.py (lines 1107-1203)

Guard: require_role(current_user, UserRole.MANAGER) at line 1115. Minimum MANAGER to access any role-change endpoint.

Self-change prevention at line 1166:

if user.id == current_user.id and payload.role != current_user.role and not is_admin_or_owner(current_user):
    raise HTTPException(status_code=400, detail="You cannot change your own role.")
This means:

MANAGER cannot change their own role (correct)
ADMIN CAN change their own role (because is_admin_or_owner(current_user) is True)
OWNER CAN change their own role
BUG-PERM-007 -- ADMIN/OWNER can self-demote | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\settings.py (line 1166) | | Root Cause: is_admin_or_owner check creates an exception that allows ADMIN and OWNER to change their own role. While line 1141 prevents assigning a role >= current (so ADMIN cannot assign ADMIN or OWNER to themselves), they CAN demote themselves to MANAGER or below. This could be used to bypass audit trails or escape responsibility. | | Fix: Remove the is_admin_or_owner exception, or require explicit org-owner confirmation for self-demotion. |

Additional constraint at line 1141:

if role_order[payload.role] >= role_order[current_user.role]:
    raise HTTPException(status_code=403, detail="Cannot assign a role equal to or higher than your own")
This correctly prevents privilege escalation but uses the weaker settings.py hierarchy (see BUG-PERM-001).

Constraint at line 1149:

if role_order[user.role] >= role_order[current_user.role]:
    raise HTTPException(status_code=403, detail="Cannot modify a user with equal or higher rank")
This prevents modifying peers or superiors.

Last-admin/owner protection at lines 1168-1170:

if user.role in {ADMIN, OWNER} and payload.role != user.role:
    if not _has_other_privileged_user(db, org_id=org_id, exclude_user_id=user.id):
        raise HTTPException(status_code=400, detail="Cannot remove the last owner/admin account.")
This is solid.

5. IS FACTORYID ALWAYS TAKEN FROM SESSION (TENANCY.PY), NEVER FROM REQUEST BODY?
File: D:\DPR APP\DPR.ai\backend\tenancy.py (lines 12-28)

resolve_factory_id() tries active_factory_id from the JWT token first, then falls back to DB lookup of first assigned factory.

However, there is a notable exception:

File: D:\DPR APP\DPR.ai\backend\routers\auth.py (lines 1396-1405) -- /select-factory endpoint:

@router.post("/select-factory", response_model=AuthResponse)
def select_factory(payload: SelectFactoryRequest, ...):
SelectFactoryRequest includes factory_id from the request body. This endpoint reissues a JWT with the new factory_id -- this is the intended way to switch factory context and is validated by checking UserFactoryRole membership. This is acceptable.

Other endpoints that take factory_id from the request body rather than deriving it from the session:

File: D:\DPR APP\DPR.ai\backend\routers\auth.py (line 1366) -- /factories endpoint (listing, read-only)

The data-layer scoping functions (apply_org_scope, apply_role_scope) in query_helpers.py do use resolve_org_id() and resolve_factory_id() from tenancy.py.

Conculsion: Factory ID from request body is generally only accepted in the context-switch endpoint (select-factory), which validates membership. Other endpoints properly use tenancy scoping. This pattern is acceptable.

6. ENDPOINTS ACCESSIBLE WITHOUT ANY ROLE CHECK
These endpoints use get_current_user (authenticated) but have zero require_role()/require_any_role() checks:

Router	Lines	Endpoints
ai.py	585-965	8 endpoints
feedback.py	372-641	6 endpoints
intelligence.py	27-71	4 endpoints
jobs.py	18-52	4 endpoints
phone_auth.py	58, 85	2 endpoints
observability.py	160	readiness_check (fully public)
auth.py	various	Profile update, photo upload, password change (all authenticated, no role)
Public (no auth at all):

Router	Endpoints
auth.py	Register, login, password forgot/reset, email verify
auth_google.py	Google OAuth login/callback
auth_secure.py	Session-based auth endpoints
plans.py	Listing plans
whatsapp_webhook.py	WhatsApp webhook
observability.py	/ready health check
7. SELF-APPROVAL PREVENTION MECHANISM
rbac.py (line 37-39):

def assert_not_self_approval(record_user_id: int, current_user_id: int) -> None:
    if record_user_id == current_user_id:
        raise HTTPException(status_code=403, detail="You cannot approve or reject your own record.")
Where it IS used:

entries.py -- approve entry (line 768), reject entry (line 804)
attendance.py -- approve attendance record (line 1565), reject attendance record (line 1690)
Where it is MISSING:

BUG-PERM-008 -- Missing self-approval prevention in steel stock reconciliation approval | Severity: HIGH | | File: D:\DPR APP\DPR.ai\backend\routers\steel.py (lines 2113-2192 approve_steel_stock_reconciliation, lines 2195-2219 reject_steel_stock_reconciliation) | | Root Cause: The approve_steel_stock_reconciliation and reject_steel_stock_reconciliation endpoints check role but never call assert_not_self_approval(). The reconciliation has created_by_user_id but neither endpoint verifies the current user is not the creator. | | Fix: Add assert_not_self_approval(row.created_by_user_id, current_user.id) after the role check. |

BUG-PERM-009 -- Missing self-approval prevention in all steel approval/rejection endpoints | Severity: HIGH | | File: D:\DPR APP\DPR.ai\backend\routers\steel.py -- review endpoints at line 3030 (/customers/{customer_id}/verification/review), line 4079 (/dispatches/{dispatch_id}/status) | | Root Cause: Multiple steel review/approve/reject endpoints allow reviewing records without checking for self-approval. | | Fix: Audit all steel endpoints that change status (approve/reject/review) and add assert_not_self_approval() where the record has a created_by_user_id field. |

8. CAN A DEACTIVATED USER STILL CALL APIS?
File: D:\DPR APP\DPR.ai\backend\security.py (line 105):

user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
Result: NO. The get_current_user() dependency explicitly filters for is_active.is_(True). A deactivated user's token will fail this query and return 401 User not found. This is correct.

Token revocation (security.py line 101):

if db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first():
    raise HTTPException(status_code=401, detail="Token revoked.")
Tokens can be individually revoked via the TokenBlacklist table. This is used for logout. Good.

However, the check only validates token-level blacklist, not session-level. If a user is deactivated while a valid token exists, they lose access on their next request (when get_current_user runs). But the filter is correctly applied on every API call.

9. UI-LEVEL ROLE GUARDS
File: D:\DPR APP\DPR.ai\web\src\components\auth-guard.tsx (lines 10-24)

The RoleGuard component and withRoleGuard HOC check allowed roles array:

type RoleGuardProps = {
  allowed: UserRole[];
  children: ReactNode;
};
The UserRole type (line 8) is CurrentUser["role"] | "superadmin".

Bug: The UserRole type at line 8 includes "superadmin" as a valid role, but "superadmin" is NOT a UserRole enum value in the backend. The backend uses is_platform_admin boolean for this. The frontend has no way to actually be a "superadmin" role, so RoleGuard with superadmin will never match -- will always show "403 Forbidden".

File: D:\DPR APP\DPR.ai\web\src\lib\role-navigation.ts (lines 1-258)

This provides role-appropriate navigation hrefs. It's a client-side convenience, not a security control -- the real enforcement is server-side.

File: D:\DPR APP\DPR.ai\web\middleware.ts (lines 38-44)

const ROLE_ROUTES = {
  "/billing": ["admin", "owner"],
  "/settings": ["manager", "admin", "owner"],
  "/admin-billing": ["superadmin"],
  "/analytics": ["supervisor", "manager", "admin", "owner"],
  "/settings/users": ["manager", "admin", "owner"],
};
This is a first-line client-side guard at the edge. It decodes JWT to check role before page load. However, it only covers 5 routes.

BUG-PERM-010 -- Incomplete edge-level role coverage in middleware | Severity: LOW | | File: D:\DPR APP\DPR.ai\web\middleware.ts (lines 38-44) | | Root Cause: Only 5 routes are covered by ROLE_ROUTES. All other protected routes (PROTECTED_PREFIXES has 23 entries) are only checked for authentication, not role. Role enforcement is deferred to the server, which is secure but could lead to unnecessary 403 errors. | | Fix: Expand ROLE_ROUTES to match the backend's role requirements for all protected routes, or document that this is intentional. |

10. PRIVILEGE ESCALATION VULNERABILITIES
BUG-PERM-011 -- Inconsistent rank check in settings.py allows ACCOUNTANTS to be treated equal to SUPERVISORS for role assignments | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\settings.py (lines 1116-1124 vs rbac.py lines 10-18) | | Root Cause: settings.py line 1120 assigns ACCOUNTANT=2, SUPERVISOR=2 (same rank). An ACCOUNTANT user could potentially have their role "upgraded" via other paths without triggering the rank check correctly. Meanwhile, rbac.py has SUPERVISOR=3 > ACCOUNTANT=2. | | Fix: Use from backend.rbac import ROLE_ORDER and reference ROLE_ORDER in settings.py instead of redefining the hierarchy. |

BUG-PERM-012 -- update_user_factory_access guarded at ADMIN, but update_user_role guarded at MANAGER | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\settings.py (line 1010 vs line 1115) | | Root Cause: update_user_factory_access (line 1010) requires UserRole.ADMIN, but update_user_role (line 1115) requires only UserRole.MANAGER. A MANAGER can change a user's role but cannot control which factories that user accesses. This is architecturally inconsistent -- if a MANAGER can change role to ADMIN, they could then change factory access. But since they can't assign ADMIN/OWNER roles (line 1141), the escalation path is limited. | | Fix: Either lower factory access to MANAGER or raise role change to ADMIN for consistency. |

BUG-PERM-013 -- ADMIN can change own role, then re-grant higher privileges | Severity: HIGH | | File: D:\DPR APP\DPR.ai\backend\routers\settings.py (line 1166) | | Root Cause: ADMIN can self-demote to MANAGER (bypassing assert_not_self_approval at line 1166). After becoming MANAGER, the rank checks at lines 1141/1149 now see MANAGER=4. If the role_order dict is incorrect (BUG-PERM-001), this could allow further manipulation. More importantly, the audit trail records the change, but there's no mechanism to detect self-demotion as suspicious. | | Fix: Consider removing the is_admin_or_owner exception entirely, or adding an explicit confirmation flow ("Type 'CONFIRM' to change your own role"). |

BUG-PERM-014 -- is_platform_admin/superadmin has no role-ranking protection | Severity: MEDIUM | | File: D:\DPR APP\DPR.ai\backend\routers\settings.py (lines 984, 1010) | | Root Cause: is_platform_admin is a boolean on the User model (model line 63-68) that bypasses normal role assignments. The require_superadmin dependency checks this flag. But there is no endpoint to SET or UNSET is_platform_admin in the evaluated routers, making this low-risk. However, it's a secondary authorization axis that lives outside the RBAC framework. | | Fix: Consider documenting this as an intentional escape hatch for platform-level operations. |

SUMMARY OF FINDINGS
ID	Severity	File	Line	Description
BUG-PERM-001	MEDIUM	backend/routers/settings.py	1116-1124	Duplicate role hierarchy inconsistent with rbac.py
BUG-PERM-002	MEDIUM	backend/routers/ai.py	585-965	8 AI endpoints have no role guard
BUG-PERM-003	LOW	backend/routers/feedback.py	372-641	Feedback endpoints have no role guard
BUG-PERM-004	MEDIUM	backend/routers/intelligence.py	27-71	Intelligence endpoints have no role guard
BUG-PERM-005	LOW	backend/routers/jobs.py	18-52	Jobs endpoints have no role guard
BUG-PERM-006	LOW	backend/routers/phone_auth.py	58, 85	Phone auth endpoints have no role guard
BUG-PERM-007	MEDIUM	backend/routers/settings.py	1166	ADMIN/OWNER can change their own role (self-demotion)
BUG-PERM-008	HIGH	backend/routers/steel.py	2113, 2195	No self-approval check on steel reconciliation approve/reject
BUG-PERM-009	HIGH	backend/routers/steel.py	3030, 4079	No self-approval check on steel customer review/dispatch status
BUG-PERM-010	LOW	web/middleware.ts	38-44	Incomplete edge-level role route coverage
BUG-PERM-011	MEDIUM	backend/routers/settings.py	1116-1124	ACCOUNTANT and SUPERVISOR ranked equal in settings.py (different from rbac.py)
BUG-PERM-012	MEDIUM	backend/routers/settings.py	1010 vs 1115	Factory access requires ADMIN but role change only requires MANAGER
BUG-PERM-013	HIGH	backend/routers/settings.py	1166	ADMIN self-demotion allows bypassing rank protections
BUG-PERM-014	MEDIUM	backend/routers/admin_billing.py	23	Superadmin is outside the RBAC role hierarchy
KEY STRENGTHS OF THE SYSTEM
get_current_user correctly filters deactivated users (security.py:105) -- deactivation immediately prevents API access.
Token revocation via TokenBlacklist (security.py:101) -- enables per-token invalidation.
role_revision counter (user.py:45) -- incremented on role changes, detected client-side via registerRoleRevisionMismatchHandler (auth.ts:275-284), forcing session refresh.
Rank checks prevent peer/superior modification (settings.py:1141,1149) -- a user cannot modify someone with equal or higher rank.
Last-owner/admin protection (settings.py:1168-1170) -- prevents removing the last privileged user.
Server-side enforcement is the norm -- nearly all mutation endpoints in the core business domains (entries, attendance, steel, billing, reports, analytics, settings) have proper role guards.
is_admin_or_owner guard on update_user_factory_access (settings.py:1010) -- factory-level access requires elevated role.
Data-level scoping via apply_role_scope and apply_org_scope in query_helpers.py -- row-level filtering by org/factory/role.
RECOMMENDATIONS (PRIORITY ORDER)
P0: Add assert_not_self_approval() to all steel approve/reject/review endpoints (BUG-PERM-008, BUG-PERM-009).
P0: Fix the duplicate role hierarchy in settings.py to use the centralized one from rbac.py (BUG-PERM-001, BUG-PERM-011).
P1: Add role guards to ai.py, intelligence.py endpoints (BUG-PERM-002, BUG-PERM-004).
P1: Review the ADMIN self-demotion path (BUG-PERM-007, BUG-PERM-013).
P2: Add role guards to feedback.py, jobs.py, phone_auth.py or explicitly document them as all-role endpoints (BUG-PERM-003, -005, -006).
P2: Consider adding is_platform_admin to a proper role or removing the "superadmin" loose type from the frontend RoleGuard (auth-guard.tsx line 8).