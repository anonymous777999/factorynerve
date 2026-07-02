 Role & Permission Workflow Audit Report

  Status: Completed
  Workflow Readiness Score: 68/100

  ---

  1. Workflow Mapping

  ┌───────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Component         │ Details                                                                                                            │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Screens           │ settings-users-tab.tsx, app-shell.tsx, steel-dispatches-page.tsx, steel-reconciliations-page.tsx, billing-page.tsx │
  │ APIs              │ GET /auth/me, PUT /users/{user_id}/role, POST /inventory/reconciliations, POST /dispatches, POST /invoices         │
  │ Database Entities │ User (Global Role), UserFactoryRole (Factory-specific Role), Factory (Industry Context)                            │
  │ User Roles        │ Owner, Admin, Manager, Accountant (Billing), Supervisor (Dispatch/Inventory), Operator, Attendance                 │
  └───────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  ---

  2. Findings Report

  Critical Issues (Release Blocking)
   1. Triple Inconsistent Role Ordering: The role_order logic is duplicated and contradictory across three core files.
      - rbac.py: SUPERVISOR(3) > ACCOUNTANT(2), MANAGER(4).
      - settings.py: SUPERVISOR(2) == ACCOUNTANT(2), MANAGER(3).
      - auth.py: SUPERVISOR(2) == ACCOUNTANT(2), MANAGER(3).
     Impact: Potential for privilege escalation or unexpected "Access Denied" errors where one module thinks a user has sufficient rank but another does
  not.
   2. Global Role Privilege Leakage: Permission checks in rbac.py and steel.py use current_user.role (global) exclusively. The UserFactoryRole.role
      (factory-specific) is completely ignored during runtime authorization, even though DB triggers enforce it as a sub-role.
     Impact: A user assigned as a MANAGER in Factory A and OPERATOR in Factory B will retain MANAGER permissions in Factory B.

  High Priority Issues
   1. Inventory Staff Permission Gap: POST /inventory/reconciliations requires UserRole.MANAGER. Standard Inventory Staff (mapped to SUPERVISOR) are blocked
      from recording stock counts.
   2. Manager Approval Logic Conflict: Managers can create reconciliations but are blocked from approving them in both Backend (require_any_role({ADMIN,
      OWNER})) and Frontend (canReview check).
   3. Broken Admin Panel Check: _build_permissions in auth.py checks for role_value == "superadmin", but "superadmin" is not a valid role in the UserRole
      enum. It should check user.is_platform_admin.

  Medium Priority Issues
   1. Operator Dispatch Visibility: Operators are blocked from GET /dispatches. In steel operations, operators often need to view dispatches to verify
      loading weights against planned limits.
   2. Missing Self-Approval Guard: Unlike the Attendance module, the Steel Reconciliation approval API does not use assert_not_self_approval. An Admin who
      records a count can approve their own variance adjustment.

  Low Priority Issues
   1. UI/UX Role Labeling: The UI uses labels like "Billing Staff" and "Dispatch Staff" in documentation/requirements, but the system shows "Accountant" and
      "Supervisor," causing user mapping confusion.

  ---

  3. Recommended Fixes

   1. Centralize Role Order: Consolidate all role ranking logic into a single RoleService or update rbac.py to be the single source of truth for both
      ranking and permissions.
   2. Implement Factory-Aware RBAC: Update backend/security.py to inject the UserFactoryRole.role into the current_user object during the get_current_user
      dependency resolution if a factory_id is present in the context.
   3. Refine Steel Permissions:
      - Change create_steel_stock_reconciliation to allow SUPERVISOR.
      - Change list_steel_dispatches and list_steel_inventory_items to allow OPERATOR.
   4. Fix Admin Flag: Update _build_permissions to use the is_platform_admin boolean flag.
   5. Enforce Self-Approval: Add assert_not_self_approval(reconciliation.created_by, current_user.id) to the reconciliation approval endpoint.

  ---

  4. Permission Matrix (Actual vs. Expected)

  ┌────────────┬────────────────┬─────────────────┬─────────────────────┬─────────────────┐
  │ Role       │ Billing Access │ Dispatch Access │ Inventory Reconcile │ User Management │
  ├────────────┼────────────────┼─────────────────┼─────────────────────┼─────────────────┤
  │ Owner      │ Full           │ Full            │ Approve             │ Full            │
  │ Admin      │ View Only      │ Full            │ Approve             │ Limited         │
  │ Manager    │ None           │ Full            │ Create Only         │ Limited         │
  │ Accountant │ Full           │ View Only       │ View Only           │ None            │
  │ Supervisor │ None           │ Full            │ Blocked (Issue)     │ None            │
  │ Operator   │ None           │ Blocked (Issue) │ None                │ None            │
  └────────────┴────────────────┴─────────────────┴─────────────────────┴─────────────────┘

  Audit Result: ⚠️ FAILS (Strategic architectural fixes required for Role Consistency and Factory-specific scoping).


