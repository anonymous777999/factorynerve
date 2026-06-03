"use client";

import Link from "next/link";
import type { FormEventHandler } from "react";
import {
  ArrowRight,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { Button } from "@/components/ui/button";
import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_INPUT_TOGGLE_PADDING,
  PasswordVisibilityToggle,
} from "@/components/ui/password-visibility-toggle";
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
    "factory-auth-provider flex min-h-[52px] w-full items-center justify-between rounded-panel px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
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
      sidePanel="minimal"
      badge="Secure access"
      title="Identify user"
      description="Use your work credentials or a connected provider to start an operational session."
      leftEyebrow="Authentication lane"
      leftTitle={title}
      leftDescription={subtitle}
      supportTitle="Factory-safe account flow"
      supportDescription="Shift-change login stays compact, keyboard-first, and bound to verified factory identities."
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: "Secure connection stays active before any workspace is released.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Role routing and factory context restore only after session rules pass.",
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: "Verification resend and recovery stay on the same registered work inbox.",
        },
      ]}
      metrics={redirectHint ? [{ label: "Requested destination", value: redirectHint }] : []}
      homeHref={homeHref}
      contentClassName="space-y-5"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
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
                <span className="block text-label-dense text-text-secondary">Work account</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="factory-auth-divider" aria-hidden>
          Or use work email
        </div>

        <div className="space-y-4">
          <Field>
            <Label htmlFor="email">Work email</Label>
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
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href={forgotPasswordHref} className="factory-auth-link">
                Forgot password?
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
                className={cn("factory-auth-input min-h-[40px] pl-10", PASSWORD_INPUT_TOGGLE_PADDING)}
              />
              {onTogglePassword ? (
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={onTogglePassword}
                />
              ) : null}
            </div>
          </Field>

          <Button type="submit" className="factory-auth-cta h-[42px] w-full border-transparent" isBusy={loading} busyLabel="Signing in...">
            Sign in
          </Button>
        </div>

        {statusMessage ? (
          <div className={cn("rounded-panel border px-4 py-4 text-sm leading-6", statusClasses(statusTone))} role="status">
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
                <HelperText className="text-current/80">Use the same signup inbox.</HelperText>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
          <span className="text-label-dense text-text-secondary">Need provisioning?</span>
          <Link href={createAccountHref} className="inline-flex items-center gap-2 text-sm font-semibold text-action-primary transition hover:text-action-primary-hover">
            Create account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </form>
    </AuthWorkstationShell>
  );
}
