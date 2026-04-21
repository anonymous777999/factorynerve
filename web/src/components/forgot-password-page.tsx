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
  const stateCard = response
    ? {
        title: isEmailDelivery ? "Inbox check required" : "Local reset link ready",
        detail: isEmailDelivery
          ? "Use only the newest email for this address. The reset link is time-limited and older links should be ignored."
          : "Preview mode is active, so you can open or copy the reset link directly from this screen.",
        className: isEmailDelivery
          ? "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-green-100"
          : "border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] text-sky-100",
      }
    : null;

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
      supportDescription="No account lookup."
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">Email Address</label>
          <Input
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full"
          />
        </div>
        {error && (
          <div className="rounded-lg border border-color-danger/25 bg-color-danger/10 p-3 text-sm text-color-danger">
            {error}
          </div>
        )}
        <Button
          type="submit"
          disabled={loading}
          variant="primary"
          className="w-full h-12 text-base font-semibold"
        >
          {loading ? "Preparing reset..." : "Send Reset Link"}
        </Button>
      </form>

      {stateCard ? (
        <div className={`rounded-2xl border p-4 text-sm ${stateCard.className}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Recovery Status</div>
          <div className="mt-2 text-base font-semibold text-text-primary">{stateCard.title}</div>
          <div className="mt-2 leading-6">{stateCard.detail}</div>
        </div>
      ) : null}

      {response ? (
        <div className="rounded-lg border border-color-success/25 bg-color-success/10 p-4 text-sm">
          <div className="font-semibold text-color-success">
            {isEmailDelivery ? "Reset email sent if the account exists" : "Reset link ready"}
          </div>
          <div className="mt-3 text-text-primary/90">{response.message}</div>
          <div className="mt-4 rounded-md border border-border bg-card-elevated p-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              What to do next
            </div>
            <ol className="mt-3 space-y-2 text-sm text-text-primary/90">
              <li>1. Check the inbox for {email}.</li>
              <li>2. Open the newest reset link only.</li>
              <li>3. Set a new password, then sign in again.</li>
            </ol>
          </div>
          <div className="mt-3 rounded-md border border-color-warning/25 bg-color-warning/10 p-3 text-xs text-color-warning">
            If you only just signed up and have not clicked the verification email yet, password reset will not arrive. Verify the signup email first because the real account is created only after verification.
          </div>
          {isEmailDelivery ? (
            <div className="mt-3 rounded-md border border-border bg-card-elevated p-3 text-xs text-text-muted">
              Same result for every email.
            </div>
          ) : null}
          {response.reset_link ? (
            <div className="mt-4 space-y-3">
              <div className="text-text-muted">
                Local preview mode is active, so your reset link is shown here directly.
              </div>
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <a
                  href={response.reset_link}
                  className="inline-flex w-full items-center justify-center rounded-md border border-color-primary/40 bg-color-primary/20 px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-color-primary/30 sm:w-auto"
                >
                  Open Reset Form
                </a>
                <Button type="button" variant="outline" onClick={copyResetLink} className="w-full sm:w-auto">
                  Copy Reset Link
                </Button>
              </div>
              {copyStatus ? <div className="text-xs text-text-muted">{copyStatus}</div> : null}
              <div className="break-all rounded-md border border-border bg-card p-3 text-xs text-text-muted font-mono">
                {response.reset_link}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-text-muted">
              Check your inbox, spam, and promotions folder for the reset email.
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:flex sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onResendVerification}
              disabled={resendingVerification}
              className="w-full flex-1"
            >
              {resendingVerification ? "Sending..." : "Resend Verification Email"}
            </Button>
            <Link href="/access" className="inline-flex w-full items-center justify-center text-sm text-color-primary hover:underline sm:w-auto">
              Back to sign in
            </Link>
          </div>
          {verificationStatus ? (
            <div className="mt-3 rounded-md border border-border bg-card-elevated p-3 text-sm text-text-muted">
              {verificationStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="text-center text-sm text-text-muted">
        Remembered it?{" "}
        <Link href="/access" className="text-color-primary hover:underline font-medium">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
