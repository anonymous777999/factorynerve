import {
  API_BASE_URL,
  ApiError,
  apiFetch,
  invalidateApiCache,
  primeRoleRevision,
  registerRoleRevisionMismatchHandler,
} from "@/lib/api";
import { pushAppToast } from "@/lib/toast";
import {
  clearSession,
  getSessionSnapshot,
  invalidateSession,
  primeSession,
} from "@/lib/session-store";
import type { WorkflowTemplateSummary } from "@/lib/settings";

export interface Permissions {
  can_view_billing: boolean;
  can_manage_users: boolean;
  can_view_analytics: boolean;
  can_approve_entries: boolean;
  can_export_data: boolean;
  can_manage_billing: boolean;
  can_view_admin_panel: boolean;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  can_view_billing: false,
  can_manage_users: false,
  can_view_analytics: false,
  can_approve_entries: false,
  can_export_data: false,
  can_manage_billing: false,
  can_view_admin_panel: false,
};

export type CurrentUser = {
  id: number;
  user_code: number;
  email: string;
  role: string;
  permissions: Permissions;
  role_revision: number;
  is_platform_admin: boolean;
  name: string;
  profile_picture?: string | null;
  factory_name: string;
  factory_code?: string | null;
  phone_number?: string | null;
  org_id: string;
  is_active: boolean;
  email_verified_at?: string | null;
  verification_sent_at?: string | null;
  created_at: string;
  last_login?: string | null;
};

export type FactoryAccess = {
  factory_id: string;
  name: string;
  role: string;
  factory_code?: string | null;
  industry_type?: string;
  industry_label?: string;
  workflow_template_key?: string | null;
  workflow_template_label?: string | null;
  location?: string | null;
  timezone?: string | null;
};

export type OrganizationContext = {
  org_id: string;
  name: string;
  plan: string;
  total_factories: number;
  accessible_factories: number;
};

export type AuthContext = {
  user: CurrentUser;
  active_factory_id?: string | null;
  active_factory?: FactoryAccess | null;
  factories?: FactoryAccess[];
  organization?: OrganizationContext | null;
};

export type ActiveWorkflowTemplateContext = {
  factory_id?: string | null;
  factory_name?: string | null;
  factory_code?: string | null;
  industry_type: string;
  industry_label: string;
  workflow_template_key: string;
  workflow_template_label: string;
  starter_modules: string[];
  template: WorkflowTemplateSummary;
};

type AuthResponse = AuthContext & {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
};

export type RegisterResponse = {
  message: string;
  email: string;
  pending_factory_name: string;
  verification_required: boolean;
  verification_link?: string | null;
  delivery_mode?: string;
};

export type PasswordForgotResponse = {
  message: string;
  reset_link?: string | null;
  delivery_mode?: string;
};

export type EmailVerificationResponse = {
  message: string;
  verification_link?: string | null;
  delivery_mode?: string;
};

export type EmailVerificationValidateResponse = {
  valid: boolean;
  message: string;
  email?: string | null;
};

export type PasswordResetValidateResponse = {
  valid: boolean;
  message: string;
};

export type SessionSummary = {
  active_devices: number;
  last_activity?: string | null;
};

const AUTH_EMAIL_TIMEOUT_MS = 30_000;
const BACKEND_WAKE_TIMEOUT_MS = 25_000;
const BACKEND_WAKE_INTERVAL_MS = 3_000;

let backendWarmPromise: Promise<boolean> | null = null;
type WakeRetryOptions = {
  retryMessage: string;
};

export type WorkspaceRecoveryPlan =
  | { action: "switch"; factoryId: string; factoryName: string }
  | { action: "redirect"; href: "/onboarding/factory-required" }
  | { action: "ignore" };

function sanitizeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  if (raw === "/login" || raw === "/access" || raw === "/register") {
    return "/";
  }
  return raw;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function warmBackendConnection(force = false): Promise<boolean> {
  if (typeof window === "undefined") {
    return true;
  }

  if (!force && backendWarmPromise) {
    return backendWarmPromise;
  }

  const task = (async () => {
    const deadline = Date.now() + BACKEND_WAKE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${API_BASE_URL}/observability/ready`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (response.ok) {
          return true;
        }

        const renderRouting = response.headers.get("x-render-routing") || "";
        if (response.status !== 503 || !renderRouting.includes("hibernate-wake")) {
          return false;
        }
      } catch {
        // Retry a few times while the service wakes up.
      }

      await delay(BACKEND_WAKE_INTERVAL_MS);
    }

    return false;
  })();

  backendWarmPromise = task.finally(() => {
    backendWarmPromise = null;
  });

  return backendWarmPromise;
}

async function withBackendWakeRetry<T>(
  operation: () => Promise<T>,
  options: WakeRetryOptions,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      const woke = await warmBackendConnection(true);
      if (woke) {
        return operation();
      }
      throw new ApiError(options.retryMessage, 503, error.detail);
    }
    throw error;
  }
}

export async function startGoogleLogin(nextPath?: string | null): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const woke = await warmBackendConnection();
  if (!woke) {
    throw new ApiError(
      "DPR.ai is waking up. Please try Google sign-in again in a few seconds.",
      503,
    );
  }

  const safeNext = sanitizeNextPath(nextPath);
  window.location.assign(`/api/auth/google/login?next=${encodeURIComponent(safeNext)}`);
}

function refreshAccountSession(payload: CurrentUser) {
  invalidateApiCache("session:me");
  invalidateApiCache("session:context");
  primeRoleRevision(payload.role_revision);
  primeSession(payload);
  return payload;
}

async function refreshSessionContext(options?: { timeoutMs?: number }) {
  invalidateAuthCache();
  invalidateSession();
  const refreshedContext = await getAuthContext({ timeoutMs: options?.timeoutMs ?? 8000 });
  primeRoleRevision(refreshedContext.user.role_revision);
  primeSession(refreshedContext);
  return refreshedContext;
}

export function invalidateAuthCache() {
  invalidateApiCache("session:");
  invalidateSession();
}

registerRoleRevisionMismatchHandler(async () => {
  try {
    await refreshSessionContext({ timeoutMs: 8000 });
  } catch {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/access") {
      window.location.assign("/access?reason=permissions_updated");
    }
  }
});

function mergeCurrentUserWithPermissions(user: CurrentUser): CurrentUser {
  return {
    ...user,
    permissions: user.permissions ?? DEFAULT_PERMISSIONS,
  };
}

function mergeAuthContextWithUserPermissions(context: AuthContext, user: CurrentUser): AuthContext {
  return {
    ...context,
    user: mergeCurrentUserWithPermissions({
      ...context.user,
      ...user,
      permissions: user.permissions,
    }),
  };
}

export async function recoverWorkspaceContextFromError(status: number): Promise<AuthContext | null> {
  const snapshot = getSessionSnapshot();

  // Store diagnostic info in sessionStorage so it survives the page navigation
  // to /onboarding/factory-required. The factory-required page reads this to
  // display debug info.
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        "dpr:redirect-diagnostic",
        JSON.stringify({
          status,
          timestamp: new Date().toISOString(),
          factories: snapshot.factories,
          activeFactoryId: snapshot.activeFactoryId,
          userEmail: snapshot.user?.email,
          userName: snapshot.user?.name,
        }),
      );
    } catch {
      // sessionStorage may be unavailable
    }
  }

  const recoveryPlan = resolveWorkspaceRecoveryPlan(
    {
      activeFactoryId: snapshot.activeFactoryId,
      factories: snapshot.factories,
    },
    status,
  );

  if (recoveryPlan.action === "ignore") {
    return null;
  }

  if (recoveryPlan.action === "switch") {
    const refreshedContext = await selectFactory(recoveryPlan.factoryId);
    primeSession(refreshedContext);
    pushAppToast({
      title: "Workspace updated",
      description: `Active workspace changed to ${recoveryPlan.factoryName}`,
      tone: "info",
    });
    return refreshedContext;
  }

  primeSession({
    ...(snapshot.user ? { user: snapshot.user } : {}),
    active_factory_id: null,
    active_factory: null,
    factories: [],
    organization: snapshot.organization,
  } as AuthContext);
  if (typeof window !== "undefined") {
    window.location.assign("/onboarding/factory-required");
  }
  return null;
}

export function resolveWorkspaceRecoveryPlan(
  snapshot: {
    activeFactoryId: string | null;
    factories: FactoryAccess[];
  },
  status: number,
): WorkspaceRecoveryPlan {
  if (status !== 403 && status !== 404) {
    return { action: "ignore" };
  }

  const nextFactories = snapshot.factories.filter(
    (factory) => factory.factory_id && factory.factory_id !== snapshot.activeFactoryId,
  );

  if (nextFactories.length > 0) {
    return {
      action: "switch",
      factoryId: nextFactories[0].factory_id,
      factoryName: nextFactories[0].name,
    };
  }

  return { action: "redirect", href: "/onboarding/factory-required" };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const performLogin = async () => {
    // /auth/v2/login uses cookie-based sessions — the response is just a
    // success message, not user data. Fetch the full context afterward.
    await apiFetch(
      "/auth/v2/login",
      {
        method: "POST",
        body: { email, password },
      },
      { cookieAuth: true },
    );

    // Fetch context directly (not via getAuthContext) to avoid the
    // recovery-redirect logic that navigates to /onboarding/factory-required
    // on 403/404. During login, any error should surface on the login form
    // as a clear message, not as a silent redirect to a dead page.
    let context = null as AuthContext | null;
    try {
      // Single retry for transient errors (e.g., cookie propagation delay)
      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const fetched = await apiFetch<AuthContext>(
            "/auth/v2/context",
            {},
            { cacheKey: "session:context", timeoutMs: 8000 },
          );
          const user = await getMe();
          context = mergeAuthContextWithUserPermissions(fetched, user);
          break;
        } catch (fetchError) {
          if (attempt === 0 && fetchError instanceof ApiError && (fetchError.status === 403 || fetchError.status === 404)) {
            await delay(500);
            continue;
          }
          throw fetchError;
        }
      }
    } catch (error) {
      // Clear any stale session data and surface the error so the login
      // form shows a meaningful message instead of redirecting away.
      clearSession();
      throw error;
    }

    // context is guaranteed non-null here — the loop always assigns it or throws
    const resolvedContext = context!;

    primeRoleRevision(resolvedContext.user.role_revision);
    primeSession(resolvedContext);
    return {
      ...resolvedContext,
      access_token: "",
      token_type: "cookie",
    } as AuthResponse;
  };

  return withBackendWakeRetry(performLogin, {
    retryMessage: "DPR.ai is waking up. Please try signing in again in a few seconds.",
  });
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  role: string;
  factory_name: string;
  company_code?: string | null;
  phone_number?: string | null;
}): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: payload,
    },
    { useCookies: false, timeoutMs: AUTH_EMAIL_TIMEOUT_MS },
  );
}

export async function logout(): Promise<void> {
  await withBackendWakeRetry(
    () => apiFetch("/auth/v2/logout", { method: "POST" }, { cookieAuth: true }),
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds before signing out again.",
    },
  );
  clearSession();
}

export async function logoutAllDevices(): Promise<{ message: string }> {
  const response = await apiFetch<{ message: string }>(
    "/auth/v2/logout-all",
    { method: "POST" },
    { cookieAuth: true },
  );
  clearSession();
  return response;
}

export async function refresh(): Promise<AuthResponse> {
  const response = await withBackendWakeRetry(
    () => apiFetch<AuthResponse>("/auth/refresh", { method: "POST" }, { cookieAuth: true }),
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds and refresh your session again.",
    },
  );
  primeRoleRevision(response.user.role_revision);
  const currentUser = await getMe();
  const mergedResponse = {
    ...response,
    user: mergeCurrentUserWithPermissions({
      ...response.user,
      ...currentUser,
      permissions: currentUser.permissions,
    }),
  };
  primeSession(mergedResponse);
  return mergedResponse;
}

export async function requestPasswordReset(email: string): Promise<PasswordForgotResponse> {
  return apiFetch<PasswordForgotResponse>(
    "/auth/password/forgot",
    {
      method: "POST",
      body: { email },
    },
    { useCookies: false, timeoutMs: AUTH_EMAIL_TIMEOUT_MS },
  );
}

export async function resendEmailVerification(email: string): Promise<EmailVerificationResponse> {
  return apiFetch<EmailVerificationResponse>(
    "/auth/email/verification/resend",
    {
      method: "POST",
      body: { email },
    },
    { useCookies: false, timeoutMs: AUTH_EMAIL_TIMEOUT_MS },
  );
}

export async function validateEmailVerificationToken(
  token: string,
): Promise<EmailVerificationValidateResponse> {
  return apiFetch<EmailVerificationValidateResponse>(
    `/auth/email/verify/validate?token=${encodeURIComponent(token)}`,
    {},
    { useCookies: false },
  );
}

export async function verifyEmail(token: string): Promise<EmailVerificationResponse> {
  return apiFetch<EmailVerificationResponse>(
    "/auth/email/verify",
    {
      method: "POST",
      body: { token },
    },
    { useCookies: false },
  );
}

export async function validatePasswordResetToken(token: string): Promise<PasswordResetValidateResponse> {
  return apiFetch<PasswordResetValidateResponse>(
    `/auth/password/reset/validate?token=${encodeURIComponent(token)}`,
    {},
    { useCookies: false },
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    "/auth/password/reset",
    {
      method: "POST",
      body: { token, new_password: newPassword },
    },
    { useCookies: false },
  );
}

export async function updateProfile(payload: {
  name?: string;
  phone_number?: string | null;
}): Promise<CurrentUser> {
  const response = await apiFetch<CurrentUser>("/auth/profile", {
    method: "PUT",
    body: payload,
  });
  return refreshAccountSession(mergeCurrentUserWithPermissions(response));
}

export async function uploadProfilePicture(file: File): Promise<CurrentUser> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await apiFetch<CurrentUser>("/auth/profile-photo", {
    method: "POST",
    body: formData,
  });
  return refreshAccountSession(mergeCurrentUserWithPermissions(response));
}

export async function removeProfilePicture(): Promise<CurrentUser> {
  const response = await apiFetch<CurrentUser>("/auth/profile-photo", {
    method: "DELETE",
  });
  return refreshAccountSession(mergeCurrentUserWithPermissions(response));
}

export async function changePassword(payload: {
  old_password: string;
  new_password: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: payload,
  });
}

export async function getMe(options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<CurrentUser> {
  return withBackendWakeRetry(
    async () =>
      mergeCurrentUserWithPermissions(
        await apiFetch<CurrentUser>(
        "/auth/v2/me",
        { signal: options?.signal },
        { timeoutMs: options?.timeoutMs ?? 8000, cacheTtlMs: 30_000, cacheKey: "session:me" },
        ),
      ),
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds while your session reloads.",
    },
  );
}

export async function getSessionSummary(): Promise<SessionSummary> {
  return apiFetch<SessionSummary>("/auth/session-summary", {}, { cacheTtlMs: 10_000 });
}

export async function getAuthContext(options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<AuthContext> {
  const MAX_RETRIES = 1;
  const RETRY_DELAY_MS = 500;

  return withBackendWakeRetry(
    async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const context = await apiFetch<AuthContext>(
            "/auth/v2/context",
            { signal: options?.signal },
            { timeoutMs: options?.timeoutMs ?? 8000, cacheTtlMs: 30_000, cacheKey: "session:context" },
          );
          const user = await getMe(options);
          return mergeAuthContextWithUserPermissions(context, user);
        } catch (error) {
          const isAuthError = error instanceof ApiError && (error.status === 403 || error.status === 404);
          if (isAuthError && attempt < MAX_RETRIES) {
            // Brief delay to allow the session cookie from login to fully propagate
            // before retrying the context fetch.
            await delay(RETRY_DELAY_MS);
            continue;
          }
          if (isAuthError) {
            const recovered = await recoverWorkspaceContextFromError(error.status);
            if (recovered) {
              return recovered;
            }
          }
          throw error;
        }
      }
      // This line is unreachable — the loop always returns or throws.
      throw new Error("Unreachable");
    },
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds while your workspace reloads.",
    },
  );
}

export async function selectFactory(factoryId: string): Promise<AuthResponse> {
  const response = await withBackendWakeRetry(
    () =>
      apiFetch<AuthResponse>(
        "/auth/select-factory",
        {
          method: "POST",
          body: { factory_id: factoryId },
        },
        { cookieAuth: true },
      ),
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds before switching factory context again.",
    },
  );
  primeRoleRevision(response.user.role_revision);
  const currentUser = await getMe();
  const mergedResponse = {
    ...response,
    user: mergeCurrentUserWithPermissions({
      ...response.user,
      ...currentUser,
      permissions: currentUser.permissions,
    }),
  };
  primeSession(mergedResponse);
  return mergedResponse;
}

export async function getActiveWorkflowTemplate(): Promise<ActiveWorkflowTemplateContext> {
  return withBackendWakeRetry(
    () =>
      apiFetch<ActiveWorkflowTemplateContext>(
        "/auth/active-workflow-template",
        {},
        { cacheTtlMs: 30_000, cacheKey: "session:active-template" },
      ),
    {
      retryMessage: "DPR.ai is waking up. Please wait a few seconds while the workflow context reloads.",
    },
  );
}
