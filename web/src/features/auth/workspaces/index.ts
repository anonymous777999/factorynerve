/**
 * features/auth/workspaces — unauthenticated and account-recovery surfaces.
 *
 * /access            → unified login + OTP entry
 * /forgot-password   → request reset link
 * /reset-password    → set new password from token
 * /verify-email      → email verification landing
 */

export { default as ForgotPasswordWorkspace } from "@/components/forgot-password-page";
export { default as ResetPasswordWorkspace } from "@/components/reset-password-page";
export { default as VerifyEmailWorkspace } from "@/components/verify-email-page";
