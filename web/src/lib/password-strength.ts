export type PasswordRule = {
  label: string;
  passed: boolean;
};

export type PasswordStrength = {
  score: number;
  label: string;
  colorClass: string;
  barClass: string;
  percent: number;
  rules: PasswordRule[];
};

export function getPasswordStrength(password: string): PasswordStrength {
  const rules: PasswordRule[] = [
    { label: "At least 12 characters", passed: password.length >= 12 },
    { label: "Uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "Lowercase letter", passed: /[a-z]/.test(password) },
    { label: "Number", passed: /\d/.test(password) },
    { label: "Symbol", passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const passedCount = rules.filter((rule) => rule.passed).length;
  const percent = Math.max(8, Math.round((passedCount / rules.length) * 100));

  if (passedCount <= 2) {
    return {
      score: passedCount,
      label: "Weak",
      colorClass: "text-red-300",
      barClass: "bg-[var(--danger)]",
      percent,
      rules,
    };
  }
  if (passedCount <= 4) {
    return {
      score: passedCount,
      label: "Good",
      colorClass: "text-amber-200",
      barClass: "bg-[var(--warning)]",
      percent,
      rules,
    };
  }
  return {
    score: passedCount,
    label: "Strong",
    colorClass: "text-emerald-300",
    barClass: "bg-[var(--success)]",
    percent: 100,
    rules,
  };
}
