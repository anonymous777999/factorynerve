/**
 * features/attendance/api — server contract for attendance.
 *
 * Migration shim: today this re-exports from `@/lib/attendance`. After
 * the next refactor pass, the body of `lib/attendance.ts` moves here
 * and `lib/attendance.ts` becomes the shim instead. Consumers don't change.
 */

export {
    getMyAttendanceToday,
    punchAttendance,
    getLiveAttendance,
    getAttendanceReportSummary,
    formatAttendanceStatusLabel,
    formatAttendanceReviewStatusLabel,
    listAttendanceReview,
    approveAttendanceReview,
    rejectAttendanceReview,
    listShiftTemplates,
    upsertShiftTemplate,
    listAttendanceEmployeeProfiles,
    upsertAttendanceEmployeeProfile,
    createAttendanceRegularization,
} from "@/lib/attendance";

export type {
    AttendanceShift,
    AttendanceStatus,
    AttendanceReviewStatus,
    AttendanceRegularizationType,
    AttendanceReviewFinalStatus,
    AttendanceToday,
    AttendanceShiftSummary,
    AttendanceLive,
    AttendanceLiveRow,
    AttendanceRegularization,
    AttendanceReviewItem,
    AttendanceReviewPayload,
    AttendanceReportDay,
    AttendanceReportSummary,
    EmployeeProfileItem,
    ShiftTemplateItem,
} from "@/lib/attendance";
