export function validatePhoneNumber(value?: string | null, fieldLabel = "Phone number") {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("@")) {
    return `${fieldLabel} cannot be an email address.`;
  }
  if (trimmed.split("+").length > 2 || (trimmed.includes("+") && !trimmed.startsWith("+"))) {
    return `${fieldLabel} can only use a leading + symbol.`;
  }
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return `${fieldLabel} can only contain digits, spaces, parentheses, periods, and hyphens.`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return `${fieldLabel} must contain 10 to 15 digits.`;
  }
  if (new Set(digits).size === 1) {
    return `${fieldLabel} cannot use the same digit repeatedly.`;
  }
  if (["0123456789", "1234567890", "0987654321", "9876543210"].includes(digits)) {
    return `${fieldLabel} looks invalid. Enter a real mobile number.`;
  }
  return null;
}

export function validateIdentifierCode(value?: string | null, fieldLabel = "Code", maxLength = 32) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("@")) {
    return `${fieldLabel} cannot be an email address.`;
  }
  if (trimmed.length > maxLength) {
    return `${fieldLabel} must be ${maxLength} characters or fewer.`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(trimmed)) {
    return `${fieldLabel} can only use letters, numbers, hyphens, underscores, and slashes.`;
  }
  return null;
}

export function validateReferenceCode(value?: string | null, fieldLabel = "Reference number", maxLength = 80) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("@")) {
    return `${fieldLabel} cannot be an email address.`;
  }
  if (trimmed.length > maxLength) {
    return `${fieldLabel} must be ${maxLength} characters or fewer.`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./_-]*$/.test(trimmed)) {
    return `${fieldLabel} can only use letters, numbers, spaces, periods, hyphens, underscores, and slashes.`;
  }
  return null;
}

export function digitsOnly(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export function coerceIntegerInput(value: string | number, minValue = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return minValue;
  }
  return Math.max(minValue, Math.trunc(numeric));
}
