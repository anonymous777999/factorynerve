"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { validateEmailVerificationToken, verifyEmail } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
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
  const loginHref = verificationFinished ? "/login?verified=1" : "/login";
  const stateCard = useMemo(() => {
    if (verifying) {
      return {
        title: "Checking link",
        detail: "We are validating the verification token before allowing account activation.",
        className: "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]",
      };
    }
    if (verificationFinished) {
      return {
        title: "Email verified",
        detail: "The inbox is confirmed and this account can now sign in with the same email and password.",
        className: "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-green-100",
      };
    }
    if (valid) {
      return {
        title: "Ready to activate",
        detail: "This verification link is valid. Use the button below to redeem it and finish account activation.",
        className: "border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] text-sky-100",
      };
    }
    if (error) {
      return {
        title: "Verification needs attention",
        detail: "This link is invalid, expired, or already used. Go back to register or request a fresh verification email.",
        className: "border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] text-red-200",
      };
    }
    return {
      title: "Awaiting verification",
      detail: "Open the secure email link to prove inbox ownership before this account can sign in.",
      className: "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]",
    };
  }, [error, valid, verificationFinished, verifying]);

  useEffect(() => {
    let alive = true;

    if (!token) {
      setValid(false);
      setVerifying(false);
      setError("This verification link is missing a token. Request a new one.");
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
          setError("Could not verify the email link.");
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
  }, [token]);

  const onVerify = async () => {
    if (!token) {
      setError("This verification link is missing a token. Request a new one.");
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
        setError("Could not verify the email address.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Email Verification"
      title="Verify email"
      description="Confirm your email address so the DPR.ai account can sign in securely."
      journeyTitle="Use inbox ownership as the final gate before account activation."
      journeyDescription="Verification is the moment DPR.ai turns a pending signup into a real user account or confirms ownership on an existing local account."
      steps={[
        {
          title: "Open the verification link",
          description: "The person who controls the inbox proves they can receive and open the secure verification email.",
        },
        {
          title: "Confirm account activation",
          description: "Pending signups become real accounts only at this point, after the verification token is redeemed.",
        },
        {
          title: "Return to sign in",
          description: "Once verification succeeds, the account is ready to log in using the same email and password.",
        },
      ]}
      supportTitle="Why we verify before login"
      supportDescription="This prevents wrong inboxes from turning public signup into real factory access and keeps every activated account tied to a reachable email owner."
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      {verifying ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
          Checking your verification link...
        </div>
      ) : null}

      {status ? (
        <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-4 text-sm text-green-200">
          <div>{status}</div>
          {verificationFinished ? (
            <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-green-100/90">
              Next step: return to sign in and use the same email and password from registration.
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className={`rounded-2xl border p-4 text-sm ${stateCard.className}`}>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Link Status</div>
        <div className="mt-2 text-base font-semibold text-[var(--text)]">{stateCard.title}</div>
        <div className="mt-2 leading-6">{stateCard.detail}</div>
      </div>

      {valid && !verifying ? (
        <Button type="button" onClick={onVerify} disabled={loading} className="w-full">
          {loading ? "Verifying email..." : isPendingSignupToken ? "Create and Activate Account" : "Verify Email"}
        </Button>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <Link href="/register">
          <Button variant="outline" className="w-full sm:w-auto">Back to Register</Button>
        </Link>
        <Link href={loginHref}>
          <Button className="w-full sm:w-auto">Go to Login</Button>
        </Link>
      </div>
    </AuthShell>
  );
}
