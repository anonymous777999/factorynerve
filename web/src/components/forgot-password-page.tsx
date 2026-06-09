"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Mail, ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api";
import { requestPasswordReset, resendEmailVerification, type PasswordForgotResponse } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
  const isEmailDelivery = response?.delivery_mode !== "preview";

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
    try {
      const result = await requestPasswordReset(email);
      setResponse(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
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
    <AuthWorkstationShell
      sidePanel="minimal"
      badge={t("auth.forgot.badge", "Password Recovery")}
      title={t("auth.forgot.title", "Forgot password")}
      description={t("auth.forgot.description", "Enter your account email and we will prepare a reset path.")}
      leftEyebrow={t("auth.shell.guardrails", "Guardrails")}
      leftTitle={t("auth.forgot.journey_title", "Recover access without leaking account state.")}
      leftDescription={t("auth.forgot.journey_description", "The flow stays privacy-safe and only works for verified, active accounts.")}
      supportTitle={t("auth.forgot.support_title", "Privacy-safe by design")}
      supportDescription={t("auth.forgot.support_description", "This screen never confirms whether an email exists. Reset works only after signup verification creates the real account.")}
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: t("auth.forgot.step_1_detail", "Submit the account email. The response stays privacy-safe either way."),
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: t("auth.forgot.step_2_detail", "Use only the latest valid email if multiple links were requested."),
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: t("auth.forgot.step_3_detail", "Choose a strong password, then sign in again with the same email."),
        },
      ]}
      panelClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field>
          <Label htmlFor="forgot-email">{t("forms.email", "Email")}</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="factory-auth-input min-h-[40px]"
          />
        </Field>
        {error ? (
          <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-3 py-3 text-sm text-status-danger-fg" role="alert">
            {error}
          </div>
        ) : null}
        <Button type="submit" isBusy={loading} busyLabel={t("auth.forgot.submitting", "Preparing...")} className="factory-auth-cta w-full border-transparent">
          {t("auth.forgot.submit", "Send link")}
        </Button>
      </form>

      {response ? (
        <div className="rounded-panel border border-status-success-border bg-status-success-bg p-4 text-sm text-status-success-fg">
          <p className="font-semibold">
            {isEmailDelivery ? t("auth.forgot.sent", "Reset email sent if the account exists") : t("auth.forgot.preview_ready", "Reset link ready")}
          </p>
          <p className="mt-2 text-text-primary/90">{response.message}</p>
          <div className="mt-4 rounded-panel border border-border-default bg-surface-shell p-3 text-sm text-text-primary">
            Next: check the inbox for {email}, open the newest link, then sign in again after the reset.
          </div>
          <div className="mt-3 space-y-3 rounded-panel border border-border-default bg-surface-shell p-3 text-xs text-text-secondary">
            <p className="text-label font-semibold text-text-secondary">{t("auth.forgot.help", "Need help")}</p>
            <div className="rounded-panel border border-status-warning-border bg-status-warning-bg p-3 text-status-warning-fg">
              {t("auth.forgot.help_unverified", "If signup email verification is still pending, reset will not arrive until the real account exists.")}
            </div>
            {isEmailDelivery ? (
              <p>{t("auth.forgot.help_privacy", "For privacy, this page always shows the same result whether the email exists or not.")}</p>
            ) : null}
          </div>
          {response.reset_link ? (
            <div className="mt-4 space-y-3">
              <p className="text-text-tertiary">Local preview mode is active, so your reset link is shown here directly.</p>
              <a
                href={response.reset_link}
                className="inline-flex rounded-control border border-border-focus bg-surface-selected px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
              >
                {t("auth.forgot.open_reset_form", "Open Reset Form")}
              </a>
              <Button type="button" variant="outline" onClick={copyResetLink}>
                {t("auth.forgot.copy_link", "Copy link")}
              </Button>
              {copyStatus ? <p className="text-xs text-text-tertiary">{copyStatus}</p> : null}
              <p className="break-all text-xs text-text-tertiary">{response.reset_link}</p>
            </div>
          ) : (
            <p className="mt-3 text-text-tertiary">
              {t("auth.forgot.check_inbox", "Check your inbox, spam, and promotions folder for the reset email.")}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={onResendVerification} disabled={resendingVerification}>
              {resendingVerification ? t("auth.forgot.resend_verifying", "Sending...") : t("auth.forgot.resend_verify", "Resend verify")}
            </Button>
            <Link href="/access" className="factory-auth-link text-sm underline">
              {t("auth.forgot.back_to_sign_in", "Back to sign in")}
            </Link>
          </div>
          {verificationStatus ? (
            <div className="mt-3 rounded-panel border border-border-default bg-surface-shell p-3 text-sm text-text-secondary">
              {verificationStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-sm text-text-secondary">
        Remembered it?{" "}
        <Link href="/access" className="factory-auth-link underline">
          {t("auth.forgot.back_to_sign_in", "Back to sign in")}
        </Link>
      </p>
    </AuthWorkstationShell>
  );
}
