"use client";

import { cn } from "@/lib/utils";
import { getPasswordStrength } from "@/lib/password-strength";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--text)]">Password strength</div>
        <div className={cn("text-sm font-semibold", strength.colorClass)}>{strength.label}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(148,163,184,0.18)]">
        <div
          className={cn("h-full rounded-full transition-all duration-300", strength.barClass)}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {strength.rules.map((rule) => (
          <div
            key={rule.label}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs",
              rule.passed
                ? "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-emerald-200"
                : "border-[var(--border)] bg-[rgba(11,14,20,0.4)] text-[var(--muted)]",
            )}
          >
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
}
