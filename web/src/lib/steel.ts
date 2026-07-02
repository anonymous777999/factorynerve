import { API_BASE_URL, apiFetch } from "@/lib/api";

export type SteelPaymentMode = "bank_transfer" | "cash" | "cheque" | "upi";
export type SteelDispatchStatus = "pending" | "loaded" | "exited" | "dispatched" | "delivered" | "cancelled";
export type SteelVehicleType = "truck" | "trailer" | "pickup" | "other";
export type SteelStockMismatchCause =
  | "counting_error"
  | "process_loss"
  | "theft_or_leakage"
  | "wrong_entry"
  | "delayed_dispatch_update"
  | "other";

export type SteelInventoryTransaction = {
  id: number;
  item_id: number;
  item_name?: string | null;
  item_code?: string | null;
  transaction_type: string;
  quantity_kg: number;
  direction?: "in" | "out" | null;
  notes?: string | null;
  created_at: string;
};
export type SteelFollowUpTaskPriority = "low" | "medium" | "high" | "critical";
export type SteelFollowUpTaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type SteelCustomerVerificationStatus =
  | "draft"
  | "format_valid"
  | "pending_review"
  | "verified"
  | "mismatch"
  | "rejected"
  | "expired";
export type SteelCustomerVerificationFieldStatus =
  | "not_checked"
  | "missing"
  | "format_valid"
  | "invalid_format"
  | "matched"
  | "mismatch"
  | "not_available";
export type SteelCustomerVerificationDocType = "pan" | "gst";

export type SteelOperatorResponsibility = {
  user_id: number;
  name: string;
  batch_count: number;
  high_risk_batches: number;
  critical_batches: number;
  total_variance_kg: number;
  total_variance_value_inr: number | null;
  total_estimated_gross_profit_inr: number | null;
  average_loss_percent: number;
  highest_anomaly_score: number;
};

export type SteelDayResponsibility = {
  date: string;
  batch_count: number;
  high_risk_batches: number;
  total_variance_kg: number;
  total_variance_value_inr: number | null;
  total_estimated_gross_profit_inr: number | null;
  average_loss_percent: number;
};

export type SteelBatchResponsibility = {
  id: number;
  batch_code: string;
  production_date: string;
  operator_name?: string | null;
  severity: "normal" | "watch" | "high" | "critical";
  loss_percent: number;
  variance_kg: number;
  variance_value_inr: number | null;
  estimated_gross_profit_inr: number | null;
  anomaly_score: number;
  reason: string;
};

export type SteelOverview = {
  financial_access: boolean;
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
    workflow_template_key: string;
  };
  inventory_totals: {
    raw_material_kg: number;
    wip_kg: number;
    finished_goods_kg: number;
    total_kg: number;
    total_ton: number;
  };
  confidence_counts: {
    green: number;
    yellow: number;
    red: number;
  };
  batch_metrics: {
    total_batches: number;
    average_loss_percent: number;
    high_severity_batches: number;
  };
  profit_summary: {
    estimated_input_cost_inr: number;
    estimated_output_value_inr: number;
    estimated_gross_profit_inr: number;
    gross_margin_percent: number;
    average_profit_per_batch_inr: number;
    invoice_count: number;
    dispatch_count: number;
    realized_invoiced_amount_inr: number;
    realized_invoiced_weight_kg: number;
    realized_dispatched_revenue_inr: number;
    realized_dispatched_cost_inr: number;
    realized_dispatched_profit_inr: number;
    realized_dispatch_weight_kg: number;
    realized_margin_percent: number;
    outstanding_invoice_amount_inr: number;
    outstanding_invoice_weight_kg: number;
    best_profit_batch?: SteelBatch | null;
    lowest_profit_batch?: SteelBatch | null;
  } | null;
  anomaly_summary: {
    watch_batches: number;
    high_batches: number;
    critical_batches: number;
    ranked_batch_count: number;
    total_variance_kg: number;
    total_estimated_leakage_value_inr: number | null;
    highest_anomaly_score: number;
    highest_risk_operator?: SteelOperatorResponsibility | null;
    highest_loss_day?: SteelDayResponsibility | null;
  };
  top_loss_batch?: SteelBatch | null;
  top_operator_losses: SteelOperatorResponsibility[];
  loss_by_day: SteelDayResponsibility[];
  anomaly_batches: SteelBatch[];
  ranked_anomalies: Array<{
    rank: number;
    anomaly_score: number;
    reason: string;
    estimated_leakage_value_inr: number | null;
    batch: SteelBatch;
  }>;
  responsibility_analytics: {
    by_operator: SteelOperatorResponsibility[];
    by_day: SteelDayResponsibility[];
    by_batch: SteelBatchResponsibility[];
  };
  low_confidence_items: SteelStockItem[];
};

export type SteelItem = {
  id: number;
  item_code: string;
  name: string;
  category: string;
  display_unit: string;
  base_unit: string;
  current_rate_per_kg?: number | null;
  reorder_point_kg?: number | null;
  safety_stock_kg?: number | null;
  lead_time_days?: number | null;
  is_active: boolean;
};

export type SteelStockItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  base_unit: string;
  display_unit: string;
  current_rate_per_kg?: number | null;
  reorder_point_kg?: number | null;
  safety_stock_kg?: number | null;
  lead_time_days?: number | null;
  stock_balance_kg: number;
  stock_balance_ton: number;
  confidence_status: "green" | "yellow" | "red";
  confidence_reason: string;
  last_reconciliation_at?: string | null;
  last_variance_kg?: number | null;
  last_variance_percent?: number | null;
};

export type SteelBatch = {
  id: number;
  batch_code: string;
  production_date: string;
  input_item_id: number;
  input_item_name?: string | null;
  output_item_id: number;
  output_item_name?: string | null;
  operator_user_id?: number | null;
  operator_name?: string | null;
  input_quantity_kg: number;
  expected_output_kg: number;
  actual_output_kg: number;
  loss_kg: number;
  loss_percent: number;
  variance_kg: number;
  variance_percent: number;
  variance_value_inr: number | null;
  severity: "normal" | "watch" | "high" | "critical";
  input_rate_per_kg: number | null;
  output_rate_per_kg: number | null;
  estimated_input_cost_inr: number | null;
  estimated_output_value_inr: number | null;
  estimated_gross_profit_inr: number | null;
  profit_per_kg_inr: number | null;
  anomaly_score: number;
  variance_reason: string;
  rejection_qty_kg?: number | null;
  scrap_qty_kg?: number | null;
  line_id?: number | null;
  machine_id?: number | null;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type SteelBatchMovement = {
  id: number;
  item_id: number;
  item_code?: string | null;
  item_name?: string | null;
  item_category?: string | null;
  transaction_type: string;
  quantity_kg: number;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  created_at: string;
  balance_before_kg?: number | null;
  balance_after_kg?: number | null;
};

export type SteelBatchAuditEvent = {
  id: number;
  action: string;
  details?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  timestamp: string;
};

export type SteelBatchDetail = {
  financial_access: boolean;
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
  };
  batch: SteelBatch;
  traceability: {
    input_item: {
      id?: number | null;
      item_code?: string | null;
      name?: string | null;
      category?: string | null;
      current_rate_per_kg?: number | null;
      current_stock_kg: number;
      movement?: SteelBatchMovement | null;
    };
    output_item: {
      id?: number | null;
      item_code?: string | null;
      name?: string | null;
      category?: string | null;
      current_rate_per_kg?: number | null;
      current_stock_kg: number;
      movement?: SteelBatchMovement | null;
    };
    severity_reason: string;
  };
  inventory_movements: SteelBatchMovement[];
  audit_events: SteelBatchAuditEvent[];
};

export type SteelInvoiceLine = {
  id: number;
  item_id: number;
  item_code?: string | null;
  item_name?: string | null;
  batch_id?: number | null;
  batch_code?: string | null;
  description?: string | null;
  weight_kg: number;
  rate_per_kg: number;
  line_total: number;
  dispatched_weight_kg?: number;
  remaining_weight_kg?: number;
  created_at: string;
};

export type SteelInvoice = {
  id: number;
  customer_id?: number | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  status: string;
  currency: string;
  payment_terms_days: number;
  total_weight_kg: number;
  subtotal_amount: number;
  total_amount: number;
  paid_amount_inr?: number;
  outstanding_amount_inr?: number;
  overdue_days?: number;
  is_overdue?: boolean;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  lines?: SteelInvoiceLine[];
};

export type SteelInvoiceDetail = {
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
  };
  invoice: SteelInvoice;
  dispatch_summary: {
    dispatch_count: number;
    active_count: number;
    delivered_count: number;
    cancelled_count: number;
    dispatched_weight_kg: number;
    remaining_weight_kg: number;
    last_dispatch_date?: string | null;
  };
  dispatches: SteelDispatch[];
  audit_events: SteelBatchAuditEvent[];
};

export type SteelDispatchLine = {
  id: number;
  invoice_line_id: number;
  item_id: number;
  item_code?: string | null;
  item_name?: string | null;
  batch_id?: number | null;
  batch_code?: string | null;
  weight_kg: number;
  invoice_line_weight_kg?: number | null;
  rate_per_kg?: number | null;
  line_total_reference?: number | null;
  created_at: string;
};

export type SteelDispatch = {
  id: number;
  invoice_id: number;
  invoice_number?: string | null;
  customer_name?: string | null;
  dispatch_number: string;
  gate_pass_number: string;
  dispatch_date: string;
  truck_number: string;
  transporter_name?: string | null;
  vehicle_type?: SteelVehicleType | null;
  truck_capacity_kg?: number | null;
  driver_name: string;
  driver_phone?: string | null;
  driver_license_number?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  status: SteelDispatchStatus;
  total_weight_kg: number;
  notes?: string | null;
  receiver_name?: string | null;
  pod_notes?: string | null;
  inventory_posted_at?: string | null;
  delivered_at?: string | null;
  delivered_by_user_id?: number | null;
  delivered_by_name?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  lines?: SteelDispatchLine[];
};

export type SteelDispatchDetail = {
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
  };
  dispatch: SteelDispatch;
  ledger_movements: SteelBatchMovement[];
  audit_events: SteelBatchAuditEvent[];
};

export type SteelCustomer = {
  id: number;
  customer_code?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  tax_id?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  company_type?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  credit_limit: number;
  payment_terms_days: number;
  status: string;
  notes?: string | null;
  verification_status: SteelCustomerVerificationStatus;
  pan_status: SteelCustomerVerificationFieldStatus;
  gst_status: SteelCustomerVerificationFieldStatus;
  verification_source?: string | null;
  official_legal_name?: string | null;
  official_trade_name?: string | null;
  official_state?: string | null;
  name_match_status: SteelCustomerVerificationFieldStatus;
  state_match_status: SteelCustomerVerificationFieldStatus;
  match_score: number;
  mismatch_reason?: string | null;
  pan_document_url?: string | null;
  gst_document_url?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: number | null;
  verified_by_name?: string | null;
  is_active: boolean;
  invoice_total_inr: number;
  payments_total_inr: number;
  outstanding_amount_inr: number;
  advance_amount_inr: number;
  overdue_amount_inr: number;
  invoice_count: number;
  payment_count: number;
  open_invoice_count: number;
  overdue_days: number;
  credit_used_percentage: number;
  available_credit_inr: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  late_payment_count: number;
  last_payment_date?: string | null;
  last_invoice_date?: string | null;
  open_follow_up_count: number;
  next_follow_up_date?: string | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type SteelCustomerFollowUpTask = {
  id: number;
  customer_id: number;
  invoice_id?: number | null;
  invoice_number?: string | null;
  title: string;
  note?: string | null;
  priority: SteelFollowUpTaskPriority;
  status: SteelFollowUpTaskStatus;
  due_date?: string | null;
  assigned_to_user_id?: number | null;
  assigned_to_name?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SteelPaymentAllocation = {
  invoice_id: number;
  invoice_number?: string | null;
  amount: number;
  payment_date?: string;
};

export type SteelCustomerPayment = {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  payment_date: string;
  amount: number;
  payment_mode: SteelPaymentMode;
  reference_number?: string | null;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  created_at: string;
  allocations?: SteelPaymentAllocation[];
};

export type SteelCustomerLedger = {
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
  };
  customer: SteelCustomer;
  ledger_summary: {
    invoice_total_inr: number;
    payments_total_inr: number;
    outstanding_amount_inr: number;
    advance_amount_inr: number;
    overdue_amount_inr: number;
    credit_used_percentage: number;
    available_credit_inr: number;
    risk_score: number;
    risk_level: "low" | "medium" | "high";
    overdue_days: number;
    late_payment_count: number;
  };
  invoices: Array<SteelInvoice & { paid_amount_inr: number; outstanding_amount_inr: number }>;
  payments: SteelCustomerPayment[];
  follow_up_tasks: SteelCustomerFollowUpTask[];
  alerts: Array<{
    level: "info" | "warning" | "critical";
    title: string;
    detail: string;
  }>;
};

export type SteelReconciliation = {
  id: number;
  item_id: number;
  item_code?: string | null;
  item_name?: string | null;
  status: "pending" | "approved" | "rejected";
  physical_qty_kg: number;
  system_qty_kg: number;
  variance_kg: number;
  variance_percent: number;
  confidence_status: "green" | "yellow" | "red";
  notes?: string | null;
  approver_notes?: string | null;
  rejection_reason?: string | null;
  mismatch_cause?: SteelStockMismatchCause | null;
  counted_by_user_id?: number | null;
  counted_by_name?: string | null;
  approved_by_user_id?: number | null;
  approved_by_name?: string | null;
  rejected_by_user_id?: number | null;
  rejected_by_name?: string | null;
  counted_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
};

export type SteelReconciliationSummary = {
  active_items: number;
  reviewed_items: number;
  matched_items: number;
  mismatch_items: number;
  pending_reviews: number;
  stale_reviews: number;
  stale_sla_days: number;
  accuracy_percent: number;
  last_review_at?: string | null;
};

export async function getSteelOverview() {
  return apiFetch<SteelOverview>("/steel/overview", {}, { cacheTtlMs: 10_000, cacheKey: "steel:overview" });
}

export async function listSteelItems() {
  return apiFetch<{ items: SteelItem[] }>("/steel/inventory/items", {}, { cacheTtlMs: 10_000, cacheKey: "steel:items" });
}

export async function listSteelStock() {
  return apiFetch<{ items: SteelStockItem[] }>("/steel/inventory/stock", {}, { cacheTtlMs: 10_000, cacheKey: "steel:stock" });
}

export async function listSteelBatches(limit = 20) {
  return apiFetch<{ items: SteelBatch[] }>(`/steel/batches?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 10_000, cacheKey: `steel:batches:${limit}` });
}

export async function getSteelBatchDetail(batchId: number) {
  return apiFetch<SteelBatchDetail>(`/steel/batches/${encodeURIComponent(String(batchId))}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:batch:${batchId}` });
}

export async function createSteelItem(payload: {
  item_code: string;
  name: string;
  category: string;
  display_unit: string;
  current_rate_per_kg?: number | null;
  reorder_point_kg?: number | null;
  safety_stock_kg?: number | null;
  lead_time_days?: number | null;
}) {
  return apiFetch<{ item: SteelItem }>("/steel/inventory/items", {
    method: "POST",
    body: payload,
  });
}

export async function createSteelTransaction(payload: {
  item_id: number;
  transaction_type: string;
  quantity_kg: number;
  direction?: string | null;
  notes?: string | null;
}) {
  return apiFetch<{ transaction: { id: number } }>("/steel/inventory/transactions", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelTransactions(limit = 100) {
  return apiFetch<{ items: any[] }>(`/steel/inventory/transactions?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:transactions:${limit}` });
}

export async function reconcileSteelStock(payload: {
  item_id: number;
  physical_qty_kg: number;
  notes?: string | null;
  mismatch_cause?: SteelStockMismatchCause | null;
}) {
  return apiFetch<{ reconciliation: { id: number; status: string; confidence_status: string; mismatch_cause?: SteelStockMismatchCause | null } }>("/steel/inventory/reconciliations", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelReconciliations(params?: {
  status?: "pending" | "approved" | "rejected" | "";
  item_id?: number | null;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.item_id) search.set("item_id", String(params.item_id));
  if (params?.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: SteelReconciliation[] }>(`/steel/inventory/reconciliations${suffix}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:reconciliations:${suffix}` });
}

export async function getSteelReconciliationsSummary() {
  return apiFetch<{ summary: SteelReconciliationSummary }>(
    "/steel/inventory/reconciliations/summary",
    {},
    { cacheTtlMs: 5_000, cacheKey: "steel:reconciliations:summary" },
  );
}

export async function approveSteelReconciliation(reconciliationId: number, payload?: {
  approver_notes?: string | null;
  mismatch_cause?: SteelStockMismatchCause | null;
}) {
  return apiFetch<{ reconciliation: { id: number; status: string; confidence_status: string; mismatch_cause?: SteelStockMismatchCause | null } }>(
    `/steel/inventory/reconciliations/${encodeURIComponent(String(reconciliationId))}/approve`,
    { method: "POST", body: payload || {} },
  );
}

export async function rejectSteelReconciliation(reconciliationId: number, payload: {
  rejection_reason: string;
  approver_notes?: string | null;
  mismatch_cause?: SteelStockMismatchCause | null;
}) {
  return apiFetch<{ reconciliation: { id: number; status: string; rejection_reason?: string | null; mismatch_cause?: SteelStockMismatchCause | null } }>(
    `/steel/inventory/reconciliations/${encodeURIComponent(String(reconciliationId))}/reject`,
    { method: "POST", body: payload },
  );
}

export async function createSteelBatch(payload: {
  batch_code?: string | null;
  production_date: string;
  input_item_id: number;
  output_item_id: number;
  input_quantity_kg: number;
  expected_output_kg: number;
  actual_output_kg: number;
  rejection_qty_kg?: number | null;
  scrap_qty_kg?: number | null;
  line_id?: number | null;
  machine_id?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ batch: SteelBatch }>("/steel/batches", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelInvoices(limit = 20) {
  return apiFetch<{ items: SteelInvoice[] }>(`/steel/invoices?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 10_000, cacheKey: `steel:invoices:${limit}` });
}

export async function getSteelInvoiceDetail(invoiceId: number) {
  return apiFetch<SteelInvoiceDetail>(`/steel/invoices/${encodeURIComponent(String(invoiceId))}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:invoice:${invoiceId}` });
}

export async function createSteelInvoice(payload: {
  invoice_number?: string | null;
  invoice_date: string;
  customer_name?: string | null;
  customer_id?: number | null;
  payment_terms_days?: number | null;
  notes?: string | null;
  lines: Array<{
    item_id: number;
    batch_id?: number | null;
    description?: string | null;
    weight_kg: number;
    rate_per_kg: number;
  }>;
}) {
  return apiFetch<{ invoice: SteelInvoice }>("/steel/invoices", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelCustomers(limit = 50) {
  return apiFetch<{ items: SteelCustomer[] }>(`/steel/customers?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 10_000, cacheKey: `steel:customers:${limit}` });
}

export async function createSteelCustomer(payload: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  tax_id?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  company_type?: string | null;
  contact_person?: string | null;
  designation?: string | null;
  credit_limit?: number | null;
  payment_terms_days?: number | null;
  status?: "active" | "on_hold" | "blocked";
  notes?: string | null;
}) {
  return apiFetch<{ customer: SteelCustomer }>("/steel/customers", {
    method: "POST",
    body: payload,
  });
}

export async function getSteelCustomerLedger(customerId: number) {
  return apiFetch<SteelCustomerLedger>(`/steel/customers/${encodeURIComponent(String(customerId))}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:customer:${customerId}` });
}

export async function runSteelCustomerVerificationCheck(customerId: number) {
  return apiFetch<{ customer: SteelCustomer }>(`/steel/customers/${encodeURIComponent(String(customerId))}/verification/run-check`, {
    method: "POST",
  });
}

export async function uploadSteelCustomerVerificationDocument(
  customerId: number,
  documentType: SteelCustomerVerificationDocType,
  file: File,
) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<{ customer: SteelCustomer }>(
    `/steel/customers/${encodeURIComponent(String(customerId))}/verification-documents/${encodeURIComponent(documentType)}`,
    {
      method: "POST",
      body,
    },
  );
}

export async function reviewSteelCustomerVerification(
  customerId: number,
  payload: {
    decision: "approve" | "reject";
    verification_source?: string | null;
    official_legal_name?: string | null;
    official_trade_name?: string | null;
    official_state?: string | null;
    mismatch_reason?: string | null;
  },
) {
  return apiFetch<{ customer: SteelCustomer }>(`/steel/customers/${encodeURIComponent(String(customerId))}/verification/review`, {
    method: "POST",
    body: payload,
  });
}

export async function createSteelCustomerPayment(payload: {
  customer_id: number;
  invoice_id?: number | null;
  payment_date: string;
  amount: number;
  payment_mode?: SteelPaymentMode;
  reference_number?: string | null;
  notes?: string | null;
  allocations?: Array<{
    invoice_id: number;
    amount: number;
  }> | null;
}) {
  return apiFetch<{ payment: SteelCustomerPayment }>("/steel/customers/payments", {
    method: "POST",
    body: payload,
  });
}

export async function createSteelCustomerFollowUpTask(
  customerId: number,
  payload: {
    title: string;
    note?: string | null;
    priority?: SteelFollowUpTaskPriority;
    due_date?: string | null;
    invoice_id?: number | null;
    assigned_to_user_id?: number | null;
  },
) {
  return apiFetch<{ task: SteelCustomerFollowUpTask }>(`/steel/customers/${encodeURIComponent(String(customerId))}/tasks`, {
    method: "POST",
    body: payload,
  });
}

export async function updateSteelCustomerFollowUpTaskStatus(
  customerId: number,
  taskId: number,
  payload: {
    status: SteelFollowUpTaskStatus;
    note?: string | null;
  },
) {
  return apiFetch<{ task: SteelCustomerFollowUpTask }>(
    `/steel/customers/${encodeURIComponent(String(customerId))}/tasks/${encodeURIComponent(String(taskId))}/status`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function listSteelDispatches(limit = 20) {
  return apiFetch<{ items: SteelDispatch[] }>(`/steel/dispatches?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 10_000, cacheKey: `steel:dispatches:${limit}` });
}

export async function getSteelDispatchDetail(dispatchId: number) {
  return apiFetch<SteelDispatchDetail>(`/steel/dispatches/${encodeURIComponent(String(dispatchId))}`, {}, { cacheTtlMs: 5_000, cacheKey: `steel:dispatch:${dispatchId}` });
}

export async function createSteelDispatch(payload: {
  dispatch_number?: string | null;
  gate_pass_number?: string | null;
  invoice_id: number;
  dispatch_date: string;
  truck_number: string;
  transporter_name?: string | null;
  vehicle_type?: SteelVehicleType | null;
  truck_capacity_kg?: number | null;
  driver_name: string;
  driver_phone?: string | null;
  driver_license_number?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  status?: SteelDispatchStatus;
  notes?: string | null;
  lines: Array<{
    invoice_line_id: number;
    weight_kg: number;
  }>;
}) {
  return apiFetch<{ dispatch: SteelDispatch; warnings?: string[] }>("/steel/dispatches", {
    method: "POST",
    body: payload,
  });
}

export async function updateSteelDispatchStatus(
  dispatchId: number,
  payload: {
    status: SteelDispatchStatus;
    entry_time?: string | null;
    exit_time?: string | null;
    receiver_name?: string | null;
    pod_notes?: string | null;
  },
) {
  return apiFetch<{ dispatch: SteelDispatch }>(`/steel/dispatches/${encodeURIComponent(String(dispatchId))}/status`, {
    method: "POST",
    body: payload,
  });
}

export function getSteelOwnerDailyPdfUrl(reportDate?: string | null) {
  const params = new URLSearchParams();
  if (reportDate) params.set("report_date", reportDate);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return `/api/steel/owner-daily-pdf${suffix}`;
}

export function getSteelCustomerVerificationDocumentUrl(
  customerId: number,
  documentType: SteelCustomerVerificationDocType,
) {
  return `${API_BASE_URL}/steel/customers/${encodeURIComponent(String(customerId))}/verification-documents/${encodeURIComponent(documentType)}`;
}

// ── Inventory Intelligence Types ────────────────────────────────────────────

export type LowStockAlert = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  avg_daily_usage_kg: number;
  days_remaining: number;
  coverage_threshold_kg: number;
  estimated_value_inr: number;
  severity: "warning" | "critical";
};

export type DeadStockItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  estimated_value_inr: number;
  last_transaction_at: string | null;
  inactive_days: number;
};

export type TurnoverItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  avg_daily_out_kg: number;
  days_of_stock_on_hand: number | null;
  total_outflow_kg_30d: number;
  estimated_value_inr: number;
  confidence_status: string;
};

export type CategorySummary = {
  category: string;
  item_count: number;
  total_balance_kg: number;
  total_value_inr: number;
  low_stock_count: number;
  dead_stock_count: number;
  slow_moving_count: number;
  overstocked_count: number;
};

export type InventoryIntelligence = {
  low_stock_alerts: LowStockAlert[];
  dead_stock: DeadStockItem[];
  turnover_analysis: {
    items: TurnoverItem[];
    category_summary: CategorySummary[];
  };
};

export type ValuationCategory = {
  category: string;
  balance_kg: number;
  value_inr: number;
  item_count: number;
};

export type InventoryValuation = {
  total_estimated_value_inr: number;
  by_category: ValuationCategory[];
  as_of: string;
  data_quality: string;
  method: string;
  note: string;
};

export type SlowMovingItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  estimated_value_inr: number;
  avg_daily_out_kg: number;
  days_of_stock_on_hand: number | null;
  last_transaction_at: string | null;
};

export type OverstockedItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  estimated_value_inr: number;
  days_of_stock_on_hand: number;
  avg_daily_out_kg: number;
  coverage_days: number;
};

export type ABCItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  balance_kg: number;
  estimated_value_inr: number;
  contribution_percent: number;
};

export type ABCAnalysis = {
  a_items: ABCItem[];
  b_items: ABCItem[];
  c_items: ABCItem[];
  summary: {
    a_count: number;
    a_value_inr: number;
    b_count: number;
    b_value_inr: number;
    c_count: number;
    c_value_inr: number;
    total_value_inr: number;
  };
  method: string;
};

export type SuspiciousMovement = {
  type: string;
  severity: "critical" | "high" | "warning" | "info";
  item_id: number;
  item_code: string;
  item_name: string;
  detail: string;
  detected_at: string;
  [key: string]: unknown;
};

export type ReconciliationRiskItem = {
  item_id: number;
  item_code: string;
  name: string;
  category: string;
  current_balance_kg: number;
  estimated_value_inr: number;
  reason: string;
  days_since_last_review?: number | null;
  last_reviewed_at?: string | null;
  variance_percent?: number;
  variance_kg?: number;
  mismatch_cause?: string | null;
};

export type ReconciliationRisk = {
  stale_items: ReconciliationRiskItem[];
  high_variance_items: ReconciliationRiskItem[];
  pending_reviews: number;
  stale_sla_days: number;
};

export type ExpandedInventoryIntelligence = InventoryIntelligence & {
  as_of: string;
  inventory_valuation: InventoryValuation;
  slow_moving_items: SlowMovingItem[];
  overstocked_items: OverstockedItem[];
  abc_analysis: ABCAnalysis;
  suspicious_movements: SuspiciousMovement[];
  reconciliation_risk: ReconciliationRisk;
};

// ── Quality Tracking Types ─────────────────────────────────────────────────

export type OperatorQuality = {
  user_id: number;
  name: string;
  batch_count: number;
  high_critical_count: number;
  high_critical_percent: number;
  avg_loss_percent: number;
};

export type QualityScore = {
  overall: number;
  label: "good" | "needs_attention" | "critical" | "insufficient_data";
  loss_penalty: number;
  severity_penalty: number;
};

export type QualityTrendDay = {
  date: string;
  batch_count: number;
  avg_loss_percent: number;
  high_critical_count: number;
  quality_score: number;
};

export type DefectCategory = {
  reason: string;
  count: number;
  percent: number;
};

export type QualityTracking = {
  total_batches: number;
  time_period_days: number;
  rejection_rate: {
    overall_high_critical_percent: number;
    overall_avg_loss_percent: number;
    by_operator: OperatorQuality[];
  };
  severity_distribution: Record<string, number>;
  defect_categories: DefectCategory[];
  quality_score: QualityScore;
  trend: QualityTrendDay[];
};

// ── Anomaly Detection Types ────────────────────────────────────────────────

export type AnomalyItem = {
  type: string;
  severity: "critical" | "high" | "warning" | "info";
  resource_id: string;
  resource_label: string;
  detail: string;
  detected_at: string;
  [key: string]: unknown;
};

export type AnomalyDetection = {
  anomaly_count: number;
  time_period_days: number;
  financial_anomalies: AnomalyItem[];
  inventory_anomalies: AnomalyItem[];
  dispatch_fraud_alerts: AnomalyItem[];
  all_anomalies_sorted: AnomalyItem[];
  summary: {
    critical_count: number;
    high_count: number;
    warning_count: number;
  };
};

// ── Owner Dashboard Types ──────────────────────────────────────────────────

export type OwnerDashboard = {
  factory: {
    factory_id: string;
    name: string;
    factory_code?: string | null;
    industry_type: string;
  };
  report_date: string;
  snapshot: {
    total_stock_kg: number;
    total_items: number;
    today_batches: number;
    week_batches: number;
    month_batches: number;
    today_output_kg: number;
    today_loss_kg: number;
    today_loss_percent: number;
  };
  inventory_health: {
    green_count: number;
    yellow_count: number;
    red_count: number;
    low_confidence_items: Array<{
      item_id: number;
      item_code: string;
      name: string;
      balance_kg: number;
      confidence_status: string;
      confidence_reason: string;
    }>;
  };
  financial_pulse: {
    realized_dispatched_revenue_inr: number;
    realized_dispatched_profit_inr: number;
    realized_margin_percent: number;
    outstanding_invoice_amount_inr: number;
    overdue_invoice_count: number;
    overdue_amount_inr: number;
  };
  anomaly_pressure: {
    critical_count: number;
    high_count: number;
    warning_count: number;
    top_anomalies: AnomalyItem[];
  };
  alerts: Array<{
    level: "info" | "warning" | "critical";
    title: string;
    detail: string;
  }>;
};

// ── Sales Intelligence Types ────────────────────────────────────────────────

export type SalesCustomerBrief = {
  customer_id: number;
  customer_name: string;
  revenue_inr: number;
  weight_kg: number;
  invoice_count: number;
  risk_level: string;
};

export type MonthlySalesTrend = {
  month: string;
  revenue_inr: number;
  weight_kg: number;
  invoice_count: number;
};

export type RiskLevelSegment = {
  risk_level: string;
  count: number;
};

export type VolumeTier = {
  label: string;
  min_kg: number;
  count: number;
  total_revenue_inr: number;
};

export type OutstandingCustomer = {
  customer_id: number;
  customer_name: string;
  outstanding_inr: number;
  overdue_days: number;
  risk_level: string;
};

export type FulfillmentFunnel = {
  invoiced_count: number;
  dispatched_count: number;
  delivered_count: number;
  paid_invoices: number;
  conversion_rates: {
    invoice_to_dispatch_pct: number;
    dispatch_to_delivery_pct: number;
    invoice_to_paid_pct: number;
  };
};

export type SalesIntelligence = {
  sales_trends: {
    period: {
      total_revenue_inr: number;
      total_weight_kg: number;
      invoice_count: number;
      time_period_days: number;
    };
    top_customers: SalesCustomerBrief[];
    monthly_trend: MonthlySalesTrend[];
  };
  customer_analytics: {
    total_customers: number;
    by_risk_level: RiskLevelSegment[];
    by_volume_tier: VolumeTier[];
    top_by_revenue: SalesCustomerBrief[];
    top_by_outstanding: OutstandingCustomer[];
  };
  fulfillment_funnel: FulfillmentFunnel;
};

// ── New API Functions ──────────────────────────────────────────────────────

export async function getSteelInventoryIntelligence(params?: {
  low_stock_days?: number;
  dead_stock_days?: number;
}) {
  const search = new URLSearchParams();
  if (params?.low_stock_days) search.set("low_stock_days", String(params.low_stock_days));
  if (params?.dead_stock_days) search.set("dead_stock_days", String(params.dead_stock_days));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ExpandedInventoryIntelligence>(
    `/steel/inventory/intelligence${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:intelligence${suffix}` },
  );
}

export async function getSteelQualityTracking(days = 30) {
  return apiFetch<QualityTracking>(
    `/steel/quality?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:quality:${days}` },
  );
}

export async function getSteelAnomalies(days = 30) {
  return apiFetch<AnomalyDetection>(
    `/steel/anomalies?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:anomalies:${days}` },
  );
}

export async function getSteelOwnerDashboard() {
  return apiFetch<OwnerDashboard>(
    "/steel/owner/dashboard",
    {},
    { cacheTtlMs: 10_000, cacheKey: "steel:owner:dashboard" },
  );
}

export async function getSteelSalesIntelligence(days = 90) {
  return apiFetch<SalesIntelligence>(
    `/steel/sales-intelligence?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:sales:${days}` },
  );
}

// ── Financial Intelligence Types ─────────────────────────────────────────

export type RevenuePeriod = {
  invoice_count: number;
  revenue_inr: number;
  weight_kg: number;
};

export type FinancialOverview = {
  as_of: string;
  period_days: number;
  revenue: {
    today: RevenuePeriod;
    this_week: RevenuePeriod;
    this_month: RevenuePeriod;
    last_n_days: RevenuePeriod;
    total_all_time: {
      revenue_inr: number;
      invoice_count: number;
    };
  };
  collected_cash: {
    today: number;
    this_week: number;
    this_month: number;
    last_n_days: number;
  };
  realized_metrics: {
    dispatched_revenue_inr: number;
    dispatched_cost_inr: number;
    dispatched_profit_inr: number;
    margin_percent: number;
    dispatch_weight_kg: number;
    data_quality: string;
    cost_basis: string;
  };
  cash_balance: {
    total_balance_inr: number;
    cash_in_hand_inr: number;
    bank_balance_inr: number;
    account_count: number;
  };
  payables: {
    total_unpaid_inr: number;
    overdue_bill_count: number;
    overdue_amount_inr: number;
    unpaid_bill_count: number;
  };
  expenses: {
    total_expenses_inr: number;
    categories: Array<{ category: string; total_amount_inr: number; count: number }>;
  };
  paid_to_vendors: {
    last_n_days_inr: number;
  };
  receivables: {
    total_outstanding_inr: number;
    overdue_count: number;
    overdue_amount_inr: number;
    outstanding_invoice_count: number;
  };
  context: {
    active_customers: number;
    total_invoices_all_time: number;
  };
};

export type ProductProfitabilityItem = {
  item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  total_revenue_inr: number;
  total_cost_inr: number;
  gross_profit_inr: number;
  margin_percent: number;
  total_weight_kg: number;
  avg_rate_per_kg: number;
  avg_cost_per_kg: number;
  invoice_count: number;
  cost_basis: string;
};

export type ProductProfitability = {
  time_period_days: number;
  total_products_analyzed: number;
  data_quality: string;
  cost_basis_summary: string;
  products: ProductProfitabilityItem[];
  top_by_margin: ProductProfitabilityItem[];
  bottom_by_margin: ProductProfitabilityItem[];
  summary: {
    total_revenue_inr: number;
    total_cost_inr: number;
    total_profit_inr: number;
    avg_margin_percent: number;
    total_weight_kg: number;
  };
};

export type AgingBucket = {
  key: string;
  label: string;
  count: number;
  amount_inr: number;
  invoice_count: number;
};

export type OverdueCustomer = {
  customer_id: number;
  customer_name: string;
  risk_level: string;
  outstanding_inr: number;
  overdue_inr: number;
  max_overdue_days: number;
  invoice_count: number;
};

export type ReceivablesSummary = {
  as_of: string;
  total_outstanding_inr: number;
  total_overdue_inr: number;
  aging_buckets: AgingBucket[];
  top_overdue_customers: OverdueCustomer[];
  summary: {
    total_invoices: number;
    fully_paid_invoices: number;
    outstanding_invoices: number;
    total_paid_inr: number;
    collection_efficiency_percent: number;
  };
};

export async function getSteelFinancialOverview(days = 30) {
  return apiFetch<FinancialOverview>(
    `/steel/finance/overview?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:finance:overview:${days}` },
  );
}

export async function getSteelProductProfitability(days = 90) {
  return apiFetch<ProductProfitability>(
    `/steel/finance/product-profitability?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:finance:product:${days}` },
  );
}

export async function getSteelReceivables() {
  return apiFetch<ReceivablesSummary>(
    "/steel/finance/receivables",
    {},
    { cacheTtlMs: 5_000, cacheKey: "steel:finance:receivables" },
  );
}

// ── Payables / Expense Types & API ────────────────────────────────────────

export type PayablesAgingBucket = {
  key: string;
  label: string;
  count: number;
  amount_inr: number;
  bill_count: number;
};

export type OverdueVendor = {
  vendor_id: number;
  vendor_name: string;
  outstanding_inr: number;
  overdue_inr: number;
  max_overdue_days: number;
  bill_count: number;
};

export type PayablesSummary = {
  as_of: string;
  total_outstanding_inr: number;
  total_overdue_inr: number;
  aging_buckets: PayablesAgingBucket[];
  top_overdue_vendors: OverdueVendor[];
  summary: {
    total_bills: number;
    fully_paid_bills: number;
    outstanding_bills: number;
    total_paid_inr: number;
    payment_efficiency_percent: number;
  };
};

export type ExpenseCategory = {
  category: string;
  total_amount_inr: number;
  count: number;
};

export type ExpenseMonthlyTrend = {
  month: string;
  direct_expenses_inr: number;
  vendor_bills_inr: number;
  total_inr: number;
  count: number;
};

export type ExpensesSummary = {
  time_period_days: number;
  total_expenses_inr: number;
  categories: ExpenseCategory[];
  monthly_trend: ExpenseMonthlyTrend[];
};

export type Vendor = {
  id: number;
  vendor_code?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  contact_person?: string | null;
  payment_terms_days: number;
  credit_limit: number;
  status: string;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
};

export type VendorBill = {
  id: number;
  vendor_id: number;
  vendor_name?: string | null;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: string;
  expense_category: string;
  currency: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  notes?: string | null;
  created_at: string;
};

export type Expense = {
  id: number;
  expense_number?: string | null;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  vendor_id?: number | null;
  notes?: string | null;
  created_at: string;
};

export async function getSteelPayables() {
  return apiFetch<PayablesSummary>(
    "/steel/finance/payables",
    {},
    { cacheTtlMs: 5_000, cacheKey: "steel:finance:payables" },
  );
}

export async function getSteelExpensesSummary(days = 90) {
  return apiFetch<ExpensesSummary>(
    `/steel/finance/expenses?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:finance:expenses:${days}` },
  );
}

export async function listSteelVendors(limit = 50) {
  return apiFetch<{ items: Vendor[] }>(`/steel/vendors?limit=${encodeURIComponent(String(limit))}`, {}, { cacheTtlMs: 10_000, cacheKey: `steel:vendors:${limit}` });
}

export async function createSteelVendor(payload: {
  name: string;
  vendor_code?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  contact_person?: string | null;
  payment_terms_days?: number;
  credit_limit?: number;
  notes?: string | null;
}) {
  return apiFetch<{ vendor: { id: number; name: string; vendor_code?: string | null } }>("/steel/vendors", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelVendorBills(params?: { limit?: number; status?: string }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: VendorBill[] }>(
    `/steel/vendor-bills${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:vendor-bills:${suffix}` },
  );
}

export async function createSteelVendorBill(payload: {
  vendor_id: number;
  bill_number: string;
  bill_date: string;
  due_date: string;
  expense_category?: string;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount: number;
  notes?: string | null;
}) {
  return apiFetch<{ bill: { id: number; bill_number: string; vendor_id: number; total_amount: number } }>("/steel/vendor-bills", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelExpenses(params?: { limit?: number; category?: string }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.category) search.set("category", params.category);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: Expense[] }>(
    `/steel/expenses${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:expenses:${suffix}` },
  );
}

export async function createSteelExpense(payload: {
  expense_number?: string | null;
  expense_date: string;
  category: string;
  description: string;
  amount?: number;
  tax_amount?: number;
  total_amount: number;
  payment_status?: string;
  vendor_id?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ expense: { id: number; expense_number?: string | null; category: string; total_amount: number } }>("/steel/expenses", {
    method: "POST",
    body: payload,
  });
}

// ── Production Intelligence Types & API ─────────────────────────────────

export type ProductionDataCoverage = {
  entry_based_shift_data: boolean;
  batch_based_quality_data: boolean;
  machine_tracking: boolean;
  line_tracking: boolean;
  true_rejection_counts: boolean;
  true_oee: boolean;
};

export type ProductionSummary = {
  total_entries: number;
  approved_entries: number;
  pending_entries: number;
  rejected_entries: number;
  total_target_units: number;
  total_produced_units: number;
  overall_attainment_percent: number;
  total_downtime_minutes: number;
  total_quality_issue_entries: number;
  today_produced_units: number;
  today_entry_count: number;
  total_batch_count: number;
  total_batch_output_kg: number;
  total_batch_loss_kg: number;
  avg_batch_loss_percent: number;
  high_critical_batch_count: number;
  data_quality: string;
};

export type ThroughputDay = {
  date: string;
  total_target: number;
  total_produced: number;
  entry_count: number;
  approved_entry_count: number;
  total_downtime_minutes: number;
  quality_issue_count: number;
  batch_output_kg: number;
  batch_loss_kg: number;
  batch_loss_percent: number;
  batch_count: number;
  attainment_percent: number | null;
};

export type ShiftKpi = {
  shift: string;
  entry_count: number;
  total_target_units: number;
  total_produced_units: number;
  attainment_percent: number;
  total_downtime_minutes: number;
  quality_issue_count: number;
  quality_issue_rate_percent: number;
};

export type ShiftAnalysis = {
  by_shift: ShiftKpi[];
  worst_attainment_shift: ShiftKpi | null;
  highest_downtime_shift: ShiftKpi | null;
};

export type DowntimeEntry = {
  shift?: string;
  department?: string;
  reason?: string;
  total_downtime_minutes: number;
};

export type DowntimeAnalysis = {
  total_downtime_minutes: number;
  avg_downtime_per_entry_minutes: number;
  by_shift: DowntimeEntry[];
  by_department: DowntimeEntry[];
  top_reasons: DowntimeEntry[];
};

export type ManpowerProductivity = {
  total_manpower_present: number;
  total_manpower_absent: number;
  avg_units_per_worker: number;
  avg_absenteeism_percent: number;
  by_shift: Array<{
    shift: string;
    total_manpower_present: number;
    total_manpower_absent: number;
    units_per_worker: number;
  }>;
};

export type TopLossBatch = {
  id: number;
  batch_code: string;
  production_date: string;
  loss_percent: number;
  loss_kg: number;
  actual_output_kg: number;
  severity: string;
};

export type BatchLossAnalysis = {
  total_batches: number;
  severity_distribution: Record<string, number>;
  avg_loss_percent: number;
  avg_variance_percent: number;
  total_batch_output_kg: number;
  top_loss_batches: TopLossBatch[];
};

export type OperatorBatchPerformance = {
  user_id: number;
  name: string;
  batch_count: number;
  high_critical_count: number;
  total_loss_percent: number;
  total_actual_output_kg: number;
  avg_loss_percent: number;
  high_critical_percent: number;
};

export type ConversionPair = {
  input_name: string;
  input_category: string;
  output_name: string;
  output_category: string;
  batch_count: number;
  total_input_kg: number;
  total_output_kg: number;
  total_loss_kg: number;
  avg_loss_percent: number;
  high_critical_count: number;
};

export type ProcessLossProxy = {
  by_conversion_pair: ConversionPair[];
  note: string;
};

export type QualitySignalSummary = {
  entry_based: {
    total_entries: number;
    quality_issue_entries: number;
    quality_issue_rate_percent: number;
  };
  batch_based: {
    total_batches: number;
    normal_count: number;
    watch_count: number;
    high_count: number;
    critical_count: number;
    high_critical_rate_percent: number;
  };
  note: string;
};

export type OeeReadiness = {
  availability_inputs_present: string;
  performance_inputs_present: string;
  quality_inputs_present: string;
  true_oee_supported: boolean;
  missing_fields: string[];
};

export type RejectionScrapAnalysis = {
  total_rejection_kg: number;
  total_scrap_kg: number;
  rejection_rate_percent: number | null;
  scrap_rate_percent: number | null;
  rejection_batch_count: number;
  scrap_batch_count: number;
  data_quality: string;
  note: string;
};

export type LineEfficiencyItem = {
  line_id: number;
  line_name: string;
  line_code?: string | null;
  batch_count: number;
  total_output_kg: number;
  total_loss_kg: number;
  avg_loss_percent: number;
  high_critical_count: number;
  total_rejection_kg: number;
  total_scrap_kg: number;
};

export type LineEfficiencyAnalysis = {
  by_line: LineEfficiencyItem[];
  line_count: number;
  total_batches_with_line: number;
  data_quality: string;
  note: string;
};

export type MachineUtilizationItem = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_type?: string | null;
  batch_count: number;
  total_output_kg: number;
  total_loss_kg: number;
  avg_loss_percent: number;
  high_critical_count: number;
  total_rejection_kg: number;
  total_scrap_kg: number;
  rejection_rate_percent: number;
};

export type MachineUtilizationAnalysis = {
  by_machine: MachineUtilizationItem[];
  machine_count: number;
  total_batches_with_machine: number;
  highest_rejection_machine: MachineUtilizationItem | null;
  highest_utilization_machine: MachineUtilizationItem | null;
  data_quality: string;
  note: string;
};

export type ProductionIntelligence = {
  as_of: string;
  period_days: number;
  data_coverage: ProductionDataCoverage;
  summary: ProductionSummary;
  throughput_trend: ThroughputDay[];
  shift_analysis: ShiftAnalysis;
  downtime_analysis: DowntimeAnalysis;
  manpower_productivity: ManpowerProductivity;
  batch_loss_analysis: BatchLossAnalysis;
  operator_batch_performance: OperatorBatchPerformance[];
  process_loss_proxy: ProcessLossProxy;
  quality_signal_summary: QualitySignalSummary;
  rejection_scrap_analysis: RejectionScrapAnalysis;
  line_efficiency_analysis: LineEfficiencyAnalysis;
  machine_utilization_analysis: MachineUtilizationAnalysis;
  machine_intelligence: MachineIntelligence | null;
  oee_readiness: OeeReadiness;
};

// ── Production Line & Machine Types & API ──────────────────────────────

export type SteelProductionLine = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type SteelMachine = {
  id: number;
  line_id: number;
  machine_code: string;
  name: string;
  machine_type?: string | null;
  description?: string | null;
  rated_capacity_per_hour?: number | null;
  planned_runtime_minutes?: number | null;
  operating_runtime_minutes?: number | null;
  is_active: boolean;
};


export async function updateSteelMachine(machineId: number, payload: {
  line_id?: number | null;
  machine_code?: string | null;
  name?: string | null;
  machine_type?: string | null;
  description?: string | null;
  rated_capacity_per_hour?: number | null;
  planned_runtime_minutes?: number | null;
  operating_runtime_minutes?: number | null;
}) {
  return apiFetch<{ machine: SteelMachine }>(
    `/steel/production/machines/${encodeURIComponent(String(machineId))}`,
    { method: "PATCH", body: payload },
  );
}

export async function deleteSteelMachine(machineId: number) {  return apiFetch<{ message: string }>(
    `/steel/production/machines/${encodeURIComponent(String(machineId))}`,
    { method: "DELETE" },
  );
}

export async function updateSteelMachineDowntimeEvent(eventId: number, payload: {
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
  reason_category?: string | null;
  reason_detail?: string | null;
  shift?: string | null;
  operator_user_id?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ event: MachineDowntimeEvent }>(
    `/steel/production/machines/downtime-events/${encodeURIComponent(String(eventId))}`,
    { method: "PATCH", body: payload },
  );
}

export async function deleteSteelMachineDowntimeEvent(eventId: number) {
  return apiFetch<{ message: string }>(
    `/steel/production/machines/downtime-events/${encodeURIComponent(String(eventId))}`,
    { method: "DELETE" },
  );
}

export async function updateSteelMaintenanceTask(taskId: number, payload: {
  title?: string | null;
  description?: string | null;
  maintenance_type?: string | null;
  priority?: string | null;
  scheduled_date?: string | null;
  assigned_to_user_id?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ task: SteelMaintenanceTask }>(
    `/steel/production/machines/maintenance-tasks/${encodeURIComponent(String(taskId))}`,
    { method: "PATCH", body: payload },
  );
}

export async function deleteSteelMaintenanceTask(taskId: number) {
  return apiFetch<{ message: string }>(
    `/steel/production/machines/maintenance-tasks/${encodeURIComponent(String(taskId))}`,
    { method: "DELETE" },
  );
}

export async function listSteelProductionLines() {
  return apiFetch<{ lines: SteelProductionLine[] }>(
    "/steel/production/lines",
    {},
    { cacheTtlMs: 10_000, cacheKey: "steel:production:lines" },
  );
}

export async function createSteelProductionLine(payload: {
  name: string;
  code: string;
  description?: string | null;
}) {
  return apiFetch<{ line: SteelProductionLine }>("/steel/production/lines", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelMachines(lineId?: number | null) {
  const suffix = lineId ? `?line_id=${encodeURIComponent(String(lineId))}` : "";
  return apiFetch<{ machines: SteelMachine[] }>(
    `/steel/production/machines${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:production:machines${suffix}` },
  );
}

export async function createSteelMachine(payload: {
  line_id: number;
  machine_code: string;
  name: string;
  machine_type?: string | null;
  description?: string | null;
  rated_capacity_per_hour?: number | null;
  planned_runtime_minutes?: number | null;
  operating_runtime_minutes?: number | null;
}) {
  return apiFetch<{ machine: SteelMachine }>("/steel/production/machines", {
    method: "POST",
    body: payload,
  });
}

// ── Scrap & Loss Intelligence Types & API ──────────────────────────

export type ScrapTrendDay = {
  date: string;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  loss_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
  batch_count: number;
};

export type ScrapMachineItem = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  line_id?: number | null;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapLineItem = {
  line_id: number;
  line_name: string;
  line_code?: string | null;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapOperatorItem = {
  user_id: number;
  name: string;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapProcessItem = {
  input_name: string;
  input_category: string;
  output_name: string;
  output_category: string;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  loss_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapShiftItem = {
  shift: string;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapByShiftResponse = {
  by_shift: ScrapShiftItem[];
  matched_batch_count: number;
  total_batches_with_operator: number;
  coverage_percent: number;
  ambiguous_count: number;
  attribution_method: string;
  note: string;
};

export type ScrapTeamItem = {
  department: string;
  batch_count: number;
  scrap_kg: number;
  scrap_cost_inr: number | null;
  rejection_kg: number;
  output_kg: number;
  scrap_rate_percent: number | null;
};

export type ScrapByTeamResponse = {
  by_team: ScrapTeamItem[];
  matched_batch_count: number;
  total_batches_with_operator: number;
  coverage_percent: number;
  attribution_method: string;
  note: string;
};

export type ScrapCostEntity = {
  entity: string;
  scrap_cost_inr: number;
};

export type ScrapFinancialImpact = {
  cost_basis: string;
  valuation_mode: string;
  total_scrap_cost_inr: number | null;
  today_scrap_cost_inr: number | null;
  mtd_scrap_cost_inr: number | null;
  top_cost_machines: ScrapCostEntity[];
  top_cost_lines: ScrapCostEntity[];
  top_cost_operators: ScrapCostEntity[];
  top_cost_processes: ScrapCostEntity[];
};

export type ScrapDriverItem = {
  dimension: string;
  entity_key: string;
  entity_label: string;
  current_scrap_kg: number;
  baseline_scrap_kg: number;
  delta_kg: number;
  delta_percent: number | null;
  explanation: string;
  confidence: string;
};

export type ScrapIncreaseDrivers = {
  current_period_days: number;
  baseline_period_days: number;
  total_scrap_delta_kg: number;
  total_scrap_delta_percent: number;
  top_drivers: ScrapDriverItem[];
};

export type ScrapDataConfidence = {
  batch_scrap_tracking: boolean;
  batch_rejection_tracking: boolean;
  machine_tracking: boolean;
  line_tracking: boolean;
  operator_tracking: boolean;
  shift_attribution: string;
  team_attribution: string;
  financial_valuation: string;
  missing_fields: string[];
};

export type ScrapLossSummary = {
  total_scrap_today_kg: number;
  total_scrap_mtd_kg: number;
  total_scrap_period_kg: number;
  total_rejection_period_kg: number;
  total_scrap_batch_count: number;
  total_output_period_kg: number;
  scrap_rate_percent: number | null;
  scrap_cost_today_inr: number | null;
  scrap_cost_mtd_inr: number | null;
  scrap_cost_period_inr: number | null;
  highest_scrap_machine_kg?: number | null;
  highest_scrap_line_kg?: number | null;
  highest_scrap_operator_kg?: number | null;
  data_quality: string;
};

export type ScrapLossIntelligence = {
  as_of: string;
  period_days: number;
  baseline_period_days: number;
  financial_access: boolean;
  data_confidence: ScrapDataConfidence;
  summary: ScrapLossSummary;
  daily_trend: ScrapTrendDay[];
  by_machine: ScrapMachineItem[];
  by_line: ScrapLineItem[];
  by_operator: ScrapOperatorItem[];
  by_process: ScrapProcessItem[];
  by_shift: ScrapByShiftResponse;
  by_team: ScrapByTeamResponse;
  financial_impact: ScrapFinancialImpact;
  increase_drivers: ScrapIncreaseDrivers;
};

export async function getSteelScrapLossIntelligence(params?: {
  days?: number;
  baseline_days?: number;
  line_id?: number | null;
  machine_id?: number | null;
  operator_user_id?: number | null;
}) {
  const search = new URLSearchParams();
  if (params?.days) search.set("days", String(params.days));
  if (params?.baseline_days) search.set("baseline_days", String(params.baseline_days));
  if (params?.line_id) search.set("line_id", String(params.line_id));
  if (params?.machine_id) search.set("machine_id", String(params.machine_id));
  if (params?.operator_user_id) search.set("operator_user_id", String(params.operator_user_id));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ScrapLossIntelligence>(
    `/steel/scrap-loss/intelligence${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:scrap-loss:${suffix}` },
  );
}

export async function getSteelProductionIntelligence(days = 30) {
  return apiFetch<ProductionIntelligence>(
    `/steel/production/intelligence?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:production:intelligence:${days}` },
  );
}

// ── Machine Intelligence Types & API ──────────────────────────────────

export type MachineAlert = {
  type: "mtbf_low" | "overdue_maintenance" | "maintenance_due_soon";
  severity: "critical" | "high" | "warning";
  message: string;
};

export type MachineDowntimeReason = {
  reason_category: string;
  total_minutes: number;
  event_count: number;
};

export type MaintenanceTaskBrief = {
  id: number;
  machine_id: number;
  title: string;
  description?: string | null;
  maintenance_type: string;
  status: string;
  priority: string;
  scheduled_date: string;
  completed_at?: string | null;
  assigned_to_user_id?: number | null;
  runtime_hours_trigger?: number | null;
  notes?: string | null;
  created_at: string;
};

export type MachineIntelligenceItem = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_type?: string | null;
  line_id?: number | null;
  rated_capacity_per_hour?: number | null;
  planned_runtime_minutes?: number | null;
  operating_runtime_minutes?: number | null;
  downtime_minutes: number;
  uptime_percent: number;
  oee_availability_percent?: number | null;
  oee_performance_percent?: number | null;
  oee_quality_percent?: number | null;
  oee_score?: number | null;
  oee_data_quality: string;
  failure_count: number;
  mtbf_hours?: number | null;
  mttr_minutes?: number | null;
  top_downtime_reasons: MachineDowntimeReason[];
  event_count: number;
  upcoming_maintenance_count: number;
  overdue_maintenance_count: number;
  last_maintenance_at?: string | null;
  maintenance_due_soon: boolean;
  maintenance_tasks: MaintenanceTaskBrief[];
  alerts: MachineAlert[];
};

export type MachineIntelligence = {
  as_of: string;
  period_days: number;
  machine_count: number;
  factory_summary: {
    avg_uptime_percent?: number | null;
    total_downtime_minutes: number;
    total_failure_count: number;
    factory_mtbf_hours?: number | null;
    overdue_maintenance_count: number;
    upcoming_maintenance_count: number;
    completed_maintenance_count: number;
    active_alerts_count: number;
  };
  machines: MachineIntelligenceItem[];
  has_true_oee: boolean;
  has_runtime_data: boolean;
  data_quality: string;
  note: string;
};
export type MachineDowntimeEvent = {
  id: number;
  machine_id: number;
  machine_code?: string | null;
  machine_name?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
  reason_category?: string | null;
  reason_detail?: string | null;
  shift?: string | null;
  operator_user_id?: number | null;
  entry_id?: number | null;
  notes?: string | null;
  created_at: string;
};
export type SteelMaintenanceTask = {
  id: number;
  machine_id: number;
  machine_code?: string | null;
  machine_name?: string | null;
  title: string;
  description?: string | null;
  maintenance_type: string;
  status: string;
  priority: string;
  scheduled_date: string;
  completed_at?: string | null;
  assigned_to_user_id?: number | null;
  runtime_hours_trigger?: number | null;
  notes?: string | null;
  created_at: string;
};

export async function getSteelMachineIntelligence(params?: { days?: number; machine_id?: number | null }) {
  const search = new URLSearchParams();
  if (params?.days) search.set("days", String(params.days));
  if (params?.machine_id) search.set("machine_id", String(params.machine_id));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<MachineIntelligence>(
    `/steel/production/machine-intelligence${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:machine:intel${suffix}` },
  );
}

export async function listSteelMachineDowntimeEvents(params?: { machine_id?: number | null; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.machine_id) search.set("machine_id", String(params.machine_id));
  if (params?.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ events: MachineDowntimeEvent[] }>(
    `/steel/production/machines/downtime-events${suffix}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:downtime:events${suffix}` },
  );
}

export async function createSteelMachineDowntimeEvent(payload: {
  machine_id: number;
  started_at: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
  reason_category?: string | null;
  reason_detail?: string | null;
  shift?: string | null;
  operator_user_id?: number | null;
  entry_id?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ event: MachineDowntimeEvent }>("/steel/production/machines/downtime-events", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelMaintenanceTasks(params?: {
  machine_id?: number | null;
  status?: string | null;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.machine_id) search.set("machine_id", String(params.machine_id));
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ tasks: SteelMaintenanceTask[] }>(
    `/steel/production/machines/maintenance-tasks${suffix}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:maintenance:tasks${suffix}` },
  );
}

export async function createSteelMaintenanceTask(payload: {
  machine_id: number;
  title: string;
  description?: string | null;
  maintenance_type?: string;
  priority?: string;
  scheduled_date: string;
  assigned_to_user_id?: number | null;
  runtime_hours_trigger?: number | null;
  notes?: string | null;
}) {
  return apiFetch<{ task: SteelMaintenanceTask }>("/steel/production/machines/maintenance-tasks", {
    method: "POST",
    body: payload,
  });
}

export async function updateSteelMaintenanceTaskStatus(taskId: number, payload: {
  status: string;
  notes?: string | null;
}) {
  return apiFetch<{ task: SteelMaintenanceTask }>(
    `/steel/production/machines/maintenance-tasks/${encodeURIComponent(String(taskId))}/status`,
    { method: "POST", body: payload },
  );
}

// ── Fraud Intelligence Types & API ────────────────────────────────────

export type FraudSignal = {
  signal_type: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: string;
  evidence_summary: string;
  recommended_action: string;
  estimated_loss_inr?: number | null;
  [key: string]: unknown;
};

export type FraudInventoryLossSignal = FraudSignal & {
  item_id: number;
  item_name: string;
  item_code?: string;
  variance_kg: number;
  variance_percent?: number | null;
  occurrence_count_30d: number;
};

export type FraudDispatchSignal = FraudSignal & {
  dispatch_id: number;
  dispatch_number: string;
};

export type FraudTransactionSignal = FraudSignal & {
  transaction_id: number;
  quantity_kg: number;
  transaction_type: string;
};

export type FraudApprovalSignal = FraudSignal & {
  instance_id?: string;
  workflow_key?: string;
  resource_type?: string;
};

export type FraudUserProfile = {
  user_id: number;
  display_name: string;
  risk_score: number;
  risk_band: string;
  top_signals: string[];
  confidence: string;
};

export type FraudInvestigationItem = {
  domain: string;
  signal_type: string;
  severity: string;
  confidence: string;
  summary: string;
  recommended_action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  actor_user_id?: number | null;
};

export type FraudSignalSection = {
  signals: FraudSignal[];
  total_signals: number;
  data_quality: string;
  [key: string]: unknown;
};

export type FraudDataConfidence = {
  inventory_reconciliation_signals: string;
  dispatch_mismatch_signals: string;
  transaction_reference_quality: string;
  approval_behavior_signals: string;
  attendance_risk_signals: string;
  user_behavior_profiling: string;
  theft_confirmation: string;
  financial_valuation: string;
  missing_fields: string[];
};

export type FraudSummary = {
  total_signals: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  inventory_loss_count: number;
  dispatch_mismatch_count: number;
  transaction_anomaly_count: number;
  approval_risk_count: number;
  attendance_risk_count: number;
  investigation_queue_count: number;
  data_quality: string;
};

export type FraudIntelligence = {
  as_of: string;
  period_days: number;
  financial_access: boolean;
  user_detail_access: boolean;
  summary: FraudSummary;
  inventory_loss_signals: FraudSignalSection;
  dispatch_mismatch_signals: FraudSignalSection;
  transaction_anomalies: FraudSignalSection;
  approval_risk_signals: FraudSignalSection;
  attendance_risk_signals: FraudSignalSection;
  user_behavior_signals: FraudUserProfile[];
  investigation_queue: FraudInvestigationItem[];
  data_confidence: FraudDataConfidence;
};

export async function getSteelFraudIntelligence(params?: {
  days?: number;
  severity?: string | null;
}) {
  const search = new URLSearchParams();
  if (params?.days) search.set("days", String(params.days));
  if (params?.severity) search.set("severity", params.severity);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FraudIntelligence>(
    `/steel/fraud/intelligence${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:fraud:${suffix}` },
  );
}

// ── Quality Intelligence Types & API ────────────────────────────────

export type QualityIntelligenceDefectCategory = {
  code: string;
  label: string;
  entry_count: number;
  total_rejection_units: number;
  total_scrap_units: number;
  rework_count: number;
  entry_percent: number;
};

export type QualityIntelligenceOperator = {
  user_id: number;
  name: string;
  entry_count: number;
  total_rejection_units: number;
  total_scrap_units: number;
  rework_entry_count: number;
  defect_entry_count: number;
  rejection_rate_percent: number | null;
  scrap_rate_percent: number | null;
  total_produced_units: number;
  top_defect_codes: Array<{ label: string; count: number }>;
};

export type QualityIntelligenceShift = {
  shift: string;
  entry_count: number;
  total_rejection_units: number;
  total_scrap_units: number;
  rework_entry_count: number;
  defect_entry_count: number;
  total_produced_units: number;
  rejection_rate_percent: number | null;
};

export type QualityIntelligenceDepartment = {
  department: string;
  entry_count: number;
  total_rejection_units: number;
  total_scrap_units: number;
  rework_entry_count: number;
  defect_entry_count: number;
  total_produced_units: number;
  rejection_rate_percent: number | null;
};

export type QualityIntelligenceTrendDay = {
  date: string;
  entry_count: number;
  approved_entry_count: number;
  total_produced_units: number;
  rejection_units: number;
  scrap_units: number;
  rework_count: number;
  defect_entry_count: number;
  rejection_rate_percent: number | null;
  batch_rejection_kg: number;
  batch_scrap_kg: number;
  batch_output_kg: number;
  batch_count: number;
  batch_rejection_rate_percent: number | null;
};

export type QualityIntelligenceScrapVsRework = {
  total_scrap_units: number;
  total_rework_entry_count: number;
  entries_with_scrap_count: number;
  entries_with_rework_count: number;
  entries_with_both_scrap_and_rework: number;
  scrap_vs_rework_ratio: number | null;
  scrap_dominates: boolean;
  estimated_rework_labour_cost_inr: number | null;
  data_quality: string;
  note: string;
  cost_basis: string;
  valuation_mode: string;
};

export type QualityIntelligenceBatchIntegration = {
  total_batches: number;
  severity_distribution: Record<string, number>;
  total_batch_rejection_kg: number;
  total_batch_scrap_kg: number;
  total_batch_loss_kg: number;
  total_batch_output_kg: number;
  batch_loss_percent: number | null;
  scrap_cost_period_inr: number | null;
  top_loss_batches: Array<{
    id: number;
    batch_code: string;
    production_date: string;
    loss_percent: number;
    loss_kg: number;
    actual_output_kg: number;
    severity: string;
    rejection_qty_kg: number;
    scrap_qty_kg: number;
  }>;
  data_quality: string;
  note: string;
};

export type QualityIntelligenceIncreaseDriver = {
  dimension: string;
  entity_key: string;
  entity_label: string;
  current_rejection_units?: number;
  baseline_rejection_units?: number;
  delta_units?: number;
  current_entry_count?: number;
  baseline_entry_count?: number;
  delta_count?: number;
  delta_percent: number | null;
  metric: string;
  explanation: string;
  confidence: string;
};

export type QualityIntelligenceDataConfidence = {
  entry_rejection_tracking: string;
  entry_scrap_tracking: string;
  entry_rework_tracking: string;
  entry_defect_reason_tracking: string;
  batch_rejection_tracking: string;
  batch_scrap_tracking: string;
  overall_quality_data_quality: string;
  missing_fields: string[];
};

export type QualityIntelligence = {
  as_of: string;
  period_days: number;
  baseline_period_days: number;
  financial_access: boolean;
  data_confidence: QualityIntelligenceDataConfidence;
  summary: {
    total_entries_analyzed: number;
    entries_with_quality_data: number;
    total_rejection_units: number;
    total_scrap_units: number;
    rework_entry_count: number;
    rejection_rate_percent: number | null;
    scrap_rate_percent: number | null;
    rework_rate_percent: number | null;
    total_batches_analyzed: number;
    total_batch_rejection_kg: number;
    total_batch_scrap_kg: number;
    batch_rejection_rate_percent: number | null;
    batch_scrap_rate_percent: number | null;
    entry_data_quality: string;
    batch_data_quality: string;
  };
  rejection_trend: QualityIntelligenceTrendDay[];
  defect_category_analysis: {
    categories: QualityIntelligenceDefectCategory[];
    uncategorized_entry_count: number;
    total_entries_with_defect: number;
    has_structured_defects: boolean;
    data_quality: string;
    note: string;
  };
  by_operator: QualityIntelligenceOperator[];
  by_shift: {
    by_shift: QualityIntelligenceShift[];
    data_quality: string;
    note: string;
  };
  by_department: {
    by_department: QualityIntelligenceDepartment[];
    data_quality: string;
    note: string;
  };
  scrap_vs_rework: QualityIntelligenceScrapVsRework;
  batch_quality_integration: QualityIntelligenceBatchIntegration;
  increase_drivers: {
    current_period_days: number;
    baseline_period_days: number;
    current_rejection_units: number;
    baseline_rejection_units: number;
    total_rejection_delta_units: number;
    total_rejection_delta_percent: number;
    current_scrap_units: number;
    baseline_scrap_units: number;
    total_scrap_delta_units: number;
    total_scrap_delta_percent: number;
    current_batch_rejection_kg: number;
    baseline_batch_rejection_kg: number;
    batch_rejection_delta_kg: number;
    top_drivers: QualityIntelligenceIncreaseDriver[];
  };
};

export async function getSteelQualityIntelligence(params?: {
  days?: number;
  baseline_days?: number;
}) {
  const search = new URLSearchParams();
  if (params?.days) search.set("days", String(params.days));
  if (params?.baseline_days) search.set("baseline_days", String(params.baseline_days));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<QualityIntelligence>(
    `/steel/quality/intelligence${suffix}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:quality:intel${suffix}` },
  );
}

// ── Machine Analytics Types & API ──────────────────────────────────────

export type DowntimeParetoItem = {
  reason_category: string;
  total_minutes: number;
  event_count: number;
  percent_of_total: number;
  cumulative_percent: number;
};

export type WeeklyTrendItem = {
  week_start: string;
  mtbf_hours: number | null;
  mttr_minutes: number | null;
  failure_count: number;
  downtime_minutes: number;
};

export type DailyDowntimeItem = {
  date: string;
  downtime_minutes: number;
  event_count: number;
  top_reason: string | null;
};

export type MachineAnalyticsSummary = {
  total_downtime_minutes: number;
  total_events: number;
  failure_count: number;
  mtbf_hours: number | null;
  mttr_minutes: number | null;
  period_days: number;
} | null;

export type MachineAnalytics = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  period_days: number;
  downtime_pareto: DowntimeParetoItem[];
  daily_downtime_trend: DailyDowntimeItem[];
  mtbf_trend: WeeklyTrendItem[];
  mttr_trend: WeeklyTrendItem[];
  summary: MachineAnalyticsSummary;
};

// ── Machine Alert Types & API ──────────────────────────────────────

export type MachineAlertItem = {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_type?: string | null;
  alert_type: "mtbf_low" | "overdue_maintenance" | "maintenance_due_soon";
  severity: "critical" | "high" | "warning";
  message: string;
  mtbf_hours?: number | null;
  failure_count: number;
  overdue_count: number;
  downtime_minutes: number;
};

export type MachineAlertsListResponse = {
  items: MachineAlertItem[];
  total: number;
  filter_severity?: string | null;
  filter_type?: string | null;
};

export async function getSteelMachineAlerts(params?: {
  severity?: string;
  alert_type?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.severity) search.set("severity", params.severity);
  if (params?.alert_type) search.set("alert_type", params.alert_type);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<MachineAlertsListResponse>(
    `/steel/production/machine-alerts${suffix}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:machine:alerts${suffix}` },
  );
}

export async function getSteelMachineAnalytics(machineId: number, days = 90) {
  return apiFetch<MachineAnalytics>(
    `/steel/production/machines/${encodeURIComponent(String(machineId))}/analytics?days=${encodeURIComponent(String(days))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:machine:analytics:${machineId}:${days}` },
  );
}

// ── Fraud Alert Types & API ────────────────────────────────────────────

export type FraudAlert = {
  id: number;
  org_id: string;
  factory_id: string;
  domain: string;
  signal_type: string;
  severity: string;
  confidence: string;
  summary: string;
  evidence?: Record<string, unknown> | null;
  recommended_action?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  actor_user_id?: number | null;
  status: string;
  acknowledged_by_user_id?: number | null;
  acknowledged_at?: string | null;
  resolved_by_user_id?: number | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  dismissed_reason?: string | null;
  is_suppressed: boolean;
  created_at: string;
  updated_at: string;
};

export type FraudAlertCount = {
  active_count: number;
};

export async function getSteelFraudAlerts(params?: {
  status?: string;
  domain?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.domain) search.set("domain", params.domain);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: FraudAlert[]; total: number }>(
    `/steel/fraud/alerts${suffix}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:fraud:alerts:${suffix}` },
  );
}

export async function getSteelFraudAlertsCount() {
  return apiFetch<FraudAlertCount>(
    "/steel/fraud/alerts/count",
    {},
    { cacheTtlMs: 10_000, cacheKey: "steel:fraud:alerts:count" },
  );
}

export async function acknowledgeSteelFraudAlert(alertId: number) {
  return apiFetch<{ status: string; alert_id: number; new_status: string }>(
    `/steel/fraud/alerts/${alertId}/acknowledge`,
    { method: "POST" },
  );
}

export async function investigateSteelFraudAlert(alertId: number) {
  return apiFetch<{ status: string; alert_id: number; new_status: string }>(
    `/steel/fraud/alerts/${alertId}/investigate`,
    { method: "POST" },
  );
}

export async function resolveSteelFraudAlert(alertId: number, resolutionNote?: string) {
  return apiFetch<{ status: string; alert_id: number; new_status: string }>(
    `/steel/fraud/alerts/${alertId}/resolve`,
    { method: "POST", body: resolutionNote ? { resolution_note: resolutionNote } : {} },
  );
}

export async function dismissSteelFraudAlert(alertId: number, reason: string) {
  return apiFetch<{ status: string; alert_id: number; new_status: string }>(
    `/steel/fraud/alerts/${alertId}/dismiss`,
    { method: "POST", body: { dismissed_reason: reason } },
  );
}

// ── Cash Flow Types & API ────────────────────────────────────────────────

export type CashAccount = {
  id: number;
  account_name: string;
  account_type: string;
  account_number?: string | null;
  bank_name?: string | null;
  ifsc_code?: string | null;
  opening_balance: number;
  current_balance: number;
  currency: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
};

export type LedgerEntry = {
  id: number;
  account_id: number;
  account_name?: string | null;
  entry_date: string;
  entry_type: "debit" | "credit";
  amount: number;
  balance_after: number;
  reference_type?: string | null;
  reference_id?: string | null;
  description: string;
  category?: string | null;
  payment_mode: string;
  notes?: string | null;
  created_at: string;
};

export type CashFlowSummary = {
  as_of: string;
  total_balance_inr: number;
  cash_balance_inr: number;
  bank_balance_inr: number;
  digital_balance_inr: number;
  account_count: number;
  accounts: CashAccount[];
  recent_entries: LedgerEntry[];
};

export type CashFlowMonthlyEntry = {
  month: string;
  inflow_inr: number;
  outflow_inr: number;
  net_inr: number;
  inflow_count: number;
  outflow_count: number;
};

export type CashFlowMonthlyTrend = {
  months: number;
  total_inflow_inr: number;
  total_outflow_inr: number;
  net_inr: number;
  monthly_data: CashFlowMonthlyEntry[];
};

export async function getSteelCashFlow() {
  return apiFetch<CashFlowSummary>(
    "/steel/finance/cash-flow",
    {},
    { cacheTtlMs: 5_000, cacheKey: "steel:finance:cash-flow" },
  );
}

export async function getSteelCashFlowMonthly(months = 12) {
  return apiFetch<CashFlowMonthlyTrend>(
    `/steel/finance/cash-flow/monthly?months=${encodeURIComponent(String(months))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:finance:cash-flow:monthly:${months}` },
  );
}

export async function listSteelCashAccounts(limit = 50) {
  return apiFetch<{ items: CashAccount[] }>(
    `/steel/cash-accounts?limit=${encodeURIComponent(String(limit))}`,
    {},
    { cacheTtlMs: 10_000, cacheKey: `steel:cash-accounts:${limit}` },
  );
}

export async function createSteelCashAccount(payload: {
  account_name: string;
  account_type: string;
  account_number?: string | null;
  bank_name?: string | null;
  ifsc_code?: string | null;
  opening_balance?: number;
  currency?: string;
  notes?: string | null;
}) {
  return apiFetch<{ account: { id: number; account_name: string; account_type: string; current_balance: number } }>("/steel/cash-accounts", {
    method: "POST",
    body: payload,
  });
}

export async function listSteelCashLedger(params?: { account_id?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.account_id) search.set("account_id", String(params.account_id));
  if (params?.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: LedgerEntry[] }>(
    `/steel/cash-ledger${suffix}`,
    {},
    { cacheTtlMs: 5_000, cacheKey: `steel:cash-ledger:${suffix}` },
  );
}

export async function createSteelCashLedgerEntry(payload: {
  account_id: number;
  entry_date: string;
  entry_type: "debit" | "credit";
  amount: number;
  description: string;
  reference_type?: string | null;
  reference_id?: string | null;
  category?: string | null;
  payment_mode?: string;
  notes?: string | null;
}) {
  return apiFetch<{ entry: { id: number; account_id: number; entry_type: string; amount: number; balance_after: number } }>("/steel/cash-ledger", {
    method: "POST",
    body: payload,
  });
}
