"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { register, resendEmailVerification, type RegisterResponse } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { validatePhoneNumber } from "@/lib/validation";
import { AuthShell } from "@/components/auth-shell";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function destinationLabel(path: string, t: (key: string, fallback?: string) => string) {
  switch (path) {
    case "/attendance":
      return t("auth.register.destination.attendance", "the attendance desk");
    case "/dashboard":
      return t("auth.register.destination.dashboard", "the operations board");
    case "/approvals":
      return t("auth.register.destination.approvals", "the review queue");
    case "/reports":
      return t("auth.register.destination.reports", "the reports desk");
    default:
      return t("auth.register.destination.workspace", "the workspace");
  }
}

export default function RegisterPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "forms", "errors"]);
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RegisterResponse | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const rawNextPath = searchParams.get("next");
  const nextPath =
    rawNextPath && rawNextPath.startsWith("/") && !rawNextPath.startsWith("//") ? rawNextPath : "/";
  const nextDestination = destinationLabel(nextPath, t);
  const hasRedirectTarget = nextPath !== "/";
  const deliveryMode = success?.delivery_mode ?? null;
  const isPreviewMode = deliveryMode === "preview";
  const isEmailFailure = deliveryMode === "email_failed";
  const isEmailDelivery = !!success && !isPreviewMode && !isEmailFailure;
  const successState = success
    ? {
        title: isEmailFailure
          ? t("auth.register.success_pending_saved", "Pending signup saved")
          : isEmailDelivery
            ? t("auth.register.success_inbox_required", "Inbox verification required")
            : t("auth.register.success_link_ready", "Verification link ready"),
        detail: isEmailFailure
          ? t("auth.register.success_pending_detail", "The signup request is stored safely. You only need to resend verification after email delivery recovers.")
          : isEmailDelivery
            ? t("auth.register.success_inbox_detail", "The real account stays locked until this inbox opens the verification email and activates the signup.")
            : t("auth.register.success_link_detail", "Preview mode is active, so you can open the verification link directly from this screen."),
        className: isEmailFailure
          ? "border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] text-amber-100"
          : isEmailDelivery
            ? "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-green-100"
            : "border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] text-sky-100",
      }
    : null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setResendStatus("");
    if (companyCode.trim() && !factoryName.trim()) {
      setError(t("auth.register.error_factory_required", "Factory/Company name is required to verify the company code."));
      return;
    }
    const phoneError = validatePhoneNumber(phoneNumber, "Phone number");
    if (phoneError) {
      setError(phoneError);
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        name,
        email,
        password,
        role: "attendance",
        factory_name: factoryName,
        company_code: companyCode || null,
        phone_number: phoneNumber || null,
      });
      setSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError(t("auth.register.error_backend_unreachable", "Backend not reachable. Check that FastAPI is running and NEXT_PUBLIC_API_BASE_URL is correct."));
      } else if (err instanceof Error && err.message.includes("Request timed out")) {
        setError(t("auth.register.error_timeout", "Signup is taking too long waiting for email delivery. Please try again or retry in a minute."));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.register.error_failed", "Registration failed."));
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus("");
    try {
      const result = await resendEmailVerification(email);
      if (result.verification_link) {
        setSuccess((current) =>
          current
            ? {
                ...current,
                verification_link: result.verification_link,
                delivery_mode: result.delivery_mode,
              }
            : current,
        );
      }
      setResendStatus(result.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setResendStatus(err.message);
      } else if (err instanceof Error) {
        setResendStatus(err.message);
      } else {
        setResendStatus(t("auth.register.resend_failed", "Could not resend the verification email."));
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      badge={t("auth.register.badge", "Public Signup")}
      title={t("auth.register.title", "Create your account")}
      description={
        hasRedirectTarget
          ? t("auth.register.description_redirect", "Create the account, verify the inbox, then continue into {{destination}}.", { destination: nextDestination })
          : t("auth.register.description", "Public signup creates an attendance-worker signup request that stays locked until the inbox is verified.")
      }
      journeyTitle={t("auth.register.journey_title", "Bring workers into the system without risking factory access.")}
      journeyDescription={
        hasRedirectTarget
          ? t("auth.register.journey_description_redirect", "The account stays locked until the inbox is verified, then the user can continue into {{destination}}.", { destination: nextDestination })
          : t("auth.register.journey_description", "Collect the details, verify the inbox owner, then unlock the real account.")
      }
      steps={[
        {
          title: t("auth.register.step_1_title", "Submit worker details"),
          description: t("auth.register.step_1_detail", "Collect the person, factory, and contact details needed to prepare a pending signup safely."),
        },
        {
          title: t("auth.register.step_2_title", "Verify the email inbox"),
          description: t("auth.register.step_2_detail", "Only the inbox owner can open the verification link and activate the real DPR.ai account."),
        },
        {
          title: t("auth.register.step_3_title", "Unlock sign-in"),
          description: t("auth.register.step_3_detail", "After verification, the worker returns to sign in and start using the attendance-first workflow."),
        },
      ]}
      supportTitle={t("auth.register.support_title", "Why this feels stricter now")}
      supportDescription={t("auth.register.support_description", "Wrong or fake emails can no longer create a working account. They only create a pending signup that stays locked until the real inbox verifies it.")}
      cardClassName="max-w-3xl"
      guidanceKey="auth-register-help"
    >
      {success ? (
        <div className="space-y-5">
              {hasRedirectTarget ? (
                <div className="rounded-2xl border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] p-4 text-sm text-[var(--text)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("auth.register.after_verification", "After verification")}</div>
                  <div className="mt-2 text-base font-semibold">{t("auth.register.after_verification_detail", "Sign in to continue into {{destination}}.", { destination: nextDestination })}</div>
                </div>
              ) : null}
              {successState ? (
                <div className={`rounded-2xl border p-4 text-sm ${successState.className}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">{t("auth.register.status_title", "Signup Status")}</div>
                  <div className="mt-2 text-base font-semibold text-[var(--text)]">{successState.title}</div>
                  <div className="mt-2 leading-6">{successState.detail}</div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] p-4 text-sm">
                <div className="font-semibold text-amber-300">
                  {isEmailFailure
                    ? "Signup saved, but email delivery needs another try"
                    : isEmailDelivery
                      ? "Check your inbox to finish signup"
                      : "Verification link ready"}
                </div>
                <div className="mt-2 text-[var(--text)]/90">{success.message}</div>
                <div className="mt-3 text-[var(--muted)]">
                  We saved a pending signup for <span className="font-medium text-[var(--text)]">{email}</span>.
                  The account cannot sign in until that inbox opens the verification link.
                </div>
                <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    What to do next
                  </div>
                  <ol className="mt-3 space-y-2 text-sm text-[var(--text)]/90">
                    <li>1. {isEmailFailure ? "Wait a minute, then request a fresh verification email." : `Open the inbox for ${email}.`}</li>
                    <li>
                      2. {isEmailFailure
                        ? "Use Resend Verification Email below until the message arrives."
                        : isEmailDelivery
                          ? "Click the verification email from DPR.ai."
                          : "Open the preview link below."}
                    </li>
                    <li>3. Return here and sign in after verification is complete.</li>
                  </ol>
                </div>
                {isEmailFailure ? (
                  <div className="mt-3 rounded-xl border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.28)] p-3 text-xs text-red-100">
                    The signup request is safe in the system, but the first verification email did not leave successfully. You do not need to fill the form again.
                  </div>
                ) : null}
                {isEmailDelivery ? (
                  <div className="mt-3 rounded-xl border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] p-3 text-xs text-[var(--muted)]">
                    If you do not see the email within a minute, check spam or promotions, then use
                    {" "}
                    <span className="font-medium text-[var(--text)]">Resend Verification Email</span>.
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  Random or wrong emails can create a pending record, but they do not get working access. Only the person who can open that inbox can activate the account.
                </div>
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  Password reset works only after verification is complete. Until then, use <span className="font-medium text-[var(--text)]">Resend Verification Email</span> instead of forgot password.
                </div>
                {success.verification_link ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-[var(--muted)]">
                      Local preview mode is active, so your verification link is shown here directly.
                    </div>
                    <a
                      href={success.verification_link}
                      className="inline-flex rounded-full border border-[rgba(62,166,255,0.4)] bg-[rgba(62,166,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(62,166,255,0.18)]"
                    >
                      Open Verification Page
                    </a>
                    <div className="break-all text-xs text-[var(--muted)]">{success.verification_link}</div>
                  </div>
                ) : isEmailFailure ? (
                  <div className="mt-3 text-[var(--muted)]">
                    Use resend once the email service is healthy again. The pending signup is already stored.
                  </div>
                ) : (
                  <div className="mt-3 text-[var(--muted)]">
                    Check your inbox and spam folder for the verification email.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={onResend} disabled={resending}>
                  {resending ? t("auth.register.resending", "Sending...") : t("auth.register.resend", "Resend email")}
                </Button>
                <Link href="/access" className="text-sm text-[var(--accent)] underline">
                  {t("auth.register.sign_in", "Sign in")}
                </Link>
              </div>

              {resendStatus ? (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--muted)]">
                  {resendStatus}
                </div>
              ) : null}
            </div>
      ) : (
        <div className="space-y-5">
          {hasRedirectTarget ? (
            <div className="rounded-2xl border border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] p-4 text-sm text-[var(--text)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("auth.register.start_here", "Start here first")}</div>
              <div className="mt-2 text-base font-semibold">{t("auth.register.start_here_detail", "After verification, the user can continue into {{destination}}.", { destination: nextDestination })}</div>
            </div>
          ) : null}
          {/* AUDIT: BUTTON_CLUTTER - keep the Google route available in a secondary reveal so the worker signup form stays primary. */}
          <details className="group rounded-2xl border border-[rgba(62,166,255,0.2)] bg-[rgba(62,166,255,0.08)] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text)]">
              {t("auth.register.google_summary", "Google sign-in")}
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] transition group-open:hidden">{t("common.open", "Open")}</span>
              <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--muted)] group-open:inline">{t("common.close", "Close")}</span>
            </summary>
            <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {t("auth.register.google_description", "Use Google when you want the direct workspace route instead of the attendance-worker signup request.")}
            </div>
            <div className="mt-4">
              <GoogleAuthButton
                nextPath="/dashboard"
                hint={t("auth.register.google_hint", "Use Google when you want the direct workspace-owner route instead of the attendance-worker signup request.")}
              />
            </div>
          </details>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">{t("auth.register.name_label", "Full Name")}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">{t("forms.email", "Email")}</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-1">
                <PasswordField
                  label={t("forms.password", "Password")}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  required
                />
                <p className="mt-2 text-xs text-[var(--muted)]">{t("auth.register.password_hint", "Use 12+ characters with mixed case, number, and symbol.")}</p>
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">{t("auth.register.account_type_label", "Account Type")}</label>
                <Input value={t("auth.register.account_type_value", "Attendance worker access")} readOnly aria-readonly />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">{t("auth.register.factory_label", "Company / Factory Name")}</label>
                <Input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} required />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">{t("auth.register.company_code_label", "Company Code (optional)")}</label>
                <Input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-[var(--muted)]">{t("forms.phone_number_optional", "Phone Number (optional)")}</label>
                <Input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t("auth.register.phone_placeholder", "+91 98765 43210")}
                />
              </div>

              {error ? <div className="md:col-span-2 text-sm text-red-400">{error}</div> : null}

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? t("auth.register.submitting", "Creating...") : t("auth.register.submit", "Register")}
                </Button>
                <Link href="/access" className="text-sm text-[var(--accent)] underline">
                  {t("auth.register.sign_in", "Sign in")}
                </Link>
              </div>
            </form>
        </div>
      )}
    </AuthShell>
  );
}
