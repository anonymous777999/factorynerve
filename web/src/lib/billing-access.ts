type BillingUserLike = {
  org_role?: string | null;
  role?: string | null;
} | null | undefined;

export function resolveBillingRole(user: BillingUserLike) {
  return String(user?.org_role || user?.role || "").trim().toLowerCase();
}

export function canViewPlansCatalog() {
  return true;
}

export function canViewBillingWorkspace(user: BillingUserLike) {
  const role = resolveBillingRole(user);
  return role === "admin" || role === "owner";
}

export function canStartBillingCheckout(user: BillingUserLike) {
  const role = resolveBillingRole(user);
  return role === "admin" || role === "owner";
}

export function canManageBillingControls(user: BillingUserLike) {
  return resolveBillingRole(user) === "owner";
}

export function billingRoleLabel(user: BillingUserLike) {
  const role = resolveBillingRole(user);
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "operator") return "Operator";
  if (role === "attendance") return "Attendance";
  if (role === "accountant") return "Accountant";
  return "User";
}
