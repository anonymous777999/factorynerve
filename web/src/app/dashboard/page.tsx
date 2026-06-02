"use client";

import dynamic from "next/dynamic";

import { useSession } from "@/lib/use-session";

import { DashboardPageSkeleton } from "@/components/page-skeletons";
import OperatorDashboardRoute from "@/features/dashboard/workspaces/operator-dashboard-route";

/**
 * Dashboard route entry — role-forked.
 *
 * Operators get the small `OperatorDashboardRoute` (minimal data fetch,
 * minimal JSX). Everyone else gets the full management `DashboardHome`,
 * dynamically loaded so it never lands in the operator bundle.
 *
 * The fork happens client-side because role identity is in the session
 * store. SSR sees neither branch and renders a skeleton until the
 * session loads — same as today's behavior.
 */
const ManagementDashboard = dynamic(
  () =>
    import("@/features/dashboard/workspaces/dashboard-home-workspace").then((mod) => ({
      default: mod.default,
    })),
  {
    ssr: false,
    loading: () => <DashboardPageSkeleton />,
  },
);

export default function DashboardRoute() {
  const { user, loading } = useSession();

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (user?.role === "operator") {
    return <OperatorDashboardRoute />;
  }

  return <ManagementDashboard />;
}
