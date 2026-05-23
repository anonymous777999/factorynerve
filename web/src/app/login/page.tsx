"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { login, resendEmailVerification, startGoogleLogin, warmBackendConnection } from "@/lib/auth";
import { resolveAccessReasonMessage } from "@/lib/access-reason";
import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getHomeDestination } from "@/lib/role-navigation";
import { LoginOne } from "@/components/ui/login-1";

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

export default function LoginPage() {
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
    ? { message: info, tone: infoTone === "success" ? "success" : "neutral" as const }
    : error
      ? { message: error, tone: "error" as const }
      : routeInfo;

  return (
    <LoginOne
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      onGoogleLogin={() => void onGoogleLogin()}
      onTogglePassword={() => setShowPassword((current) => !current)}
      loading={loading}
      googleLoading={googleLoading}
      showPassword={showPassword}
      statusMessage={surfaceStatus?.message}
      statusTone={surfaceStatus?.tone}
      canResendVerification={canResendVerification}
      onResendVerification={() => void onResendVerification()}
      resendingVerification={resending}
      title={t("auth.login.title", "System Access")}
      subtitle={t(
        "auth.login.description",
        "Sign in with a verified inbox and land in the right desk without losing factory context.",
      )}
      redirectHint={
        hasRedirectTarget
          ? t("auth.login.guardrail.redirect_title", "Open {{destination}}", { destination: nextDestination })
          : null
      }
    />
  );
}
