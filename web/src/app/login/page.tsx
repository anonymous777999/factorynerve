"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { login, resendEmailVerification, warmBackendConnection } from "@/lib/auth";
import { getHomeDestination } from "@/lib/role-navigation";

const trustSignals = [
  {
    title: "Verified Email",
    caption: "Verify your email",
    Icon: ShieldCheck,
  },
  {
    title: "Secure Session",
    caption: "Secure sign in",
    Icon: LockKeyhole,
  },
  {
    title: "Role-Based Access",
    caption: "Role controls",
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
    case "/settings":
      return "admin desk";
    case "/control-tower":
      return "control tower";
    case "/premium/dashboard":
      return "owner desk";
    default:
      return "workspace";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
        message: "Password updated.",
        tone: "success" as const,
      };
    }
    if (searchParams.get("verified") === "1") {
      return {
        message: "Email verified.",
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
      const authContext = await login(email, password);
      const roleHome = getHomeDestination(
        authContext.user.role,
        authContext.organization?.accessible_factories ?? authContext.factories?.length ?? 0,
      );
      router.replace(nextPath === "/" ? roleHome : nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 503 ? "Waking backend... Try again in a moment." : err.message);
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError("Backend not reachable. Check FastAPI and your API base URL.");
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
      setInfo("Enter your signup email first.");
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
    if (error) {
      return {
        title: canResendVerification ? "Verification required" : "Sign-in blocked",
        detail: error,
        className: canResendVerification
          ? "border-[rgba(245,158,11,0.26)] bg-[rgba(245,158,11,0.12)] text-[rgba(255,218,161,0.96)]"
          : "border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.10)] text-[rgba(255,188,188,0.96)]",
      };
    }

    if (info) {
      return {
        title: infoTone === "success" ? "Verification updated" : "Factory note",
        detail: info,
        className:
          infoTone === "success"
            ? "border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.10)] text-[rgba(197,226,255,0.96)]"
            : "border-white/10 bg-[rgba(255,255,255,0.04)] text-[rgba(218,226,239,0.88)]",
      };
    }

    if (routeInfo) {
      return {
        title: routeInfo.tone === "success" ? "Access updated" : "Google sign-in blocked",
        detail: routeInfo.message,
        className:
          routeInfo.tone === "success"
            ? "border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.10)] text-[rgba(197,226,255,0.96)]"
            : "border-[rgba(239,68,68,0.24)] bg-[rgba(239,68,68,0.10)] text-[rgba(255,188,188,0.96)]",
      };
    }

    return null;
  }, [canResendVerification, error, info, infoTone, routeInfo]);

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
        <section className="industrial-auth-card w-full max-w-[34rem] rounded-[2rem] px-6 py-7 sm:px-10 sm:py-10">
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
              Secure Factory Sign-In
            </h1>
            <p className="type-body-secondary mx-auto mt-4 max-w-[25rem] text-[rgba(214,224,238,0.7)]">
              Modern industrial AI operations platform dashboard for factory management.
            </p>
            {hasRedirectTarget ? (
              <p className="type-caption mx-auto mt-3 max-w-[22rem] font-medium uppercase tracking-[0.18em] text-[rgba(170,202,244,0.62)]">
                Continuing to {nextDestination}
              </p>
            ) : null}
          </div>

          <div className="mt-8">
            <GoogleAuthButton
              nextPath={nextPath}
              label="Sign in with Google"
              className="space-y-3"
              buttonClassName="industrial-google-button h-11 rounded-[1rem] border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.035)] px-4 text-sm font-semibold text-white hover:bg-[rgba(255,255,255,0.055)] [&>span:first-child]:h-11 [&>span:first-child]:w-11 [&>span:first-child]:rounded-[0.85rem] [&>span:first-child]:border-white/12 [&>span:first-child]:shadow-[0_10px_24px_rgba(15,23,42,0.32)]"
              errorClassName="text-center text-[rgba(255,188,188,0.96)]"
            />
          </div>

          <div className="industrial-auth-divider mt-8">
            <span>Or continue with email</span>
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-[1.15rem]">
            <div className="space-y-2.5">
              <label className="type-body-secondary font-medium text-white">Email</label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
              />
            </div>

            <div className="space-y-2.5">
              <label className="type-body-secondary font-medium text-white">Password</label>
              <div className="relative">
                <Input
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="industrial-auth-input h-11 rounded-[0.95rem] border-[rgba(255,255,255,0.17)] bg-[rgba(14,20,31,0.7)] px-4 pr-24 text-base text-[rgba(233,239,246,0.96)] placeholder:text-[rgba(255,255,255,0.24)]"
                />
                <button
                  type="button"
                  className="type-body-secondary absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-[0.8rem] border border-white/10 bg-[rgba(255,255,255,0.06)] px-4 font-semibold text-[rgba(222,231,242,0.82)] transition hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
                  onClick={() => setPasswordVisible((current) => !current)}
                >
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {notice ? (
              <div className={`type-body-secondary rounded-[1rem] border px-4 py-3 ${notice.className}`}>
                <div className="type-caption font-semibold uppercase tracking-[0.24em] text-white/60">
                  Status
                </div>
                <div className="type-card-title mt-2 text-white">{notice.title}</div>
                <div className="type-body-secondary mt-1">{notice.detail}</div>
              </div>
            ) : null}

            {canResendVerification ? (
              <div className="type-body-secondary rounded-[1rem] border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-4 text-[rgba(255,226,179,0.88)]">
                <div className="type-card-title text-white">Need a fresh verification email?</div>
                <div className="type-body-secondary mt-2">
                  Use the same signup inbox, resend verification, then return after the inbox confirms the account.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResendVerification}
                  disabled={resending}
                  className="mt-4 h-11 w-full rounded-[0.95rem] border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] text-sm text-white hover:bg-[rgba(255,255,255,0.08)]"
                >
                  {resending ? "Sending..." : "Resend Verification Email"}
                </Button>
              </div>
            ) : null}

            <div className="pt-0.5">
              <Link href="/forgot-password" className="type-body-secondary text-[rgba(182,212,255,0.92)] underline-offset-4 hover:text-white hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="industrial-auth-submit h-11 w-full rounded-[1rem] text-base font-bold tracking-[-0.01em]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in and continue"
              )}
            </Button>
          </form>

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

          <div className="type-body-secondary mt-8 text-center text-[rgba(214,224,238,0.76)]">
            New here?{" "}
            <Link href="/register" className="font-medium text-[rgba(195,221,255,0.96)] underline underline-offset-4 hover:text-white">
              Create an account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
