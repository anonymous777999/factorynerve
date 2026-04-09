"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Factory, LoaderCircle, ShieldCheck } from "lucide-react";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { login, resendEmailVerification, warmBackendConnection } from "@/lib/auth";

function destinationLabel(path: string) {
  switch (path) {
    case "/attendance":
      return "your attendance desk";
    case "/dashboard":
      return "your operations board";
    case "/approvals":
      return "your review queue";
    case "/reports":
      return "your reports desk";
    case "/settings":
      return "your admin desk";
    case "/control-tower":
      return "your factory network";
    case "/premium/dashboard":
      return "your owner desk";
    default:
      return "your workspace";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [infoTone, setInfoTone] = useState<"neutral" | "success">("neutral");
  const [resending, setResending] = useState(false);

  const routeInfo = useMemo(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      return {
        message: oauthError,
        tone: "error" as const,
      };
    }
    if (searchParams.get("reset") === "1") {
      return {
        message: "Password updated successfully. Sign in with your new password.",
        tone: "success" as const,
      };
    }
    if (searchParams.get("verified") === "1") {
      return {
        message: "Email verified successfully. You can sign in now.",
        tone: "success" as const,
      };
    }
    return null;
  }, [searchParams]);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return "/";
    }
    if (raw === "/login" || raw === "/register") {
      return "/";
    }
    return raw;
  }, [searchParams]);

  const nextDestination = useMemo(() => destinationLabel(nextPath), [nextPath]);
  const hasRedirectTarget = nextPath !== "/";
  const canResendVerification = error.toLowerCase().includes("verify your email");

  useEffect(() => {
    void warmBackendConnection();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    setInfoTone("neutral");

    try {
      await login(email, password);
      router.replace(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 503
            ? "FactoryNerve is waking up on the backend. Please wait a few seconds and try again."
            : err.message,
        );
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError("Backend not reachable. Check that FastAPI is running and NEXT_PUBLIC_API_BASE_URL is correct.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onResendVerification = async () => {
    if (!email) {
      setInfo("Enter the same email address first, then resend verification.");
      setInfoTone("neutral");
      return;
    }

    setResending(true);
    setInfo("");
    setInfoTone("neutral");

    try {
      const result = await resendEmailVerification(email);
      setInfo(result.message);
      setInfoTone("success");
    } catch (err) {
      if (err instanceof ApiError) {
        setInfo(err.message);
      } else if (err instanceof Error) {
        setInfo(err.message);
      } else {
        setInfo("Could not resend the verification email.");
      }
      setInfoTone("neutral");
    } finally {
      setResending(false);
    }
  };

  const notice = useMemo(() => {
    if (routeInfo) {
      return {
        title: routeInfo.tone === "success" ? "Ready to continue" : "Sign-in needs attention",
        detail: routeInfo.message,
        className:
          routeInfo.tone === "success"
            ? "border-color-success/25 bg-color-success/10 text-color-success"
            : "border-color-danger/25 bg-color-danger/10 text-color-danger",
      };
    }

    if (info) {
      return {
        title: infoTone === "success" ? "Verification updated" : "Action needed",
        detail: info,
        className:
          infoTone === "success"
            ? "border-color-success/25 bg-color-success/10 text-color-success"
            : "border-border bg-card-elevated text-text-primary",
      };
    }

    return null;
  }, [info, infoTone, routeInfo]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,176,255,0.18),transparent_28%),radial-gradient(circle_at_85%_16%,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,rgba(5,11,19,0.98),rgba(11,19,31,0.96))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-position:center] [background-size:72px_72px]" />
      <div className="pointer-events-none absolute -left-12 top-20 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-xl">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(77,163,255,0.24),rgba(20,184,166,0.2))] text-[rgba(214,237,255,0.96)]">
              <Factory className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-white">FactoryNerve</div>
              <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Secure sign in</div>
            </div>
          </Link>

          <Card className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(14,22,35,0.9),rgba(10,16,26,0.96))] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur">
            <CardHeader className="space-y-4 border-b border-white/8 pb-6">
              <div className="inline-flex w-fit rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                Secure Sign In
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl text-white sm:text-[2rem]">Sign in</CardTitle>
                <p className="text-sm leading-7 text-slate-300">
                  {hasRedirectTarget
                    ? `Use your verified email or Google account to continue to ${nextDestination}.`
                    : "Use your verified email or Google account to continue into your workspace."}
                </p>
              </div>

              {hasRedirectTarget ? (
                <div className="rounded-xl border border-color-primary/20 bg-color-primary/10 p-4 text-sm text-text-primary">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">After sign-in</div>
                  <div className="mt-2 text-base font-semibold">You will open {nextDestination}.</div>
                  <div className="mt-2 leading-6 text-text-secondary">
                    Sign in with the same verified inbox that already belongs to this workspace.
                  </div>
                </div>
              ) : null}

              {notice ? (
                <div className={`rounded-xl border p-4 text-sm ${notice.className}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Status</div>
                  <div className="mt-2 text-base font-semibold text-text-primary">{notice.title}</div>
                  <div className="mt-2 leading-6">{notice.detail}</div>
                </div>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              <GoogleAuthButton
                nextPath={nextPath}
                hint={
                  hasRedirectTarget
                    ? `Use Google to continue to ${nextDestination} without typing a password.`
                    : "Use your Google account to open the same factory-safe session without typing a password."
                }
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-[0.18em] text-text-muted">
                  <span className="bg-[rgba(10,16,26,0.96)] px-3">or continue with email</span>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-primary">Email Address</label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <PasswordField
                  label="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={setPassword}
                  required
                  className="w-full"
                />

                {error ? (
                  <div
                    className={
                      canResendVerification
                        ? "rounded-lg border border-color-warning/25 bg-color-warning/10 p-4 text-sm text-color-warning"
                        : "rounded-lg border border-color-danger/25 bg-color-danger/10 p-4 text-sm text-color-danger"
                    }
                  >
                    <div className="font-medium">{error}</div>
                    {canResendVerification ? (
                      <div className="mt-2 text-xs text-color-warning/80">
                        This inbox still needs verification before sign-in can continue.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {canResendVerification ? (
                  <div className="rounded-xl border border-border bg-card-elevated p-4">
                    <div className="text-sm font-semibold text-text-primary">Need a fresh verification email?</div>
                    <div className="mt-2 text-sm leading-6 text-text-secondary">
                      Enter the same signup email above, then resend verification and come back after the inbox confirms the account.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onResendVerification}
                      disabled={resending}
                      className="mt-4 w-full h-11"
                    >
                      {resending ? "Sending..." : "Resend Verification Email"}
                    </Button>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="text-text-muted">Use the inbox already linked to your workspace.</div>
                  <Link href="/forgot-password" className="font-medium text-color-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  variant="primary"
                  className="h-12 w-full text-base font-semibold"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : hasRedirectTarget ? (
                    "Sign in and continue"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300 backdrop-blur">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-[rgba(112,184,255,0.96)]" />
                Secure session
              </div>
              <div className="mt-2 leading-6">Cookie-backed sign-in keeps the factory session safer after authentication.</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300 backdrop-blur">
              <div className="font-semibold text-white">Need a new workspace?</div>
              <div className="mt-2 leading-6">
                Create an account first if your team has not been onboarded yet.
              </div>
              <Link href="/register" className="mt-3 inline-flex items-center gap-2 font-medium text-color-primary hover:underline">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
