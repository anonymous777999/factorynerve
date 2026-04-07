"use client";

import Link from "next/link";
import { useState } from "react";

import { register, resendEmailVerification, type RegisterResponse } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { validatePhoneNumber } from "@/lib/validation";
import { AuthShell } from "@/components/auth-shell";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RegisterResponse | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const deliveryMode = success?.delivery_mode ?? null;
  const isPreviewMode = deliveryMode === "preview";
  const isEmailFailure = deliveryMode === "email_failed";
  const isEmailDelivery = !!success && !isPreviewMode && !isEmailFailure;
  const successState = success
    ? {
        title: isEmailFailure
          ? "Pending signup saved"
          : isEmailDelivery
            ? "Inbox verification required"
            : "Verification link ready",
        detail: isEmailFailure
          ? "The signup request is stored safely. You only need to resend verification after email delivery recovers."
          : isEmailDelivery
            ? "The real account stays locked until this inbox opens the verification email and activates the signup."
            : "Preview mode is active, so you can open the verification link directly from this screen.",
        className: isEmailFailure
          ? "border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] text-amber-100"
          : isEmailDelivery
            ? "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-green-100"
            : "border-[rgba(62,166,255,0.24)] bg-[rgba(62,166,255,0.08)] text-sky-100",
      }
    : null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setResendStatus("");
    if (companyCode.trim() && !factoryName.trim()) {
      setError("Factory/Company name is required to verify the company code.");
      return;
    }
    const phoneError = validatePhoneNumber(phoneNumber, "Phone number");
    if (phoneError) {
      setError(phoneError);
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        name,
        email,
        password,
        role: "attendance",
        factory_name: factoryName,
        company_code: companyCode || null,
        phone_number: phoneNumber || null,
      });
      setSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError("Backend not reachable. Check that FastAPI is running and NEXT_PUBLIC_API_BASE_URL is correct.");
      } else if (err instanceof Error && err.message.includes("Request timed out")) {
        setError("Signup is taking too long waiting for email delivery. Please try again or retry in a minute.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus("");
    try {
      const result = await resendEmailVerification(email);
      if (result.verification_link) {
        setSuccess((current) =>
          current
            ? {
                ...current,
                verification_link: result.verification_link,
                delivery_mode: result.delivery_mode,
              }
            : current,
        );
      }
      setResendStatus(result.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setResendStatus(err.message);
      } else if (err instanceof Error) {
        setResendStatus(err.message);
      } else {
        setResendStatus("Could not resend the verification email.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      badge="Public Signup"
      title="Create your account"
      description="Public signup creates an attendance-worker signup request. The account stays locked until the email owner verifies it."
      journeyTitle="Bring workers into the system without risking factory access."
      journeyDescription="We keep public registration intentionally narrow: collect the details, verify the inbox owner, then create the real account only after confirmation."
      steps={[
        {
          title: "Submit worker details",
          description: "Collect the person, factory, and contact details needed to prepare a pending signup safely.",
        },
        {
          title: "Verify the email inbox",
          description: "Only the inbox owner can open the verification link and activate the real DPR.ai account.",
        },
        {
          title: "Unlock sign-in",
          description: "After verification, the worker returns to sign in and start using the attendance-first workflow.",
        },
      ]}
      supportTitle="Why this feels stricter now"
      supportDescription="Wrong or fake emails can no longer create a working account. They only create a pending signup that stays locked until the real inbox verifies it."
      cardClassName="max-w-3xl"
    >
      {success ? (
        <div className="space-y-5">
              {successState ? (
                <div className={`rounded-2xl border p-4 text-sm ${successState.className}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Signup Status</div>
                  <div className="mt-2 text-base font-semibold text-[var(--text)]">{successState.title}</div>
                  <div className="mt-2 leading-6">{successState.detail}</div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] p-4 text-sm">
                <div className="font-semibold text-amber-300">
                  {isEmailFailure
                    ? "Signup saved, but email delivery needs another try"
                    : isEmailDelivery
                      ? "Check your inbox to finish signup"
                      : "Verification link ready"}
                </div>
                <div className="mt-2 text-[var(--text)]/90">{success.message}</div>
                <div className="mt-3 text-[var(--muted)]">
                  We saved a pending signup for <span className="font-medium text-[var(--text)]">{email}</span>.
                  The account cannot sign in until that inbox opens the verification link.
                </div>
                <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    What to do next
                  </div>
                  <ol className="mt-3 space-y-2 text-sm text-[var(--text)]/90">
                    <li>1. {isEmailFailure ? "Wait a minute, then request a fresh verification email." : `Open the inbox for ${email}.`}</li>
                    <li>
                      2. {isEmailFailure
                        ? "Use Resend Verification Email below until the message arrives."
                        : isEmailDelivery
                          ? "Click the verification email from DPR.ai."
                          : "Open the preview link below."}
                    </li>
                    <li>3. Return here and sign in after verification is complete.</li>
                  </ol>
                </div>
                {isEmailFailure ? (
                  <div className="mt-3 rounded-xl border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.28)] p-3 text-xs text-red-100">
                    The signup request is safe in the system, but the first verification email did not leave successfully. You do not need to fill the form again.
                  </div>
                ) : null}
                {isEmailDelivery ? (
                  <div className="mt-3 rounded-xl border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] p-3 text-xs text-[var(--muted)]">
                    If you do not see the email within a minute, check spam or promotions, then use
                    {" "}
                    <span className="font-medium text-[var(--text)]">Resend Verification Email</span>.
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  Random or wrong emails can create a pending record, but they do not get working access. Only the person who can open that inbox can activate the account.
                </div>
                <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  Password reset works only after verification is complete. Until then, use <span className="font-medium text-[var(--text)]">Resend Verification Email</span> instead of forgot password.
                </div>
                {success.verification_link ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-[var(--muted)]">
                      Local preview mode is active, so your verification link is shown here directly.
                    </div>
                    <div className="grid gap-3 sm:flex sm:flex-wrap">
                      <a
                        href={success.verification_link}
                        className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(62,166,255,0.4)] bg-[rgba(62,166,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[rgba(62,166,255,0.18)] sm:w-auto"
                      >
                        Open Verification Page
                      </a>
                    </div>
                    <div className="break-all text-xs text-[var(--muted)]">{success.verification_link}</div>
                  </div>
                ) : isEmailFailure ? (
                  <div className="mt-3 text-[var(--muted)]">
                    Use resend once the email service is healthy again. The pending signup is already stored.
                  </div>
                ) : (
                  <div className="mt-3 text-[var(--muted)]">
                    Check your inbox and spam folder for the verification email.
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                <Button type="button" variant="outline" onClick={onResend} disabled={resending} className="w-full sm:w-auto">
                  {resending ? "Sending..." : "Resend Verification Email"}
                </Button>
                <Link href="/login" className="inline-flex w-full items-center justify-center text-sm text-[var(--accent)] underline sm:w-auto">
                  Back to sign in
                </Link>
              </div>

              {resendStatus ? (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--muted)]">
                  {resendStatus}
                </div>
              ) : null}
            </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[rgba(77,163,255,0.18)] bg-[rgba(77,163,255,0.08)] p-4">
            <div className="text-sm font-semibold text-text-primary">Prefer the faster Google route?</div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">
              Continue with Google to create or link a workspace owner account without filling the full public signup form.
            </div>
            <div className="mt-4">
              <GoogleAuthButton
                nextPath="/dashboard"
                hint="Use this when you want the direct workspace-owner flow. The form below still creates the attendance-worker signup request."
              />
            </div>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Passwords must be 12+ characters with mixed case, number, and symbol.
                </p>
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Account Type</label>
                <Input value="Attendance worker access" readOnly aria-readonly />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Company / Factory Name</label>
                <Input value={factoryName} onChange={(e) => setFactoryName(e.target.value)} required />
              </div>
              <div className="md:col-span-1">
                <label className="text-sm text-[var(--muted)]">Company Code (optional)</label>
                <Input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-[var(--muted)]">Phone Number (optional)</label>
                <Input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              {error ? (
                <div className="md:col-span-2 rounded-lg border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <div className="md:col-span-2 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Creating account..." : "Register"}
                </Button>
                <Link href="/login" className="inline-flex w-full items-center justify-center text-sm text-[var(--accent)] underline sm:w-auto">
                  Already have an account? Sign in
                </Link>
              </div>
            </form>
        </div>
      )}
    </AuthShell>
  );
}
