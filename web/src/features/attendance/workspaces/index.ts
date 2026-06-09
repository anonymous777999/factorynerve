/**
 * features/attendance/workspaces — full-page compositions.
 *
 * Each role × screen pair is a workspace. Routes import these
 * directly from `app/<route>/page.tsx` with `export default`.
 *
 * Migration: today these re-export the legacy `*-page.tsx` files in
 * `components/`. As workspaces are physically moved, swap the source.
 */

// /attendance — operator daily punch
export { default as OperatorAttendanceWorkspace } from "@/components/attendance-page";

// /attendance/live — supervisor floor view
export { default as SupervisorLiveAttendanceWorkspace } from "@/components/attendance-live-page";

// /attendance/reports — accountant + manager attendance history
export { default as AttendanceReportsWorkspace } from "@/components/attendance-reports-page";

// /attendance/review — supervisor exception correction queue
export { default as AttendanceReviewWorkspace } from "@/components/attendance-review-page";
