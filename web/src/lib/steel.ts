import { API_BASE_URL, apiFetch } from "@/lib/api";

export type SteelPaymentMode = "bank_transfer" | "cash" | "cheque" | "upi";
export type SteelDispatchStatus = "pending" | "loaded" | "dispatched" | "delivered" | "cancelled";
export type SteelVehicleType = "truck" | "trailer" | "pickup" | "other";
export type SteelStockMismatchCause =
  | "counting_error"
  | "process_loss"
  | "theft_or_leakage"
  | "wrong_entry"
  | "delayed_dispatch_update"
  | "other";
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
