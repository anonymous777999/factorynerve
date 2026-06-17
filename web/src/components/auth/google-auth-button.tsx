"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatApiErrorMessage } from "@/lib/api";
import { startGoogleLogin } from "@/lib/auth";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type GoogleAuthButtonProps = {
  nextPath?: string | null;
  label?: string;
  hint?: string;
  className?: string;
  buttonClassName?: string;
  hintClassName?: string;
  errorClassName?: string;
};

export function GoogleAuthButton({
  nextPath,
  label,
  hint,
  className,
  buttonClassName,
  hintClassName,
  errorClassName,
}: GoogleAuthButtonProps) {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "errors"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    try {
      await startGoogleLogin(nextPath);
    } catch (err) {
      setError(formatApiErrorMessage(err, t("auth.google.error", "Could not open Google sign-in right now.")));
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        className={cn("h-12 w-full justify-center gap-3 text-sm font-semibold", buttonClassName)}
        onClick={() => void handleClick()}
        disabled={loading}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white text-sm font-bold text-slate-900">
          G
        </span>
        {loading ? t("auth.google.connecting", "Connecting to Google...") : label || t("auth.google.continue", "Continue with Google")}
      </Button>
      {hint ? <div className={cn("text-xs leading-5 text-[var(--muted)]", hintClassName)}>{hint}</div> : null}
      {error ? <div className={cn("text-xs leading-5 text-amber-300", errorClassName)}>{error}</div> : null}
    </div>
  );
}
