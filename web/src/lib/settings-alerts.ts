import { apiFetch } from "@/lib/api";

export type AlertRecipient = {
  id: number;
  user_id: number | null;
  phone_number: string;
  phone_e164: string | null;
  verification_status: string;
  verified_at: string | null;
  event_types: string[] | null;
  event_types_mode: string;
  severity_levels: string[] | null;
  severity_levels_mode: string;
  receive_daily_summary: boolean;
  is_active: boolean;
  created_at: string;
};

export type AlertRecipientListPayload = {
  recipients: AlertRecipient[];
  active_count: number;
  limit: number;
  plan: string;
  preference_rules: {
    event_types: string;
    severity_levels: string;
  };
};

export type AlertVerificationStartResult = {
  masked_phone: string;
  expires_in: number;
};

export type AlertVerificationConfirmResult = {
  verified: boolean;
  phone_e164: string;
};

export type AlertActivityItem = {
  ref_id: string;
  org_id: string | null;
  org_name: string | null;
  event_type: string;
  severity: string;
  status: string;
  delivery_status: string;
  suppressed_reason: string | null;
  escalation_level: number;
  timestamp: string;
  summary: string;
  recipient_phone: string | null;
};

export type AlertActivityPayload = {
  alerts: AlertActivityItem[];
  total: number;
  filters: Record<string, unknown>;
};

export type AlertActivityDetail = {
  ref_id: string;
  org_id: string | null;
  org_name: string | null;
  event_type: string;
  severity: string;
  status: string;
  delivery_status: string;
  suppressed_reason: string | null;
  escalation_level: number;
  timestamp: string;
  summary: string;
  meta: Record<string, unknown> | null;
  deliveries: AlertActivityItem[];
};

export type AlertCategoryKey = "critical" | "warning" | "security" | "reports" | "machineDowntime";

export type AlertCategoryState = Record<AlertCategoryKey, boolean>;

export const ALL_ALERT_EVENT_TYPES = [
  "server_exception",
  "server_5xx_spike",
  "ocr_failure_spike",
  "payment_failure",
  "payment_webhook_error",
  "auth_anomaly",
  "abnormal_error_rate",
  "daily_summary",
] as const;

export const NON_SECURITY_EVENT_TYPES = [
  "server_exception",
  "server_5xx_spike",
  "ocr_failure_spike",
  "payment_failure",
  "payment_webhook_error",
  "abnormal_error_rate",
] as const;

export const SECURITY_EVENT_TYPES = ["auth_anomaly"] as const;

export const ALERT_SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export function emptyAlertCategoryState(): AlertCategoryState {
  return {
    critical: true,
    warning: true,
    security: true,
    reports: true,
    machineDowntime: false,
  };
}

function hasAll(values: Set<string>, required: readonly string[]) {
  return required.every((value) => values.has(value));
}

export function categoriesFromRecipient(recipient: AlertRecipient): AlertCategoryState {
  const eventTypes = recipient.event_types ? new Set(recipient.event_types) : new Set<string>(ALL_ALERT_EVENT_TYPES);
  const severityLevels = recipient.severity_levels
    ? new Set(recipient.severity_levels.map((value) => String(value).toUpperCase()))
    : new Set<string>(ALERT_SEVERITY_LEVELS);
  const hasBaseEvents = NON_SECURITY_EVENT_TYPES.some((value) => eventTypes.has(value));

  return {
    critical: hasBaseEvents && hasAll(severityLevels, ["HIGH", "CRITICAL"]),
    warning: hasBaseEvents && hasAll(severityLevels, ["LOW", "MEDIUM"]),
    security: eventTypes.has("auth_anomaly"),
    reports: recipient.receive_daily_summary,
    machineDowntime: false,
  };
}

export function categoriesToPreferences(categories: AlertCategoryState): {
  event_types: string[] | null;
  severity_levels: string[] | null;
  receive_daily_summary: boolean;
} {
  const baseSelected = categories.critical || categories.warning;
  let eventTypes: string[] | null = [];
  if (baseSelected && categories.security) {
    eventTypes = null;
  } else if (baseSelected) {
    eventTypes = [...NON_SECURITY_EVENT_TYPES];
  } else if (categories.security) {
    eventTypes = [...SECURITY_EVENT_TYPES];
  }

  let severityLevels: string[] | null = null;
  if (categories.critical && categories.warning) {
    severityLevels = null;
  } else if (categories.critical) {
    severityLevels = ["HIGH", "CRITICAL"];
  } else if (categories.warning) {
    severityLevels = ["LOW", "MEDIUM"];
  }

  return {
    event_types: eventTypes,
    severity_levels: severityLevels,
    receive_daily_summary: categories.reports,
  };
}

export function summarizeRecipientCategories(recipient: AlertRecipient) {
  const categories = categoriesFromRecipient(recipient);
  const labels: string[] = [];
  if (categories.critical) labels.push("Critical");
  if (categories.warning) labels.push("Warnings");
  if (categories.security) labels.push("Security");
  if (categories.reports) labels.push("Reports");
  if (!labels.length) return "No live alerts selected";
  return labels.join(", ");
}

export function formatAlertEventTypeLabel(value: string) {
  const labels: Record<string, string> = {
    server_exception: "Server/API Failure",
    server_5xx_spike: "5xx Spike",
    ocr_failure_spike: "OCR Failure Spike",
    payment_failure: "Payment Failure",
    payment_webhook_error: "Payment Webhook Error",
    auth_anomaly: "Security Anomaly",
    abnormal_error_rate: "Abnormal Error Rate",
    daily_summary: "Daily Summary",
  };
  return labels[String(value || "").trim().toLowerCase()] || String(value || "").replace(/_/g, " ");
}

export async function listAlertRecipients() {
  return apiFetch<AlertRecipientListPayload>("/settings/alert-recipients");
}

export async function createAlertRecipient(payload: {
  phone_number: string;
  event_types: string[] | null;
  severity_levels: string[] | null;
  receive_daily_summary: boolean;
  is_active: boolean;
}) {
  return apiFetch<AlertRecipient>("/settings/alert-recipients", {
    method: "POST",
    body: payload,
  });
}

export async function updateAlertRecipient(
  recipientId: number,
  payload: {
    phone_number?: string;
    event_types?: string[] | null;
    severity_levels?: string[] | null;
    receive_daily_summary?: boolean;
    is_active?: boolean;
  },
) {
  return apiFetch<AlertRecipient>(`/settings/alert-recipients/${recipientId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteAlertRecipient(recipientId: number) {
  return apiFetch<void>(`/settings/alert-recipients/${recipientId}`, {
    method: "DELETE",
  });
}

export async function startAlertRecipientVerification(recipientId: number, phone: string) {
  return apiFetch<AlertVerificationStartResult>(`/settings/alert-recipients/${recipientId}/start-verification`, {
    method: "POST",
    body: { phone },
  });
}

export async function confirmAlertRecipientVerification(recipientId: number, phone: string, otp: string) {
  return apiFetch<AlertVerificationConfirmResult>(`/settings/alert-recipients/${recipientId}/confirm-verification`, {
    method: "POST",
    body: { phone, otp },
  });
}

export async function listAlertActivity(limit = 10) {
  return apiFetch<AlertActivityPayload>(`/observability/alerts?limit=${encodeURIComponent(String(limit))}`);
}

export async function getAlertActivityDetail(refId: string) {
  return apiFetch<AlertActivityDetail>(`/observability/alerts/${encodeURIComponent(refId)}`);
}
