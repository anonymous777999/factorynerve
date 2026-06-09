/**
 * features/dashboard/workspaces — role-aware home.
 *
 * /dashboard         → role-aware dashboard (operator/supervisor/manager/owner)
 * /premium/dashboard → premium owner home
 * /control-tower     → multi-factory ops view (own feature folder)
 */

export { default as DashboardHome } from "./dashboard-home-workspace";
export { default as PremiumDashboardWorkspace } from "@/components/premium-dashboard-page";
