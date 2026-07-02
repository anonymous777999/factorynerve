"use client";

import type { ComponentType, ReactNode } from "react";

import type { CurrentUser } from "@/lib/auth";
import { useSession as useAuth } from "@/lib/use-session";

export type UserRole = CurrentUser["role"] | "superadmin";

type RoleGuardProps = {
  allowed: UserRole[];
  children: ReactNode;
};

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  if (!role || !allowed.includes(role)) {
    return <div>403 Forbidden</div>;
  }

  return <>{children}</>;
}

export function withRoleGuard<P extends object>(
  Component: ComponentType<P>,
  allowed: UserRole[],
) {
  function GuardedComponent(props: P) {
    return (
      <RoleGuard allowed={allowed}>
        <Component {...props} />
      </RoleGuard>
    );
  }

  GuardedComponent.displayName = `withRoleGuard(${Component.displayName || Component.name || "Component"})`;

  return GuardedComponent;
}
