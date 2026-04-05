import type { AddonInfo, PlanInfo, PricingMeta } from "@/lib/plans";

export type BillingCycle = "monthly" | "yearly";

export type PricingSelection = {
  users: number;
  factories: number;
  requiredFeatures?: string[];
  selectedAddons?: string[];
  selectedAddonQuantities?: Record<string, number>;
  activeAddonIds?: string[];
  activeAddonQuantities?: Record<string, number>;
};

export type EstimatedAddon = AddonInfo & {
  quantity: number;
  activeQuantity: number;
  incrementalQuantity: number;
};

export type AddonBreakdown = {
  selectedAddons: EstimatedAddon[];
  chargeableAddons: EstimatedAddon[];
  includedAddons: EstimatedAddon[];
  alreadyActiveAddons: EstimatedAddon[];
  requiredAddonIds: string[];
};

const PLAN_ORDER = ["free", "starter", "growth", "factory", "business", "enterprise"];

function safeLimit(limit: number) {
  return Number(limit || 0);
}

function uniqueIds(values: string[] = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function addonCatalog(addons: AddonInfo[]) {
  return new Map(addons.map((addon) => [addon.id, addon]));
}

function normalizeAddonQuantities(selection: PricingSelection, requiredAddonIds: string[]) {
  const quantities: Record<string, number> = {};
  Object.entries(selection.selectedAddonQuantities || {}).forEach(([addonId, quantity]) => {
    const normalized = Number(quantity || 0);
    if (normalized > 0) {
      quantities[addonId] = normalized;
    }
  });
  (selection.selectedAddons || []).forEach((addonId) => {
    quantities[addonId] = Math.max(1, quantities[addonId] || 1);
  });
  requiredAddonIds.forEach((addonId) => {
    quantities[addonId] = Math.max(1, quantities[addonId] || 1);
  });
  return quantities;
}

export function sortPlans(plans: PlanInfo[]) {
  return [...plans].sort(
    (left, right) => PLAN_ORDER.indexOf(left.id) - PLAN_ORDER.indexOf(right.id),
  );
}

export function sortAddons(addons: AddonInfo[]) {
  return [...addons].sort((left, right) => {
    const orderDelta = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (orderDelta !== 0) return orderDelta;
    return left.name.localeCompare(right.name);
  });
}

export function yearlyValue(monthlyValue: number, pricing: PricingMeta) {
  return monthlyValue * (pricing.yearly_multiplier || 10);
}

export function formatLimit(value: number) {
  if (value < 0) return "Locked";
  return value > 0 ? String(value) : "Unlimited";
}

export function featureSatisfied(plan: PlanInfo, featureKey: string) {
  return Boolean(plan.features?.[featureKey]);
}

export function addonSupportsFeature(addon: AddonInfo, featureKey: string) {
  return addon.kind === "feature" && addon.feature_key === featureKey;
}

export function getRequiredAddonIds(
  plan: PlanInfo,
  addons: AddonInfo[],
  requiredFeatures: string[] = [],
) {
  const ids: string[] = [];
  requiredFeatures.forEach((featureKey) => {
    if (featureSatisfied(plan, featureKey)) return;
    const addon = addons.find((item) => addonSupportsFeature(item, featureKey));
    if (addon) ids.push(addon.id);
  });
  return uniqueIds(ids);
}

export function planSupportsSelection(
  plan: PlanInfo,
  addons: AddonInfo[],
  selection: PricingSelection,
) {
  const requiredFeatures = selection.requiredFeatures || [];
  if (safeLimit(plan.user_limit) > 0 && selection.users > safeLimit(plan.user_limit)) {
    return false;
  }
  if (safeLimit(plan.factory_limit) > 0 && selection.factories > safeLimit(plan.factory_limit)) {
    return false;
  }
  return requiredFeatures.every((featureKey) => {
    if (featureSatisfied(plan, featureKey)) return true;
    return addons.some((addon) => addonSupportsFeature(addon, featureKey));
  });
}

export function resolveAddonBreakdown(
  plan: PlanInfo,
  addons: AddonInfo[],
  selection: PricingSelection,
): AddonBreakdown {
  const requiredAddonIds = getRequiredAddonIds(plan, addons, selection.requiredFeatures || []);
  const selectedAddonQuantities = normalizeAddonQuantities(selection, requiredAddonIds);
  const activeAddonQuantities = selection.activeAddonQuantities || {};
  const activeAddonIds = new Set(uniqueIds(selection.activeAddonIds || []));
  const catalog = addonCatalog(addons);

  const selectedAddons = Object.entries(selectedAddonQuantities)
    .map(([addonId, quantity]) => {
      const addon = catalog.get(addonId);
      if (!addon) return null;
      const activeQuantity = Number(activeAddonQuantities[addonId] || (activeAddonIds.has(addonId) ? 1 : 0));
      return {
        ...addon,
        quantity,
        activeQuantity,
        incrementalQuantity: Math.max(0, quantity - activeQuantity),
      } satisfies EstimatedAddon;
    })
    .filter((addon): addon is EstimatedAddon => Boolean(addon));

  const chargeableAddons: EstimatedAddon[] = [];
  const includedAddons: EstimatedAddon[] = [];
  const alreadyActiveAddons: EstimatedAddon[] = [];

  selectedAddons.forEach((addon) => {
    if (addon.feature_key && addon.kind === "feature" && featureSatisfied(plan, addon.feature_key)) {
      includedAddons.push(addon);
      return;
    }
    if (addon.incrementalQuantity <= 0 && addon.activeQuantity > 0) {
      alreadyActiveAddons.push(addon);
      return;
    }
    chargeableAddons.push(addon);
  });

  return {
    selectedAddons,
    chargeableAddons,
    includedAddons,
    alreadyActiveAddons,
    requiredAddonIds,
  };
}

export function calculatePlanEstimate(
  plan: PlanInfo,
  pricing: PricingMeta,
  addons: AddonInfo[],
  selection: PricingSelection,
  cycle: BillingCycle,
) {
  const isCompatible = planSupportsSelection(plan, addons, selection);
  const extraUsers =
    plan.user_limit > 0 ? Math.max(0, selection.users - plan.user_limit) : 0;
  const extraFactories =
    plan.factory_limit > 0 ? Math.max(0, selection.factories - plan.factory_limit) : 0;
  const extraUserCost = 0;
  const extraFactoryCost = 0;
  const addonBreakdown = resolveAddonBreakdown(plan, addons, selection);
  const addonMonthlyCost = addonBreakdown.chargeableAddons.reduce(
    (sum, addon) => sum + (addon.price || 0) * Math.max(0, addon.incrementalQuantity || 0),
    0,
  );
  const monthlyTotal = (plan.monthly_price || 0) + addonMonthlyCost;
  const cycleMultiplier = cycle === "yearly" ? pricing.yearly_multiplier || 10 : 1;
  const cycleTotal = monthlyTotal * cycleMultiplier;

  return {
    plan,
    cycle,
    cycleMultiplier,
    isCompatible,
    extraUsers,
    extraFactories,
    extraUserCost,
    extraFactoryCost,
    addonMonthlyCost,
    monthlyTotal,
    cycleTotal,
    ...addonBreakdown,
  };
}

export function getCompatiblePlans(
  plans: PlanInfo[],
  addons: AddonInfo[],
  selection: PricingSelection,
) {
  return sortPlans(plans).filter((plan) => planSupportsSelection(plan, addons, selection));
}

export function getBestValuePlan(
  plans: PlanInfo[],
  pricing: PricingMeta,
  addons: AddonInfo[],
  selection: PricingSelection,
  cycle: BillingCycle,
) {
  const compatible = getCompatiblePlans(plans, addons, selection).filter((plan) => !plan.sales_only);
  if (!compatible.length) return null;
  const scored = compatible.map((plan) =>
    calculatePlanEstimate(plan, pricing, addons, selection, cycle),
  );
  return (
    scored.sort((left, right) => {
      if (left.monthlyTotal !== right.monthlyTotal) {
        return left.monthlyTotal - right.monthlyTotal;
      }
      return PLAN_ORDER.indexOf(left.plan.id) - PLAN_ORDER.indexOf(right.plan.id);
    })[0] || null
  );
}

export function getAlternativePlan(
  plans: PlanInfo[],
  pricing: PricingMeta,
  addons: AddonInfo[],
  selection: PricingSelection,
  cycle: BillingCycle,
  excludedPlanId: string,
) {
  const compatible = getCompatiblePlans(plans, addons, selection).filter(
    (plan) => plan.id !== excludedPlanId && !plan.sales_only,
  );
  if (!compatible.length) return null;
  const scored = compatible.map((plan) =>
    calculatePlanEstimate(plan, pricing, addons, selection, cycle),
  );
  return (
    scored.sort((left, right) => {
      if (left.monthlyTotal !== right.monthlyTotal) {
        return left.monthlyTotal - right.monthlyTotal;
      }
      return PLAN_ORDER.indexOf(left.plan.id) - PLAN_ORDER.indexOf(right.plan.id);
    })[0] || null
  );
}

export function getBestValueBadgePlan(plans: PlanInfo[]) {
  const paidPlans = sortPlans(plans).filter(
    (plan) => Number(plan.monthly_price || 0) > 0 && !plan.sales_only,
  );
  return paidPlans.find((plan) => plan.id === "factory") || paidPlans[2] || paidPlans[0] || null;
}
