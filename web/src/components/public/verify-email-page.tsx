"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { AUTH_ROUTE_PARAM_GUARDS } from "@/config/featureFlags";
import { validateEmailVerificationToken, verifyEmail } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

function MailSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
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

function ZapSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}

function GlobeSm() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

export default function VerifyEmailPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "common"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token") || searchParams.get("verification_token") || "",
    [searchParams],
  );

  const brand = {
    appInitial: "D",
    appName: "DPR.ai",
    eyebrow: t("auth.verify.badge", "Email Verification"),
    title: t("auth.verify.title", "Verify email"),
    description: t(
      "auth.verify.description",
      "Confirm your email address so the account can sign in securely.",
    ),
    trustPoints: [
      {
        icon: <MailSm />,
        text: t("auth.verify.trust_inbox", "Inbox ownership proves the email belongs to you"),
      },
      {
        icon: <ZapSm />,
        text: t("auth.verify.trust_activate", "Activates pending signup into a real DPR.ai account"),
      },
      {
        icon: <GlobeSm />,
        text: t("auth.verify.trust_secure", "Secure sign-in with verified email and password"),
      },
    ],
  };

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const isPendingSignupToken = status.toLowerCase().includes("create the account");
  const verificationFinished = status.toLowerCase().includes("sign in now") || status.toLowerCase().includes("ready to sign in");
  const loginHref = verificationFinished ? "/access?verified=1" : "/access";
  const missingTokenMessage = t(
    "auth.verify.missing_token",
    "This verification link is missing a token. Request a new one.",
  );
  const resolvedError = token ? error : missingTokenMessage;
  const resolvedVerifying = token ? verifying : false;
  const resolvedValid = token ? valid : false;

  useEffect(() => {
    let alive = true;

    if (!token) {
      if (AUTH_ROUTE_PARAM_GUARDS) {
        router.replace("/register");
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

      validateEmailVerificationToken(token)
        .then((result) => {
          if (!alive) return;
          setValid(result.valid);
          if (result.valid) {
            setStatus(result.message);
          } else {
            if (AUTH_ROUTE_PARAM_GUARDS) {
              router.replace("/register");
              return;
            }
            setError(result.message);
          }
        })
        .catch((err) => {
          if (!alive) return;
          if (AUTH_ROUTE_PARAM_GUARDS) {
            router.replace("/register");
            return;
          }
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
    });

    return () => {
      alive = false;
    };
  }, [router, t, token]);

  const onVerify = async () => {
    if (!token) {
      setError(missingTokenMessage);
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

  return (
    <AuthShell
      variant="split"
      brand={brand}
      badge={t("auth.verify.badge", "Email Verification")}
      title={t("auth.verify.title", "Verify email")}
      description={t("auth.verify.description", "Confirm your email address so the account can sign in securely.")}
    >
      {resolvedVerifying ? (
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

          {resolvedError ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-red-300">
              {resolvedError}
            </div>
          ) : null}

          {resolvedValid && !resolvedVerifying ? (
            <>

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
