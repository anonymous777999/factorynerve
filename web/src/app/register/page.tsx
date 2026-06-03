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

import { AuthWorkstationShell } from "@/components/auth-workstation-shell";
import { register, resendEmailVerification, type RegisterResponse } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { validatePhoneNumber } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_INPUT_TOGGLE_PADDING,
  PasswordVisibilityToggle,
} from "@/components/ui/password-visibility-toggle";
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
    <label htmlFor={htmlFor} className="mb-2 block text-label font-medium text-text-secondary">
      {children}
    </label>
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
          className="factory-auth-input min-h-[40px] border-border-default bg-surface-elevated pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus"
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
          className={cn(
            "factory-auth-input min-h-[40px] border-border-default bg-surface-elevated pl-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus",
            PASSWORD_INPUT_TOGGLE_PADDING,
          )}
          required
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
        />
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
    <AuthWorkstationShell
      sidePanel="standard"
      badge="Factory access provisioning"
      title="Identify Setup Operator"
      description="Configure the first organization profile, assign the initial role, then complete inbox verification before desktop access is released."
      leftEyebrow="Factory onboarding channel"
      leftTitle="Establish Factory Access"
      leftDescription="Register the operating organization, bind the first control user, and prepare the desktop workspace before the line teams enter production."
      steps={[
        {
          title: "Register company identity",
          description: "Capture organization, admin contact, and role authority.",
        },
        {
          title: "Verify operational inbox",
          description: "Only the inbox owner can unlock the real DPR.ai account.",
        },
        {
          title: "Initialize factory workspace",
          description: `After verification, continue into ${nextDestination}.`,
        },
      ]}
      supportTitle={roleLabel(selectedRole)}
      supportDescription={
        isPreviewMode ? "Preview verification is exposed locally." : "Email verification remains mandatory before live access opens."
      }
      supportItems={[
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Credential submission stays bound to verified inbox activation before workstation access opens.",
        },
        {
          icon: <Building2 className="h-4 w-4" />,
          text: "Factory metadata, company code, and initial operator role are logged as the baseline operational identity.",
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: "Verification delivery remains mandatory so unauthorized signups never become live floor credentials.",
        },
      ]}
      metrics={[
        { label: "Verification mode", value: isPreviewMode ? "Preview link exposed" : "Email-gated activation" },
        { label: "Provisioning role", value: roleLabel(selectedRole) },
      ]}
      contentClassName="space-y-5"
    >
      {success ? (
        <div className="space-y-4">
          {hasRedirectTarget ? (
            <div className="rounded-panel border border-border-focus bg-surface-selected p-4 text-sm text-text-primary">
              <p className="text-label-dense font-medium text-text-tertiary">After verification</p>
              <div className="mt-2 text-base font-semibold">
                Sign in to continue into {nextDestination}.
              </div>
            </div>
          ) : null}

          {successState ? (
            <div className={cn("rounded-panel border p-4 text-sm", successState.panelTone)}>
              <p className="text-label-dense font-medium text-current/80">Signup status</p>
              <div className="mt-2 text-base font-semibold text-text-primary">{successState.title}</div>
              <div className="mt-2 leading-6">{successState.detail}</div>
            </div>
          ) : null}

          <div className="rounded-panel border border-border-default bg-surface-panel p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label-dense font-medium text-text-tertiary">Pending identity</p>
                <div className="mt-2 text-base font-semibold text-text-primary">{email}</div>
              </div>
              <div className="rounded-control border border-border-default bg-surface-elevated px-3 py-2 text-label-dense font-medium text-text-secondary">
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
                <p className="text-label-dense font-medium text-text-tertiary">Preview verification link</p>
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
            <Link href="/access" className="factory-auth-link text-sm underline-offset-4">
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
              <p className="text-label-dense font-medium text-text-tertiary">Start here first</p>
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
                    className="factory-auth-input min-h-[40px] border-border-default bg-surface-elevated px-3 pr-10 text-sm text-text-primary focus:border-border-focus"
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
              <p className="text-label-dense font-medium text-text-tertiary">Operational onboarding</p>
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
              className="factory-auth-cta h-[42px] w-full border-transparent"
            >
              Create account
            </Button>

            <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <span className="text-label-dense text-text-secondary">Existing operator?</span>
              <div className="flex items-center gap-4">
                <Link href="/access" className="factory-auth-link text-sm underline-offset-4">
                  {t("auth.register.sign_in", "Sign in")}
                </Link>
              </div>
            </div>
          </form>
        </div>
      )}
    </AuthWorkstationShell>
  );
}
