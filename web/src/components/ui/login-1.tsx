"use client";

import Link from "next/link";
import type { FormEventHandler } from "react";
import {
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
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
    "factory-auth-provider flex min-h-[56px] w-full items-center justify-between rounded-panel px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    disabled
      ? "cursor-not-allowed text-text-tertiary opacity-75"
      : "text-text-primary",
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
  title = "System Access",
  subtitle = "Sign in with a verified inbox and land in the right desk without losing factory context.",
  redirectHint,
}: LoginOneProps) {
  return (
    <AuthWorkstationShell
      badge="Secure access"
      title="Identify User"
      description="Continue with a supported provider or use your work credentials to initialize the operational session."
      leftEyebrow="Authentication lane"
      leftTitle={title}
      leftDescription={subtitle}
      steps={[
        {
          title: "Validate operator identity",
          description: "Use the registered inbox or a connected provider to start a traceable session.",
        },
        {
          title: "Confirm access controls",
          description: "Verification and role context determine which desk opens after sign-in.",
        },
        {
          title: "Resume factory workflow",
          description: "After authentication, continue directly into the assigned operational workspace.",
        },
      ]}
      supportTitle="Factory-safe account flow"
      supportDescription="High-trust login stays compact, keyboard-first, and tightly bound to verified factory identities."
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: "Secure connection remains active before any workspace or control desk is released.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Role routing and factory context are restored only after session rules pass verification.",
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: "Verification resend and recovery actions stay attached to the same registered work inbox.",
        },
      ]}
      metrics={redirectHint ? [{ label: "Requested destination", value: redirectHint }] : []}
      homeHref={homeHref}
      contentClassName="space-y-5"
    >
      <form onSubmit={onSubmit} className="space-y-5">
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
                <span className="block text-sm font-semibold text-current">Google workspace route</span>
                <span className="block text-[11px] uppercase tracking-[0.16em] text-text-secondary">Connected</span>
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
                <span className="block text-sm font-semibold text-current">Facebook workspace route</span>
                <span className="block text-[11px] uppercase tracking-[0.16em] text-text-secondary">Backend not enabled</span>
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
                <span className="block text-sm font-semibold text-current">Microsoft identity route</span>
                <span className="block text-[11px] uppercase tracking-[0.16em] text-text-secondary">Backend not enabled</span>
              </span>
            </span>
            <span className="rounded-full border border-border-default px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
              Soon
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border-subtle" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
            Operator email
          </span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
              Work email
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
                placeholder="operator@factory.os"
                className="factory-auth-input min-h-[40px] pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                Access code
              </Label>
              <Link href={forgotPasswordHref} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--action-primary)] hover:text-[var(--action-primary-hover)]">
                Reset code
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
                className="factory-auth-input min-h-[40px] pl-10 pr-20"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control border border-border-default bg-surface-shell px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <Button type="submit" className="factory-auth-cta h-[42px] w-full border-transparent" isBusy={loading} busyLabel="Signing in...">
            Initialize Session
          </Button>
        </div>

        {statusMessage ? (
          <div className={cn("rounded-panel border px-4 py-4 text-sm leading-6", statusClasses(statusTone))}>
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
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-current/80">
                  Use the same signup inbox.
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-secondary">
            Need provisioning?
          </div>
          <Link
            href={createAccountHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--action-primary)] transition hover:text-[var(--action-primary-hover)]"
          >
            Create account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </form>
    </AuthWorkstationShell>
  );
}
