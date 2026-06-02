/**
 * features/entry — shift entry / Daily Production Report.
 *
 * Public surface only.
 */

export { ShiftEntryWorkspace, EntryDetailWorkspace } from "./workspaces";
export * as entryApi from "./api/entries";
export * as entryHelpers from "./lib/entry-helpers";

// Direct named re-exports for cross-feature consumers.
export { approveEntry, rejectEntry } from "./api/entries";

export type {
    Entry,
    EntryListParams,
    EntryListResponse,
    EntryConflict,
    SmartInputResponse,
} from "./api/entries";
