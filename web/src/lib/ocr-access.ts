export const OCR_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const OCR_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const OCR_SCAN_ROLES = new Set(["operator", "supervisor", "manager", "admin", "owner"]);
const OCR_WORKSPACE_ROLES = new Set(["supervisor", "manager", "admin", "owner"]);
const OCR_APPROVAL_ROLES = new Set(["manager", "admin", "owner"]);

function normalizeRole(role?: string | null) {
  return (role || "").trim().toLowerCase();
}

export function canUseOcrScan(role?: string | null) {
  return OCR_SCAN_ROLES.has(normalizeRole(role));
}

export function canUseOcrWorkspace(role?: string | null) {
  return OCR_WORKSPACE_ROLES.has(normalizeRole(role));
}

export function canUseOcrVerification(role?: string | null) {
  return canUseOcrWorkspace(role);
}

export function canApproveOcrVerification(role?: string | null) {
  return OCR_APPROVAL_ROLES.has(normalizeRole(role));
}

export function validateOcrImageFile(
  input: File | null,
  fieldLabel: string,
  options?: { required?: boolean },
) {
  if (!input) {
    return options?.required ? `${fieldLabel} is required.` : "";
  }
  const lowerName = input.name.toLowerCase();
  const isHeic = lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
  if (!input.type.startsWith("image/") && !isHeic) {
    return `${fieldLabel} must be an image file (JPG, PNG, WEBP).`;
  }
  if (input.size > OCR_MAX_SOURCE_BYTES) {
    return `${fieldLabel} must be smaller than 20 MB before processing.`;
  }
  return "";
}
