import { apiFetch } from "@/lib/api";

export type EmailSummarySnapshot = {
  range: {
    start_date: string;
    end_date: string;
  };
  totals: {
    total_units: number;
    total_target: number;
    average_performance: number;
    total_downtime: number;
    manpower_present: number;
    manpower_absent: number;
    quality_issues: number;
  };
  top_performer?: {
    name: string;
    production_percent: number;
  } | null;
  most_downtime?: {
    name: string;
    downtime_minutes: number;
  } | null;
  subject: string;
  raw_lines: string[];
  suggested_recipients: string[];
  estimated_tokens: number;
  provider: string;
  plan: string;
  can_send: boolean;
  min_plan: string;
};

export type GeneratedEmailDraft = {
  subject: string;
  body: string;
  estimated_tokens: number;
  provider: string;
};

export async function getEmailSummary(startDate: string, endDate: string) {
  const query = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return apiFetch<EmailSummarySnapshot>(`/emails/summary?${query.toString()}`);
}

export async function generateEmailSummary(startDate: string, endDate: string) {
  const query = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return apiFetch<GeneratedEmailDraft>(
    `/emails/summary/generate?${query.toString()}`,
    {
      method: "POST",
    },
  );
}

export function buildComposeLinks(
  recipients: string[],
  subject: string,
  body: string,
) {
  const to = recipients.filter(Boolean).join(", ");
  const encodedTo = encodeURIComponent(to);
  const encodedSubject = encodeURIComponent(subject || "");
  const encodedBody = encodeURIComponent(body || "");
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`,
    mailto: `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`,
  };
}
