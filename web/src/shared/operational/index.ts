/**
 * shared/operational — industrial-domain widgets.
 *
 * These primitives know about operational UX concepts (density, status,
 * audit, scan zone, action zone) but not about specific business domains
 * like OCR or attendance.
 *
 * Migration note: re-exports from the legacy `components/ui/` location.
 */

export { WorkstationShell } from "@/components/ui/workstation-shell";
export { QueueWorkspaceLayout } from "@/components/ui/queue-workspace-layout";
export { OperationalDrawer } from "@/components/ui/operational-drawer";
export { StickyActionBar } from "@/components/ui/sticky-action-bar";
export { MetricStrip } from "@/components/ui/metric-strip";
export { SectionPanel } from "@/components/ui/section-panel";
export { FilterBar } from "@/components/ui/filter-bar";
export { ActionDock } from "@/components/ui/action-dock";
export { CommandPalette } from "@/components/ui/command-palette";
export { ConfirmationModal } from "@/components/ui/confirmation-modal";
export { EmptyState } from "@/components/ui/empty-state";
export { EmptyOperationalState } from "@/components/ui/empty-operational-state";
export { LoadingBoundary } from "@/components/ui/loading-boundary";
export { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
export { GuidanceHint, GuidanceBlock } from "@/components/ui/guidance-block";
export { WorkflowPanel } from "@/components/ui/workflow-panel";
