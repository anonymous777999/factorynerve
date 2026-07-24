"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, ShieldCheck, Lock, RefreshCw } from "lucide-react";

import { ApiError } from "@/lib/api";
import { requestPasswordReset, resendEmailVerification, type PasswordForgotResponse } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function MailSm() {
  return <Mail className="h-4 w-4" />;
}

function ShieldSm() {
  return <ShieldCheck className="h-4 w-4" />;
}

function LockSm() {
  return <Lock className="h-4 w-4" />;
}

function RefreshSm() {
  return <RefreshCw className="h-4 w-4" />;
}

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "forms", "common"]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<PasswordForgotResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);
  const RESUBMIT_COOLDOWN_SECONDS = 30;
  const isEmailDelivery = response?.delivery_mode !== "preview";

  const brand = {
    appInitial: "F",
    appName: "Factory Nerve",
    useFnLogo: true,
    eyebrow: t("auth.forgot.badge", "Password Recovery"),
    title: t("auth.forgot.title", "Forgot password"),
    description: t(
      "auth.forgot.description",
      "Enter your account email and we will prepare a reset path.",
    ),
    trustPoints: [
      {
        icon: <ShieldSm />,
        text: t("auth.forgot.trust_privacy", "Privacy-safe — never confirms whether an email exists"),
      },
      {
        icon: <LockSm />,
        text: t("auth.forgot.trust_single_use", "Single-use reset links for account security"),
      },
      {
        icon: <RefreshSm />,
        text: t("auth.forgot.trust_verified", "Reset works only after signup verification is complete"),
      },
    ],
  };

  const copyResetLink = async () => {
    if (!response?.reset_link) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(response.reset_link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = response.reset_link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopyStatus(t("auth.forgot.copy_success", "Reset link copied."));
      window.setTimeout(() => setCopyStatus(""), 2200);
    } catch {
      setCopyStatus(t("auth.forgot.copy_failed", "Could not copy automatically. You can still open the link below."));
      window.setTimeout(() => setCopyStatus(""), 2600);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResponse(null);
    setCopyStatus("");
    setVerificationStatus("");
    if (cooldown > 0) return;
    try {
      const result = await requestPasswordReset(email);
      setResponse(result);
      setCooldown(RESUBMIT_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.status === 429) {
          setCooldown(RESUBMIT_COOLDOWN_SECONDS);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.forgot.failed", "Could not start password recovery."));
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendVerification = async () => {
    if (!email) {
      setVerificationStatus(t("auth.forgot.resend_requires_email", "Enter the same signup email first, then resend verification."));
      return;
    }
    setResendingVerification(true);
    setVerificationStatus("");
    try {
      const result = await resendEmailVerification(email);
      setVerificationStatus(result.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setVerificationStatus(err.message);
      } else if (err instanceof Error) {
        setVerificationStatus(err.message);
      } else {
        setVerificationStatus(t("auth.forgot.resend_failed", "Could not resend the verification email."));
      }
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <AuthShell
      variant="split"
      brand={brand}
      badge={t("auth.forgot.badge", "Password Recovery")}
      title={t("auth.forgot.title", "Forgot password")}
      description={t("auth.forgot.description", "Enter your account email and we will prepare a reset path.")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">{t("forms.email", "Email")}</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error ? <div className="text-sm text-red-400">{error}</div> : null}
            <Button type="submit" disabled={loading || cooldown > 0} className="w-full">
              {loading
                ? t("auth.forgot.submitting", "Preparing...")
                : cooldown > 0
                  ? t("auth.forgot.cooldown", "Try again in {{seconds}}s", { seconds: String(cooldown) })
                  : t("auth.forgot.submit", "Send link")}
            </Button>
          </form>

          {response ? (

            <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-4 text-sm">
              <div className="font-semibold text-green-300">
                {isEmailDelivery ? t("auth.forgot.sent", "Reset email sent if the account exists") : t("auth.forgot.preview_ready", "Reset link ready")}
              </div>
              <div className="mt-2 text-[var(--text)]/90">{response.message}</div>
              <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--text)]/90">
                Next: check the inbox for {email}, open the newest link, then sign in again after the reset.
              </div>
              <details className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer list-none font-semibold uppercase tracking-header text-[var(--muted)]">
                  {t("auth.forgot.help", "Need help")}
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] p-3 text-amber-100">
                    {t("auth.forgot.help_unverified", "If signup email verification is still pending, reset will not arrive until the real account exists.")}
                  </div>
                  {isEmailDelivery ? (
                    <div>
                      {t("auth.forgot.help_privacy", "For privacy, this page always shows the same result whether the email exists or not.")}
                    </div>
                  ) : null}
                </div>
              </details>
              {response.reset_link ? (
                <div className="mt-4 space-y-3">
                  <div className="text-[var(--muted)]">
                    Local preview mode is active, so your reset link is shown here directly.
                  </div>
                  <a
                    href={response.reset_link}
                    className="inline-flex rounded-full border border-[rgba(197,109,45,0.4)] bg-[rgba(197,109,45,0.12)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(197,109,45,0.18)]"
                  >
                    {t("auth.forgot.open_reset_form", "Open Reset Form")}
                  </a>
                  <Button type="button" variant="outline" onClick={copyResetLink}>
                    {t("auth.forgot.copy_link", "Copy link")}
                  </Button>
                  {copyStatus ? <div className="text-xs text-[var(--muted)]">{copyStatus}</div> : null}
                  <div className="break-all text-xs text-[var(--muted)]">{response.reset_link}</div>
                </div>
              ) : (
                <div className="mt-3 text-[var(--muted)]">
                  {t("auth.forgot.check_inbox", "Check your inbox, spam, and promotions folder for the reset email.")}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={onResendVerification} disabled={resendingVerification}>
                  {resendingVerification ? t("auth.forgot.resend_verifying", "Sending...") : t("auth.forgot.resend_verify", "Resend verify")}
                </Button>
                <Link href="/access" className="text-sm text-[var(--accent)] underline">
                  {t("auth.forgot.back_to_sign_in", "Back to sign in")}
                </Link>
              </div>
              {verificationStatus ? (
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--muted)]">
                  {verificationStatus}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="text-center text-sm text-[var(--muted)]">
            Remembered it?{" "}
            <Link href="/access" className="text-[var(--accent)] underline">
              {t("auth.forgot.back_to_sign_in", "Back to sign in")}
            </Link>
          </div>
    </AuthShell>
  );
}
