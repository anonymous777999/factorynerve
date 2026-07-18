"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = {
  id?: string;
  label: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
};

export function PasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
  placeholder,
  required = false,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="text-sm text-[var(--muted)]">{label}</label>
      <div className="relative mt-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
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
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </span>
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
        </Button>
      </div>
    </div>
  );
}
