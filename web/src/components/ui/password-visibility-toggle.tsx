"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * Icon-only password reveal control (Google / Microsoft style).
 * Sits inside a relatively positioned input wrapper — not a boxed "Show" chip.
 */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  className,
  "aria-label": ariaLabel,
}: PasswordVisibilityToggleProps) {
  const label = ariaLabel ?? (visible ? "Hide password" : "Show password");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={visible}
      className={cn("password-visibility-toggle", className)}
    >
      {visible ? (
        <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
      )}
    </button>
  );
}

/** Right padding for inputs that include a visibility toggle. */
export const PASSWORD_INPUT_TOGGLE_PADDING = "pr-11";
