"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { login, resendEmailVerification } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        setError(err.message);
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

  const canResendVerification = error.toLowerCase().includes("verify your email");

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

  return (
    <AuthShell
      badge="Secure Sign In"
      title="Sign in"
      description="Sign in with your verified email and password."
      journeyTitle="Keep access simple for workers and safe for the factory."
      journeyDescription="DPR.ai uses verified email ownership, cookie-backed sessions, and role-based access so the right person sees the right workflow after sign-in."
      steps={[
        {
          title: "Use the verified inbox",
          description: "Only email addresses that completed verification can unlock a local sign-in.",
        },
        {
          title: "Create a secure session",
          description: "We issue protected session cookies so the app stays signed in safely across the workflow.",
        },
        {
          title: "Land in the right role view",
          description: "Operators, supervisors, accountants, managers, and owners all land in role-correct areas after login.",
        },
      ]}
      supportTitle="If sign-in is blocked"
      supportDescription="The most common cause is an unverified inbox. Use resend verification with the same signup email, then come back and sign in normally."
      cardClassName="max-w-xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted)]">Email</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <PasswordField
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />
            {error ? (
              <div className={canResendVerification ? "rounded-2xl border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] p-4 text-sm text-amber-200" : "text-sm text-red-400"}>
                <div>{error}</div>
                {canResendVerification ? (
                  <div className="mt-2 text-xs text-amber-100/80">
                    This usually means the signup exists only as a pending record. The account will stay locked until the email inbox opens the verification link.
                  </div>
                ) : null}
              </div>
            ) : null}
            {canResendVerification ? (
              <div className="space-y-3">
                <Button type="button" variant="outline" onClick={onResendVerification} disabled={resending}>
                  {resending ? "Sending..." : "Resend Verification Email"}
                </Button>
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-xs text-[var(--muted)]">
                  Use the same email address you used during signup. After the inbox verifies the account, come back here and sign in normally.
                </div>
              </div>
            ) : null}
            {info ? (
              <div
                className={
                  infoTone === "success"
                    ? "rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-3 text-sm text-green-200"
                    : "rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--muted)]"
                }
              >
                {info}
              </div>
            ) : routeInfo ? (
              <div
                className={
                  routeInfo.tone === "success"
                    ? "rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] p-3 text-sm text-green-200"
                    : "rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] p-3 text-sm text-[var(--muted)]"
                }
              >
                {routeInfo.message}
              </div>
            ) : null}
            <div className="text-right text-sm">
              <Link href="/forgot-password" className="text-[var(--accent)] underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-[var(--muted)]">
            New here?{" "}
            <Link href="/register" className="text-[var(--accent)] underline">
              Create an account
            </Link>
          </div>
    </AuthShell>
  );
}
