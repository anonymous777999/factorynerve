"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { login, resendEmailVerification, startGoogleLogin, warmBackendConnection } from "@/lib/auth";
import { resolveAccessReasonMessage } from "@/lib/access-reason";
import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getHomeDestination } from "@/lib/role-navigation";
import { Button } from "@/components/ui/button";
import { GuidanceBlock } from "@/components/ui/guidance-block";
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

function badgeToneClasses(tone: "neutral" | "success" | "error") {
  switch (tone) {
    case "success":
      return "border-[0.5px] border-status-success-border bg-status-success-bg text-status-success-fg";
    case "error":
      return "border-[0.5px] border-status-warning-border bg-status-warning-bg text-status-warning-fg";
    default:
      return "border-[0.5px] border-border-default bg-surface-shell text-text-secondary";
  }
}

function panelToneClasses(tone: "neutral" | "success" | "error") {
  switch (tone) {
    case "success":
      return "border-[0.5px] border-status-success-border bg-status-success-bg text-status-success-fg";
    case "error":
      return "border-[0.5px] border-status-warning-border bg-status-warning-bg text-status-warning-fg";
    default:
      return "border-[0.5px] border-border-default bg-surface-panel text-text-primary";
  }
}

function WorkflowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 18h16" />
      <path d="M6 18V7l3 3 3-6 4 5 2-2 0 11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 4h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThermalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12v4" strokeLinecap="round" />
      <path d="M10 8h4" strokeLinecap="round" />
    </svg>
  );
}

function DialIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6 15a6 6 0 1 1 12 0" strokeLinecap="round" />
      <path d="M12 12l4-3" strokeLinecap="round" />
      <path d="M12 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 3 3.7 18.5a1 1 0 0 0 .88 1.5h14.84a1 1 0 0 0 .88-1.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v4.5" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

type GuardrailCardProps = {
  eyebrow: string;
  title: string;
  tone: "ok" | "warn";
  icon: React.ReactNode;
};

function GuardrailCard({ eyebrow, title, tone, icon }: GuardrailCardProps) {
  const toneClasses =
    tone === "warn"
      ? {
          card: "border-[0.5px] border-status-warning-border bg-status-warning-bg",
          iconWrap: "border-[0.5px] border-status-warning-border bg-surface-panel text-status-warning-fg",
          eyebrow: "text-status-warning-fg",
          dot: "bg-status-warning-icon",
        }
      : {
          card: "border-[0.5px] border-border-default bg-surface-panel",
          iconWrap: "border-[0.5px] border-border-default bg-surface-shell text-text-primary",
          eyebrow: "text-text-secondary",
          dot: "bg-status-processing-icon",
        };

  return (
    <div className={`flex items-center gap-3 rounded-panel px-4 py-4 ${toneClasses.card}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${toneClasses.iconWrap}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold uppercase tracking-[0.28em] ${toneClasses.eyebrow}`}>{eyebrow}</div>
        <div className="mt-1 text-base font-semibold text-text-primary">{title}</div>
      </div>
      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses.dot}`} />
    </div>
  );
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

  const workflowMap = [
    { id: "01", label: t("auth.login.workflow_1_label", "Inbox Check"), detail: t("auth.login.workflow_1_detail", "Verified access"), active: true },
    { id: "02", label: t("auth.login.workflow_2_label", "Session Lock"), detail: t("auth.login.workflow_2_detail", "Cookie shield"), active: false },
    { id: "03", label: t("auth.login.workflow_3_label", "Route Deploy"), detail: hasRedirectTarget ? nextDestination : t("auth.login.workflow_3_detail", "role desk"), active: false },
  ];

  const guardrails: GuardrailCardProps[] = [
    {
      eyebrow: canResendVerification ? "Verification Block" : "Verified Inbox",
      title: canResendVerification ? t("auth.login.guardrail.verify_required", "Email verification required") : t("auth.login.guardrail.verified_only", "Verified email access only"),
      tone: canResendVerification ? "warn" : "ok",
      icon: <ThermalIcon />,
    },
    {
      eyebrow: t("auth.login.guardrail.cookie_eyebrow", "Cookie Session"),
      title: t("auth.login.guardrail.cookie_title", "Protected workspace session"),
      tone: "ok",
      icon: <DialIcon />,
    },
    {
      eyebrow: hasRedirectTarget ? t("auth.login.guardrail.redirect_eyebrow", "Redirect Target") : t("auth.login.guardrail.role_eyebrow", "Role Routing"),
      title: hasRedirectTarget ? t("auth.login.guardrail.redirect_title", "Open {{destination}}", { destination: nextDestination }) : t("auth.login.guardrail.role_title", "Role-based desk handoff"),
      tone: "ok",
      icon: canResendVerification ? <AlertIcon /> : <AlertIcon />,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface-app text-text-primary">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-shell)_78%,transparent),transparent_12rem)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(color-mix(in_srgb,var(--border-subtle)_55%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--border-subtle)_35%,transparent)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-4 py-5 sm:px-5 sm:py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-text-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-panel">
              <WorkflowIcon />
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.38em] text-text-secondary">{t("auth.login.factory_os", "Factory OS")}</div>
              <div className="text-[1.4rem] font-semibold uppercase tracking-[-0.04em] text-text-primary">DPR.ai</div>
            </div>
          </div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-text-secondary">{t("auth.login.system", "System")}</div>
        </header>

        <section className="mt-6">
          <div className="text-[0.78rem] font-medium uppercase tracking-[0.3em] text-text-secondary">{t("auth.login.eyebrow", "Industrial intelligence platform")}</div>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-text-primary sm:text-[2.25rem]">
            {t("auth.login.title", "System Access")}
          </h1>
          <p className="mt-3 max-w-[34rem] text-sm leading-6 text-text-secondary">
            {t("auth.login.description", "Sign in with a verified inbox and land in the right desk without losing factory context.")}
          </p>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short access sequence so the page points to one clear sign-in outcome. */}
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-panel border-[0.5px] border-border-default bg-surface-panel px-3 py-4">
            <div className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-secondary">{t("auth.login.step_1_label", "1. Verify inbox")}</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{t("auth.login.step_1_title", "Use a real account")}</div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">{t("auth.login.step_1_detail", "Only verified inboxes can open the workspace.")}</div>
          </div>
          <div className="rounded-panel border-[0.5px] border-border-default bg-surface-panel px-3 py-4">
            <div className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-secondary">{t("auth.login.step_2_label", "2. Start session")}</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{t("auth.login.step_2_title", "Lock the route")}</div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">{t("auth.login.step_2_detail", "Cookie protection keeps the handoff stable after sign-in.")}</div>
          </div>
          <div className="rounded-panel border-[0.5px] border-border-default bg-surface-panel px-3 py-4">
            <div className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-text-secondary">{t("auth.login.step_3_label", "3. Open desk")}</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">
              {hasRedirectTarget ? t("auth.login.guardrail.redirect_title", "Open {{destination}}", { destination: nextDestination }) : t("auth.login.step_3_title", "Open workspace")}
            </div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">{t("auth.login.step_3_detail", "Role routing finishes the sign-in without another decision screen.")}</div>
          </div>
        </section>

        <section className="mt-5 rounded-panel border-[0.5px] border-border-default bg-surface-panel px-4 py-4 sm:px-5 sm:py-5">
          <form onSubmit={onSubmit} className="operational-form">
            <div>
              <label className="text-label-dense font-medium uppercase tracking-wide text-text-secondary">{t("auth.login.email_label", "Email address")}</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("auth.login.email_placeholder", "operator@factory.ai")}
                required
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-label-dense font-medium uppercase tracking-wide text-text-secondary">{t("auth.login.password_label", "Access password")}</label>
              <div className="relative mt-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("auth.login.password_placeholder", "........")}
                  required
                  className="mt-0 pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 inline-flex h-7 -translate-y-1/2 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-shell px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
                >
                  {showPassword ? t("auth.login.hide_password", "Hide") : t("auth.login.show_password", "Show")}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? t("auth.login.submitting", "Authorizing...") : t("auth.login.submit", "Sign in")}
            </Button>

            {surfaceStatus ? (
              <div className={`rounded-panel px-4 py-4 text-sm leading-6 ${panelToneClasses(surfaceStatus.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`inline-flex rounded-badge px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] ${badgeToneClasses(surfaceStatus.tone === "error" ? "error" : surfaceStatus.tone === "success" ? "success" : "neutral")}`}>
                      {surfaceStatus.tone === "error" ? t("auth.login.status_blocked", "Access blocked") : surfaceStatus.tone === "success" ? t("notifications.ready", "Ready") : t("notifications.status", "Status")}
                    </div>
                    <div className="mt-3">{surfaceStatus.message}</div>
                  </div>
                </div>
                {canResendVerification ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onResendVerification}
                      disabled={resending}
                      className="text-xs"
                    >
                      {resending ? t("auth.login.resending", "Sending...") : t("auth.login.resend", "Resend verification")}
                    </Button>
                    <div className="self-center text-xs uppercase tracking-[0.18em] text-text-secondary">
                      {t("auth.login.resend_hint", "Use the same signup inbox.")}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void onGoogleLogin()}
                disabled={googleLoading}
                className="w-full"
              >
                {googleLoading ? t("auth.login.google_loading", "Connecting...") : t("auth.login.google", "Google sign-in")}
              </Button>
              <Link href="/forgot-password" className="flex h-input items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated px-sm text-label-dense font-semibold uppercase tracking-wide text-text-primary transition hover:border-border-strong hover:bg-surface-hover">
                {t("auth.login.reset_password", "Reset password")}
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-sm text-text-secondary">
              <span>{t("auth.login.create_account_prompt", "Need a new workspace access path?")}</span>
              <Link href="/register" className="font-semibold uppercase tracking-[0.14em] text-text-primary transition hover:text-text-primary">
                {t("auth.login.create_account", "Create account")}
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-5">
          <GuidanceBlock
            surfaceKey="auth-login-help"
            title={t("auth.login.help_title", "Why sign-in is locked down")}
            summary={t("auth.login.help_summary", "Verification, session protection, and route handoff stay available here without crowding the sign-in form.")}
            eyebrow={t("auth.login.safety_guardrails", "Safety guardrails")}
            collapsedLabel={t("common.open", "Open")}
            expandedLabel={t("common.close", "Close")}
            critical
            className="border-border-default bg-surface-panel"
            eyebrowClassName="text-text-secondary"
            titleClassName="text-text-primary"
            summaryClassName="text-text-secondary"
            contentClassName="border-border-subtle"
          >
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                  {t("auth.login.workflow_map_title", "Workflow map")}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {workflowMap.map((step) => (
                    <div
                      key={step.id}
                      className={`rounded-panel border-[0.5px] px-4 py-4 ${
                        step.active
                          ? "border-border-focus bg-surface-selected"
                          : "border-border-default bg-surface-shell"
                      }`}
                    >
                      <div className={`text-center font-mono text-[2rem] font-semibold tracking-[-0.08em] ${step.active ? "text-text-primary" : "text-text-secondary"}`}>
                        {step.id}
                      </div>
                      <div className="overflow-safe-text mt-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">
                        {step.label}
                      </div>
                      <div className="overflow-safe-text mt-2 text-center text-[0.67rem] uppercase tracking-[0.18em] text-text-secondary">{step.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                  {t("auth.login.safety_guardrails", "Safety guardrails")}
                </div>
                <div className="mt-4 space-y-4">
                  {guardrails.map((guardrail) => (
                    <GuardrailCard key={`${guardrail.eyebrow}-${guardrail.title}`} {...guardrail} />
                  ))}
                </div>
              </div>
            </div>
          </GuidanceBlock>
        </section>

        <section className="mt-5 overflow-hidden rounded-panel border-[0.5px] border-border-default bg-surface-panel">
          <div className="relative px-4 py-5">
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-text-secondary">{t("auth.login.access_lane_rating", "Access lane rating")}</div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-5xl font-semibold tracking-[-0.08em] text-text-primary">05</div>
                  <div className="text-sm uppercase tracking-[0.2em] text-text-secondary">{t("auth.login.routes_online", "Role routes online")}</div>
                </div>
                <div className="rounded-badge border-[0.5px] border-border-default bg-surface-shell px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-primary">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-status-success-icon" />
                  {t("auth.login.protected", "Protected")}
                </div>
              </div>
              <div className="mt-4 max-w-md text-sm leading-6 text-text-secondary">
                {t("auth.login.rating_detail", "Verified inbox ownership, protected cookies, and role-based routing hold the sign-in path steady before the workspace opens.")}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
