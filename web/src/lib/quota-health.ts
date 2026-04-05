export function quotaPercent(used?: number, limit?: number) {
  if (limit === undefined || limit === null || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((used || 0) / limit) * 100)));
}

export function quotaLabel(used?: number, limit?: number) {
  if (limit !== undefined && limit !== null && limit < 0) {
    return "Locked";
  }
  if (limit === undefined || limit === null || limit === 0) {
    return `${used || 0} / Unlimited`;
  }
  return `${used || 0} / ${limit}`;
}

export function getQuotaHealth(used?: number, limit?: number) {
  if (limit !== undefined && limit !== null && limit < 0) {
    return {
      percent: 0,
      badge: "Locked",
      detail: "Upgrade required",
      badgeClass: "border border-[var(--border)] bg-[rgba(148,163,184,0.14)] text-slate-200",
      barClass: "bg-[rgba(148,163,184,0.35)]",
    };
  }

  if (limit === undefined || limit === null || limit === 0) {
    return {
      percent: 0,
      badge: "Unlimited",
      detail: "No monthly cap",
      badgeClass: "border border-sky-400/30 bg-sky-400/15 text-sky-200",
      barClass: "bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]",
    };
  }

  const percent = quotaPercent(used, limit);

  if (percent >= 95) {
    return {
      percent,
      badge: "Critical",
      detail: `${percent}% used`,
      badgeClass: "border border-rose-400/30 bg-rose-400/15 text-rose-200",
      barClass: "bg-[linear-gradient(90deg,#fb7185,#ef4444)]",
    };
  }

  if (percent >= 80) {
    return {
      percent,
      badge: "Near Limit",
      detail: `${percent}% used`,
      badgeClass: "border border-amber-400/30 bg-amber-400/15 text-amber-200",
      barClass: "bg-[linear-gradient(90deg,#f59e0b,#f97316)]",
    };
  }

  if (percent >= 50) {
    return {
      percent,
      badge: "Tracking",
      detail: `${percent}% used`,
      badgeClass: "border border-sky-400/30 bg-sky-400/15 text-sky-200",
      barClass: "bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]",
    };
  }

  return {
    percent,
    badge: "Healthy",
    detail: `${percent}% used`,
    badgeClass: "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
    barClass: "bg-[linear-gradient(90deg,#34d399,#22c55e)]",
  };
}
