"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { ApiError } from "@/lib/api";
import { register, resendEmailVerification, type RegisterResponse } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePhoneNumber } from "@/lib/validation";

const trustSignals = [
  {
    title: "Verified Email",
    caption: "Inbox activation",
    Icon: ShieldCheck,
  },
  {
    title: "Secure Session",
    caption: "Protected access",
    Icon: LockKeyhole,
  },
  {
    title: "Role-Based Access",
    caption: "Attendance-first",
    Icon: KeyRound,
  },
];

function destinationLabel(path: string) {
  switch (path) {
    case "/attendance":
      return "attendance desk";
    case "/dashboard":
      return "operations board";
    case "/approvals":
      return "review queue";
    case "/reports":
      return "reports desk";
    default:
      return "workspace";
  }
}

export default function RegisterPage() {
  const searchParams = useSearchParams();
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

  const nextPath = searchParams.get("next") || "/";
  const nextDestination = destinationLabel(nextPath);
  const hasRedirectTarget = nextPath !== "/";
  const deliveryMode = success?.delivery_mode ?? null;
  const isPreviewMode = deliveryMode === "preview";
  const isEmailFailure = deliveryMode === "email_failed";
  const isEmailDelivery = !!success && !isPreviewMode && !isEmailFailure;

  const successState = useMemo(() => {
    if (!success) return null;
    return {
      title: isEmailFailure
        ? "Verification email failed"
        : isEmailDelivery
          ? "Check your inbox"
          : "Verification link ready",
      detail: isEmailFailure
        ? "Your signup is saved. Send a fresh verification email when delivery recovers."
        : isEmailDelivery
          ? "This account stays locked until the inbox owner opens the verification email."
          : "Preview mode is active, so the verification link is available below.",
      className: isEmailFailure
        ? "border-[rgba(245,158,11,0.26)] bg-[rgba(245,158,11,0.12)] text-[rgba(255,218,161,0.96)]"
        : isEmailDelivery
          ? "border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.10)] text-[rgba(197,226,255,0.96)]"
          : "border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.10)] text-[rgba(197,226,255,0.96)]",
    };
  }, [isEmailDelivery, isEmailFailure, success]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setResendStatus("");

    if (companyCode.trim() && !factoryName.trim()) {
      setError("Factory name is required to verify the company code.");
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
        setError("Backend not reachable. Check FastAPI and your API base URL.");
      } else if (err instanceof Error && err.message.includes("Request timed out")) {
        setError("Verification email delayed. Retry in a minute.");
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
    <main className="industrial-auth-shell relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.42] [background-image:linear-gradient(rgba(111,168,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(111,168,255,0.12)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="pointer-events-none absolute inset-x-[7%] top-[72px] h-px bg-[rgba(125,176,255,0.14)]" />
      <div className="pointer-events-none absolute inset-x-[7%] bottom-[88px] h-px bg-[rgba(125,176,255,0.10)]" />
      <div className="pointer-events-none absolute inset-y-[10%] left-[7%] w-px bg-[rgba(125,176,255,0.14)]" />
      <div className="pointer-events-none absolute inset-y-[10%] right-[7%] w-px bg-[rgba(125,176,255,0.14)]" />
      <div className="pointer-events-none absolute left-[7%] top-[10%] h-2 w-2 rounded-full bg-[rgba(140,184,255,0.28)]" />
      <div className="pointer-events-none absolute right-[7%] top-[10%] h-2 w-2 rounded-full bg-[rgba(140,184,255,0.28)]" />
      <div className="pointer-events-none absolute left-[7%] bottom-[10%] h-2 w-2 rounded-full bg-[rgba(140,184,255,0.24)]" />
      <div className="pointer-events-none absolute right-[7%] bottom-[10%] h-2 w-2 rounded-full bg-[rgba(140,184,255,0.24)]" />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-56 w-56 -translate-x-1/2 rounded-full bg-[rgba(59,130,246,0.16)] blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-[52%] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-[rgba(14,165,233,0.08)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <section className="industrial-auth-card w-full max-w-[38rem] rounded-[2rem] px-6 py-7 sm:px-10 sm:py-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-3">
              <span className="industrial-auth-mark">
                <span>D</span>
              </span>
              <span className="type-screen-title font-black tracking-[-0.05em] text-white">
                DPR.ai
              </span>
            </div>

            <h1 className="type-screen-title mt-9 font-black tracking-[-0.065em] text-white">
              Create Factory Access
            </h1>
            <p className="type-body-secondary mx-auto mt-4 max-w-[28rem] text-[rgba(214,224,238,0.7)]">
              Set up a verified attendance account for the factory team, then unlock sign-in after inbox confirmation.
            </p>
            {hasRedirectTarget ? (
              <p className="type-caption mx-auto mt-3 max-w-[24rem] font-medium uppercase tracking-[0.18em] text-[rgba(170,202,244,0.62)]">
                After verification, continue to {nextDestination}
              </p>
            ) : null}
          </div>

          {success ? (
            <div className="mt-8 space-y-4">
              {successState ? (
                <div className={`type-body-secondary rounded-[1rem] border px-4 py-4 ${successState.className}`}>
                  <div className="type-caption font-semibold uppercase tracking-[0.24em] text-white/70">
                    Signup status
                  </div>
                  <div className="type-card-title mt-2 text-white">{successState.title}</div>
                  <div className="type-body-secondary mt-1">{successState.detail}</div>
                </div>
              ) : null}

              <div className="type-body-secondary rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[rgba(219,227,239,0.84)]">
                <div className="type-caption font-semibold uppercase tracking-[0.24em] text-white/60">
                  Next step
                </div>
                <div className="type-body-secondary mt-2">
                  We saved the signup for <span className="font-semibold text-white">{email}</span>. The account stays locked until that inbox opens the verification link.
                </div>
              </div>

              {success.verification_link ? (
                <div className="type-body-secondary rounded-[1rem] border border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.08)] px-4 py-4 text-[rgba(214,229,247,0.88)]">
                  <div className="type-caption font-semibold uppercase tracking-[0.24em] text-white/70">
                    Preview link
                  </div>
                  <a
                    href={success.verification_link}
                    className="type-body-secondary mt-3 inline-flex h-11 items-center justify-center rounded-[0.9rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-4 font-semibold text-white transition hover:bg-[rgba(255,255,255,0.09)]"
                  >
                    Open verification page
                  </a>
                  <div className="type-caption mt-3 break-all text-[rgba(208,220,236,0.66)]">{success.verification_link}</div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResend}
                  disabled={resending}
                  className="h-12 rounded-[0.95rem] border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-white hover:bg-[rgba(255,255,255,0.08)]"
                >
                  {resending ? "Sending..." : "Resend verification"}
                </Button>
                <Link
                  href="/login"
                  className="type-body-secondary inline-flex h-12 items-center justify-center rounded-[0.95rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 font-semibold text-[rgba(195,221,255,0.96)] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                >
                  Back to sign in
                </Link>
              </div>

              {resendStatus ? (
                <div className="type-body-secondary rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[rgba(215,223,236,0.78)]">
                  {resendStatus}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="mt-8">
                <GoogleAuthButton
                  nextPath="/dashboard"
                  label="Continue with Google"
                  className="space-y-3"
                  hint="Use Google when you want the faster workspace-owner route instead of worker signup."
                  buttonClassName="industrial-google-button h-11 rounded-[1rem] border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.035)] px-4 text-sm font-semibold text-white hover:bg-[rgba(255,255,255,0.055)] [&>span:first-child]:h-11 [&>span:first-child]:w-11 [&>span:first-child]:rounded-[0.85rem] [&>span:first-child]:border-white/12 [&>span:first-child]:shadow-[0_10px_24px_rgba(15,23,42,0.32)]"
                  hintClassName="text-center text-[rgba(202,213,228,0.62)]"
                />
              </div>

              <div className="industrial-auth-divider mt-8">
                <span>Or continue with email</span>
              </div>

              <form onSubmit={onSubmit} className="mt-7 space-y-[1.15rem]">
                <div className="grid gap-[1.15rem] sm:grid-cols-2">
                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Full name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Email</label>
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Password</label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                    />
                    <p className="type-caption text-[rgba(198,209,223,0.58)]">
                      Use 12+ characters with mixed case, number, and symbol.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Account type</label>
                    <Input
                      value="Attendance worker access"
                      readOnly
                      aria-readonly
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(199,210,226,0.72)]"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Factory name</label>
                    <Input
                      value={factoryName}
                      onChange={(e) => setFactoryName(e.target.value)}
                      required
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="type-body-secondary font-medium text-white">Company code</label>
                    <Input
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value)}
                      className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="type-body-secondary font-medium text-white">Phone number</label>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                  />
                </div>

                {error ? (
                  <div className="type-body-secondary rounded-[1rem] border border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-[rgba(255,188,188,0.96)]">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="industrial-auth-submit h-11 w-full rounded-[1rem] text-base font-bold tracking-[-0.01em]"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create account"
                  )}
                </Button>

                <div className="type-body-secondary text-center text-[rgba(214,224,238,0.76)]">
                  Already have an account?{" "}
                  <Link href="/login" className="font-medium text-[rgba(195,221,255,0.96)] underline underline-offset-4 hover:text-white">
                    Sign in
                  </Link>
                </div>
              </form>
            </>
          )}

          <div className="mt-10 grid gap-4 border-t border-white/8 pt-7 sm:grid-cols-3">
            {trustSignals.map(({ title, caption, Icon }) => (
              <div key={title} className="industrial-auth-feature text-center">
                <span className="industrial-auth-feature-icon">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="type-card-title mt-3 text-white">{title}</div>
                <div className="type-body-secondary mt-1 text-[rgba(193,204,218,0.64)]">{caption}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
