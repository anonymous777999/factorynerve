export function resolveAccessReasonMessage(
  reason: string | null,
  t: (key: string, fallback?: string) => string,
) {
  if (reason === "permissions_updated") {
    return {
      message: t(
        "auth.login.permissions_updated",
        "Your account permissions have been updated by an administrator. Please sign in again to continue.",
      ),
      tone: "neutral" as const,
    };
  }
  if (reason === "session_expired") {
    return {
      message: t(
        "auth.login.session_expired",
        "Your session has expired. Please sign in to continue.",
      ),
      tone: "neutral" as const,
    };
  }
  if (reason === "account_suspended") {
    return {
      message: t(
        "auth.login.account_suspended",
        "Your account has been suspended. Contact your administrator.",
      ),
      tone: "error" as const,
    };
  }
  return null;
}
