"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = {
  label: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function PasswordField({
  label,
  value,
  autoComplete,
  onChange,
  placeholder,
  required = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm text-[var(--muted)]">{label}</label>
      <div className="relative mt-2">
        <Input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className="mt-0 pr-24"
        />
        <Button
          type="button"
          variant="ghost"
          className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.35)] px-3 text-xs text-[var(--text)] hover:bg-[rgba(25,35,52,0.55)]"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          <span aria-hidden="true" className="inline-flex items-center">
            {visible ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.5 0 9.6 3.8 11 8-0.5 1.6-1.6 3.1-3 4.4" />
                <path d="M6.2 6.3C4.1 7.7 2.7 9.7 2 12c1.4 4.2 5.5 8 10 8 1.8 0 3.4-0.5 4.8-1.3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8-10-8-10-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </span>
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
        </Button>
      </div>
    </div>
  );
}
