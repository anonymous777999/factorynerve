/**
 * features/entry/workspaces — full-page compositions.
 *
 * /entry      → operator/supervisor 4-step shift entry form
 *               (workspace lives in shift-entry-workspace.tsx; helpers in
 *               features/entry/lib/entry-helpers.ts)
 * /entry/[id] → entry detail + edit + audit
 */

export { default as ShiftEntryWorkspace } from "./shift-entry-workspace";
export { default as EntryDetailWorkspace } from "@/components/entry-detail-page";
