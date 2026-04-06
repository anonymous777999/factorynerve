"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  label: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function PasswordField({
  label,
  value,
  autoComplete,
  onChange,
  placeholder,
  required = false,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("w-full", className)}>
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
          className="absolute right-1 top-1/2 h-9 -translate-y-1/2 px-3 text-xs"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  );
}
