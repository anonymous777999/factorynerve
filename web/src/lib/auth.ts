import { API_BASE_URL, apiFetch, ApiError, invalidateApiCache } from "@/lib/api";
import { clearSession, primeSession } from "@/lib/session-store";
import type { WorkflowTemplateSummary } from "@/lib/settings";

export type CurrentUser = {
  id: number;
  user_code: number;
  email: string;
  role: string;
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
const BACKEND_WAKE_TIMEOUT_MS = 12_000;
const BACKEND_WAKE_INTERVAL_MS = 1_000;
const BACKEND_WAKE_REQUEST_TIMEOUT_MS = 2_500;

let backendWarmPromise: Promise<boolean> | null = null;

type WakeRetryOptions = {
  retryMessage: string;
};

function refreshAccountSession(payload: CurrentUser) {
  invalidateApiCache("session:me");
  invalidateApiCache("session:context");
  primeSession(payload);
  return payload;
}

function sanitizeNextPath(raw?: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  if (raw === "/login" || raw === "/register") {
    return "/";
  }
  return raw;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createWakeTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    clear() {
      window.clearTimeout(timeoutId);
    },
  };
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
      const wakeRequest = createWakeTimeoutController(BACKEND_WAKE_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${API_BASE_URL}/observability/ready`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: wakeRequest.controller.signal,
        });
        wakeRequest.clear();

        if (response.ok) {
          return true;
        }

        const renderRouting = response.headers.get("x-render-routing") || "";
        const shouldKeepWaiting =
          (response.status === 503 && renderRouting.includes("hibernate-wake"))
          || response.status === 502
          || response.status === 503
          || response.status === 504;
        if (!shouldKeepWaiting) {
          return false;
        }
      } catch (error) {
        wakeRequest.clear();
        if (!(error instanceof DOMException) || error.name !== "AbortError") {
          // Retry while the service wakes up or the network settles.
        }
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
      "Waking backend... Retry Google sign-in.",
      503,
    );
  }

  const safeNext = sanitizeNextPath(nextPath);
  window.location.assign(`/api/auth/google/login?next=${encodeURIComponent(safeNext)}`);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const performLogin = async () => {
    const response = await apiFetch<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: { email, password },
      },
      { cookieAuth: true },
    );
    primeSession(response);
    return response;
  };

  return withBackendWakeRetry(performLogin, {
    retryMessage: "Waking backend... Retry sign in.",
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
    () => apiFetch("/auth/logout", { method: "POST" }),
    {
      retryMessage: "Waking backend... Retry sign out.",
    },
  );
  clearSession();
}

export async function logoutAllDevices(): Promise<{ message: string }> {
  const response = await apiFetch<{ message: string }>("/auth/logout-all", { method: "POST" });
  clearSession();
  return response;
}

export async function refresh(): Promise<AuthResponse> {
  const response = await withBackendWakeRetry(
    () => apiFetch<AuthResponse>("/auth/refresh", { method: "POST" }, { cookieAuth: true }),
    {
      retryMessage: "Waking backend... Retry session refresh.",
    },
  );
  primeSession(response);
  return response;
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
  return refreshAccountSession(response);
}

export async function uploadProfilePicture(file: File): Promise<CurrentUser> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await apiFetch<CurrentUser>("/auth/profile-photo", {
    method: "POST",
    body: formData,
  });
  return refreshAccountSession(response);
}

export async function removeProfilePicture(): Promise<CurrentUser> {
  const response = await apiFetch<CurrentUser>("/auth/profile-photo", {
    method: "DELETE",
  });
  return refreshAccountSession(response);
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
    () =>
      apiFetch<CurrentUser>(
        "/auth/me",
        { signal: options?.signal },
        { timeoutMs: options?.timeoutMs ?? 8000, cacheTtlMs: 30_000, cacheKey: "session:me" },
      ),
    {
      retryMessage: "Reloading session...",
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
  return withBackendWakeRetry(
    () =>
      apiFetch<AuthContext>(
        "/auth/context",
        { signal: options?.signal },
        { timeoutMs: options?.timeoutMs ?? 8000, cacheTtlMs: 30_000, cacheKey: "session:context" },
      ),
    {
      retryMessage: "Reloading workspace...",
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
      retryMessage: "Reloading factory context...",
    },
  );
  primeSession(response);
  return response;
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
      retryMessage: "Reloading workflow context...",
    },
  );
}
