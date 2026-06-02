/**
 * features/attendance — the public API of the attendance feature.
 *
 * Other features and routes import only from `@/features/attendance`.
 * Internal modules (components, hooks, state, api) are not part of
 * this public surface unless re-exported here.
 *
 * Stay disciplined: the smaller this surface, the easier the feature
 * is to refactor and reason about.
 */

export * from "./workspaces";
export * as attendanceApi from "./api/attendance";

// Direct named re-exports for cross-feature consumers (e.g. approvals adapters).
export {
    approveAttendanceReview,
    rejectAttendanceReview,
    listAttendanceReview,
    getMyAttendanceToday,
    punchAttendance,
} from "./api/attendance";

export type {
    AttendanceShift,
    AttendanceStatus,
    AttendanceToday,
    AttendanceLiveRow,
    AttendanceReviewItem,
    AttendanceReviewPayload,
    AttendanceReviewFinalStatus,
} from "./api/attendance";
