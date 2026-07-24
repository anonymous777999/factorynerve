Comprehensive File Analysis: DPR.ai Codebase
1. OVERALL PROJECT STRUCTURE
DPR.ai/                    (project root)
├── backend/               (Python FastAPI backend)
│   ├── main.py            (app entrypoint, router registrations)
│   ├── database.py        (SQLAlchemy engine, Base, session mgmt)
│   ├── security.py        (JWT auth: create/decode tokens, get_current_user)
│   ├── auth_cookies.py    (HTTP-only cookie helpers for JWT)
│   ├── rbac.py            (Role-based access control helpers)
│   ├── tenancy.py         (Org/factory scoping helpers)
│   ├── email_service.py   (SMTP / Resend email sending)
│   ├── phone_utils.py     (Phone number normalization + masking)
│   ├── otp_utils.py       (OTP generation + bcrypt hashing)
│   ├── feature_limits.py  (Per-user/org feature limits)
│   ├── plans.py           (Plan definitions, enforce_user_limit)
│   ├── routers/           (API route handlers)
│   ├── models/            (SQLAlchemy ORM models)
│   ├── schemas/           (Pydantic request/response schemas)
│   ├── services/          (Business logic services)
│   ├── middleware/        (CORS, rate limiting, CSRF, security headers)
│   ├── dependencies/      (FastAPI dependencies: quota, subscription)
│   ├── auth_security/     (Production-grade auth: sessions, MFA, Argon2 passwords)
│   └── scripts/           (Admin utility scripts)
├── web/                   (Next.js frontend)
│   ├── src/
│   │   ├── app/           (Next.js App Router pages)
│   │   ├── components/    (React components)
│   │   ├── lib/           (API clients, auth helpers, utilities)
│   │   ├── config/        (Feature flags)
│   │   ├── hooks/         (React hooks)
│   │   ├── locales/       (i18n translations: en, hi, mr, ta, gu)
│   │   ├── types/         (Type definitions)
│   │   └── features/      (Feature modules: attendance, ocr)
│   ├── e2e/               (Playwright end-to-end tests)
│   └── __tests__/         (Unit tests)
├── alembic/               (Database migrations)
├── tests/                 (Python test suite)
├── config/                (Configuration files)
├── deploy/                (Deployment configs: Caddy, systemd, Render)
├── scripts/               (Infrastructure scripts)
└── docs/                  (Documentation)
2. TECH STACK
Layer	Technology
Backend Framework	FastAPI (Python)
Database	SQLAlchemy ORM with SQLite (dev) / PostgreSQL (production)
Database Migrations	Alembic
Auth - Legacy JWT	python-jose (HS256 JWT), bcrypt (password hashing)
Auth - Production	passlib + argon2, itsdangerous (signed tokens), pyotp (TOTP MFA)
Frontend Framework	Next.js 16.2.1 (App Router), React 19.2.4
API Client	Custom apiFetch wrapper with cookie/auth headers
Session Store	browser sessionStorage + in-memory React sync store
Styling	Tailwind CSS v4
Language	TypeScript (frontend), Python (backend)
Testing	Pytest (backend), Playwright (e2e)
Email	SMTP / Resend API
SMS/WhatsApp	Provider-agnostic SMS service, WhatsApp sender
Authentication Architecture (Two Systems):

Legacy JWT System (/auth routes): JWT access tokens in Authorization header or dpr_access cookie, with dpr_refresh refresh tokens, CSRF via dpr_csrf cookie.
Production Auth System (/auth-secure routes): Cookie-based sessions (auth_session), Argon2 password hashing, TOTP MFA, session management.
3. COMPLETE FILE LISTING BY WORKFLOW & CATEGORY
A. DATABASE SCHEMA / MIGRATION FILES
ORM Models (Backend models/)

File	Description
D:\DPR APP\DPR.ai\backend\models\user.py	User model (core identity: email, password_hash, google_id, role, org_id, is_active, email_verified_at, etc.) - also defines UserRole enum, UserReadSchema, UserCreateSchema, UserUpdateSchema
D:\DPR APP\DPR.ai\backend\models\auth_user.py	AuthUser model (production auth: email, password_hash, MFA fields, password_changed_at)
D:\DPR APP\DPR.ai\backend\models\auth_session.py	AuthSession model (session token_hash, csrf_hash, IP hash, expiry, revocation)
D:\DPR APP\DPR.ai\backend\models\auth_audit_log.py	AuthAuditLog (audit trail for auth-secure events)
D:\DPR APP\DPR.ai\backend\models\auth_password_reset.py	AuthPasswordReset (production password reset tokens)
D:\DPR APP\DPR.ai\backend\models\organization.py	Organization model (multi-tenant root, plan, billing fields)
D:\DPR APP\DPR.ai\backend\models\factory.py	Factory model (org-scoped factory locations, industry type, workflow template)
D:\DPR APP\DPR.ai\backend\models\user_factory_role.py	UserFactoryRole (junction: user -> factory + role assignment)
D:\DPR APP\DPR.ai\backend\models\refresh_token.py	RefreshToken (JWT refresh token storage with hash, user_id, org/factory scope)
D:\DPR APP\DPR.ai\backend\models\email_verification_token.py	EmailVerificationToken (legacy email verification tokens for live users)
D:\DPR APP\DPR.ai\backend\models\password_reset_token.py	PasswordResetToken (legacy password reset tokens)
D:\DPR APP\DPR.ai\backend\models\pending_registration.py	PendingRegistration (verify-first signup: stores signup data until email verified)
D:\DPR APP\DPR.ai\backend\models\phone_verification.py	PhoneVerification (OTP records, status tracking) + enums
D:\DPR APP\DPR.ai\backend\models\employee_profile.py	EmployeeProfile (attendance employee roster per factory)
D:\DPR APP\DPR.ai\backend\models\report.py	AuditLog (auth events: login, logout, etc.), TokenBlacklist (revoked JWT jti)
D:\DPR APP\DPR.ai\backend\models\subscription.py	Subscription (org billing subscriptions)
D:\DPR APP\DPR.ai\backend\models\user_plan.py	UserPlan (per-user plan assignments)
Alembic Migrations (alembic/versions/)

File	Relevance
D:\DPR APP\DPR.ai\alembic\versions\20260327_02_add_refresh_tokens.py	Refresh tokens table
D:\DPR APP\DPR.ai\alembic\versions\20260328_02_add_google_auth_fields.py	Google OAuth fields on User
D:\DPR APP\DPR.ai\alembic\versions\20260328_05_add_auth_secure_tables.py	AuthUser, AuthSession, AuthAuditLog tables
D:\DPR APP\DPR.ai\alembic\versions\20260328_06_add_password_reset_tokens.py	Password reset tokens
D:\DPR APP\DPR.ai\alembic\versions\20260328_07_add_user_phone_number.py	Phone fields on User
D:\DPR APP\DPR.ai\alembic\versions\20260330_03_add_user_session_invalidated_at.py	Session invalidation tracking
D:\DPR APP\DPR.ai\alembic\versions\20260330_04_add_pending_invite_context.py	Pending invitation context
D:\DPR APP\DPR.ai\alembic\versions\20260330_05_add_pending_invite_custom_note.py	Pending invitation notes
D:\DPR APP\DPR.ai\alembic\versions\20260423_01_remove_legacy_invite_columns.py	Legacy invite cleanup
D:\DPR APP\DPR.ai\alembic\versions\20260424_02_add_phone_verification.py	Phone verification tables
D:\DPR APP\DPR.ai\alembic\versions\20260513_01_add_user_is_platform_admin.py	Platform admin flag
D:\DPR APP\DPR.ai\alembic\versions\20260518_02_add_user_role_revision.py	Role revision counter
D:\DPR APP\DPR.ai\alembic\versions\20260518_03_factory_role_constraint.py	Unique constraint: user_id + factory_id
D:\DPR APP\DPR.ai\alembic\versions\20260613_02_enforce_single_subscription_per_org.py	Single subscription per org
B. BACKEND API ROUTE HANDLERS
File	Auth Workflows Handled
D:\DPR APP\DPR.ai\backend\routers\auth.py	PRIMARY AUTH ROUTER (1682 lines) - /register, /v2/login, /logout, /logout-all, /refresh, /email/verification/resend, /email/verify/validate, /email/verify, /password/forgot, /password/reset/validate, /password/reset, /select-factory, /factories, /me, /context, /active-workflow-template, /profile, /profile-photo, /session-summary, /change-password, /admin-only
D:\DPR APP\DPR.ai\backend\routers\auth_secure.py	PRODUCTION-GRADE AUTH (312 lines) - /auth-secure/register, /auth-secure/login, /auth-secure/logout, /auth-secure/me, /auth-secure/password/forgot, /auth-secure/password/reset, /auth-secure/mfa/setup, /auth-secure/mfa/verify, /auth-secure/mfa/disable
D:\DPR APP\DPR.ai\backend\routers\auth_google.py	GOOGLE OAUTH (292 lines) - /auth/google/login, /auth/google/callback
D:\DPR APP\DPR.ai\backend\routers\phone_auth.py	PHONE VERIFICATION (114 lines) - /auth/phone/start-verification, /auth/phone/confirm-verification
D:\DPR APP\DPR.ai\backend\routers\settings.py	USER MANAGEMENT (1537 lines) - /settings/users (list), /settings/users/invite, /settings/users/{id}/factory-access, /settings/users/{id}/role, /settings/users/{id}/plan, /settings/users/{id} (deactivate)
C. BACKEND AUTH / SECURITY SERVICES
File	Description
D:\DPR APP\DPR.ai\backend\security.py	JWT token creation/decode, get_current_user dependency, password hash/verify (bcrypt), password strength validation
D:\DPR APP\DPR.ai\backend\auth_cookies.py	Cookie set/get/clear for JWT access, refresh, CSRF; CSRF validation; wants_cookie_auth
D:\DPR APP\DPR.ai\backend\rbac.py	role_rank(), require_role(), require_any_role(), is_admin_or_owner(), is_manager_or_admin(), is_supervisor_or_higher()
D:\DPR APP\DPR.ai\backend\tenancy.py	resolve_org_id(), resolve_factory_id() for multi-tenant scoping
D:\DPR APP\DPR.ai\backend\auth_security\passwords.py	Argon2 password hash/verify, PasswordPolicy, validate_password_strength()
D:\DPR APP\DPR.ai\backend\auth_security\sessions.py	create_session(), revoke_session(), revoke_all_sessions(), get_current_session(), get_current_user(), require_csrf(), touch_session()
D:\DPR APP\DPR.ai\backend\auth_security\tokens.py	generate_token(), hash_token(), build_reset_token(), verify_reset_token()
D:\DPR APP\DPR.ai\backend\auth_security\mfa.py	TOTP secret generation, provisioning URI, verify_totp()
D:\DPR APP\DPR.ai\backend\auth_security\rate_limit.py	In-memory sliding window rate limiter
D:\DPR APP\DPR.ai\backend\middleware\security.py	CORS, HTTPS redirect, rate limiting, security headers (CSP, HSTS, etc.)
D:\DPR APP\DPR.ai\backend\middleware\csrf_cookie.py	CSRF enforcement middleware for cookie-based JWT auth
D:\DPR APP\DPR.ai\backend\middleware\rate_limit_middleware.py	Client IP extraction for rate limiting
D:\DPR APP\DPR.ai\backend\middleware\response_envelope.py	API response envelope middleware
D:\DPR APP\DPR.ai\backend\middleware\rate_limit.py	Rate limit utilities
D. BACKEND SERVICE LAYER
File	Description
D:\DPR APP\DPR.ai\backend\services\auth_service.py	get_or_create_google_user() - provisions Google OAuth users, orgs, factories
D:\DPR APP\DPR.ai\backend\services\registration_service.py	resolve_registration_context() - creates/finds org + factory for signup
D:\DPR APP\DPR.ai\backend\services\pending_registration_service.py	create_or_update_pending_registration(), verify_pending_registration_token()
D:\DPR APP\DPR.ai\backend\services\email_verification_service.py	create_verification_token(), verify_verification_token(), build_verification_link()
D:\DPR APP\DPR.ai\backend\services\password_reset_service.py	create_reset_token(), verify_reset_token(), build_reset_link()
D:\DPR APP\DPR.ai\backend\services\token_service.py	create_access_token_short(), issue_refresh_token()
D:\DPR APP\DPR.ai\backend\services\user_service.py	validate_factory_role_assignment() - ensures factory role <= global role
D:\DPR APP\DPR.ai\backend\services\user_code_service.py	next_user_code(), is_user_code_collision() - org-scoped numeric user codes
D:\DPR APP\DPR.ai\backend\services\otp_service.py	OTP generation, rate limiting, SMS/WhatsApp delivery, confirmation
D:\DPR APP\DPR.ai\backend\services\rate_limit_service.py	Redis/in-memory rate limiting for OTP send and verification flows
D:\DPR APP\DPR.ai\backend\services\sms_service.py	SMS provider abstraction
D:\DPR APP\DPR.ai\backend\services\whatsapp_sender.py	WhatsApp message sender
E. PYDANTIC SCHEMAS
File	Description
D:\DPR APP\DPR.ai\backend\schemas\auth.py	PermissionsSchema, AuthMeResponse
D:\DPR APP\DPR.ai\backend\schemas\phone_verification.py	Request/response schemas for phone OTP verification
F. FRONTEND PAGES ("app/" routes)
File	Workflow
D:\DPR APP\DPR.ai\web\src\app\login\page.tsx	LOGIN - email/password form, Google SSO, resend verification, error/info display, role-based routing
D:\DPR APP\DPR.ai\web\src\app\register\page.tsx	SIGNUP - multi-field form (name, email, password, factory, company code, phone), success state management, resend verification
D:\DPR APP\DPR.ai\web\src\app\forgot-password\page.tsx	FORGOT PASSWORD - thin wrapper rendering ForgotPasswordPage component
D:\DPR APP\DPR.ai\web\src\app\reset-password\page.tsx	RESET PASSWORD - Suspense wrapper rendering ResetPasswordPage
D:\DPR APP\DPR.ai\web\src\app\verify-email\page.tsx	VERIFY EMAIL - Suspense wrapper rendering VerifyEmailPage
D:\DPR APP\DPR.ai\web\src\app\profile\page.tsx	PROFILE - displays/edits user profile, change password, logout, logout-all, switch account, photo upload/crop
D:\DPR APP\DPR.ai\web\src\app\onboarding\factory-required\page.tsx	ONBOARDING - shown when user has no active factory access
D:\DPR APP\DPR.ai\web\src\app\access\page.tsx	ACCESS ENTRY - re-exports /login/page.tsx
D:\DPR APP\DPR.ai\web\src\app\403\page.tsx	FORBIDDEN - 403 error page
D:\DPR APP\DPR.ai\web\src\app\settings\users\page.tsx	SETTINGS USERS - redirects to /settings?tab=users
G. FRONTEND COMPONENTS
File	Description
D:\DPR APP\DPR.ai\web\src\components\auth-shell.tsx	Auth page layout wrapper (card, guardrail display, workflow map, animations)
D:\DPR APP\DPR.ai\web\src\components\auth-guard.tsx	RoleGuard component and withRoleGuard HOC for role-based rendering
D:\DPR APP\DPR.ai\web\src\components\forgot-password-page.tsx	Forgot password form with reset link display/copy, resend verification
D:\DPR APP\DPR.ai\web\src\components\reset-password-page.tsx	Token validation, new password form with strength meter, confirmation
D:\DPR APP\DPR.ai\web\src\components\verify-email-page.tsx	Token validation, verification confirmation button, activation for pending signup
D:\DPR APP\DPR.ai\web\src\components\profile-page.tsx	Full account management: profile edit, photo upload/crop, change password, logout, logout-all, switch account, session summary
D:\DPR APP\DPR.ai\web\src\components\google-auth-button.tsx	Google OAuth sign-in button with error handling
D:\DPR APP\DPR.ai\web\src\components\password-field.tsx	Reusable password input with show/hide toggle
D:\DPR APP\DPR.ai\web\src\components\password-strength-meter.tsx	Password strength visual indicator with rules checklist
D:\DPR APP\DPR.ai\web\src\components\settings-users-tab.tsx	User management tab: invite user, update roles, manage factory access, deactivate users
H. FRONTEND LIBRARIES (auth-related)
File	Description
D:\DPR APP\DPR.ai\web\src\lib\auth.ts	PRIMARY AUTH CLIENT - login(), register(), logout(), logoutAllDevices(), refresh(), requestPasswordReset(), resetPassword(), resendEmailVerification(), validateEmailVerificationToken(), verifyEmail(), validatePasswordResetToken(), getMe(), getAuthContext(), selectFactory(), getActiveWorkflowTemplate(), updateProfile(), uploadProfilePicture(), removeProfilePicture(), changePassword(), getSessionSummary(), startGoogleLogin(), warmBackendConnection(), recoverWorkspaceContextFromError(), type definitions for CurrentUser, AuthContext, FactoryAccess, etc.
D:\DPR APP\DPR.ai\web\src\lib\session-store.ts	SESSION STORE - React useSyncExternalStore-compatible store with sessionStorage persistence, primeSession(), clearSession(), invalidateSession(), ensureSessionLoaded(), hydrateSessionFromStorage()
D:\DPR APP\DPR.ai\web\src\lib\use-session.ts	SESSION HOOK - useSession() (React synced store), useAuth() (with permissions)
D:\DPR APP\DPR.ai\web\src\lib\api.ts	API CLIENT - apiFetch(), ApiError, formatApiErrorMessage(), response caching, CSRF header injection, cookie auth mode
D:\DPR APP\DPR.ai\web\src\lib\cookies.ts	getCookie() - client-side cookie reader
D:\DPR APP\DPR.ai\web\src\lib\access-reason.ts	resolveAccessReasonMessage() - maps URL ?reason= params (permissions_updated, session_expired, account_suspended) to user messages
D:\DPR APP\DPR.ai\web\src\lib\password-strength.ts	getPasswordStrength() - client-side password strength evaluation
D:\DPR APP\DPR.ai\web\src\lib\role-navigation.ts	getHomeDestination(), getRolePrimaryHrefs(), etc. - role-based route resolution
D:\DPR APP\DPR.ai\web\src\lib\validation.ts	Phone number validation
I. FRONTEND CONFIG
File	Description
D:\DPR APP\DPR.ai\web\src\config\featureFlags.ts	AUTH_ROUTE_PARAM_GUARDS flag for redirect on invalid auth tokens
J. FRONTEND MIDDLEWARE
File	Description
D:\DPR APP\DPR.ai\web\middleware.ts	Next.js middleware - handles auth routing at edge level
K. LOCALIZATION (auth translation files)
File	Language
D:\DPR APP\DPR.ai\web\src\locales\en\auth.json	English auth translations
D:\DPR APP\DPR.ai\web\src\locales\hi\auth.json	Hindi auth translations
D:\DPR APP\DPR.ai\web\src\locales\mr\auth.json	Marathi auth translations
D:\DPR APP\DPR.ai\web\src\locales\ta\auth.json	Tamil auth translations
D:\DPR APP\DPR.ai\web\src\locales\gu\auth.json	Gujarati auth translations
L. TEST FILES
Backend Auth Tests (tests/)

File	Description
D:\DPR APP\DPR.ai\tests\conftest.py	Test fixtures: backend server lifecycle, base_url, http_client
D:\DPR APP\DPR.ai\tests\utils.py	register_user() - test helper that creates user via registration flow, verifies email, creates JWT token
D:\DPR APP\DPR.ai\tests\test_auth_e2e.py	End-to-end auth flow tests
D:\DPR APP\DPR.ai\tests\test_auth_google.py	Google OAuth auth tests
D:\DPR APP\DPR.ai\tests\test_password_reset.py	Password reset flow tests
D:\DPR APP\DPR.ai\tests\auth\test_auth_me.py	/auth/me endpoint tests
D:\DPR APP\DPR.ai\tests\auth\test_factory_roles.py	Factory role assignment tests
D:\DPR APP\DPR.ai\tests\auth\test_privilege_escalation.py	Privilege escalation prevention tests
D:\DPR APP\DPR.ai\tests\auth\test_role_revision.py	Role revision change detection tests
D:\DPR APP\DPR.ai\tests\test_tenant_isolation.py	Multi-tenant data isolation tests
D:\DPR APP\DPR.ai\tests\test_feature_gating.py	Feature gating based on role/plan tests
D:\DPR APP\DPR.ai\tests\test_otp_service.py	OTP service tests
D:\DPR APP\DPR.ai\tests\test_phone_endpoints.py	Phone verification endpoint tests
D:\DPR APP\DPR.ai\tests\test_email_service.py	Email service tests
D:\DPR APP\DPR.ai\tests\test_rate_limiting.py	Rate limiting tests (includes auth rate limits)
D:\DPR APP\DPR.ai\tests\test_input_validation.py	Input validation tests
D:\DPR APP\DPR.ai\tests\test_profile.py	Profile update tests
D:\DPR APP\DPR.ai\tests\security\	Security-related tests
D:\DPR APP\DPR.ai\scripts\test_auth_email.py	Auth email sending test script
M. SCRIPT FILES
File	Description
D:\DPR APP\DPR.ai\backend\scripts\set_platform_admin.py	CLI script to set a user as platform admin
4. WORKFLOW-TO-FILE MAPPING SUMMARY
Workflow	Backend Routes	Backend Services	Frontend Page	Frontend Component	Frontend Lib
Signup	auth.py: register_user()	pending_registration_service.py, registration_service.py, email_verification_service.py	/register/page.tsx	auth-shell.tsx	auth.ts: register()
Login	auth.py: login_user() (deprecated -> v2/login), auth_secure.py: login()	security.py: get_current_user()	/login/page.tsx	google-auth-button.tsx	auth.ts: login()
Logout	auth.py: logout_user(), logout_all_devices()	auth_cookies.py: clear_auth_cookies()	/profile/page.tsx	profile-page.tsx	auth.ts: logout(), logoutAllDevices()
Password Reset	auth.py: password_forgot(), password_reset()	password_reset_service.py	/forgot-password/page.tsx, /reset-password/page.tsx	forgot-password-page.tsx, reset-password-page.tsx	auth.ts: requestPasswordReset(), resetPassword()
Email Verification	auth.py: verify_email_address(), validate_email_verification_token(), resend_email_verification()	email_verification_service.py, pending_registration_service.py	/verify-email/page.tsx	verify-email-page.tsx	auth.ts: verifyEmail(), validateEmailVerificationToken(), resendEmailVerification()
Company Creation	auth.py: register_user(), registration_service.py: resolve_registration_context()	registration_service.py, auth_service.py: get_or_create_google_user()	/register/page.tsx	(form in register page)	auth.ts: register()
Company Switching	auth.py: select_factory()	auth.py: _build_auth_context(), _get_factory_access()	/profile/page.tsx	profile-page.tsx	auth.ts: selectFactory()
User Invitation	settings.py: invite_user()	email_verification_service.py, password_reset_service.py	/settings/users/page.tsx	settings-users-tab.tsx	(via settings API)
Team Onboarding	settings.py: invite_user() (includes user creation + factory role)	user_service.py: validate_factory_role_assignment()	N/A (invite by admin)	settings-users-tab.tsx	N/A
Google OAuth	auth_google.py: google_login(), google_callback()	auth_service.py: get_or_create_google_user()	/login/page.tsx	google-auth-button.tsx	auth.ts: startGoogleLogin()
Phone Verification	phone_auth.py	otp_service.py, sms_service.py	N/A (in profile/settings)	N/A	N/A
MFA	auth_secure.py: mfa_setup(), mfa_verify(), mfa_disable()	auth_security/mfa.py, auth_security/sessions.py	N/A	N/A	auth_secure.py only
5. TOTAL FILE COUNT
Database Models: 15 files
Alembic Migrations: ~38 files (all listed above are auth-relevant)
Backend API Routers: 5 files
Backend Auth/Security Core: 12 files
Backend Services: 12 files
Pydantic Schemas: 2 files
Backend Middleware: 4 files
Backend Dependencies: 2 files
Frontend Pages (routes): 10 page files
Frontend Components: 10 components
Frontend Libraries: 9 lib files
Frontend Config: 1 file
Frontend Locales: 5 locale files
Test Files: 18 test files
Scripts: 1 admin script + 1 test script
Misc: conftest.py, utils.py
Grand total: ~145 auth-related files across the entire codebase.