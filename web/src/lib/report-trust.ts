import { apiFetch } from "@/lib/api";

export type TrustApprovalRecord = {
  id: number;
  label: string;
  approved_by_name?: string | null;
  approved_at?: string | null;
};

export type ReportTrustSummary = {
  range: {
    start_date: string;
    end_date: string;
  };
  ocr: {
    approved_count: number;
    reviewed_count: number;
    total_count: number;
    pending_count: number;
    flagged_count: number;
  };
  shift_entries: {
    approved_count: number;
    reviewed_count: number;
    total_count: number;
    pending_count: number;
    flagged_count: number;
  };
  attendance: {
    approved_count: number;
    reviewed_count: number;
    total_count: number;
    pending_count: number;
    status: "reviewed" | "not_reviewed";
  };
  overall_trust_score: number;
  can_send: boolean;
  blocking_reason?: string | null;
  confirmation: string;
  next_action?: {
    href: string;
    label: string;
  } | null;
  approval_register: {
    ocr: TrustApprovalRecord[];
    shift_entries: TrustApprovalRecord[];
    attendance: TrustApprovalRecord[];
  };
};

export async function getReportTrustSummary(params: {
  startDate: string;
  endDate: string;
  shift?: string | null;
  factoryId?: string | null;
}) {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.shift) query.set("shift", params.shift);
  if (params.factoryId) query.set("factory_id", params.factoryId);
  return apiFetch<ReportTrustSummary>(`/reports/trust-summary?${query.toString()}`);
}

function formatApprovalLine(record: TrustApprovalRecord) {
  const when = record.approved_at ? new Date(record.approved_at) : null;
  const stamp = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : record.approved_at || "-";
  return `${record.label} | Approved by ${record.approved_by_name || "-"} | ${stamp}`;
}

export function buildTrustAppendix(trust: ReportTrustSummary) {
  const sections = [
    {
      title: "Approved OCR records",
      items: trust.approval_register.ocr,
    },
    {
      title: "Approved shift entries",
      items: trust.approval_register.shift_entries,
    },
    {
      title: "Approved attendance records",
      items: trust.approval_register.attendance,
    },
  ];

  const lines = [
    "Trust Checklist",
    `Report window: ${trust.range.start_date} to ${trust.range.end_date}`,
    `OCR reviewed: ${trust.ocr.approved_count} of ${trust.ocr.total_count} approved`,
    `Shift entries: ${trust.shift_entries.approved_count} of ${trust.shift_entries.total_count} approved`,
    `Attendance: ${trust.attendance.status === "reviewed" ? "Reviewed" : "Not reviewed"}`,
    `Overall trust score: ${trust.overall_trust_score}%`,
    trust.can_send ? trust.confirmation : (trust.blocking_reason || "Trust review is still in progress."),
  ];

  for (const section of sections) {
    lines.push("");
    lines.push(section.title);
    if (!section.items.length) {
      lines.push("- No approved records in this section for the selected window.");
      continue;
    }
    for (const item of section.items) {
      lines.push(`- ${formatApprovalLine(item)}`);
    }
  }

  return lines.join("\n");
}
