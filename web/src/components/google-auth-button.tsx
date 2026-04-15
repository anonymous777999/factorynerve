"use client";

import { useEffect, useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { startGoogleLogin, warmBackendConnection } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  label = "Continue with Google",
  hint,
  className,
  buttonClassName,
  hintClassName,
  errorClassName,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void warmBackendConnection();
  }, []);

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
        className={cn("h-12 w-full justify-center gap-3 text-sm font-semibold", buttonClassName)}
        onClick={() => void handleClick()}
        onPointerEnter={() => {
          void warmBackendConnection();
        }}
        onFocus={() => {
          void warmBackendConnection();
        }}
        disabled={loading}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white text-sm font-bold text-slate-900">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
            <path
              fill="#EA4335"
              d="M12.24 10.285v3.821h5.445c-.24 1.23-.959 2.273-2.038 2.973l3.298 2.56c1.92-1.77 3.025-4.375 3.025-7.47 0-.72-.065-1.414-.185-2.089z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.965-.894 6.62-2.415l-3.298-2.56c-.915.615-2.084.98-3.322.98-2.553 0-4.715-1.724-5.49-4.04H3.1v2.54A9.998 9.998 0 0 0 12 22"
            />
            <path
              fill="#4A90E2"
              d="M6.51 13.965A5.996 5.996 0 0 1 6.2 12c0-.682.117-1.344.31-1.965V7.495H3.1A9.998 9.998 0 0 0 2 12c0 1.61.385 3.135 1.1 4.505z"
            />
            <path
              fill="#FBBC05"
              d="M12 5.995c1.468 0 2.785.505 3.823 1.496l2.867-2.867C16.96 3.01 14.696 2 12 2A9.998 9.998 0 0 0 3.1 7.495l3.41 2.54c.775-2.317 2.937-4.04 5.49-4.04"
            />
          </svg>
        </span>
        {loading ? "Connecting to Google..." : label}
      </Button>
      {hint ? <div className={cn("text-xs leading-5 text-text-muted", hintClassName)}>{hint}</div> : null}
      {error ? <div className={cn("text-xs leading-5 text-color-warning", errorClassName)}>{error}</div> : null}
    </div>
  );
}
