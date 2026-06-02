"use client";

import { useAuth } from "@/lib/use-session";

type RoleGateProps = {
  allowedRoles: string[];
  children: React.ReactNode;
};

export default function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();

  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
