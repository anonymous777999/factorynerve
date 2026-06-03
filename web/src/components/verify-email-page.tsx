"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Lock, Mail, ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api";
import { AUTH_ROUTE_PARAM_GUARDS } from "@/config/featureFlags";
import { validateEmailVerificationToken, verifyEmail } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors", "common"]);
  const router = useRouter();
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
    <AuthWorkstationShell
      sidePanel="minimal"
      badge={t("auth.verify.badge", "Email Verification")}
      title={t("auth.verify.title", "Verify email")}
      description={t("auth.verify.description", "Confirm your email address so the account can sign in securely.")}
      leftEyebrow={t("auth.shell.guardrails", "Guardrails")}
      leftTitle={t("auth.verify.journey_title", "Use inbox ownership as the final activation gate.")}
      leftDescription={t("auth.verify.journey_description", "Verification turns a pending signup into a real account or confirms ownership on an existing local account.")}
      supportTitle={t("auth.verify.support_title", "Why we verify before login")}
      supportDescription={t("auth.verify.support_description", "This keeps every activated account tied to a reachable email owner before factory access starts.")}
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: t("auth.verify.step_1_detail", "The inbox owner proves they can open the secure verification email."),
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: t("auth.verify.step_2_detail", "Pending signups become real accounts only after the token is redeemed."),
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: t("auth.verify.step_3_detail", "Once verification succeeds, sign in with the same email and password."),
        },
      ]}
      panelClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      {resolvedVerifying ? (
        <div className="rounded-panel border border-border-default bg-surface-shell p-4 text-sm text-text-secondary" role="status">
          {t("auth.verify.verifying", "Checking your verification link...")}
        </div>
      ) : null}

      {status ? (
        <div className="rounded-panel border border-status-success-border bg-status-success-bg p-4 text-sm text-status-success-fg" role="status">
          <div>{status}</div>
          {verificationFinished ? (
            <div className="mt-3 rounded-panel border border-border-default bg-surface-shell p-3 text-xs text-text-primary">
              {t("auth.verify.next_step", "Next step: return to sign in and use the same email and password from registration.")}
            </div>
          ) : null}
        </div>
      ) : null}

      {resolvedError ? (
        <div className="rounded-panel border border-status-danger-border bg-status-danger-bg p-4 text-sm text-status-danger-fg" role="alert">
          {resolvedError}
        </div>
      ) : null}

      {resolvedValid && !resolvedVerifying ? (
        <>
          <div className="rounded-panel border border-border-default bg-surface-shell p-4 text-sm text-text-primary">
            {t("auth.verify.prep", "Confirm this link once, then return to sign in with the same registration email.")}
          </div>
          <Button type="button" onClick={onVerify} disabled={loading} className="factory-auth-cta w-full border-transparent">
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
    </AuthWorkstationShell>
  );
}
