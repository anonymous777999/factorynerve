/**
 * shared/audit — audit-shaped UI primitives.
 *
 * Trust + auditability are first-class concerns in industrial software.
 * These primitives render the audit story for any operational record.
 *
 * Rule: every approvable record should expose its AuditTimeline somewhere
 * accessible (drawer, side panel, dedicated tab). Not buried.
 */

export { AuditTimeline } from "./audit-timeline";
export type { AuditEvent } from "./audit-timeline";
export { EvidencePanel } from "./evidence-panel";
