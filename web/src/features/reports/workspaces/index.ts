/**
 * features/reports/workspaces — reporting & analytics.
 *
 * /reports     → range reports + Excel exports (intelligence workspace)
 * /analytics   → premium analytics charts
 * /email-summary → outbound report builder
 */

export { default as ReportsIntelligenceWorkspace } from "@/components/reports-intelligence-workspace";
export { default as ReportsListWorkspace } from "@/components/reports-page";
export { default as AnalyticsWorkspace } from "@/components/analytics-page";
export { default as EmailSummaryWorkspace } from "@/components/email-summary-page";
