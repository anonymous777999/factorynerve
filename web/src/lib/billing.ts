import { apiFetch } from "@/lib/api";
import type { BillingStatus } from "@/lib/settings";

export type InvoiceItem = {
  id: number;
  plan: string;
  status: string;
  currency: string;
  amount: number;
  issued_at?: string | null;
  provider?: string | null;
  provider_invoice_id?: string | null;
  pdf_url?: string | null;
};

export type BillingConfig = {
  configured: boolean;
  provider: string;
  key_id?: string | null;
  currency: string;
  yearly_multiplier: number;
  manual_plan_override_enabled?: boolean;
};

export type BillingOrder = {
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };
  plan: string;
  billing_cycle: "monthly" | "yearly";
  amount: number;
  quote?: {
    billing_cycle: "monthly" | "yearly";
    amount_paise: number;
    base_monthly_price: number;
    included_users: number;
    included_factories: number;
    requested_users?: number | null;
    requested_factories?: number | null;
    extra_users: number;
    extra_factories: number;
    extra_user_monthly: number;
    extra_factory_monthly: number;
    selected_addon_ids: string[];
    selected_addon_quantities: Record<string, number>;
    chargeable_addon_ids: string[];
    chargeable_addon_quantities: Record<string, number>;
    included_addon_ids: string[];
    already_active_addon_ids: string[];
    chargeable_addons: Array<{ id: string; name: string; price: number; feature_key?: string; quantity?: number; incremental_quantity?: number; kind?: string; scan_quota?: number }>;
    included_addons: Array<{ id: string; name: string; price: number; feature_key?: string; quantity?: number; kind?: string; scan_quota?: number }>;
    already_active_addons: Array<{ id: string; name: string; price: number; feature_key?: string; quantity?: number; active_quantity?: number; kind?: string; scan_quota?: number }>;
    addon_monthly_total: number;
    monthly_total: number;
    multiplier: number;
  };
  idempotent?: boolean;
};

export async function getBillingStatus() {
  return apiFetch<BillingStatus>("/billing/status", {}, { cacheTtlMs: 20_000 });
}

export async function listInvoices() {
  return apiFetch<InvoiceItem[]>("/billing/invoices", {}, { cacheTtlMs: 20_000 });
}

export async function getBillingConfig() {
  return apiFetch<BillingConfig>("/billing/config", {}, { cacheTtlMs: 60_000 });
}

export async function createBillingOrder(
  plan: string,
  billingCycle: "monthly" | "yearly",
  requestedUsers?: number,
  requestedFactories?: number,
  addonIds: string[] = [],
  addonQuantities: Record<string, number> = {},
) {
  return apiFetch<BillingOrder>("/billing/orders", {
    method: "POST",
    body: {
      plan,
      billing_cycle: billingCycle,
      requested_users: requestedUsers,
      requested_factories: requestedFactories,
      addon_ids: addonIds,
      addon_quantities: addonQuantities,
    },
  });
}

export async function scheduleDowngrade(plan: string) {
  return apiFetch<{
    pending_plan: string;
    pending_plan_effective_at?: string | null;
  }>("/billing/downgrade", {
    method: "POST",
    body: { plan },
  });
}

export async function cancelScheduledDowngrade() {
  return apiFetch<{ message: string }>("/billing/downgrade", {
    method: "DELETE",
  });
}

export async function updateOrganizationPlan(plan: string) {
  return apiFetch<{ message: string; plan: string }>("/settings/org/plan", {
    method: "PUT",
    body: { plan },
  });
}
