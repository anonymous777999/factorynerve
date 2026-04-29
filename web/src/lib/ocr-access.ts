export const OCR_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const OCR_MAX_SOURCE_BYTES = 8 * 1024 * 1024;

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
  options?: { required?: boolean; allowPdf?: boolean },
) {
  if (!input) {
    return options?.required ? `${fieldLabel} is required.` : "";
  }
  const lowerName = input.name.toLowerCase();
  const isHeic = lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
  const isPdf = input.type === "application/pdf" || lowerName.endsWith(".pdf");
  if (!input.type.startsWith("image/") && !isHeic && !(options?.allowPdf && isPdf)) {
    return options?.allowPdf
      ? `${fieldLabel} must be PNG, JPG, PDF, or TIFF.`
      : `${fieldLabel} must be an image file (JPG, PNG, WEBP).`;
  }
  if (input.size > OCR_MAX_SOURCE_BYTES) {
    return "Image must be under 8 MB. Try compressing the photo.";
  }
  return "";
}
