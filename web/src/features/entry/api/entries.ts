/**
 * features/entry/api — server contract for shift entry / DPR.
 *
 * Migration shim: re-exports from `@/lib/entries`. After the next pass,
 * the body of `lib/entries.ts` moves here. Consumers don't change.
 */

export {
    createEntry,
    listEntries,
    getTodayEntries,
    getEntry,
    getEntrySummaryMeta,
    regenerateEntrySummary,
    queueEntrySummaryJob,
    updateEntry,
    approveEntry,
    rejectEntry,
    deleteEntry,
    parseSmartInput,
    getEntryConflict,
} from "@/lib/entries";

export type {
    Entry,
    EntryListResponse,
    EntryListParams,
    SmartInputResponse,
    EntrySummaryMeta,
    EntryConflict,
} from "@/lib/entries";
