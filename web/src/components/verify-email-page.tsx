"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { validateEmailVerificationToken, verifyEmail } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "common"]);
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token") || searchParams.get("verification_token") || "",
    [searchParams],
  );

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const isPendingSignupToken = status.toLowerCase().includes("create the account");
  const verificationFinished = status.toLowerCase().includes("sign in now") || status.toLowerCase().includes("ready to sign in");
  const loginHref = verificationFinished ? "/access?verified=1" : "/access";

  useEffect(() => {
    let alive = true;

    if (!token) {
      setValid(false);
      setVerifying(false);
      setError(t("auth.verify.missing_token", "This verification link is missing a token. Request a new one."));
      return () => {
        alive = false;
      };
    }

    setVerifying(true);
    setError("");
    setStatus("");

    validateEmailVerificationToken(token)
      .then((result) => {
        if (!alive) return;
        setValid(result.valid);
        if (result.valid) {
          setStatus(result.message);
        } else {
          setError(result.message);
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("auth.verify.invalid", "Could not verify the email link."));
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

  const onVerify = async () => {
    if (!token) {
      setError(t("auth.verify.missing_token", "This verification link is missing a token. Request a new one."));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await verifyEmail(token);
      setStatus(result.message);
      setValid(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.verify.failed", "Could not verify the email address."));
      }
    } finally {
      setLoading(false);
    }
  };

  // AUDIT: TEXT_NOISE - shorten the auth-shell narrative so the verification action stays primary
  return (
    <AuthShell
      badge={t("auth.verify.badge", "Email Verification")}
      title={t("auth.verify.title", "Verify email")}
      description={t("auth.verify.description", "Confirm your email address so the account can sign in securely.")}
      journeyTitle={t("auth.verify.journey_title", "Use inbox ownership as the final activation gate.")}
      journeyDescription={t("auth.verify.journey_description", "Verification turns a pending signup into a real account or confirms ownership on an existing local account.")}
      steps={[
        {
          title: t("auth.verify.step_1_title", "Open the verification link"),
          description: t("auth.verify.step_1_detail", "The inbox owner proves they can open the secure verification email."),
        },
        {
          title: t("auth.verify.step_2_title", "Confirm account activation"),
          description: t("auth.verify.step_2_detail", "Pending signups become real accounts only after the token is redeemed."),
        },
        {
          title: t("auth.verify.step_3_title", "Return to sign in"),
          description: t("auth.verify.step_3_detail", "Once verification succeeds, sign in with the same email and password."),
        },
      ]}
      supportTitle={t("auth.verify.support_title", "Why we verify before login")}
      supportDescription={t("auth.verify.support_description", "This keeps every activated account tied to a reachable email owner before factory access starts.")}
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
      guidanceKey="auth-verify-help"
    >
      {verifying ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
              {t("auth.verify.verifying", "Checking your verification link...")}
            </div>
          ) : null}

          {status ? (
            <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-4 text-sm text-green-200">
              <div>{status}</div>
              {verificationFinished ? (
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-green-100/90">
                  {t("auth.verify.next_step", "Next step: return to sign in and use the same email and password from registration.")}
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
            <>
              {/* AUDIT: DENSITY_OVERLOAD - add one compact prep card so the verify CTA reads as the clear next move */}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-4 text-sm text-[var(--text)]/90">
                {t("auth.verify.prep", "Confirm this link once, then return to sign in with the same registration email.")}
              </div>
              <Button type="button" onClick={onVerify} disabled={loading} className="w-full">
                {loading ? t("auth.verify.loading", "Verifying...") : isPendingSignupToken ? t("auth.verify.activate_account", "Activate account") : t("auth.verify.action", "Verify email")}
              </Button>
            </>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button variant="outline">{t("auth.verify.register", "Register")}</Button>
            </Link>
            <Link href={loginHref}>
              <Button>{t("auth.verify.sign_in", "Sign in")}</Button>
            </Link>
          </div>
    </AuthShell>
  );
}
