"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { AUTH_ROUTE_PARAM_GUARDS } from "@/config/featureFlags";
import { resetPassword, validatePasswordResetToken } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { Button } from "@/components/ui/button";

function LockSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function RefreshSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "common"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token") || searchParams.get("reset_token") || "",
    [searchParams],
  );

  const brand = {
    appInitial: "D",
    appName: "DPR.ai",
    eyebrow: t("auth.reset.badge", "Reset Password"),
    title: t("auth.reset.title", "Reset password"),
    description: t(
      "auth.reset.description",
      "Create a new password, then sign in again with the same email.",
    ),
    trustPoints: [
      {
        icon: <LockSm />,
        text: t("auth.reset.trust_single_use", "One-time use link for secure password reset"),
      },
      {
        icon: <RefreshSm />,
        text: t("auth.reset.trust_revoke", "Password reset revokes all existing sessions automatically"),
      },
      {
        icon: <ShieldSm />,
        text: t("auth.reset.trust_strong", "Strong password required for workspace protection"),
      },
    ],
  };

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const resetFinished = status.toLowerCase().includes("password reset successful");
  const missingTokenMessage = t(
    "auth.reset.missing_token",
    "This reset link is missing a token. Please request a new one.",
  );
  const resolvedError = token ? error : missingTokenMessage;
  const resolvedVerifying = token ? verifying : false;
  const resolvedValid = token ? valid : false;

  useEffect(() => {
    let alive = true;

    if (!token) {
      if (AUTH_ROUTE_PARAM_GUARDS) {
        router.replace("/forgot-password");
      }
      return () => {
        alive = false;
      };
    }

    queueMicrotask(() => {
      if (!alive) return;
      setVerifying(true);
      setError("");
      setStatus("");

      validatePasswordResetToken(token)
        .then((result) => {
          if (!alive) return;
          setValid(result.valid);
          if (!result.valid) {
            if (AUTH_ROUTE_PARAM_GUARDS) {
              router.replace("/forgot-password");
              return;
            }
            setError(result.message);
          } else {
            setStatus(result.message);
          }
        })
        .catch((err) => {
          if (!alive) return;
          if (AUTH_ROUTE_PARAM_GUARDS) {
            router.replace("/forgot-password");
            return;
          }
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
    });

    return () => {
      alive = false;
    };
  }, [router, t, token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!token) {
      setError(missingTokenMessage);
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

  return (
    <AuthShell
      variant="split"
      brand={brand}
      badge={t("auth.reset.badge", "Reset Password")}
      title={t("auth.reset.title", "Reset password")}
      description={t("auth.reset.description", "Create a new password, then sign in again with the same email.")}
    >
      {resolvedVerifying ? (
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

          {resolvedError ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-red-300">
              {resolvedError}
            </div>
          ) : null}

          {resolvedValid && !resolvedVerifying ? (
            <div className="space-y-4">

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

          {!resolvedValid && !resolvedVerifying && resolvedError ? (
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
