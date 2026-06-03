"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  PASSWORD_INPUT_TOGGLE_PADDING,
  PasswordVisibilityToggle,
} from "@/components/ui/password-visibility-toggle";

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
      <label className="text-sm text-text-secondary">{label}</label>
      <div className="relative mt-2">
        <Input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className={`mt-0 ${PASSWORD_INPUT_TOGGLE_PADDING}`}
        />
        <PasswordVisibilityToggle visible={visible} onToggle={() => setVisible((current) => !current)} />
      </div>
    </div>
  );
}
