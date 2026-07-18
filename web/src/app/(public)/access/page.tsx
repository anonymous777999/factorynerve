"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Zap, Lock } from "lucide-react";

import { login, resendEmailVerification, startGoogleLogin, warmBackendConnection } from "@/lib/auth";
import { resolveAccessReasonMessage } from "@/lib/access-reason";
import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getHomeDestination } from "@/lib/role-navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function destinationLabel(path: string, t: (key: string, fallback?: string) => string) {
  switch (path) {
    case "/attendance":
      return t("auth.login.destination.attendance", "attendance desk");
    case "/dashboard":
      return t("auth.login.destination.dashboard", "operations board");
    case "/approvals":
      return t("auth.login.destination.approvals", "review queue");
    case "/reports":
      return t("auth.login.destination.reports", "reports desk");
    case "/settings":
      return t("auth.login.destination.settings", "admin desk");
    case "/control-tower":
      return t("auth.login.destination.control_tower", "factory network");
    case "/premium/dashboard":
      return t("auth.login.destination.owner", "owner desk");
    default:
      return t("auth.login.destination.workspace", "workspace");
  }
}

function ShieldSm() {
  return <ShieldCheck className="h-4 w-4" />;
}

function ZapSm() {
  return <Zap className="h-4 w-4" />;
}

function LockSm() {
  return <Lock className="h-4 w-4" />;
}

export default function AccessPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "common", "errors", "notifications"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [infoTone, setInfoTone] = useState<"neutral" | "success">("neutral");
  const [resending, setResending] = useState(false);

  const routeInfo = useMemo(() => {
    const accessReason = resolveAccessReasonMessage(searchParams.get("reason"), t);
    if (accessReason) {
      return accessReason;
    }
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      return {
        message: oauthError,
        tone: "error" as const,
      };
    }
    if (searchParams.get("reset") === "1") {
      return {
        message: t("auth.login.reset_success", "Password updated. Sign in with your new password."),
        tone: "success" as const,
      };
    }
    if (searchParams.get("verified") === "1") {
      return {
        message: t("auth.login.verified_success", "Email verified. Access is ready."),
        tone: "success" as const,
      };
    }
    return null;
  }, [searchParams, t]);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return "/";
    }
    if (raw === "/login" || raw === "/access" || raw === "/register") {
      return "/";
    }
    return raw;
  }, [searchParams]);

  const nextDestination = useMemo(() => destinationLabel(nextPath, t), [nextPath, t]);
  const hasRedirectTarget = nextPath !== "/";

  useEffect(() => {
    void warmBackendConnection();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    setInfoTone("neutral");

    try {
      const authContext = await login(email, password);
      const roleHome = getHomeDestination(
        authContext.user.role,
        authContext.organization?.accessible_factories ?? authContext.factories?.length ?? 0,
      );
      router.replace(nextPath === "/" ? roleHome : nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 503
            ? t("auth.login.backend_waking", "Backend wake-up in progress. Hold for a few seconds, then try again.")
            : err.message,
        );
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError(t("errors.network", "Backend not reachable. Check API base URL and backend status."));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.login.failed", "Sign-in failed."));
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setInfo("");
    setInfoTone("neutral");
    try {
      await startGoogleLogin(nextPath);
    } catch (err) {
      setError(formatApiErrorMessage(err, t("auth.login.oauth_error", "Could not open Google access right now.")));
      setGoogleLoading(false);
    }
  };

  const canResendVerification = error.toLowerCase().includes("verify your email");

  const onResendVerification = async () => {
    if (!email) {
      setInfo(t("auth.login.resend_requires_email", "Enter the same email first, then resend verification."));
      setInfoTone("neutral");
      return;
    }
    setResending(true);
    setInfo("");
    setInfoTone("neutral");
    try {
      const result = await resendEmailVerification(email);
      setInfo(result.message);
      setInfoTone("success");
    } catch (err) {
      if (err instanceof ApiError) {
        setInfo(err.message);
      } else if (err instanceof Error) {
        setInfo(err.message);
      } else {
        setInfo(t("auth.login.resend_failed", "Could not resend the verification email."));
      }
      setInfoTone("neutral");
    } finally {
      setResending(false);
    }
  };

  const surfaceStatus: { message: string; tone: "neutral" | "success" | "error" } | null = info
    ? { message: info, tone: infoTone === "success" ? "success" : "neutral" }
    : error
      ? { message: error, tone: "error" }
      : routeInfo;

  const brand = {
    appInitial: "F",
    appName: "Factory Nerve",
    useFnLogo: true,
    eyebrow: t("auth.login.eyebrow", "Factory-first operating system"),
    title: t("auth.login.title", "System Access"),
    description: t(
      "auth.login.description",
      "Sign in with a verified inbox and land in the right desk without losing factory context.",
    ),
    trustPoints: [
      {
        icon: <ShieldSm />,
        text: t("auth.login.trust_security", "Verified inbox + cookie-protected sessions"),
      },
      {
        icon: <ZapSm />,
        text: t("auth.login.trust_routing", "Role-based routing to the right desk in one step"),
      },
      {
        icon: <LockSm />,
        text: t("auth.login.trust_isolation", "Tenant isolation across every factory workspace"),
      },
    ],
  };

  return (
    <AuthShell
      variant="split"
      brand={brand}
      badge={t("auth.login.badge", "System Access")}
      title={t("auth.login.form_title", "Sign in")}
      description={
        hasRedirectTarget
          ? t("auth.login.description_redirect", "After signing in, continue to {{destination}}.", {
              destination: nextDestination,
            })
          : t("auth.login.description_default", "Enter your credentials to access the factory workspace.")
      }
    >
      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        onClick={() => void onGoogleLogin()}
        disabled={googleLoading}
        className="w-full"
      >
        {googleLoading
          ? t("auth.login.google_loading", "Connecting...")
          : t("auth.login.google", "Continue with Google")}
      </Button>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        {t("auth.login.divider_or", "or")}
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>          <div>
            <label htmlFor="login-email" className="text-sm font-semibold uppercase tracking-label text-[#c56d2d]">
              {t("auth.login.email_label", "Email address")}
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("auth.login.email_placeholder", "operator@factory.ai")}
              required
              className="auth-input mt-3"
            />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="login-password" className="text-sm font-semibold uppercase tracking-label text-[#d7dde8]">
              {t("auth.login.password_label", "Access password")}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-slate-400 transition hover:text-[var(--accent)]"
            >
              {t("auth.login.reset_password", "Forgot password?")}
            </Link>
          </div>
          <div className="relative mt-3">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="........"
              required
              className="auth-input mt-0 pr-24"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold uppercase tracking-[0.12em] text-[#c56d2d] transition hover:text-white"
            >
              {showPassword ? t("auth.login.hide_password", "Hide") : t("auth.login.show_password", "Show")}
            </button>
          </div>
        </div>

        {surfaceStatus ? (
          <div
            role={surfaceStatus.tone === "error" ? "alert" : "status"}
            className={`rounded-[1.3rem] px-4 py-4 text-sm leading-6 shadow-[0_12px_30px_rgba(2,6,23,0.18)] ${
              surfaceStatus.tone === "success"
                ? "border border-emerald-400/22 bg-[linear-gradient(180deg,rgba(14,43,36,0.92),rgba(10,27,24,0.98))] text-emerald-100"
                : surfaceStatus.tone === "error"
                  ? "border border-amber-400/28 bg-[linear-gradient(180deg,rgba(58,34,20,0.92),rgba(37,24,18,0.98))] text-amber-100"
                  : "border border-white/10 bg-[linear-gradient(180deg,rgba(25,31,42,0.88),rgba(17,22,31,0.96))] text-slate-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="flex-1">{surfaceStatus.message}</span>
            </div>
            {canResendVerification ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResendVerification}
                  disabled={resending}
                  className="rounded-lg border-amber-300/25 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-caption text-amber-100 hover:bg-amber-300/12"
                >
                  {resending
                    ? t("auth.login.resending", "Sending...")
                    : t("auth.login.resend", "Resend verification")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" disabled={loading} className="auth-button-primary tracking-header w-full">
          {loading ? t("auth.login.submitting", "Authorizing...") : t("auth.login.submit", "Sign in")}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-400">
        {t("auth.login.create_account_prompt", "New to DPR.ai?")}{" "}
        <Link href="/register" className="font-semibold text-[#c56d2d] transition hover:text-white">
          {t("auth.login.create_account", "Create an account")}
        </Link>
      </div>
    </AuthShell>
  );
}
