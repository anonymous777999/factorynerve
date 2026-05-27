"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User2,
} from "lucide-react";

import { register, resendEmailVerification, type RegisterResponse } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { validatePhoneNumber } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RoleOption = {
  value: "owner" | "admin" | "manager" | "supervisor" | "attendance";
  label: string;
  detail: string;
};

const roleOptions: RoleOption[] = [
  {
    value: "owner",
    label: "Factory owner",
    detail: "Org controls, billing authority, and final system ownership.",
  },
  {
    value: "admin",
    label: "Factory admin",
    detail: "User controls, settings, and cross-shift system administration.",
  },
  {
    value: "manager",
    label: "Operations manager",
    detail: "Production oversight, review workflows, and reporting access.",
  },
  {
    value: "supervisor",
    label: "Shift supervisor",
    detail: "Live floor review, escalation handling, and attendance control.",
  },
  {
    value: "attendance",
    label: "Attendance operator",
    detail: "Daily register capture, punch validation, and line-side execution.",
  },
];

function destinationLabel(path: string, t: (key: string, fallback?: string) => string) {
  switch (path) {
    case "/attendance":
      return t("auth.register.destination.attendance", "the attendance desk");
    case "/dashboard":
      return t("auth.register.destination.dashboard", "the operations board");
    case "/approvals":
      return t("auth.register.destination.approvals", "the review queue");
    case "/reports":
      return t("auth.register.destination.reports", "the reports desk");
    default:
      return t("auth.register.destination.workspace", "the workspace");
  }
}

function roleLabel(value: RoleOption["value"]) {
  return roleOptions.find((option) => option.value === value)?.label ?? "Factory admin";
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-label-dense font-medium uppercase tracking-[0.18em] text-text-secondary"
    >
      {children}
    </label>
  );
}

function StatRail({ active }: { active?: boolean }) {
  return (
    <div
      className={cn(
        "h-1 flex-1 rounded-full border border-border-subtle/70",
        active
          ? "bg-[linear-gradient(90deg,var(--status-success-bg),var(--status-success-icon))] shadow-[var(--shadow-sm)]"
          : "bg-surface-elevated",
      )}
    />
  );
}

function IdentityField({
  id,
  label,
  icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
          {icon}
        </span>
        <Input
          id={id}
          {...props}
          className="min-h-[40px] border-border-default bg-surface-elevated pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus"
        />
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
          <KeyRound className="h-4 w-4" />
        </span>
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[40px] border-border-default bg-surface-elevated pl-10 pr-20 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 inline-flex h-7 min-w-12 -translate-y-1/2 items-center justify-center rounded-control border border-border-default bg-surface-panel px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "forms", "errors"]);

  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleOption["value"]>("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RegisterResponse | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  const rawNextPath = searchParams.get("next");
  const nextPath =
    rawNextPath && rawNextPath.startsWith("/") && !rawNextPath.startsWith("//") ? rawNextPath : "/";
  const nextDestination = destinationLabel(nextPath, t);
  const hasRedirectTarget = nextPath !== "/";

  const deliveryMode = success?.delivery_mode ?? null;
  const isPreviewMode = deliveryMode === "preview";
  const isEmailFailure = deliveryMode === "email_failed";
  const isEmailDelivery = Boolean(success && !isPreviewMode && !isEmailFailure);

  const activeRoleDetail = useMemo(
    () => roleOptions.find((option) => option.value === selectedRole)?.detail ?? roleOptions[1].detail,
    [selectedRole],
  );

  const successState = success
    ? {
        title: isEmailFailure
          ? t("auth.register.success_pending_saved", "Pending signup saved")
          : isEmailDelivery
            ? t("auth.register.success_inbox_required", "Inbox verification required")
            : t("auth.register.success_link_ready", "Verification link ready"),
        detail: isEmailFailure
          ? t(
              "auth.register.success_pending_detail",
              "The signup request is stored safely. You only need to resend verification after email delivery recovers.",
            )
          : isEmailDelivery
            ? t(
                "auth.register.success_inbox_detail",
                "The real account stays locked until this inbox opens the verification email and activates the signup.",
              )
            : t(
                "auth.register.success_link_detail",
                "Preview mode is active, so you can open the verification link directly from this screen.",
              ),
        panelTone: isEmailFailure
          ? "border-status-warning-border bg-status-warning-bg text-status-warning-fg"
          : isEmailDelivery
            ? "border-status-success-border bg-status-success-bg text-status-success-fg"
            : "border-border-focus bg-surface-selected text-text-primary",
      }
    : null;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setResendStatus("");

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    if (companyCode.trim() && !factoryName.trim()) {
      setError(
        t(
          "auth.register.error_factory_required",
          "Factory/Company name is required to verify the company code.",
        ),
      );
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
        role: selectedRole,
        factory_name: factoryName,
        company_code: companyCode || null,
        phone_number: phoneNumber || null,
      });
      setSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError(
          t(
            "auth.register.error_backend_unreachable",
            "Backend not reachable. Check that FastAPI is running and NEXT_PUBLIC_API_BASE_URL is correct.",
          ),
        );
      } else if (err instanceof Error && err.message.includes("Request timed out")) {
        setError(
          t(
            "auth.register.error_timeout",
            "Signup is taking too long waiting for email delivery. Please try again or retry in a minute.",
          ),
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("auth.register.error_failed", "Registration failed."));
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
        setResendStatus(t("auth.register.resend_failed", "Could not resend the verification email."));
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen min-w-[1280px] overflow-x-auto bg-surface-app text-text-primary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--surface-elevated)_68%,transparent),transparent_34%)]" />

      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border-strong bg-surface-shell px-8">
        <Link href="/" className="inline-flex items-center gap-3 text-text-primary">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border-default bg-surface-panel">
            <Building2 className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-page-title font-semibold tracking-tight">DPR.ai</span>
          </div>
        </Link>

        <div className="flex items-center gap-8 text-[11px] font-medium uppercase tracking-[0.24em] text-text-secondary">
          <span>Steel Industry</span>
          <span className="text-[var(--accent)]">Factory OS</span>
        </div>
      </header>

      <section className="relative z-10 grid min-h-[calc(100vh-56px)] grid-cols-[minmax(520px,1.05fr)_minmax(560px,0.95fr)] gap-10 px-8 py-10">
        <aside className="flex min-h-full flex-col justify-between border-r border-border-default pr-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-text-secondary">
                Factory onboarding channel
              </div>
              <h1 className="max-w-[16ch] text-[clamp(2.75rem,3.6vw,4.25rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-text-primary">
                Establish Factory Access
              </h1>
              <p className="max-w-xl text-sm leading-6 text-text-secondary">
                Register the operating organization, bind the first control user, and prepare the desktop workspace before the line teams enter production.
              </p>
            </div>

            <div className="rounded-panel border border-border-default bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-panel)_96%,transparent),color-mix(in_srgb,var(--surface-shell)_92%,transparent))] p-5">
              <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
                <ShieldCheck className="h-4 w-4 text-status-success-icon" />
                <div className="text-label-dense font-medium uppercase tracking-[0.2em] text-status-success-fg">
                  Secure connection active
                </div>
              </div>

              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                <div className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                  <div>Credential submission stays bound to verified inbox activation before workstation access opens.</div>
                </div>
                <div className="flex gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                  <div>Factory metadata, company code, and initial operator role are logged as the baseline operational identity.</div>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                  <div>Verification delivery remains mandatory so unauthorized signups never become live floor credentials.</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[1.25fr_0.9fr] gap-4">
              <div className="rounded-panel border border-border-default bg-surface-panel p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                  Onboarding sequence
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    ["01", "Register company identity", "Capture organization, admin contact, and role authority."],
                    ["02", "Verify operational inbox", "Only the inbox owner can unlock the real DPR.ai account."],
                    ["03", "Initialize factory workspace", `After verification, continue into ${nextDestination}.`],
                  ].map(([step, title, description]) => (
                    <div key={step} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-elevated font-mono text-[11px] text-text-primary">
                        {step}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">{title}</div>
                        <div className="mt-1 text-sm leading-6 text-text-secondary">{description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-panel border border-border-default bg-surface-panel p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                  Core systems status
                </div>
                <div className="mt-5 flex gap-2">
                  <StatRail active />
                  <StatRail active />
                  <StatRail />
                </div>
                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">Verification mode</div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {isPreviewMode ? "Preview link exposed" : "Email-gated activation"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">Provisioning role</div>
                    <div className="mt-1 text-sm font-medium text-text-primary">{roleLabel(selectedRole)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
            Emergency sysadmin: ext 4092
          </div>
        </aside>

        <section className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[620px] rounded-overlay border border-border-strong bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-panel)_97%,transparent),color-mix(in_srgb,var(--surface-elevated)_96%,transparent))] p-6 shadow-lg">
            <div className="border-b border-border-subtle pb-5">
              <div className="text-center text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                Factory access provisioning
              </div>
              <h2 className="mt-3 text-center text-[2rem] font-semibold tracking-[-0.03em] text-text-primary">
                Identify Setup Operator
              </h2>
              <p className="mx-auto mt-3 max-w-[46ch] text-center text-sm leading-6 text-text-secondary">
                Configure the first organization profile, assign the initial role, then complete inbox verification before desktop access is released.
              </p>
            </div>

            <div className="mt-6">
              {success ? (
                <div className="space-y-4">
                  {hasRedirectTarget ? (
                    <div className="rounded-panel border border-border-focus bg-surface-selected p-4 text-sm text-text-primary">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                        After verification
                      </div>
                      <div className="mt-2 text-base font-semibold">
                        Sign in to continue into {nextDestination}.
                      </div>
                    </div>
                  ) : null}

                  {successState ? (
                    <div className={cn("rounded-panel border p-4 text-sm", successState.panelTone)}>
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-current/80">
                        Signup status
                      </div>
                      <div className="mt-2 text-base font-semibold text-text-primary">{successState.title}</div>
                      <div className="mt-2 leading-6">{successState.detail}</div>
                    </div>
                  ) : null}

                  <div className="rounded-panel border border-border-default bg-surface-panel p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                          Pending identity
                        </div>
                        <div className="mt-2 text-base font-semibold text-text-primary">{email}</div>
                      </div>
                      <div className="rounded-control border border-border-default bg-surface-elevated px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary">
                        {isEmailFailure ? "Retry required" : isEmailDelivery ? "Inbox action" : "Link ready"}
                      </div>
                    </div>

                    <div className="mt-4 rounded-panel border border-border-default bg-surface-shell p-4 text-sm text-text-secondary">
                      {success.message}
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-text-secondary">
                      <div className="rounded-panel border border-border-default bg-surface-shell p-3">
                        1. Open the inbox for <span className="font-medium text-text-primary">{email}</span>.
                      </div>
                      <div className="rounded-panel border border-border-default bg-surface-shell p-3">
                        2. {isEmailFailure ? "Use resend once delivery is healthy again." : isPreviewMode ? "Open the local preview link below." : "Activate the verification email from DPR.ai."}
                      </div>
                      <div className="rounded-panel border border-border-default bg-surface-shell p-3">
                        3. Return to sign in after verification unlocks the operator profile.
                      </div>
                    </div>

                    {success.verification_link ? (
                      <div className="mt-4 rounded-panel border border-border-focus bg-surface-selected p-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                          Preview verification link
                        </div>
                        <a
                          href={success.verification_link}
                          className="mt-3 inline-flex items-center gap-2 rounded-control border border-border-focus bg-surface-panel px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                        >
                          Open verification page
                          <ArrowRight className="h-4 w-4" />
                        </a>
                        <div className="mt-3 break-all text-xs text-text-secondary">{success.verification_link}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" onClick={onResend} isBusy={resending} busyLabel={t("auth.register.resending", "Sending...")}>
                      {t("auth.register.resend", "Resend email")}
                    </Button>
                    <Link href="/access" className="text-sm text-[var(--accent)] underline underline-offset-4">
                      {t("auth.register.sign_in", "Sign in")}
                    </Link>
                  </div>

                  {resendStatus ? (
                    <div className="rounded-panel border border-border-default bg-surface-shell p-3 text-sm text-text-secondary">
                      {resendStatus}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-5">
                  {hasRedirectTarget ? (
                    <div className="rounded-panel border border-border-focus bg-surface-selected p-4 text-sm text-text-primary">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                        Start here first
                      </div>
                      <div className="mt-2 text-base font-semibold">
                        After verification, the user can continue into {nextDestination}.
                      </div>
                    </div>
                  ) : null}
                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <IdentityField
                        id="factoryName"
                        label="Organization / Company"
                        icon={<Building2 className="h-4 w-4" />}
                        value={factoryName}
                        onChange={(event) => setFactoryName(event.target.value)}
                        placeholder="Shree Steel Rolling Works"
                        autoComplete="organization"
                        required
                      />
                      <IdentityField
                        id="name"
                        label="Admin name"
                        icon={<User2 className="h-4 w-4" />}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Aman Patel"
                        autoComplete="name"
                        required
                      />
                      <IdentityField
                        id="email"
                        label="Work email"
                        icon={<Mail className="h-4 w-4" />}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="ops.admin@factory.com"
                        autoComplete="email"
                        required
                      />
                      <div>
                        <FieldLabel htmlFor="role">Role selection</FieldLabel>
                        <div className="relative">
                          <Select
                            id="role"
                            value={selectedRole}
                            onChange={(event) => setSelectedRole(event.target.value as RoleOption["value"])}
                            className="min-h-[40px] border-border-default bg-surface-elevated px-3 pr-10 text-sm text-text-primary focus:border-border-focus"
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                        </div>
                      </div>
                      <PasswordInput
                        id="password"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="new-password"
                        placeholder="Minimum 12 characters"
                      />
                      <PasswordInput
                        id="confirmPassword"
                        label="Confirm password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        autoComplete="new-password"
                        placeholder="Repeat access password"
                      />
                      <IdentityField
                        id="companyCode"
                        label="Company code"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        value={companyCode}
                        onChange={(event) => setCompanyCode(event.target.value)}
                        placeholder="Optional verification code"
                      />
                      <IdentityField
                        id="phoneNumber"
                        label="Operations phone"
                        icon={<Mail className="h-4 w-4" />}
                        type="tel"
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        placeholder="+91 98765 43210"
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </div>

                    <div className="rounded-panel border border-border-default bg-surface-shell p-4">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-secondary">
                        Operational onboarding
                      </div>
                      <div className="mt-2 text-sm font-medium text-text-primary">{roleLabel(selectedRole)}</div>
                      <div className="mt-2 text-sm leading-6 text-text-secondary">{activeRoleDetail}</div>
                      <div className="mt-3 text-xs leading-6 text-text-tertiary">
                        The request remains locked until the work inbox completes verification, which prevents unverified factory records from entering the live ERP workspace.
                      </div>
                    </div>

                    {error ? (
                      <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg">
                        {error}
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      isBusy={loading}
                      busyLabel={t("auth.register.submitting", "Creating...")}
                      className="h-[42px] w-full border-transparent bg-[var(--accent)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)]"
                    >
                      Factory Setup Initialization
                    </Button>

                    <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-text-secondary">
                        Existing operator?
                      </div>
                      <div className="flex items-center gap-4">
                        <Link href="/access" className="text-sm text-[var(--accent)] underline underline-offset-4">
                          {t("auth.register.sign_in", "Sign in")}
                        </Link>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
