"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { requestPasswordReset, resendEmailVerification, type PasswordForgotResponse } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
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
      setCopyStatus("Reset link copied.");
      window.setTimeout(() => setCopyStatus(""), 2200);
    } catch {
      setCopyStatus("Could not copy automatically. You can still open the link below.");
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
        setError("Could not start password recovery.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendVerification = async () => {
    if (!email) {
      setVerificationStatus("Enter the same signup email first, then resend verification.");
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
        setVerificationStatus("Could not resend the verification email.");
      }
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <AuthShell
      badge="Password Recovery"
      title="Forgot password"
      description="Enter your account email and we will prepare a secure password reset path for you."
      journeyTitle="Recover access without exposing who is in the system."
      journeyDescription="The recovery flow protects user privacy, sends time-limited reset links, and avoids leaking whether a specific email address is registered."
      steps={[
        {
          title: "Request a reset link",
          description: "Submit the account email you want to recover. The response stays privacy-safe either way.",
        },
        {
          title: "Open the newest email",
          description: "Only the latest valid reset email should be used, especially if multiple links were requested.",
        },
        {
          title: "Set a fresh password",
          description: "Choose a strong password, then sign in again using the same email address.",
        },
      ]}
      supportTitle="Privacy-safe by design"
      supportDescription="This screen intentionally does not confirm whether an email exists. Password reset only works after the signup email has been verified and the real account has been created."
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">Email</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error ? <div className="text-sm text-red-400">{error}</div> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Preparing reset..." : "Send Reset Link"}
            </Button>
          </form>

          {response ? (
            <div className="rounded-2xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-4 text-sm">
              <div className="font-semibold text-green-300">
                {isEmailDelivery ? "Reset email sent if the account exists" : "Reset link ready"}
              </div>
              <div className="mt-2 text-[var(--text)]/90">{response.message}</div>
              <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  What to do next
                </div>
                <ol className="mt-3 space-y-2 text-sm text-[var(--text)]/90">
                  <li>1. Check the inbox for {email}.</li>
                  <li>2. Open the newest reset link only.</li>
                  <li>3. Set a new password, then sign in again.</li>
                </ol>
              </div>
              <div className="mt-3 rounded-xl border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] p-3 text-xs text-amber-100">
                If you only just signed up and have not clicked the verification email yet, password reset will not arrive. Verify the signup email first because the real account is created only after verification.
              </div>
              {isEmailDelivery ? (
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  For privacy, this page always shows the same result whether the email exists or not. If the account is real, active, and eligible for reset, the email will arrive in that inbox.
                </div>
              ) : null}
              {response.reset_link ? (
                <div className="mt-4 space-y-3">
                  <div className="text-[var(--muted)]">
                    Local preview mode is active, so your reset link is shown here directly.
                  </div>
                  <a
                    href={response.reset_link}
                    className="inline-flex rounded-full border border-[rgba(62,166,255,0.4)] bg-[rgba(62,166,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(62,166,255,0.18)]"
                  >
                    Open Reset Form
                  </a>
                  <Button type="button" variant="outline" onClick={copyResetLink}>
                    Copy Reset Link
                  </Button>
                  {copyStatus ? <div className="text-xs text-[var(--muted)]">{copyStatus}</div> : null}
                  <div className="break-all text-xs text-[var(--muted)]">{response.reset_link}</div>
                </div>
              ) : (
                <div className="mt-3 text-[var(--muted)]">
                  Check your inbox, spam, and promotions folder for the reset email.
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={onResendVerification} disabled={resendingVerification}>
                  {resendingVerification ? "Sending..." : "Resend Verification Email Instead"}
                </Button>
                <Link href="/login" className="text-sm text-[var(--accent)] underline">
                  Back to sign in
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
            <Link href="/login" className="text-[var(--accent)] underline">
              Back to sign in
            </Link>
          </div>
    </AuthShell>
  );
}
