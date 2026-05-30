# Technical Design Document

## Feature: Frontend Modernization Sprint 2 - Workspace & Interaction Evolution

## Overview

This design defines a **safe, component-level modernization strategy** for Sprint 2 of the DPR.ai frontend modernization initiative. Sprint 2 builds on Sprint 1's global style foundation (typography, colors, surfaces) to refine workspace layout, sidebar navigation, AI-native UX, interaction states, operational density, status systems, and accessibility.

**Critical Constraint**: This is NOT a redesign. This is controlled visual refinement. Architecture, workflows, routing, and backend contracts remain unchanged.

**Design Philosophy**: Calm, modern, operational software (Linear/Stripe/Arc) rather than cyberpunk/SOC dashboards.

### Sprint 1 Foundation (Completed)

Sprint 1 established the visual foundation:
- ✅ Typography reset (Inter font, sentence case, readable sizing)
- ✅ Border reduction (removed heavy borders, simplified surfaces)
- ✅ Surface simplification (removed cyberpunk gradients)
- ✅ Accent color migration (warm orange #c56d2d → indigo #6366f1)
- ✅ Global CSS modernization in `web/src/app/globals.css`

### Sprint 2 Scope (This Design)

Sprint 2 focuses on component-level refinement across 12 requirement areas:
1. Workspace Layout Modernization (10 criteria)
2. Sidebar Navigation Refinement (9 criteria)
3. AI-Native UX Integration (10 criteria)
4. Interaction Polish (9 criteria)
5. Operational Density Refinement (10 criteria)
6. Status and Feedback System Cleanup (10 criteria)
7. Component Visual Consistency (10 criteria)
8. Responsive Interaction Feedback (10 criteria)
9. Dark Mode Visual Consistency (10 criteria)
10. Accessibility Compliance (12 criteria)
11. Governance Compliance (15 criteria)
12. Performance Optimization (9 criteria)


## Architecture

### High-Level Modernization Strategy

**Approach**: Component-level visual refinement using design tokens and reusable patterns.

**Principles**:
1. **Preserve Architecture**: No changes to AppShell, scroll ownership, routing, or backend contracts
2. **Use Design Tokens**: All visual changes use existing or new design tokens
3. **Reusable Primitives**: Create shared interaction patterns for consistency
4. **Safe Boundaries**: Modify only visual layer (CSS, classes, tokens)
5. **Incremental Rollout**: Phase changes to enable safe rollback

### Component Impact Assessment

**Low-Risk Components** (visual-only changes):
- `web/src/components/ui/badge.tsx` - Status chip styling
- `web/src/components/ui/button.tsx` - Interaction states
- `web/src/app/globals.css` - Token additions

**Medium-Risk Components** (interaction refinement):
- `web/src/components/app-sidebar.tsx` - Navigation styling
- `web/src/components/dashboard/` - Workspace layout spacing
- `web/src/components/ocr/` - AI insight panel styling

**Architecture-Critical Components** (NO CHANGES):
- `web/src/components/app-shell.tsx` - Scroll ownership preserved
- `web/src/app/layout.tsx` - Page structure preserved

### Architecture Preservation Guarantees

**AppShell Stability**:
- ✅ `.factory-workstation-frame` retains `overflow-y-auto`
- ✅ Page does NOT create scroll containers
- ✅ Explicit height containment maintained
- ✅ Sticky behavior preserved
- ✅ No modifications to AppShell component

**Scroll Ownership**:
- ✅ Content scrolls within factory-workstation-frame
- ✅ No page-level scrolling
- ✅ Flex children with scrolling have `min-h-0`
- ✅ Scroll containers have explicit height

**Performance**:
- ✅ Virtual scrolling preserved in data tables
- ✅ CSS transitions only (no JS animations)
- ✅ Lazy loading boundaries maintained


## Components and Interfaces

### 1. Workspace Layout Modernization

**Objective**: Create calm, uncluttered workspace using surface differentiation and generous spacing.

**Components Affected**:
- `web/src/components/dashboard/*.tsx` - Dashboard workspace components
- `web/src/components/ocr/*.tsx` - OCR workspace components
- `web/src/app/globals.css` - Surface tokens

**Safe Modification Boundaries**:
- ✅ Modify: Padding, margins, gaps, surface colors
- ✅ Modify: Border styles (reduce weight, use subtle colors)
- ❌ DO NOT: Change scroll architecture, layout structure, component hierarchy

**Token Usage Strategy**:
```css
/* Surface differentiation (2-3% lightness steps) */
--surface-app: #f8f9fa;
--surface-shell: #ffffff;
--surface-panel: #fafbfc;
--surface-card: #ffffff;

/* Spacing tokens (4px scale) */
--space-4: 16px;  /* Element padding */
--space-6: 24px;  /* Section gaps */
--space-8: 32px;  /* Major section separation */
--space-10: 40px; /* Row height default */
```

**Implementation Pattern**:
```tsx
// Before: Heavy borders, cramped spacing
<div className="border-2 border-gray-300 p-2 space-y-2">
  <Card className="border border-gray-200 p-3" />
</div>

// After: Surface differentiation, generous spacing
<div className="bg-surface-shell p-6 space-y-6">
  <Card className="bg-surface-card border border-border-subtle p-6" />
</div>
```

**Reusable Primitives**:
- `SurfacePanel` - Elevated surface with subtle border
- `SurfaceCard` - Card surface with consistent padding
- `SectionGap` - Consistent section spacing utility


### 2. Sidebar Navigation Refinement

**Objective**: Create calm, clear navigation with sentence case and adequate touch targets.

**Components Affected**:
- `web/src/components/app-sidebar.tsx` - Main sidebar component

**Current State Analysis**:
- ✅ Already uses sentence case for navigation labels
- ✅ Already uses Inter font family
- ✅ Already has icon + label pattern
- ⚠️ Needs: Hover state refinement, focus indicator enhancement, touch target validation

**Safe Modification Boundaries**:
- ✅ Modify: Hover states, focus states, active states, spacing
- ✅ Modify: Typography sizing, color opacity
- ❌ DO NOT: Change navigation structure, routing logic, permission gates

**Token Usage Strategy**:
```css
/* Navigation states */
--nav-item-height: 40px;           /* Touch-friendly */
--nav-item-padding-x: 12px;
--nav-item-padding-y: 8px;
--nav-item-gap: 8px;               /* Icon-to-label gap */

/* Opacity differentiation */
--nav-primary-opacity: 1.0;        /* Active/primary */
--nav-secondary-opacity: 0.75;     /* Secondary */
--nav-tertiary-opacity: 0.55;      /* Tertiary */

/* Interaction states */
--nav-hover-bg-opacity: 0.08;      /* 8% background change */
--nav-active-bg: var(--accent-soft); /* Indigo tint */
```

**Implementation Pattern**:
```tsx
// Navigation item with refined states
<Link
  href={item.href}
  className={cn(
    "flex items-center gap-2 px-3 py-2 rounded-md",
    "min-h-[44px]", // Touch target
    "transition-colors duration-100",
    active
      ? "bg-accent-soft text-accent font-medium"
      : "text-text-secondary hover:bg-surface-panel hover:text-text-primary"
  )}
>
  <NavIcon className="h-5 w-5" />
  <span className="text-sm">{item.label}</span>
</Link>
```

**Reusable Primitives**:
- `NavItem` - Consistent navigation item pattern
- `NavSection` - Section header with consistent styling
- `NavBadge` - Notification badge for nav items


### 3. AI-Native UX Integration

**Objective**: Make AI insights feel integrated, helpful, and trustworthy with calm indicators.

**Components Affected**:
- `web/src/components/ocr/*.tsx` - OCR AI insight panels
- `web/src/components/ui/badge.tsx` - Confidence level indicators
- `web/src/app/globals.css` - AI processing state tokens

**Safe Modification Boundaries**:
- ✅ Modify: AI indicator styling, confidence level display, panel spacing
- ✅ Modify: Processing state colors, error state presentation
- ❌ DO NOT: Change AI logic, OCR processing, backend integration

**Token Usage Strategy**:
```css
/* AI processing states */
--ai-processing-bg: rgba(99, 102, 241, 0.08);  /* Calm indigo tint */
--ai-processing-fg: #4338ca;                    /* Indigo text */
--ai-processing-border: rgba(99, 102, 241, 0.2);

/* Confidence levels */
--confidence-high-fg: #22c55e;    /* Green */
--confidence-medium-fg: #f59e0b;  /* Amber */
--confidence-low-fg: #64748b;     /* Slate */

/* AI panel spacing */
--ai-panel-padding: 16px;
--ai-panel-gap: 12px;
```

**Implementation Pattern**:
```tsx
// AI Insight Panel with calm indicators
<div className="bg-ai-processing-bg border border-ai-processing-border rounded-lg p-4 space-y-3">
  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-ai-processing-fg" />
    <span className="text-sm font-medium text-ai-processing-fg">
      AI Processing
    </span>
  </div>
  
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">Confidence</span>
      <Badge status="success" size="compact">High</Badge>
    </div>
    <p className="text-xs text-text-tertiary line-clamp-3">
      {aiReasoning}
    </p>
  </div>
</div>
```

**Reusable Primitives**:
- `AIInsightPanel` - Consistent AI content container
- `ConfidenceBadge` - Confidence level indicator
- `AIProcessingIndicator` - Calm processing state


### 4. Interaction Polish

**Objective**: Smooth, predictable interactions with consistent feedback timing.

**Components Affected**:
- `web/src/components/ui/button.tsx` - Button interaction states
- `web/src/components/ui/*.tsx` - All interactive UI primitives
- `web/src/app/globals.css` - Interaction timing tokens

**Safe Modification Boundaries**:
- ✅ Modify: Hover states, focus states, active states, loading states
- ✅ Modify: Transition timing, easing functions
- ❌ DO NOT: Change component logic, event handlers, state management

**Token Usage Strategy**:
```css
/* Interaction timing */
--transition-fast: 80ms;      /* Hover, focus */
--transition-standard: 120ms; /* State changes */
--transition-expand: 150ms;   /* Expand/collapse */

/* Easing */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);

/* Focus ring */
--focus-ring: 0 0 0 2px var(--surface-app), 0 0 0 4px var(--accent);
--focus-ring-offset: 2px;

/* Interaction opacity changes */
--hover-opacity-change: 0.08;   /* 8% background change */
--active-opacity-change: 0.15;  /* 15% background change */
```

**Implementation Pattern**:
```tsx
// Button with refined interaction states
<button
  className={cn(
    "px-4 py-2 rounded-md",
    "transition-colors duration-100 ease-standard",
    "bg-accent text-white",
    "hover:bg-accent-hover",
    "active:bg-accent-active",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    isLoading && "opacity-90 pointer-events-none"
  )}
>
  {isLoading && <Spinner className="mr-2" />}
  {children}
</button>
```

**Reusable Primitives**:
- `InteractiveElement` - Base interactive element with consistent states
- `LoadingSpinner` - Consistent loading indicator
- `FocusRing` - Consistent focus indicator utility


### 5. Operational Density Refinement

**Objective**: Balance information density for manufacturing operations without cramping.

**Components Affected**:
- `web/src/components/data-table/*.tsx` - Data table components
- `web/src/components/ui/form/*.tsx` - Form components
- `web/src/app/globals.css` - Density tokens

**Safe Modification Boundaries**:
- ✅ Modify: Row heights, cell padding, font sizes, gaps
- ✅ Modify: Density mode styling
- ❌ DO NOT: Change table virtualization, data fetching, sorting logic

**Token Usage Strategy**:
```css
/* Density modes */
--density-default-row-height: 40px;
--density-default-cell-padding-x: 12px;
--density-default-cell-padding-y: 8px;

--density-compact-row-height: 36px;
--density-compact-cell-padding-x: 8px;
--density-compact-cell-padding-y: 6px;

--density-comfortable-row-height: 48px;
--density-comfortable-cell-padding-x: 16px;
--density-comfortable-cell-padding-y: 12px;

/* Typography for density */
--table-cell-font-size: 13px;
--form-label-font-size: 14px;
--form-body-font-size: 14px;
```

**Implementation Pattern**:
```tsx
// Data table with density support
<table className={cn(
  "w-full",
  density === "compact" && "text-xs",
  density === "default" && "text-sm",
  density === "comfortable" && "text-base"
)}>
  <tbody>
    <tr className={cn(
      density === "compact" && "h-9",
      density === "default" && "h-10",
      density === "comfortable" && "h-12"
    )}>
      <td className={cn(
        "font-variant-numeric-tabular",
        density === "compact" && "px-2 py-1.5",
        density === "default" && "px-3 py-2",
        density === "comfortable" && "px-4 py-3"
      )}>
        {value}
      </td>
    </tr>
  </tbody>
</table>
```

**Reusable Primitives**:
- `DensityProvider` - Context for density mode
- `DensityAwareTable` - Table with density support
- `DensityAwareForm` - Form with density support


### 6. Status and Feedback System Cleanup

**Objective**: Clear, calm status indicators without pulsing or glow effects.

**Components Affected**:
- `web/src/components/ui/badge.tsx` - Status badge component
- `web/src/app/globals.css` - Status color tokens

**Current State Analysis**:
- ✅ Badge component already uses sentence case
- ✅ Already has status color system
- ⚠️ Needs: Ensure no pulsing animations, validate contrast ratios

**Safe Modification Boundaries**:
- ✅ Modify: Badge styling, status colors, border styles
- ✅ Modify: Remove any pulsing/glow effects
- ❌ DO NOT: Change badge logic, status determination

**Token Usage Strategy**:
```css
/* Status colors (already defined in Sprint 1) */
--status-success-fg: #22c55e;
--status-success-bg: rgba(34, 197, 94, 0.1);
--status-success-border: rgba(34, 197, 94, 0.3);

--status-warning-fg: #f59e0b;
--status-warning-bg: rgba(245, 158, 11, 0.1);
--status-warning-border: rgba(245, 158, 11, 0.3);

--status-danger-fg: #ef4444;
--status-danger-bg: rgba(239, 68, 68, 0.1);
--status-danger-border: rgba(239, 68, 68, 0.3);

--status-processing-fg: #4338ca;
--status-processing-bg: rgba(99, 102, 241, 0.1);
--status-processing-border: rgba(99, 102, 241, 0.3);

--status-paused-fg: #64748b;
--status-paused-bg: rgba(100, 116, 139, 0.1);
--status-paused-border: rgba(100, 116, 139, 0.3);

/* Badge sizing */
--badge-font-size: 11px;
--badge-padding-x: 6px;
--badge-padding-y: 2px;
--badge-border-width: 1px;
```

**Implementation Pattern**:
```tsx
// Status badge (already implemented correctly)
<Badge
  status="success"
  size="compact"
  className="font-semibold"
>
  Completed
</Badge>

// NO pulsing animations
// NO glow effects
// YES calm, static indicators
```

**Reusable Primitives**:
- `StatusBadge` - Consistent status indicator
- `StatusDot` - Minimal status indicator
- `StatusText` - Text-only status indicator


### 7. Component Visual Consistency

**Objective**: Consistent visual patterns across all components using design tokens.

**Components Affected**:
- All components in `web/src/components/ui/*.tsx`
- All components in `web/src/components/dashboard/*.tsx`
- All components in `web/src/components/ocr/*.tsx`

**Safe Modification Boundaries**:
- ✅ Modify: Typography, colors, spacing, borders, shadows
- ✅ Modify: Ensure all use design tokens
- ❌ DO NOT: Change component logic, props, behavior

**Token Usage Strategy**:
```css
/* Typography (from Sprint 1) */
--font-family-ui: 'Inter', sans-serif;
--font-family-mono: 'JetBrains Mono', monospace;

/* Accent color (from Sprint 1) */
--accent: #6366f1;
--accent-hover: #5558e3;
--accent-active: #4338ca;

/* Border radius */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;

/* Shadows (functional elevation) */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

/* Contrast ratios */
--min-contrast-body: 4.5;  /* WCAG AA */
--min-contrast-large: 3.0; /* WCAG AA large text */
```

**Implementation Pattern**:
```tsx
// Consistent component styling
<Card className={cn(
  "bg-surface-card",
  "border border-border-subtle",
  "rounded-lg",
  "p-6",
  "shadow-sm"
)}>
  <h2 className="text-base font-semibold text-text-primary">
    Card Title
  </h2>
  <p className="mt-2 text-sm text-text-secondary">
    Card content
  </p>
</Card>
```

**Reusable Primitives**:
- `Card` - Consistent card container
- `Panel` - Consistent panel container
- `Section` - Consistent section container


### 8. Responsive Interaction Feedback

**Objective**: Immediate feedback for all interactions with consistent timing.

**Components Affected**:
- `web/src/components/ui/button.tsx` - Button loading states
- `web/src/components/ui/form/*.tsx` - Form submission feedback
- `web/src/app/globals.css` - Feedback timing tokens

**Safe Modification Boundaries**:
- ✅ Modify: Loading states, success/error feedback, transition timing
- ✅ Modify: Spinner styling, feedback message styling
- ❌ DO NOT: Change form submission logic, validation logic

**Token Usage Strategy**:
```css
/* Feedback timing */
--feedback-instant: 100ms;     /* Button click feedback */
--feedback-success-duration: 3000ms;  /* Success message */
--feedback-error-duration: 5000ms;    /* Error message */

/* Spinner colors */
--spinner-color: #4338ca;      /* Indigo */
--spinner-track-opacity: 0.3;

/* Feedback colors */
--feedback-success-bg: rgba(34, 197, 94, 0.1);
--feedback-success-fg: #22c55e;
--feedback-error-bg: rgba(239, 68, 68, 0.1);
--feedback-error-fg: #ef4444;
```

**Implementation Pattern**:
```tsx
// Button with loading state
<Button
  isBusy={isSubmitting}
  busyLabel="Saving..."
  onClick={handleSubmit}
>
  Save changes
</Button>

// Success feedback
{showSuccess && (
  <div className="flex items-center gap-2 p-3 bg-feedback-success-bg border border-status-success-border rounded-md">
    <CheckIcon className="h-5 w-5 text-feedback-success-fg" />
    <span className="text-sm text-feedback-success-fg">
      Changes saved successfully
    </span>
  </div>
)}

// Error feedback
{showError && (
  <div className="flex items-center gap-2 p-3 bg-feedback-error-bg border border-status-danger-border rounded-md">
    <AlertIcon className="h-5 w-5 text-feedback-error-fg" />
    <span className="text-sm text-feedback-error-fg">
      {errorMessage}
    </span>
  </div>
)}
```

**Reusable Primitives**:
- `LoadingButton` - Button with loading state
- `FeedbackMessage` - Success/error feedback
- `InlineSpinner` - Consistent spinner component


### 9. Dark Mode Visual Consistency

**Objective**: Modern, professional dark mode without cyberpunk aesthetics.

**Components Affected**:
- `web/src/app/globals.css` - Dark mode tokens
- All components (inherit dark mode tokens)

**Safe Modification Boundaries**:
- ✅ Modify: Dark mode color tokens, surface differentiation
- ✅ Modify: Ensure 4.5:1 contrast ratios
- ❌ DO NOT: Add colored radial gradients, glow effects

**Token Usage Strategy**:
```css
/* Dark mode surfaces (2-3% differentiation) */
@media (prefers-color-scheme: dark) {
  --surface-app: #09111B;
  --surface-shell: #0D1523;
  --surface-panel: #111927;
  --surface-card: #151F2E;
  
  /* Dark mode text */
  --text-primary: #EDF2F7;    /* 4.5:1 contrast */
  --text-secondary: #94A3B8;  /* 3:1 contrast */
  --text-tertiary: #64748B;
  
  /* Dark mode borders */
  --border-default: rgba(255, 255, 255, 0.1);
  --border-subtle: rgba(255, 255, 255, 0.05);
  
  /* Dark mode shadows (1.5-2x elevation) */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 6px 12px rgba(0, 0, 0, 0.3);
  
  /* Accent remains same */
  --accent: #6366f1;
}
```

**Implementation Pattern**:
```tsx
// Components automatically inherit dark mode tokens
<div className="bg-surface-card border border-border-subtle text-text-primary">
  {/* Content */}
</div>

// NO colored radial gradients
// NO glow effects
// YES clean, professional dark mode
```

**Reusable Primitives**:
- Dark mode tokens (automatic via CSS variables)
- No component-specific dark mode logic needed


### 10. Accessibility Compliance

**Objective**: Fully accessible interface meeting WCAG 2.1 AA standards.

**Components Affected**:
- All interactive components
- All text content
- All images and icons

**Safe Modification Boundaries**:
- ✅ Modify: Focus indicators, contrast ratios, touch targets, ARIA labels
- ✅ Modify: Keyboard navigation support
- ❌ DO NOT: Break existing keyboard navigation, remove semantic HTML

**Token Usage Strategy**:
```css
/* Focus indicators */
--focus-ring: 0 0 0 2px var(--surface-app), 0 0 0 4px var(--accent);
--focus-ring-offset: 2px;
--focus-ring-width: 2px;

/* Touch targets */
--min-touch-target: 44px;

/* Contrast ratios */
--min-contrast-body: 4.5;   /* WCAG AA */
--min-contrast-large: 3.0;  /* WCAG AA large text */
--min-contrast-ui: 3.0;     /* WCAG AA UI components */
```

**Implementation Pattern**:
```tsx
// Accessible button
<button
  className={cn(
    "min-h-[44px] min-w-[44px]",  // Touch target
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
  )}
  aria-label="Save changes"
>
  Save
</button>

// Accessible image
<img
  src="/chart.png"
  alt="Steel batch production chart showing 120 batches completed"
/>

// Accessible form field
<div>
  <label htmlFor="factory-name" className="text-sm font-medium">
    Factory name
  </label>
  <input
    id="factory-name"
    type="text"
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? "factory-name-error" : undefined}
  />
  {hasError && (
    <p id="factory-name-error" className="text-sm text-status-danger-fg">
      Factory name is required
    </p>
  )}
</div>
```

**Reusable Primitives**:
- `AccessibleButton` - Button with proper ARIA
- `AccessibleFormField` - Form field with proper labels
- `AccessibleImage` - Image with alt text


## Data Models

### Design Token Schema

**Token Categories**:
1. **Color Tokens** - Surface, text, border, status, accent
2. **Spacing Tokens** - 4px scale, semantic spacing
3. **Typography Tokens** - Font families, sizes, weights
4. **Interaction Tokens** - Timing, easing, states
5. **Accessibility Tokens** - Focus rings, touch targets, contrast

**Token Structure**:
```typescript
interface DesignTokens {
  // Color tokens
  colors: {
    surface: {
      app: string;
      shell: string;
      panel: string;
      card: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    border: {
      default: string;
      subtle: string;
      focus: string;
    };
    status: {
      success: StatusColors;
      warning: StatusColors;
      danger: StatusColors;
      processing: StatusColors;
      paused: StatusColors;
    };
    accent: {
      default: string;
      hover: string;
      active: string;
      soft: string;
    };
  };
  
  // Spacing tokens
  spacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    6: string;
    8: string;
    10: string;
    12: string;
  };
  
  // Typography tokens
  typography: {
    fontFamily: {
      ui: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
  };
  
  // Interaction tokens
  interaction: {
    timing: {
      fast: string;
      standard: string;
      expand: string;
    };
    easing: {
      standard: string;
    };
  };
  
  // Accessibility tokens
  accessibility: {
    focusRing: string;
    minTouchTarget: string;
    minContrast: {
      body: number;
      large: number;
      ui: number;
    };
  };
}

interface StatusColors {
  fg: string;
  bg: string;
  border: string;
  icon: string;
}
```


### Component State Schema

**Interaction States**:
```typescript
interface InteractionState {
  default: StyleDefinition;
  hover: StyleDefinition;
  focus: StyleDefinition;
  active: StyleDefinition;
  disabled: StyleDefinition;
  loading: StyleDefinition;
}

interface StyleDefinition {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  opacity?: number;
  cursor?: string;
  transition?: string;
}
```

**Density Modes**:
```typescript
type DensityMode = 'compact' | 'default' | 'comfortable';

interface DensityConfig {
  rowHeight: number;
  cellPaddingX: number;
  cellPaddingY: number;
  fontSize: string;
  gap: number;
}

const densityConfigs: Record<DensityMode, DensityConfig> = {
  compact: {
    rowHeight: 36,
    cellPaddingX: 8,
    cellPaddingY: 6,
    fontSize: '12px',
    gap: 8,
  },
  default: {
    rowHeight: 40,
    cellPaddingX: 12,
    cellPaddingY: 8,
    fontSize: '13px',
    gap: 12,
  },
  comfortable: {
    rowHeight: 48,
    cellPaddingX: 16,
    cellPaddingY: 12,
    fontSize: '14px',
    gap: 16,
  },
};
```

**Status Types**:
```typescript
type StatusType = 
  | 'success'
  | 'warning'
  | 'danger'
  | 'processing'
  | 'paused'
  | 'draft'
  | 'synced'
  | 'error';

interface StatusConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon?: React.ComponentType;
}
```


## Error Handling

### Visual Error States

**Error Display Strategy**:
1. **Inline Errors** - Form validation errors inline with fields
2. **Toast Notifications** - Transient feedback for operations
3. **Error Boundaries** - Graceful degradation for component failures
4. **Status Indicators** - Persistent error states in status badges

**Error Styling**:
```tsx
// Form field error
<div className="space-y-1">
  <input
    className={cn(
      "px-3 py-2 border rounded-md",
      hasError
        ? "border-status-danger-border bg-status-danger-bg"
        : "border-border-default"
    )}
    aria-invalid={hasError}
  />
  {hasError && (
    <p className="text-sm text-status-danger-fg">
      {errorMessage}
    </p>
  )}
</div>

// Error toast
<div className="flex items-center gap-2 p-3 bg-status-danger-bg border border-status-danger-border rounded-md">
  <AlertIcon className="h-5 w-5 text-status-danger-fg" />
  <div className="flex-1">
    <p className="text-sm font-medium text-status-danger-fg">
      Operation failed
    </p>
    <p className="text-xs text-text-secondary">
      {errorDetails}
    </p>
  </div>
  <button
    onClick={onDismiss}
    className="text-status-danger-fg hover:opacity-80"
  >
    <XIcon className="h-4 w-4" />
  </button>
</div>
```

### Error Recovery

**Recovery Patterns**:
1. **Retry Actions** - Provide retry button for failed operations
2. **Fallback UI** - Show fallback content when components fail
3. **Clear Messaging** - Explain what went wrong and how to fix it
4. **Preserve State** - Don't lose user data on errors

**Error Boundary Pattern**:
```tsx
<ErrorBoundary
  fallback={
    <div className="p-6 bg-status-danger-bg border border-status-danger-border rounded-md">
      <h2 className="text-lg font-semibold text-status-danger-fg">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        This component failed to load. Try refreshing the page.
      </p>
      <Button
        onClick={handleRetry}
        className="mt-4"
      >
        Retry
      </Button>
    </div>
  }
>
  <Component />
</ErrorBoundary>
```


## Testing Strategy

### Visual Regression Testing

**Approach**: Capture screenshots of components before/after changes to detect unintended visual regressions.

**Tools**:
- Playwright for screenshot capture
- Percy or Chromatic for visual diff comparison
- Manual review for subjective quality

**Test Coverage**:
1. **Component States** - Default, hover, focus, active, disabled, loading
2. **Density Modes** - Compact, default, comfortable
3. **Theme Modes** - Light, dark
4. **Responsive Breakpoints** - Mobile (375px), tablet (768px), desktop (1440px)
5. **Status Variations** - Success, warning, danger, processing, paused

**Test Pattern**:
```typescript
// Visual regression test example
test('Button component visual states', async ({ page }) => {
  await page.goto('/storybook/button');
  
  // Default state
  await page.screenshot({ path: 'button-default.png' });
  
  // Hover state
  await page.hover('[data-testid="button"]');
  await page.screenshot({ path: 'button-hover.png' });
  
  // Focus state
  await page.focus('[data-testid="button"]');
  await page.screenshot({ path: 'button-focus.png' });
  
  // Loading state
  await page.click('[data-testid="toggle-loading"]');
  await page.screenshot({ path: 'button-loading.png' });
});
```

### Interaction Testing

**Approach**: Verify interaction behaviors (hover, focus, click) work correctly.

**Test Coverage**:
1. **Hover States** - Background changes within 80-120ms
2. **Focus States** - Focus ring appears on keyboard navigation
3. **Active States** - Pressed appearance on click
4. **Loading States** - Spinner appears, button disabled
5. **Keyboard Navigation** - Tab, Enter, Space, Escape work correctly

**Test Pattern**:
```typescript
// Interaction test example
test('Button interaction states', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Hover state
  await page.hover('[data-testid="save-button"]');
  const hoverBg = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="save-button"]');
    return window.getComputedStyle(btn).backgroundColor;
  });
  expect(hoverBg).not.toBe('initial-bg-color');
  
  // Focus state
  await page.keyboard.press('Tab');
  const focusRing = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="save-button"]');
    return window.getComputedStyle(btn).boxShadow;
  });
  expect(focusRing).toContain('var(--accent)');
  
  // Click feedback
  await page.click('[data-testid="save-button"]');
  await page.waitForSelector('[data-testid="loading-spinner"]');
});
```


### Accessibility Testing

**Approach**: Validate WCAG 2.1 AA compliance using automated tools and manual testing.

**Tools**:
- axe-core for automated accessibility checks
- Lighthouse for accessibility audits
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)

**Test Coverage**:
1. **Contrast Ratios** - Minimum 4.5:1 for body text, 3:1 for UI components
2. **Focus Indicators** - Visible focus ring on all interactive elements
3. **Keyboard Navigation** - All functionality accessible via keyboard
4. **ARIA Labels** - Proper labels for all interactive elements
5. **Alt Text** - Descriptive alt text for all images
6. **Touch Targets** - Minimum 44x44px for all interactive elements

**Test Pattern**:
```typescript
// Accessibility test example
test('Button accessibility', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Run axe-core
  const results = await page.evaluate(() => {
    return axe.run();
  });
  expect(results.violations).toHaveLength(0);
  
  // Check contrast ratio
  const contrast = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="save-button"]');
    const bg = window.getComputedStyle(btn).backgroundColor;
    const fg = window.getComputedStyle(btn).color;
    return calculateContrast(bg, fg);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  
  // Check touch target size
  const size = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="save-button"]');
    const rect = btn.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  
  // Check keyboard navigation
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    return document.activeElement.getAttribute('data-testid');
  });
  expect(focused).toBe('save-button');
});
```

**Accessibility Checklist**:
- [ ] All interactive elements have minimum 44x44px touch targets
- [ ] All text has minimum 4.5:1 contrast ratio
- [ ] All interactive elements have visible focus indicators
- [ ] All images have descriptive alt text
- [ ] All forms have proper labels and error messages
- [ ] All functionality accessible via keyboard
- [ ] All dynamic content announced to screen readers
- [ ] No keyboard traps
- [ ] Logical tab order
- [ ] Proper heading hierarchy


### Performance Testing

**Approach**: Validate performance metrics remain within acceptable thresholds.

**Metrics**:
1. **Interaction Feedback** - Visual feedback within 100ms
2. **Scroll Performance** - 60fps scroll in data tables
3. **Transition Duration** - 80-120ms for state changes
4. **Bundle Size** - No significant increase in bundle size
5. **Lazy Loading** - Components >100KB lazy loaded

**Test Pattern**:
```typescript
// Performance test example
test('Button interaction performance', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Measure interaction feedback time
  const startTime = Date.now();
  await page.click('[data-testid="save-button"]');
  await page.waitForSelector('[data-testid="loading-spinner"]');
  const feedbackTime = Date.now() - startTime;
  expect(feedbackTime).toBeLessThan(100);
  
  // Measure scroll performance
  const scrollMetrics = await page.evaluate(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    return new Promise((resolve) => {
      const measureFPS = () => {
        const currentTime = performance.now();
        const delta = currentTime - lastTime;
        frameCount++;
        
        if (frameCount >= 60) {
          const fps = 1000 / (delta / frameCount);
          resolve(fps);
        } else {
          lastTime = currentTime;
          requestAnimationFrame(measureFPS);
        }
      };
      
      requestAnimationFrame(measureFPS);
      window.scrollBy(0, 1000);
    });
  });
  expect(scrollMetrics).toBeGreaterThanOrEqual(60);
});
```

**Performance Benchmarks**:
- Interaction feedback: <100ms
- Scroll performance: ≥60fps
- Transition duration: 80-120ms
- Bundle size increase: <5%
- Lazy loading threshold: >100KB


## Implementation Phases

### Phase 1: Low-Risk Visual Updates (Week 1)

**Objective**: Update visual styling without touching component logic.

**Tasks**:
1. **Token Evolution** (2 days)
   - Add new design tokens to `web/src/app/globals.css`
   - Add interaction timing tokens
   - Add accessibility tokens
   - Add density mode tokens
   - Validate token values against governance

2. **Badge Component Refinement** (1 day)
   - Validate no pulsing animations
   - Ensure sentence case usage
   - Validate contrast ratios
   - Test all status variations

3. **Button Component Refinement** (1 day)
   - Refine hover state timing (80-120ms)
   - Enhance focus ring visibility
   - Validate loading state styling
   - Test all button variants

4. **Workspace Layout Spacing** (1 day)
   - Update card padding (20-24px)
   - Update section gaps (24-32px)
   - Update row heights (40px default)
   - Validate surface differentiation

**Rollback Point**: After Phase 1, can revert token changes without affecting functionality.

**Validation**:
- [ ] Visual regression tests pass
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Governance compliance validated


### Phase 2: Interaction Refinements (Week 2)

**Objective**: Refine interaction states and feedback timing.

**Tasks**:
1. **Sidebar Navigation Refinement** (2 days)
   - Refine hover states (8% opacity change)
   - Enhance focus indicators
   - Validate touch targets (44px minimum)
   - Test keyboard navigation

2. **Form Interaction States** (2 days)
   - Refine input focus states
   - Add loading states to submit buttons
   - Enhance error state styling
   - Test form validation feedback

3. **Data Table Interaction** (1 day)
   - Refine row hover states
   - Validate cell padding (default: 12px/8px)
   - Test sticky header behavior
   - Validate scroll performance

**Rollback Point**: After Phase 2, can revert interaction changes without affecting data or logic.

**Validation**:
- [ ] Interaction tests pass
- [ ] Keyboard navigation works
- [ ] Touch targets validated
- [ ] Performance benchmarks met


### Phase 3: Accessibility Enhancements (Week 3)

**Objective**: Ensure full WCAG 2.1 AA compliance.

**Tasks**:
1. **Focus Indicator Enhancement** (2 days)
   - Enhance focus ring visibility (2px minimum)
   - Validate focus ring contrast (3:1 minimum)
   - Test keyboard navigation flow
   - Validate focus trap prevention

2. **ARIA Label Audit** (2 days)
   - Audit all interactive elements
   - Add missing ARIA labels
   - Validate screen reader announcements
   - Test with NVDA/JAWS/VoiceOver

3. **Contrast Validation** (1 day)
   - Audit all text contrast ratios
   - Fix any contrast failures
   - Validate status color contrast
   - Test in light and dark modes

**Rollback Point**: After Phase 3, can revert accessibility enhancements if issues arise.

**Validation**:
- [ ] Accessibility tests pass
- [ ] axe-core violations: 0
- [ ] Lighthouse accessibility score: 100
- [ ] Manual screen reader testing complete


### Phase 4: Performance Optimizations (Week 4)

**Objective**: Ensure performance remains optimal after visual changes.

**Tasks**:
1. **Transition Performance** (1 day)
   - Validate CSS transitions (not JS animations)
   - Measure transition timing
   - Optimize backdrop filters (max 2 concurrent)
   - Test scroll performance

2. **Lazy Loading Validation** (1 day)
   - Validate lazy loading boundaries
   - Test component bundle sizes
   - Optimize image loading
   - Validate virtual scrolling

3. **Debounce/Throttle Optimization** (1 day)
   - Validate search debounce (300ms)
   - Validate filter throttle (150ms)
   - Test interaction responsiveness
   - Measure performance metrics

4. **Final Performance Audit** (2 days)
   - Run Lighthouse audits
   - Measure Core Web Vitals
   - Test on low-end devices
   - Validate 60fps scroll

**Rollback Point**: After Phase 4, can revert performance optimizations if regressions occur.

**Validation**:
- [ ] Performance tests pass
- [ ] Lighthouse performance score: ≥90
- [ ] Core Web Vitals: All green
- [ ] 60fps scroll maintained


## Token Evolution Strategy

### New Tokens to Add

**Interaction Timing Tokens**:
```css
/* Add to web/src/app/globals.css */
:root {
  /* Interaction timing */
  --transition-fast: 80ms;
  --transition-standard: 120ms;
  --transition-expand: 150ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  
  /* Feedback timing */
  --feedback-instant: 100ms;
  --feedback-success-duration: 3000ms;
  --feedback-error-duration: 5000ms;
}
```

**Accessibility Tokens**:
```css
:root {
  /* Focus indicators */
  --focus-ring: 0 0 0 2px var(--surface-app), 0 0 0 4px var(--accent);
  --focus-ring-offset: 2px;
  --focus-ring-width: 2px;
  
  /* Touch targets */
  --min-touch-target: 44px;
  
  /* Contrast ratios (for reference) */
  --min-contrast-body: 4.5;
  --min-contrast-large: 3.0;
  --min-contrast-ui: 3.0;
}
```

**Density Mode Tokens**:
```css
:root {
  /* Default density */
  --density-default-row-height: 40px;
  --density-default-cell-padding-x: 12px;
  --density-default-cell-padding-y: 8px;
  --density-default-gap: 12px;
  
  /* Compact density */
  --density-compact-row-height: 36px;
  --density-compact-cell-padding-x: 8px;
  --density-compact-cell-padding-y: 6px;
  --density-compact-gap: 8px;
  
  /* Comfortable density */
  --density-comfortable-row-height: 48px;
  --density-comfortable-cell-padding-x: 16px;
  --density-comfortable-cell-padding-y: 12px;
  --density-comfortable-gap: 16px;
}
```

**AI Processing Tokens**:
```css
:root {
  /* AI processing states */
  --ai-processing-bg: rgba(99, 102, 241, 0.08);
  --ai-processing-fg: #4338ca;
  --ai-processing-border: rgba(99, 102, 241, 0.2);
  
  /* Confidence levels */
  --confidence-high-fg: #22c55e;
  --confidence-medium-fg: #f59e0b;
  --confidence-low-fg: #64748b;
}
```

### Token Usage Patterns

**Hover State Pattern**:
```tsx
<button className="transition-colors duration-[var(--transition-fast)] hover:bg-opacity-90">
  Button
</button>
```

**Focus State Pattern**:
```tsx
<button className="focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
  Button
</button>
```

**Density Mode Pattern**:
```tsx
<tr className={cn(
  density === "compact" && "h-[var(--density-compact-row-height)]",
  density === "default" && "h-[var(--density-default-row-height)]",
  density === "comfortable" && "h-[var(--density-comfortable-row-height)]"
)}>
  <td>Cell</td>
</tr>
```


## Interaction Architecture

### Hover State Patterns

**Standard Hover Pattern**:
```tsx
// Background opacity change (8%)
<button className={cn(
  "bg-surface-panel",
  "transition-colors duration-[80ms] ease-standard",
  "hover:bg-surface-panel/90"
)}>
  Hover me
</button>
```

**Accent Hover Pattern**:
```tsx
// Accent color hover
<button className={cn(
  "bg-accent text-white",
  "transition-colors duration-[100ms] ease-standard",
  "hover:bg-accent-hover"
)}>
  Primary action
</button>
```

**Ghost Hover Pattern**:
```tsx
// Transparent to subtle background
<button className={cn(
  "bg-transparent text-text-link",
  "transition-colors duration-[80ms] ease-standard",
  "hover:bg-surface-panel hover:text-text-link-hover"
)}>
  Ghost button
</button>
```

### Focus State Patterns

**Standard Focus Pattern**:
```tsx
// Focus ring with offset
<button className={cn(
  "focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
)}>
  Focus me
</button>
```

**Input Focus Pattern**:
```tsx
// Input with focus ring
<input className={cn(
  "border border-border-default",
  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
)} />
```

**Navigation Focus Pattern**:
```tsx
// Navigation item with focus
<Link className={cn(
  "focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
)}>
  Nav item
</Link>
```

### Loading State Patterns

**Button Loading Pattern**:
```tsx
// Button with loading spinner
<Button
  isBusy={isLoading}
  busyLabel="Saving..."
  disabled={isLoading}
>
  {isLoading && <Spinner className="mr-2 h-4 w-4" />}
  Save changes
</Button>
```

**Inline Loading Pattern**:
```tsx
// Inline loading indicator
{isLoading ? (
  <div className="flex items-center gap-2 text-sm text-text-secondary">
    <Spinner className="h-4 w-4 text-accent" />
    <span>Loading...</span>
  </div>
) : (
  <Content />
)}
```

**Skeleton Loading Pattern**:
```tsx
// Skeleton placeholder
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-surface-panel rounded w-3/4" />
  <div className="h-4 bg-surface-panel rounded w-1/2" />
</div>
```

### Transition Timing Standards

**Timing Guidelines**:
- **80ms** - Hover state changes (fast feedback)
- **100ms** - Button click feedback (instant feel)
- **120ms** - Standard state transitions (smooth)
- **150ms** - Expand/collapse animations (max)

**Easing Function**:
- **Standard**: `cubic-bezier(0.2, 0, 0, 1)` - Smooth, professional
- **NO bounce**: Avoid spring physics or bounce effects
- **NO slow**: Avoid 300ms+ transitions (feels sluggish)


## Accessibility Strategy

### Focus Indicator Implementation

**Focus Ring Requirements**:
- Minimum 2px visible border
- Minimum 3:1 contrast ratio against background
- 2px offset from element
- Indigo color (#6366f1)

**Implementation**:
```tsx
// Standard focus ring
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
  Button
</button>

// Inset focus ring (for navigation)
<Link className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset">
  Nav item
</Link>

// Custom focus ring color
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2">
  Delete
</button>
```

### Keyboard Navigation Patterns

**Tab Order**:
1. Primary navigation (sidebar)
2. Page header actions
3. Main content interactive elements
4. Secondary actions
5. Footer links

**Keyboard Shortcuts**:
- **Tab** - Move focus forward
- **Shift+Tab** - Move focus backward
- **Enter** - Activate button/link
- **Space** - Activate button, toggle checkbox
- **Escape** - Close modal/dropdown

**Implementation**:
```tsx
// Keyboard-accessible button
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Action
</button>

// Keyboard-accessible modal
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  onKeyDown={(e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }}
>
  {/* Modal content */}
</Modal>
```

### ARIA Label Requirements

**Button Labels**:
```tsx
// Icon-only button
<button aria-label="Close dialog">
  <XIcon className="h-5 w-5" />
</button>

// Button with visible text (no aria-label needed)
<button>
  Save changes
</button>
```

**Form Field Labels**:
```tsx
// Proper label association
<div>
  <label htmlFor="factory-name">Factory name</label>
  <input
    id="factory-name"
    type="text"
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? "factory-name-error" : undefined}
  />
  {hasError && (
    <p id="factory-name-error" className="text-sm text-status-danger-fg">
      Factory name is required
    </p>
  )}
</div>
```

**Image Alt Text**:
```tsx
// Informative image
<img
  src="/chart.png"
  alt="Steel batch production chart showing 120 batches completed in March 2024"
/>

// Decorative image
<img
  src="/decoration.png"
  alt=""
  role="presentation"
/>
```

### Contrast Validation Approach

**Contrast Requirements**:
- Body text (<18pt): 4.5:1 minimum
- Large text (≥18pt or ≥14pt bold): 3:1 minimum
- UI components: 3:1 minimum
- Status indicators: 3:1 minimum

**Validation Tools**:
- WebAIM Contrast Checker
- Chrome DevTools Contrast Ratio
- axe DevTools
- Lighthouse Accessibility Audit

**Implementation**:
```tsx
// High contrast text
<p className="text-text-primary"> {/* 4.5:1 contrast */}
  Primary body text
</p>

// Secondary text (still meets 4.5:1)
<p className="text-text-secondary"> {/* 4.5:1 contrast */}
  Secondary text
</p>

// Tertiary text (meets 3:1 for large text)
<p className="text-lg text-text-tertiary"> {/* 3:1 contrast, large text */}
  Tertiary text
</p>
```


## Performance Protection Strategy

### CSS Transition Usage

**Preferred Approach**: Use CSS transitions for all state changes (not JavaScript animations).

**Rationale**:
- GPU-accelerated
- Better performance
- Smoother animations
- Lower CPU usage

**Implementation**:
```tsx
// ✅ CORRECT - CSS transition
<button className="transition-colors duration-100 hover:bg-accent-hover">
  Button
</button>

// ❌ WRONG - JavaScript animation
<button
  onMouseEnter={() => {
    gsap.to(buttonRef.current, { backgroundColor: '#5558e3', duration: 0.1 });
  }}
>
  Button
</button>
```

**Transition Properties**:
- **Preferred**: `opacity`, `transform`, `background-color`, `color`
- **Avoid**: `width`, `height`, `top`, `left` (causes layout reflow)

### Lazy Loading Boundaries

**Lazy Loading Strategy**:
- Components >100KB: Lazy load
- Components <100KB: Bundle with page
- Images: Lazy load when >200px outside viewport
- Routes: Lazy load all route components

**Implementation**:
```tsx
// Lazy load heavy component
const HeavyChart = lazy(() => import('./HeavyChart'));

<Suspense fallback={<ChartSkeleton />}>
  <HeavyChart data={data} />
</Suspense>

// Lazy load image
<img
  src="/large-image.jpg"
  loading="lazy"
  alt="Description"
/>
```

### Virtual Scrolling Preservation

**Critical**: Do NOT break virtual scrolling in data tables.

**Validation**:
- Test tables with 1000+ rows
- Verify smooth scrolling (60fps)
- Ensure row height consistency
- Validate scroll position preservation

**Implementation**:
```tsx
// Virtual scrolling with consistent row height
<VirtualTable
  data={data}
  rowHeight={40} // Must be consistent
  overscan={5}
  className="h-[calc(100vh-200px)]" // Explicit height
>
  {(row) => <TableRow data={row} />}
</VirtualTable>
```

### Debounce/Throttle Patterns

**Debounce** (wait for user to stop typing):
```tsx
// Search input debounce (300ms)
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    performSearch(value);
  }, 300),
  []
);

<input
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search..."
/>
```

**Throttle** (limit execution frequency):
```tsx
// Filter throttle (150ms)
const throttledFilter = useMemo(
  () => throttle((filters: Filters) => {
    applyFilters(filters);
  }, 150),
  []
);

<FilterPanel
  onChange={throttledFilter}
/>
```

**Guidelines**:
- Search: 300ms debounce
- Filters: 150ms throttle
- Scroll handlers: 100ms throttle
- Resize handlers: 200ms throttle


## Rollback Strategy

### Safe Rollback Points per Phase

**Phase 1 Rollback** (Token additions):
```bash
# Revert token changes
git revert <phase-1-commit-hash>

# Validation
- Check no visual regressions
- Verify components still render
- Test in light and dark modes
```

**Phase 2 Rollback** (Interaction refinements):
```bash
# Revert interaction changes
git revert <phase-2-commit-hash>

# Validation
- Check hover states work
- Verify focus states visible
- Test keyboard navigation
```

**Phase 3 Rollback** (Accessibility enhancements):
```bash
# Revert accessibility changes
git revert <phase-3-commit-hash>

# Validation
- Check focus indicators visible
- Verify ARIA labels present
- Test screen reader compatibility
```

**Phase 4 Rollback** (Performance optimizations):
```bash
# Revert performance changes
git revert <phase-4-commit-hash>

# Validation
- Check scroll performance
- Verify lazy loading works
- Test transition timing
```

### Feature Flag Recommendations

**Feature Flags for Gradual Rollout**:
```typescript
// Feature flag configuration
const featureFlags = {
  'sprint2-workspace-layout': boolean;
  'sprint2-sidebar-refinement': boolean;
  'sprint2-ai-ux': boolean;
  'sprint2-interaction-polish': boolean;
  'sprint2-density-refinement': boolean;
  'sprint2-status-cleanup': boolean;
  'sprint2-accessibility': boolean;
  'sprint2-performance': boolean;
};

// Usage in components
{featureFlags['sprint2-workspace-layout'] ? (
  <ModernWorkspaceLayout />
) : (
  <LegacyWorkspaceLayout />
)}
```

**Rollout Strategy**:
1. Enable for internal team (10% traffic)
2. Enable for beta users (25% traffic)
3. Enable for all users (100% traffic)
4. Remove feature flag after 2 weeks of stability

### Monitoring Requirements

**Metrics to Monitor**:
1. **Error Rate** - Track JavaScript errors
2. **Performance** - Track Core Web Vitals
3. **Accessibility** - Track axe-core violations
4. **User Feedback** - Track support tickets
5. **Engagement** - Track user interactions

**Monitoring Tools**:
- Sentry for error tracking
- Google Analytics for user behavior
- Lighthouse CI for performance
- axe DevTools for accessibility

**Alert Thresholds**:
- Error rate increase >10%: Investigate
- Performance degradation >5%: Investigate
- Accessibility violations >0: Fix immediately
- Support tickets increase >20%: Investigate


## Risk Mitigation

### AppShell Stability Verification

**Verification Checklist**:
- [ ] `.factory-workstation-frame` has `overflow-y-auto`
- [ ] Page does NOT create scroll containers
- [ ] Flex children with scrolling have `min-h-0`
- [ ] Scroll containers have explicit height
- [ ] Sticky elements work correctly
- [ ] No horizontal scroll (unless intentional)

**Testing Procedure**:
```typescript
// AppShell stability test
test('AppShell scroll ownership preserved', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Verify scroll container
  const scrollContainer = await page.evaluate(() => {
    const frame = document.querySelector('.factory-workstation-frame');
    return {
      hasOverflow: window.getComputedStyle(frame).overflowY === 'auto',
      hasHeight: frame.clientHeight > 0,
    };
  });
  expect(scrollContainer.hasOverflow).toBe(true);
  expect(scrollContainer.hasHeight).toBeGreaterThan(0);
  
  // Verify page doesn't scroll
  const pageScroll = await page.evaluate(() => {
    return {
      htmlOverflow: window.getComputedStyle(document.documentElement).overflow,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
    };
  });
  expect(pageScroll.htmlOverflow).not.toBe('auto');
  expect(pageScroll.bodyOverflow).not.toBe('auto');
  
  // Verify sticky header
  await page.evaluate(() => window.scrollBy(0, 500));
  const stickyHeader = await page.evaluate(() => {
    const header = document.querySelector('.factory-workstation-topbar');
    const rect = header.getBoundingClientRect();
    return rect.top === 0;
  });
  expect(stickyHeader).toBe(true);
});
```

### Scroll Ownership Validation

**Validation Checklist**:
- [ ] Content scrolls within factory-workstation-frame
- [ ] Sidebar does NOT scroll with content
- [ ] Header does NOT scroll with content
- [ ] Tables scroll independently
- [ ] Modals scroll independently

**Testing Procedure**:
```typescript
// Scroll ownership test
test('Scroll ownership correct', async ({ page }) => {
  await page.goto('/steel/batches');
  
  // Scroll content
  await page.evaluate(() => {
    const frame = document.querySelector('.factory-workstation-frame');
    frame.scrollBy(0, 500);
  });
  
  // Verify sidebar didn't scroll
  const sidebarPosition = await page.evaluate(() => {
    const sidebar = document.querySelector('.app-sidebar');
    return sidebar.getBoundingClientRect().top;
  });
  expect(sidebarPosition).toBe(0);
  
  // Verify header didn't scroll
  const headerPosition = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    return header.getBoundingClientRect().top;
  });
  expect(headerPosition).toBe(0);
});
```

### Virtualization Integrity Checks

**Validation Checklist**:
- [ ] Virtual scrolling works with 1000+ rows
- [ ] Row heights are consistent
- [ ] Scroll position preserved on data updates
- [ ] 60fps scroll performance maintained

**Testing Procedure**:
```typescript
// Virtualization test
test('Virtual scrolling integrity', async ({ page }) => {
  await page.goto('/steel/batches');
  
  // Load large dataset
  await page.evaluate(() => {
    // Simulate 1000+ rows
    window.testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Batch ${i}`,
    }));
  });
  
  // Measure scroll performance
  const fps = await page.evaluate(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    return new Promise((resolve) => {
      const measureFPS = () => {
        const currentTime = performance.now();
        frameCount++;
        
        if (frameCount >= 60) {
          const elapsed = currentTime - lastTime;
          const fps = (frameCount / elapsed) * 1000;
          resolve(fps);
        } else {
          requestAnimationFrame(measureFPS);
        }
      };
      
      requestAnimationFrame(measureFPS);
      
      // Scroll during measurement
      const table = document.querySelector('.virtual-table');
      table.scrollBy(0, 1000);
    });
  });
  
  expect(fps).toBeGreaterThanOrEqual(60);
});
```

### Performance Regression Detection

**Metrics to Track**:
1. **Interaction Feedback** - <100ms
2. **Scroll Performance** - ≥60fps
3. **Transition Duration** - 80-120ms
4. **Bundle Size** - <5% increase
5. **Lazy Loading** - Components >100KB

**Detection Strategy**:
```typescript
// Performance regression test
test('No performance regressions', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Measure interaction feedback
  const feedbackTime = await page.evaluate(() => {
    const start = performance.now();
    const button = document.querySelector('[data-testid="save-button"]');
    button.click();
    return performance.now() - start;
  });
  expect(feedbackTime).toBeLessThan(100);
  
  // Measure bundle size
  const bundleSize = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(r => r.name.includes('main'))
      .reduce((sum, r) => sum + r.transferSize, 0);
  });
  expect(bundleSize).toBeLessThan(500000); // 500KB max
  
  // Measure scroll performance
  const scrollFPS = await page.evaluate(() => {
    // FPS measurement logic
  });
  expect(scrollFPS).toBeGreaterThanOrEqual(60);
});
```


## Summary

### Design Objectives Achieved

This technical design provides a **safe, component-level modernization strategy** for Sprint 2 that:

1. **Preserves Architecture** - No changes to AppShell, scroll ownership, routing, or backend contracts
2. **Uses Design Tokens** - All visual changes use existing or new design tokens
3. **Creates Reusable Primitives** - Shared interaction patterns for consistency
4. **Defines Safe Boundaries** - Modifies only visual layer (CSS, classes, tokens)
5. **Enables Incremental Rollout** - Phased changes with safe rollback points

### Key Design Decisions

**1. Token-Based Approach**
- All visual changes use design tokens
- Tokens defined in `web/src/app/globals.css`
- Components inherit tokens automatically
- Easy to update globally

**2. Component-Level Refinement**
- Modify only visual styling
- Preserve component logic
- Maintain props and behavior
- No breaking changes

**3. Phased Implementation**
- Phase 1: Low-risk visual updates (tokens, spacing)
- Phase 2: Interaction refinements (hover, focus, loading)
- Phase 3: Accessibility enhancements (focus rings, ARIA, contrast)
- Phase 4: Performance optimizations (transitions, lazy loading)

**4. Safe Rollback Strategy**
- Rollback points after each phase
- Feature flags for gradual rollout
- Monitoring for regression detection
- Clear validation checklists

### Implementation Readiness

**Ready to Implement**:
- ✅ Token evolution strategy defined
- ✅ Component modification boundaries clear
- ✅ Interaction patterns documented
- ✅ Accessibility strategy defined
- ✅ Performance protection strategy defined
- ✅ Testing strategy comprehensive
- ✅ Rollback strategy safe
- ✅ Risk mitigation thorough

**Next Steps**:
1. Review design with team
2. Get approval for token additions
3. Begin Phase 1 implementation
4. Execute phased rollout
5. Monitor metrics and user feedback

### Success Criteria

**Visual Quality**:
- Workspace feels calm and modern (not cyberpunk)
- Sidebar navigation is clear and accessible
- AI insights feel integrated and helpful
- Interactions are smooth and predictable
- Status indicators are clear and calm

**Technical Quality**:
- No architecture changes
- No breaking changes
- No performance regressions
- Full WCAG 2.1 AA compliance
- 100% governance compliance

**User Experience**:
- Operators feel more focused
- Managers trust the system more
- Admins navigate more easily
- New users find it more approachable
- All users benefit from accessibility

