# Sub-Phase F — Task 5: Component Library Composition Annotations

**Date:** June 9, 2026
**Purpose:** Annotate every component in the DPR.ai library with its composition properties — hierarchy level, density class, surface level, and allowed child levels.

---

## Annotation Schema

```typescript
interface CompositionAnnotation {
  /** Which hierarchy level(s) this component is designed to occupy */
  compositionLevel: 'h0' | 'h1' | 'h2' | 'h3' | 'any';
  
  /** The density classification of this component's content */
  densityClass: 'sparse' | 'standard' | 'dense';
  
  /** Which surface elevation this component renders at */
  surfaceLevel: 0 | 1 | 2 | 3;
  
  /** Which H-levels are allowed as children of this component */
  allowedChildLevels: Array<'h0' | 'h1' | 'h2' | 'h3'>;
}
```

---

## Composition Annotation Table

### Shell / Layout Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **PageShell** | h0 | sparse | 0 | h0 | Canonical H0 wrapper. Never inside a Card. Children are ShellHeader content. |
| **WorkstationShell** | h0 | sparse | 0 | h0, h1, h2, h3 | Full-page shell that wraps the H0 zone. Contains all subsequent content. |
| **ShellHeader** | h0 | sparse | 0 | h0 | The H0 identity region — title, metrics, actions. Always bare. |
| **RouteHeader** | h0 | sparse | 0 | h0 | Alternative H0 for routes without full PageShell. |
| **SectionPanel** | any | standard | 1 | h1, h2 | Generic section container. Accepts configurable surface level. |

### Primitive Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **Card** | h1, h2 | standard | 2 | h1, h2 | Bordered container for interactive/navigable content. Default: h1 weight. |
| **CardHeader** | — | sparse | — | — | Sub-component of Card — inherits parent's level. |
| **CardContent** | — | sparse | — | — | Sub-component of Card — inherits parent's level. |
| **CardTitle** | — | sparse | — | — | Sub-component of Card — inherits parent's level. |
| **GlassPanel** | h2 (decorative only) | sparse | ad-hoc | h2 | **NEVER** for structural content. Only for decorative accent, alerts, welcome cards. |
| **Badge / StatusBadge** | any | sparse | 0 | — | Inline status marker. Renders at whatever surface its parent provides. |
| **Button** | any | sparse | — | — | Inline action element. Never a container. |
| **Skeleton** | any | sparse | — | — | Loading placeholder. Replaced by actual content on load. |

### Operational Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **DataTable** | h1, h2 | dense | 2 | h2 (pagination) | Always dense. May be H1 (primary table) or H2 (secondary table). |
| **DataTableToolbar** | h2 | standard | 1 | h2 | Filter/search toolbar serving the DataTable. Surface 1 = zone tint. |
| **ResponsiveScrollArea** | any | — | — | any | Scroll wrapper — inherits surface from parent. |
| **DisclosurePanel** | h3 | sparse | 0 | h3 | Only H3 content. Never use for H2 or H1 content. |
| **FilterBar** | h2 | standard | 1 | h2 | Filter controls that serve H1. Surface 1 — not a Card. |
| **MetricStrip** | h0 | standard | 0 | h0 | Inline metric display for H0. No border, no card — bare text values. |

### Feedback Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **EmptyState** | any | sparse | 0 | — | Full-width empty state. Uses bare Surface 0. |
| **EmptyOperationalState** | any | sparse | 0 | — | Same as EmptyState but with operational context. |
| **SuccessBanner** | any | sparse | 0 | — | Status message — never a Card. |
| **MutationErrorBanner** | any | sparse | 0 | — | Error message — never a Card. |

### Workflow Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **WorkflowProgress** | h0 | sparse | 0 | h0 | Step indicator for H0 of workflow pages. Always sparse, always bare. |
| **StepNavigation** | h2 | sparse | 2 | h2 | Mobile step controls. Surface 2 bordered bar at bottom on mobile. |
| **GuidanceHint** | h3 | sparse | 0 | h3 | Help/tip text. Always H3, always Surface 0. |

### Dashboard Components

| Component | Level | Density | Surface | Allowed Children | Justification |
|-----------|-------|---------|---------|-----------------|---------------|
| **DashboardKPIGrid** | h1 | dense | 2 | h1, h2 | KPI metric cards for dashboard. Dense — multiple values per viewport. |
| **DashboardIntelligencePanel** | h2 | standard | 1 | h2 | AI insight panel. Surface 1 — secondary to KPIs. |
| **DashboardFeed** | h1 | standard | 2 | h1, h2 | Primary workflow feed. Card bordered — interactive items. |

---

## Implementation Pattern

Add composition annotations to components as static properties:

```typescript
// Example: DataTable
export function DataTable(props: DataTableProps) {
  // ... implementation
}

DataTable.composition = {
  compositionLevel: ['h1', 'h2'],
  densityClass: 'dense',
  surfaceLevel: 2,
  allowedChildLevels: ['h2'],
} satisfies CompositionAnnotation;
```

For future tooling, the annotations can be collected into a registry:

```typescript
// composition-registry.ts
import type { CompositionAnnotation } from './types';

const registry = new Map<string, CompositionAnnotation>();

export function registerComposition(
  componentName: string,
  annotation: CompositionAnnotation,
) {
  registry.set(componentName, annotation);
}

export function getComposition(componentName: string): CompositionAnnotation | undefined {
  return registry.get(componentName);
}
```