"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { resetPassword, validatePasswordResetToken } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
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
      setError("This reset link is missing a token. Please request a new one.");
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
          setError("Could not verify the reset link.");
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

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!token) {
      setError("This reset link is missing a token. Please request a new one.");
      return;
    }
    if (!password || password !== confirmPassword) {
      setError("Passwords do not match.");
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
        router.push("/login?reset=1");
      }, 2200);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not reset password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Reset Password"
      title="Reset password"
      description="Create a new password, then sign in again with the same email address."
      journeyTitle="Turn one-time recovery links into a clean account reset."
      journeyDescription="Each reset link is temporary and one-time-use. Once the new password is saved, earlier sessions are revoked and the user signs back in with the updated secret."
      steps={[
        {
          title: "Validate the link",
          description: "We first check whether the recovery link is still valid and tied to an active account.",
        },
        {
          title: "Set a strong new password",
          description: "Use a fresh password with enough length and complexity for long-term access safety.",
        },
        {
          title: "Sign in again",
          description: "After the reset completes, return to login and continue with the new password only.",
        },
      ]}
      supportTitle="Why old sessions stop working"
      supportDescription="Password reset revokes active refresh sessions so only the new password can open fresh authenticated sessions after recovery."
      cardClassName="max-w-xl"
      contentClassName="space-y-5"
    >
      {verifying ? (
        <div className="rounded-lg border border-border bg-card-elevated p-4 text-sm text-text-muted">
          Verifying your reset link...
        </div>
      ) : null}

      {status ? (
        <div className="rounded-lg border border-color-success/25 bg-color-success/10 p-4 text-sm text-color-success">
          <div className="font-medium">{status}</div>
          {resetFinished ? (
            <div className="mt-3 rounded-md border border-border bg-card p-3 text-xs text-color-success/90">
              Next step: use your new password on the sign-in screen. You will be redirected there automatically.
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-color-danger/25 bg-color-danger/10 p-4 text-sm text-color-danger">
          {error}
        </div>
      ) : null}

      {valid && !verifying ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-card-elevated p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              What to do next
            </div>
            <ol className="mt-3 space-y-2 text-sm text-text-primary/90">
              <li>1. Enter a strong new password.</li>
              <li>2. Confirm it once more below.</li>
              <li>3. Sign in with the same email and your new password.</li>
            </ol>
            <div className="mt-4 text-xs text-text-muted">
              This reset link can only be used once. If it expires, request a new link.
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <PasswordField
              label="New Password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
              className="w-full"
            />
            <PasswordStrengthMeter password={password} />
            <div className="text-xs text-text-muted">
              Use 12+ characters with uppercase, lowercase, number, and symbol.
            </div>
            <PasswordField
              label="Confirm Password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              className="w-full"
            />
            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? "Resetting password..." : "Reset Password"}
            </Button>
          </form>
        </div>
      ) : null}

      {!valid && !verifying && error ? (
        <div className="rounded-lg border border-border bg-card-elevated p-4 text-sm text-text-muted">
          Use <span className="font-medium text-text-primary">Request New Link</span> below to generate a fresh password reset email. Only the newest valid link should be used.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/forgot-password" className="flex-1">
          <Button variant="outline" className="w-full h-11">Request New Link</Button>
        </Link>
        <Link href="/login" className="flex-1">
          <Button variant="primary" className="w-full h-11">Back to Login</Button>
        </Link>
      </div>
    </AuthShell>
  );
}
