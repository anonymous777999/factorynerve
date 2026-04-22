"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { login, resendEmailVerification, startGoogleLogin, warmBackendConnection } from "@/lib/auth";
import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getHomeDestination } from "@/lib/role-navigation";
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

function badgeToneClasses(tone: "neutral" | "success" | "error") {
  switch (tone) {
    case "success":
      return "border border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "error":
      return "border border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border border-slate-400/20 bg-slate-300/8 text-slate-200";
  }
}

function panelToneClasses(tone: "neutral" | "success" | "error") {
  switch (tone) {
    case "success":
      return "border border-emerald-400/22 bg-[linear-gradient(180deg,rgba(14,43,36,0.92),rgba(10,27,24,0.98))] text-emerald-100";
    case "error":
      return "border border-amber-400/28 bg-[linear-gradient(180deg,rgba(58,34,20,0.92),rgba(37,24,18,0.98))] text-amber-100";
    default:
      return "border border-white/10 bg-[linear-gradient(180deg,rgba(25,31,42,0.88),rgba(17,22,31,0.96))] text-slate-200";
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
          card: "border border-orange-500/14 bg-[linear-gradient(135deg,rgba(47,29,21,0.96),rgba(31,22,20,0.98))]",
          iconWrap: "bg-[rgba(255,132,40,0.14)] text-orange-400",
          eyebrow: "text-orange-400",
          dot: "bg-orange-400 shadow-[0_0_18px_rgba(255,132,40,0.8)]",
        }
      : {
          card: "border border-white/6 bg-[linear-gradient(135deg,rgba(27,32,42,0.96),rgba(19,24,34,0.98))]",
          iconWrap: "bg-[rgba(111,162,255,0.14)] text-sky-300",
          eyebrow: "text-slate-300",
          dot: "bg-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.75)]",
        };

  return (
    <div className={`flex items-center gap-4 rounded-[1.7rem] px-5 py-5 shadow-[0_14px_38px_rgba(3,7,18,0.26)] ${toneClasses.card}`}>
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneClasses.iconWrap}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-semibold uppercase tracking-[0.28em] ${toneClasses.eyebrow}`}>{eyebrow}</div>
        <div className="mt-2 text-[1.05rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.1rem]">{title}</div>
      </div>
      <div className={`h-3.5 w-3.5 shrink-0 rounded-full ${toneClasses.dot}`} />
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
    <main className="relative min-h-screen overflow-hidden bg-[#090d14] text-[#e8edf7]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(72,158,255,0.12),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.09),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[620px] flex-col px-6 py-7 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#4aa7ff]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2a4e75] bg-[linear-gradient(180deg,rgba(40,86,128,0.36),rgba(14,28,43,0.42))] shadow-[0_12px_30px_rgba(5,13,24,0.35)]">
              <WorkflowIcon />
            </div>
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.38em] text-[#8fc8ff]">{t("auth.login.factory_os", "Factory OS")}</div>
              <div className="text-[1.9rem] font-semibold uppercase tracking-[-0.05em] text-[#4aa7ff]">DPR.ai</div>
            </div>
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.34em] text-white/22">{t("auth.login.system", "System")}</div>
        </header>

        <section className="mt-10">
          <div className="text-[0.88rem] font-medium uppercase tracking-[0.36em] text-white/70">{t("auth.login.eyebrow", "Industrial intelligence platform")}</div>
          <h1 className="mt-3 text-[3rem] font-semibold tracking-[-0.06em] text-[#f0f4fc] sm:text-[3.35rem]">
            {t("auth.login.title", "System Access")}
          </h1>
          <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[#97a6bd]">
            {t("auth.login.description", "Sign in with a verified inbox and land in the right desk without losing factory context.")}
          </p>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short access sequence so the page points to one clear sign-in outcome. */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))] px-4 py-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#8fc8ff]">{t("auth.login.step_1_label", "1. Verify inbox")}</div>
            <div className="mt-3 text-base font-semibold text-white">{t("auth.login.step_1_title", "Use a real account")}</div>
            <div className="mt-2 text-sm leading-6 text-[#97a6bd]">{t("auth.login.step_1_detail", "Only verified inboxes can open the workspace.")}</div>
          </div>
          <div className="rounded-[1.5rem] border border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))] px-4 py-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#8fc8ff]">{t("auth.login.step_2_label", "2. Start session")}</div>
            <div className="mt-3 text-base font-semibold text-white">{t("auth.login.step_2_title", "Lock the route")}</div>
            <div className="mt-2 text-sm leading-6 text-[#97a6bd]">{t("auth.login.step_2_detail", "Cookie protection keeps the handoff stable after sign-in.")}</div>
          </div>
          <div className="rounded-[1.5rem] border border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))] px-4 py-5">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#8fc8ff]">{t("auth.login.step_3_label", "3. Open desk")}</div>
            <div className="mt-3 text-base font-semibold text-white">
              {hasRedirectTarget ? t("auth.login.guardrail.redirect_title", "Open {{destination}}", { destination: nextDestination }) : t("auth.login.step_3_title", "Open workspace")}
            </div>
            <div className="mt-2 text-sm leading-6 text-[#97a6bd]">{t("auth.login.step_3_detail", "Role routing finishes the sign-in without another decision screen.")}</div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/6 bg-[linear-gradient(135deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] px-5 py-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:px-8 sm:py-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8ec4ff]">{t("auth.login.email_label", "Email address")}</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("auth.login.email_placeholder", "operator@factory.ai")}
                required
                className="mt-3 h-16 rounded-xl border-[#323845] bg-[#333842]/85 px-5 text-[1.05rem] text-[#edf3ff] placeholder:text-[#69758a] focus:border-[#5ba8ff] focus:bg-[#383e49]"
              />
            </div>

            <div>
              <label className="text-sm font-semibold uppercase tracking-[0.14em] text-[#d7dde8]">{t("auth.login.password_label", "Access password")}</label>
              <div className="relative mt-3">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("auth.login.password_placeholder", "........")}
                  required
                  className="mt-0 h-16 rounded-xl border-[#323845] bg-[#333842]/85 px-5 pr-24 text-[1.05rem] text-[#edf3ff] placeholder:text-[#69758a] focus:border-[#5ba8ff] focus:bg-[#383e49]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold uppercase tracking-[0.12em] text-[#8ec4ff] transition hover:text-white"
                >
                  {showPassword ? t("auth.login.hide_password", "Hide") : t("auth.login.show_password", "Show")}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-[4.4rem] w-full rounded-xl border border-[#7cbfff]/20 bg-[linear-gradient(180deg,#89bcf8,#55a9ff)] text-[1.02rem] font-extrabold uppercase tracking-[0.24em] text-[#07131f] shadow-[0_20px_40px_rgba(66,150,255,0.3)] hover:bg-[linear-gradient(180deg,#9bc8ff,#63b2ff)]"
            >
              {loading ? t("auth.login.submitting", "Authorizing...") : t("auth.login.submit", "Sign in")}
            </Button>

            {surfaceStatus ? (
              <div className={`rounded-[1.3rem] px-4 py-4 text-sm leading-6 shadow-[0_12px_30px_rgba(2,6,23,0.18)] ${panelToneClasses(surfaceStatus.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] ${badgeToneClasses(surfaceStatus.tone === "error" ? "error" : surfaceStatus.tone === "success" ? "success" : "neutral")}`}>
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
                      className="rounded-xl border-amber-300/25 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-300/12"
                    >
                      {resending ? t("auth.login.resending", "Sending...") : t("auth.login.resend", "Resend verification")}
                    </Button>
                    <div className="self-center text-xs uppercase tracking-[0.18em] text-amber-100/70">
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
                className="h-14 rounded-xl border-[#2d3746] bg-[#151a24] text-sm font-semibold uppercase tracking-[0.16em] text-[#9bc9ff] hover:bg-[#1b2230]"
              >
                {googleLoading ? t("auth.login.google_loading", "Connecting...") : t("auth.login.google", "Google sign-in")}
              </Button>
              <Link href="/forgot-password" className="flex h-14 items-center justify-center rounded-xl border border-[#2d3746] bg-[#11161f] text-sm font-semibold uppercase tracking-[0.16em] text-white/72 transition hover:bg-[#171d29] hover:text-white">
                {t("auth.login.reset_password", "Reset password")}
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-2 text-sm text-[#91a2ba]">
              <span>{t("auth.login.create_account_prompt", "Need a new workspace access path?")}</span>
              <Link href="/register" className="font-semibold uppercase tracking-[0.14em] text-[#82c0ff] transition hover:text-white">
                {t("auth.login.create_account", "Create account")}
              </Link>
            </div>
          </form>
        </section>

        {/* AUDIT: DENSITY_OVERLOAD - keep workflow and guardrail diagnostics available but collapsed so sign-in remains the dominant action. */}
        <section className="mt-9 space-y-4">
          <details className="group rounded-[1.85rem] border border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))] px-5 py-5 shadow-[0_12px_32px_rgba(3,7,18,0.22)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[1.4rem] font-semibold uppercase tracking-[-0.04em] text-[#eef3fb]">
              {t("auth.login.workflow_map_title", "Workflow map")}
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3ce8d1] transition group-open:hidden">{t("common.open", "Open")}</span>
              <span className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-[#3ce8d1] group-open:inline">{t("common.close", "Close")}</span>
            </summary>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {workflowMap.map((step) => (
                <div
                  key={step.id}
                  className={`rounded-[1.5rem] border px-4 py-5 shadow-[0_12px_32px_rgba(3,7,18,0.22)] ${
                    step.active
                      ? "border-[#78b6ff] bg-[linear-gradient(180deg,rgba(28,35,49,0.98),rgba(17,22,31,0.98))] shadow-[inset_0_-2px_0_rgba(131,187,255,0.85),0_12px_32px_rgba(3,7,18,0.28)]"
                      : "border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))]"
                  }`}
                >
                  <div className={`text-center text-[3rem] font-semibold tracking-[-0.08em] ${step.active ? "text-[#90c2ff]" : "text-white/78"}`}>
                    {step.id}
                  </div>
                  <div className="overflow-safe-text mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {step.label}
                  </div>
                  <div className="overflow-safe-text mt-2 text-center text-[0.67rem] uppercase tracking-[0.18em] text-white/46">{step.detail}</div>
                </div>
              ))}
            </div>
          </details>

          <details className="group rounded-[1.85rem] border border-white/6 bg-[linear-gradient(180deg,rgba(24,28,37,0.96),rgba(18,23,33,0.98))] px-5 py-5 shadow-[0_12px_32px_rgba(3,7,18,0.22)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[1.4rem] font-semibold uppercase tracking-[-0.04em] text-[#eef3fb]">
              {t("auth.login.safety_guardrails", "Safety guardrails")}
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3ce8d1] transition group-open:hidden">{t("common.open", "Open")}</span>
              <span className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-[#3ce8d1] group-open:inline">{t("common.close", "Close")}</span>
            </summary>
            <div className="mt-5 space-y-4">
              {guardrails.map((guardrail) => (
                <GuardrailCard key={`${guardrail.eyebrow}-${guardrail.title}`} {...guardrail} />
              ))}
            </div>
          </details>
        </section>

        <section className="mt-8 overflow-hidden rounded-[1.85rem] border border-[#16384a] bg-[linear-gradient(180deg,rgba(12,28,39,0.96),rgba(8,18,28,0.98))] shadow-[0_22px_54px_rgba(2,6,23,0.36)]">
          <div className="relative px-6 py-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(63,186,255,0.16),transparent_28%),linear-gradient(90deg,rgba(51,183,255,0.16)_1px,transparent_1px),linear-gradient(180deg,rgba(51,183,255,0.08)_1px,transparent_1px)] [background-size:auto,92px_100%,100%_44px]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(7,13,20,0.86))]" />

            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#b8ddff]">{t("auth.login.access_lane_rating", "Access lane rating")}</div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-6xl font-semibold tracking-[-0.08em] text-white">05</div>
                  <div className="text-sm uppercase tracking-[0.2em] text-white/74">{t("auth.login.routes_online", "Role routes online")}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-[rgba(14,22,33,0.82)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/86">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(45,212,191,0.85)]" />
                  {t("auth.login.protected", "Protected")}
                </div>
              </div>
              <div className="mt-5 max-w-md text-sm leading-7 text-[#b9cadb]">
                {t("auth.login.rating_detail", "Verified inbox ownership, protected cookies, and role-based routing hold the sign-in path steady before the workspace opens.")}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
