/**
 * features/dashboard/api — server contract for dashboard data.
 *
 * Re-exports `lib/dashboard.ts` (alerts, weekly analytics, usage)
 * and `lib/premium.ts` (premium dashboard data).
 */

export * from "@/lib/dashboard";
export * as premiumApi from "@/lib/premium";
