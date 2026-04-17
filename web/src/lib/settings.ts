import { apiFetch } from "@/lib/api";

export type FactorySettings = {
  factory_name: string;
  address: string;
  factory_type: string;
  industry_type: string;
  industry_label: string;
  workflow_template_key: string;
  workflow_template_label: string;
  starter_modules: string[];
  target_morning: number;
  target_evening: number;
  target_night: number;
};

export type FactoryProfileOption = {
  key: string;
  label: string;
  description: string;
  starter_modules: string[];
};

export type WorkflowTemplateField = {
  key: string;
  label: string;
  input_type: string;
  required: boolean;
  help_text: string;
};

export type WorkflowTemplateSection = {
  key: string;
  label: string;
  description: string;
  fields: WorkflowTemplateField[];
};

export type WorkflowTemplateSummary = {
  key: string;
  label: string;
  industry_type: string;
  description: string;
  modules: string[];
  pack_level: string;
  is_default: boolean;
  sections: WorkflowTemplateSection[];
};

export type FactoryTemplatesPayload = {
  industry_type: string;
  industry_label: string;
  starter_modules: string[];
  active_template_key: string;
  active_template_label: string;
  active_template?: WorkflowTemplateSummary | null;
  templates: WorkflowTemplateSummary[];
};

export type FactorySummary = {
  factory_id: string;
  org_id: string;
  name: string;
  factory_code?: string | null;
  location?: string | null;
  timezone?: string | null;
  industry_type: string;
  industry_label: string;
  workflow_template_key: string;
  workflow_template_label: string;
  starter_modules: string[];
  member_count: number;
  my_role?: string | null;
  is_active_context: boolean;
  created_at: string;
};

export type ControlTowerPayload = {
  organization: {
    org_id: string;
    name: string;
    plan: string;
    total_factories: number;
    industry_breakdown: Array<{
      industry_type: string;
      industry_label: string;
      count: number;
    }>;
  };
  active_factory_id?: string | null;
  factories: FactorySummary[];
};

export type ManagedUser = {
  id: number;
  user_code: number;
  name: string;
  email: string;
  role: string;
  factory_name: string;
  factory_count: number;
  is_active: boolean;
  plan: string;
};

export type ManagedUserFactoryAccess = {
  factory_id: string;
  name: string;
  factory_code?: string | null;
  industry_type: string;
  industry_label: string;
  location?: string | null;
  timezone?: string | null;
  member_count: number;
  has_access: boolean;
  is_primary: boolean;
  role?: string | null;
};

export type ManagedUserFactoryAccessPayload = {
  user: {
    id: number;
    user_code: number;
    name: string;
    email: string;
    role: string;
    factory_name: string;
    primary_factory_id?: string | null;
    factory_count: number;
  };
  factories: ManagedUserFactoryAccess[];
};

export type UsageSummary = {
  plan?: string;
  period?: string;
  requests_used?: number;
  max_requests?: number;
  credits_used?: number;
  max_credits?: number;
  rate_limit_per_minute?: number;
  summary_used?: number;
  summary_limit?: number;
  email_used?: number;
  email_limit?: number;
  smart_used?: number;
  smart_limit?: number;
};

export type BillingStatus = {
  plan: string;
  status: string;
  trial_start_at?: string | null;
  trial_end_at?: string | null;
  current_period_end_at?: string | null;
  pending_plan?: string | null;
  pending_plan_effective_at?: string | null;
  active_addons?: Array<{
    id: string;
    name: string;
    feature_key?: string;
    price: number;
    quantity?: number;
    kind?: string;
    scan_quota?: number;
    billing_cycle?: string;
    status?: string;
    provider?: string | null;
    current_period_end_at?: string | null;
  }>;
  usage?: UsageSummary | null;
};

export type InvitePreviewPayload = {
  action: string;
  can_send: boolean;
  message: string;
  delivery_mode?: string;
  email?: string;
  existing_user?: {
    user_id: number;
    user_code: number;
    email: string;
    role: string;
  };
  invite_summary?: {
    recipient_name: string;
    email: string;
    role: string;
    role_label: string;
    role_summary: string;
    organization_name: string;
    factory_name: string;
    factory_location?: string | null;
    company_code?: string | null;
    inviter_name: string;
    custom_note?: string | null;
    expires_in_hours: number;
  };
  preview?: {
    subject: string;
    text_body: string;
    summary: InvitePreviewPayload["invite_summary"];
    sections: {
      details: Array<{ label: string; value: string }>;
      next_steps: string[];
      custom_note?: string | null;
    };
  };
};

export async function getFactorySettings() {
  return apiFetch<FactorySettings>("/settings/factory");
}

export async function updateFactorySettings(payload: FactorySettings) {
  return apiFetch<{ message: string; industry_type: string; industry_label: string; workflow_template_key: string; workflow_template_label: string }>(
    "/settings/factory",
    { method: "PUT", body: payload },
  );
}

export async function listFactoryProfiles() {
  return apiFetch<FactoryProfileOption[]>("/settings/factory-profiles");
}

export async function getFactoryTemplates(industryType?: string) {
  const query = industryType ? `?industry_type=${encodeURIComponent(industryType)}` : "";
  return apiFetch<FactoryTemplatesPayload>(`/settings/factory/templates${query}`);
}

export async function listFactories() {
  return apiFetch<FactorySummary[]>("/settings/factories");
}

export async function createFactory(payload: {
  name: string;
  location?: string | null;
  address?: string | null;
  timezone?: string | null;
  industry_type?: string | null;
  workflow_template_key?: string | null;
}) {
  return apiFetch<{ message: string; factory: FactorySummary }>("/settings/factories", {
    method: "POST",
    body: payload,
  });
}

export async function getControlTower() {
  return apiFetch<ControlTowerPayload>("/settings/control-tower", {}, { cacheTtlMs: 15_000 });
}

export async function listManagedUsers() {
  return apiFetch<ManagedUser[]>("/settings/users");
}

export async function inviteUser(payload: {
  name: string;
  email: string;
  role: string;
  factory_name: string;
  custom_note?: string | null;
}) {
  return apiFetch<{ message: string; delivery_mode?: string; verification_link?: string | null; preview?: InvitePreviewPayload["preview"] }>("/settings/users/invite", {
    method: "POST",
    body: payload,
  });
}

export async function previewInviteUser(payload: {
  name: string;
  email: string;
  role: string;
  factory_name: string;
  custom_note?: string | null;
}) {
  return apiFetch<InvitePreviewPayload>("/settings/users/invite/preview", {
    method: "POST",
    body: payload,
  });
}

export async function updateUserRole(userId: number, role: string, confirmAction?: string) {
  return apiFetch<{ message: string }>(`/settings/users/${userId}/role`, {
    method: "PUT",
    body: { role, confirm_action: confirmAction || null },
  });
}

export async function getManagedUserFactoryAccess(userId: number) {
  return apiFetch<ManagedUserFactoryAccessPayload>(`/settings/users/${userId}/factory-access`);
}

export async function updateManagedUserFactoryAccess(userId: number, factoryIds: string[]) {
  return apiFetch<ManagedUserFactoryAccessPayload & { message: string }>(`/settings/users/${userId}/factory-access`, {
    method: "PUT",
    body: { factory_ids: factoryIds },
  });
}

export async function deactivateUser(userId: number) {
  return apiFetch<{ message: string }>(`/settings/users/${userId}`, { method: "DELETE" });
}

export async function getUsageSummary() {
  return apiFetch<UsageSummary>("/settings/usage");
}

export async function getBillingStatus() {
  return apiFetch<BillingStatus>("/billing/status");
}
