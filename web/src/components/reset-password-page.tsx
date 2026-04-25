"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { resetPassword, validatePasswordResetToken } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "common"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token") || searchParams.get("reset_token") || "",
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const resetFinished = status.toLowerCase().includes("password reset successful");

  useEffect(() => {
    let alive = true;

    if (!token) {
      setValid(false);
      setVerifying(false);
      setError(t("auth.reset.missing_token", "This reset link is missing a token. Please request a new one."));
      return () => {
        alive = false;
      };
    }

    setVerifying(true);
    setError("");
    setStatus("");

    validatePasswordResetToken(token)
      .then((result) => {
        if (!alive) return;
        setValid(result.valid);
        if (!result.valid) {
          setError(result.message);
        } else {
          setStatus(result.message);
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("auth.reset.verify_failed", "Could not verify the reset link."));
        }
        setValid(false);
      })
      .finally(() => {
        if (!alive) return;
        setVerifying(false);
      });

    return () => {
      alive = false;
    };
  }, [t, token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!token) {
      setError(t("auth.reset.missing_token", "This reset link is missing a token. Please request a new one."));
      return;
    }
    if (!password || password !== confirmPassword) {
      setError(t("auth.reset.password_mismatch", "Passwords do not match."));
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      setStatus(result.message);
      setValid(false);
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        router.push("/access?reset=1");
      }, 2200);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.reset.failed", "Could not reset password."));
      }
    } finally {
      setLoading(false);
    }
  };

  // AUDIT: TEXT_NOISE - shorten the auth-shell narrative so the reset action stays primary
  return (
    <AuthShell
      badge={t("auth.reset.badge", "Reset Password")}
      title={t("auth.reset.title", "Reset password")}
      description={t("auth.reset.description", "Create a new password, then sign in again with the same email.")}
      journeyTitle={t("auth.reset.journey_title", "Turn a one-time link into a clean account reset.")}
      journeyDescription={t("auth.reset.journey_description", "The link is temporary and one-time-use. Saving the new password revokes older sessions.")}
      steps={[
        {
          title: t("auth.reset.step_1_title", "Validate the link"),
          description: t("auth.reset.step_1_detail", "We first check that the recovery link is still valid."),
        },
        {
          title: t("auth.reset.step_2_title", "Set a strong new password"),
          description: t("auth.reset.step_2_detail", "Use a fresh password with enough length and complexity."),
        },
        {
          title: t("auth.reset.step_3_title", "Sign in again"),
          description: t("auth.reset.step_3_detail", "After the reset completes, sign in again with the new password only."),
        },
      ]}
      supportTitle={t("auth.reset.support_title", "Why old sessions stop working")}
      supportDescription={t("auth.reset.support_description", "Password reset revokes active refresh sessions so only the new password opens fresh sessions.")}
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
      guidanceKey="auth-reset-help"
    >
      {verifying ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
              {t("auth.reset.verifying", "Verifying your reset link...")}
            </div>
          ) : null}

          {status ? (
            <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-4 text-sm text-green-200">
              <div>{status}</div>
              {resetFinished ? (
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-green-100/90">
                  {t("auth.reset.next_step", "Next step: use your new password on the sign-in screen. You will be redirected there automatically.")}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {valid && !verifying ? (
            <div className="space-y-4">
              {/* AUDIT: DENSITY_OVERLOAD - compress repeated recovery guidance into one compact prep card */}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-4 text-sm text-[var(--text)]/90">
                {t("auth.reset.prep", "Enter the new password twice, save it once, then return to sign in with the same email.")}
                <div className="mt-3 text-xs text-[var(--muted)]">
                  {t("auth.reset.expiry_notice", "This reset link works only once. If it expires, request a new link.")}
                </div>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <PasswordField
                  label={t("auth.reset.new_password", "New Password")}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  required
                />
                <PasswordStrengthMeter password={password} />
                {/* AUDIT: TEXT_NOISE - reduce inline helper copy because the strength meter already carries most of the guidance */}
                <div className="text-xs text-[var(--muted)]">{t("auth.reset.password_guidance", "Use 12+ characters with uppercase, lowercase, number, and symbol.")}</div>
                <PasswordField
                  label={t("auth.reset.confirm_password", "Confirm Password")}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t("auth.reset.submitting", "Resetting...") : t("auth.reset.submit", "Reset password")}
                </Button>
              </form>
            </div>
          ) : null}

          {!valid && !verifying && error ? (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-4 text-sm text-[var(--muted)]">
              Use <span className="font-medium text-[var(--text)]">Request New Link</span> below to generate a fresh password reset email. Only the newest valid link should be used.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href="/forgot-password">
              <Button variant="outline">{t("auth.reset.request_new", "New link")}</Button>
            </Link>
            <Link href="/access">
              <Button>{t("auth.reset.sign_in", "Sign in")}</Button>
            </Link>
          </div>
    </AuthShell>
  );
}
