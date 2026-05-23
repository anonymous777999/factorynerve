"use client";

import Link from "next/link";
import type { FormEventHandler } from "react";
import {
  ArrowRight,
  Building2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "error";

type LoginOneProps = {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onGoogleLogin?: () => void | Promise<void>;
  onTogglePassword?: () => void;
  loading?: boolean;
  googleLoading?: boolean;
  showPassword?: boolean;
  statusMessage?: string;
  statusTone?: StatusTone;
  canResendVerification?: boolean;
  onResendVerification?: () => void | Promise<void>;
  resendingVerification?: boolean;
  forgotPasswordHref?: string;
  createAccountHref?: string;
  homeHref?: string;
  title?: string;
  subtitle?: string;
  redirectHint?: string | null;
};

function providerButtonClasses(disabled?: boolean) {
  return cn(
    "flex min-h-[48px] w-full items-center justify-between rounded-[12px] border px-4 py-3 text-left transition",
    disabled
      ? "cursor-not-allowed border-border-default bg-surface-shell text-text-tertiary opacity-80"
      : "border-border-default bg-surface-panel text-text-primary hover:border-border-strong hover:bg-surface-hover",
  );
}

function statusClasses(tone: StatusTone) {
  switch (tone) {
    case "success":
      return "border-status-success-border bg-status-success-bg text-status-success-fg";
    case "error":
      return "border-status-danger-border bg-status-danger-bg text-status-danger-fg";
    default:
      return "border-border-default bg-surface-shell text-text-secondary";
  }
}

export function LoginOne({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogleLogin,
  onTogglePassword,
  loading = false,
  googleLoading = false,
  showPassword = false,
  statusMessage,
  statusTone = "neutral",
  canResendVerification = false,
  onResendVerification,
  resendingVerification = false,
  forgotPasswordHref = "/forgot-password",
  createAccountHref = "/register",
  homeHref = "/",
  title = "Sign in to continue",
  subtitle = "Use your DPR.ai account credentials. Only Google OAuth is connected on the backend right now.",
  redirectHint,
}: LoginOneProps) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-surface-app px-4 py-10 text-text-primary md:px-6 md:py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-shell)_88%,transparent),transparent_18rem)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(color-mix(in_srgb,var(--border-subtle)_55%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--border-subtle)_45%,transparent)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-3 rounded-[14px] border border-border-default bg-surface-panel px-4 py-3 transition hover:border-border-strong hover:bg-surface-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-border-default bg-surface-shell">
              <Building2 className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.28em] text-text-secondary">
                Factory OS
              </span>
              <span className="block text-lg font-semibold text-text-primary">DPR.ai</span>
            </span>
          </Link>

          <div className="max-w-xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-text-secondary">
              Secure workspace access
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.05em] text-text-primary md:text-5xl">
              {title}
            </h1>
            <p className="max-w-lg text-base leading-7 text-text-secondary">{subtitle}</p>
            {redirectHint ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-panel px-4 py-2 text-sm text-text-secondary">
                <ArrowRight className="h-4 w-4" />
                {redirectHint}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-border-default bg-surface-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                Email login
              </div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                Fully supported with the current backend session flow.
              </div>
            </div>
            <div className="rounded-[18px] border border-border-default bg-surface-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                Google OAuth
              </div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                Available today and redirects back into the app safely.
              </div>
            </div>
            <div className="rounded-[18px] border border-border-default bg-surface-panel p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                Other providers
              </div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                Facebook and Microsoft stay disabled until backend handlers exist.
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full rounded-[24px] border border-border-default bg-surface-panel shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        >
          <div className="border-b border-border-subtle px-6 py-6 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Continue with a supported provider, or use your email and password.
            </p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={!onGoogleLogin || googleLoading}
                className={providerButtonClasses(!onGoogleLogin || googleLoading)}
              >
                <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-shell">
                    {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-current">Continue with Google</span>
                    <span className="block text-xs text-text-secondary">Connected</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button type="button" disabled className={providerButtonClasses(true)}>
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-shell">
                    <Users className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-current">Continue with Facebook</span>
                    <span className="block text-xs text-text-secondary">Backend not enabled</span>
                  </span>
                </span>
                <span className="rounded-full border border-border-default px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  Soon
                </span>
              </button>

              <button type="button" disabled className={providerButtonClasses(true)}>
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-shell">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-current">Continue with Microsoft</span>
                    <span className="block text-xs text-text-secondary">Backend not enabled</span>
                  </span>
                </span>
                <span className="rounded-full border border-border-default px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  Soon
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border-subtle" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">
                or use email
              </span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-text-primary">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-sm font-medium text-text-primary">
                    Password
                  </Label>
                  <Link href={forgotPasswordHref} className="text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-20"
                  />
                  <button
                    type="button"
                    onClick={onTogglePassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[10px] border border-border-default bg-surface-shell px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Continue"}
              </Button>
            </div>

            {statusMessage ? (
              <div className={cn("rounded-[18px] border px-4 py-4 text-sm leading-6", statusClasses(statusTone))}>
                <div>{statusMessage}</div>
                {canResendVerification && onResendVerification ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onResendVerification()}
                      disabled={resendingVerification}
                    >
                      {resendingVerification ? "Sending..." : "Resend verification"}
                    </Button>
                    <span className="text-xs uppercase tracking-[0.16em] text-current/80">
                      Use the same signup inbox.
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle px-6 py-5 text-center sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-text-secondary">
              Don&apos;t have an account?
            </p>
            <Link
              href={createAccountHref}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-border-default px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-border-strong hover:bg-surface-hover"
            >
              Create one
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
