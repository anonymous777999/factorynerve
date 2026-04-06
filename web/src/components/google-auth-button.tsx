"use client";

import { useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { startGoogleLogin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type GoogleAuthButtonProps = {
  nextPath?: string | null;
  label?: string;
  hint?: string;
  className?: string;
};

export function GoogleAuthButton({
  nextPath,
  label = "Continue with Google",
  hint,
  className,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    try {
      await startGoogleLogin(nextPath);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not open Google sign-in right now."));
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full justify-center gap-3 text-sm font-semibold"
        onClick={() => void handleClick()}
        disabled={loading}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white text-sm font-bold text-slate-900">
          G
        </span>
        {loading ? "Connecting to Google..." : label}
      </Button>
      {hint ? <div className="text-xs leading-5 text-text-muted">{hint}</div> : null}
      {error ? <div className="text-xs leading-5 text-color-warning">{error}</div> : null}
    </div>
  );
}
