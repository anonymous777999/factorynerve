/**
 * core/permissions — role gates, navigation rules, access reasons.
 *
 * Every feature uses these helpers to decide what to render and what
 * to forbid. No feature implements its own role check.
 */

export { RoleGate } from "@/shared/permissions/role-gate
export { canUseOcrScan } from "@/lib/ocr-access";
export {
    getHomeDestination,
    getRolePrimaryHrefs,
    getRoleAllowedNavHrefs,
    getRoleWorkflowHint,
} from "@/lib/role-navigation";
