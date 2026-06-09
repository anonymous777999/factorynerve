# Requirements Document

## Introduction

This document defines requirements for Sprint 3 of the DPR.ai (FactoryNerve OS) Frontend Modernization initiative. Sprint 3 is an **audit-driven** modernization effort: a systematic reconnaissance of the Next.js + React + TypeScript + Tailwind web frontend (`web/src`) that produces a structured audit report, which in turn drives a prioritized remediation effort.

Sprint 3 has two coupled goals captured in these requirements:

1. **Audit (reconnaissance + documentation)** — Inspect the frontend across 16 audit dimensions and produce a single authoritative audit report artifact with severity-ranked findings, inventories (token, font, spacing, z-index, animation, fragmentation), accessibility violations, and a prioritized fix roadmap.
2. **Remediation (outcomes the audit drives)** — Define the target end state for each dimension so the audit findings can be remediated against measurable, governance-aligned acceptance criteria.

**Builds on Sprint 2 (completed)**: Sprint 1 delivered the global style foundation (Inter typography, sentence case, indigo accent migration, surface simplification). Sprint 2 delivered component-level token additions, interaction polish, dark-mode surface tokens, density tokens, AI-native panel styling, accessibility passes (focus indicators, ARIA labels on icon-only buttons, keyboard nav, alt-text), and performance tokens. Sprint 3 does NOT re-do that work; it audits what remains fragmented, inconsistent, or non-compliant and drives convergence on the established design system.

**Governance authority**: Requirements MUST respect the governance doctrine under `.mcp/governance` — `color-philosophy.md` (single indigo #6366f1 accent, surface differentiation, status colors), `typography-rules.md` (Inter for UI, JetBrains Mono for code/IDs only, sentence case, operational size scale), `spacing-rhythm.md` (4px base scale, density modes), `appshell-doctrine.md` and `scroll-ownership.md` (AppShell owns page scroll), and `anti-patterns.md` / `forbidden-mutations.md`.

**Quality bar**: The frontend is judged against enterprise operational UX references (Linear, Retool, Vercel dashboard, Stripe Dashboard), not consumer apps.

**Critical constraint**: This is controlled modernization, NOT a redesign. Remediation MUST NOT break AppShell scroll ownership, routing, list virtualization, or backend/API contracts. Any change touching architecture-critical files (`app-shell.tsx`, design tokens, `globals.css`) requires the explicit approval process defined in `forbidden-mutations.md`.

## Glossary

- **Frontend**: The Next.js + React + TypeScript + Tailwind web application rooted at `web/src`.
- **Auditor**: The role (human or agent) performing the reconnaissance and authoring the Audit_Report.
- **Audit_Report**: The single Markdown deliverable artifact (`audit-report.md`) summarizing all findings, inventories, and the prioritized fix roadmap.
- **Audit_Dimension**: One of the 16 defined inspection areas (token system, typography, spacing, dark mode, data tables, sidebar, AppShell, forms, AI components, modals, loading/empty states, animation, accessibility, performance, consistency, screen audits).
- **Finding**: A single documented issue discovered during the audit, classified by severity (Critical, High, Medium, Low).
- **Severity**: The impact classification of a Finding — Critical (broken/blocking or accessibility blocker), High (significant inconsistency or standards violation), Medium (polish or convergence gap), Low (cosmetic/nice-to-have).
- **Design_Token**: A named, centralized design value (color, spacing, typography, timing, radius, shadow) defined in `globals.css` / the token layer rather than hardcoded in components.
- **Hardcoded_Value**: A color, spacing, or typographic value written as a literal (hex, rgb/rgba, arbitrary Tailwind bracket value, or inline style) instead of referencing a Design_Token.
- **Token_Gap**: A recurring Hardcoded_Value pattern for which no corresponding Design_Token currently exists and one should be created.
- **Governance_Doctrine**: The set of authoritative design and engineering rules under `.mcp/governance`.
- **AppShell**: The architecture-critical layout component (`web/src/components/app-shell.tsx`) that owns page scroll via `.factory-workstation-frame`.
- **Scroll_Ownership**: The doctrine that AppShell's `.factory-workstation-frame` is the single page scroll container and pages do not create page-level scroll containers.
- **Data_Table**: Any tabular data component (e.g. `operational-table.tsx`, `data-table/`, OCR review tables) rendering rows and columns.
- **Sidebar**: The primary navigation component (`web/src/components/app-sidebar.tsx`).
- **AI_Component**: Any component presenting AI/OCR output, confidence, or processing state (e.g. `smart-insights-panel.tsx`, `confidence-badge.tsx`, OCR components).
- **Modal**: Any overlay dialog component (e.g. `confirmation-modal.tsx`, `operational-drawer.tsx`).
- **Z_Index_Scale**: The standardized, named set of stacking-context levels (e.g. `z-sticky`, overlay, modal, toast) used across the Frontend.
- **Tabular_Numbers**: The `font-variant-numeric: tabular-nums` treatment for aligned numeric display.
- **WCAG_AA**: WCAG 2.1 Level AA conformance, specifically 4.5:1 contrast for body text and 3:1 for large text and UI components.
- **Prefers_Reduced_Motion**: The `prefers-reduced-motion` media query expressing a user preference to minimize animation.
- **Fix_Roadmap**: The prioritized, sequenced remediation plan section of the Audit_Report.
- **Enterprise_Reference**: The benchmark products (Linear, Retool, Vercel dashboard, Stripe Dashboard) defining the target quality bar.

---

## Requirements

### Requirement 1: Audit Report Artifact

**User Story:** As a frontend lead, I want a single structured audit report, so that modernization work is driven by documented, prioritized evidence rather than ad-hoc opinion.

#### Acceptance Criteria

1. THE Auditor SHALL produce an Audit_Report as a Markdown artifact at `.kiro/specs/frontend-modernization-sprint-3/audit-report.md`.
2. THE Audit_Report SHALL include an executive summary table containing exactly one row per Audit_Dimension for all 16 Audit_Dimensions, where each row records a health rating from the set {Healthy, Needs Attention, At Risk, Critical} and a separate count of Findings for each Severity value in {Critical, High, Medium, Low}.
3. THE Audit_Report SHALL contain dedicated sections for Critical Findings, High Findings, Medium Findings, and Low Findings, and SHALL place every Finding in the section matching its Severity.
4. THE Audit_Report SHALL contain a token gap inventory, a fragmentation map, an accessibility violation list, a z-index inventory, a font inventory, a spacing inventory, and an animation inventory.
5. THE Audit_Report SHALL contain a Fix_Roadmap that orders remediation items first by Severity in the precedence Critical, then High, then Medium, then Low, and within each Severity level orders prerequisite items before the items that depend on them.
6. WHEN documenting a Finding, THE Auditor SHALL record a unique Finding identifier, the Audit_Dimension, the affected file path or component name, the Severity, the governance rule or Enterprise_Reference standard violated, and a recommended remediation.
7. WHERE a Finding recommends a change to an architecture-critical file (`app-shell.tsx`, the design token layer, or `globals.css` structure), THE Audit_Report SHALL flag the Finding as requiring the approval process defined in `forbidden-mutations.md`.
8. THE Audit_Report SHALL classify every Finding with exactly one Severity value from the set {Critical, High, Medium, Low}.

### Requirement 2: Design Token System Audit and Convergence

**User Story:** As a developer, I want color, spacing, and typography values centralized as design tokens, so that visual changes are consistent and maintainable.

#### Acceptance Criteria

1. THE Auditor SHALL inventory all Hardcoded_Value instances of color (hex, rgb, rgba, hsl, hsla, named colors, arbitrary Tailwind bracket color values, and inline `style` color properties) across `web/src` and SHALL record each instance in the token gap inventory with its literal value, its format category, and the file paths where it occurs.
2. THE Auditor SHALL identify each Token_Gap, defined as a Hardcoded_Value color pattern that has no corresponding Design_Token and occurs in at least 2 distinct files or at least 3 total occurrences.
3. THE Frontend SHALL reference a Design_Token for every color it sets, except where a Hardcoded_Value is recorded as an approved exception with a documented justification in the Audit_Report token gap inventory.
4. THE Frontend SHALL use indigo #6366f1 as the single primary accent Design_Token for primary actions, links, focus states, and active states.
5. IF a component applies a forbidden accent color (warm orange #c56d2d, amber #ffb868, or teal #1f8a78) to an interactive accent property (foreground, background, border, focus, active, or hover), THEN THE Auditor SHALL record a Finding with Severity High.
6. WHEN the Auditor identifies a Token_Gap, THE Audit_Report SHALL record a proposed Design_Token name and value aligned with `color-philosophy.md`, `typography-rules.md`, or `spacing-rhythm.md`.
7. THE Frontend SHALL express background surfaces using surface Design_Tokens (app, shell, panel, card, elevated, overlay) rather than Hardcoded_Value backgrounds.

### Requirement 3: Typography Audit and Hierarchy Consistency

**User Story:** As an operator, I want consistent, readable typography, so that I can scan operational data quickly and trust the interface.

#### Acceptance Criteria

1. THE Auditor SHALL inventory every font-family, font-size, and font-weight value used in `web/src` and record them in the font inventory.
2. THE Frontend SHALL use the Inter font family for all UI text including labels, buttons, headings, and body text.
3. THE Frontend SHALL use the JetBrains Mono font family only for code snippets, technical identifiers, and timestamps.
4. IF UI label, button, or heading text is rendered in monospace, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.
5. WHEN displaying numeric data in a Data_Table, THE Frontend SHALL apply Tabular_Numbers.
6. THE Frontend SHALL render UI labels, buttons, and headings in sentence case, with UPPERCASE permitted only for acronyms, technical constants, and keyboard shortcuts.
7. IF UI text uses UPPERCASE outside the permitted exceptions, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.
8. THE Frontend SHALL map every text element to a defined size in the operational type scale (10, 11, 12, 13, 14, 16, 18, 22, 28 px) defined in `typography-rules.md`.
9. THE Frontend SHALL use only font weights 400, 500, and 600 for UI text.
10. IF a text element uses a font-size value not present in the operational type scale defined in `typography-rules.md`, THEN THE Auditor SHALL record a Finding with the affected file path and the off-scale value.
11. IF UI text uses a font weight other than 400, 500, or 600, THEN THE Auditor SHALL record a Finding with the affected file path and the forbidden weight.
12. IF UI text uses a font family other than Inter or JetBrains Mono, THEN THE Auditor SHALL record a Finding with the affected file path and the forbidden font family.

### Requirement 4: Spacing System Audit

**User Story:** As a developer, I want spacing values drawn from the 4px scale, so that the layout has consistent visual rhythm and density.

#### Acceptance Criteria

1. THE Auditor SHALL inventory every padding, margin, gap, and row-height value declared in component files under `web/src` and SHALL classify each value as system-aligned when it equals a value on the 4px base scale defined in `spacing-rhythm.md`, or as arbitrary when it does not (including arbitrary Tailwind bracket values and inline-style spacing values), recording each value in the spacing inventory.
2. THE Frontend SHALL set every padding, margin, and gap value to a value present on the 4px base scale defined in `spacing-rhythm.md`.
3. IF a component declares a spacing value that is not on the 4px base scale defined in `spacing-rhythm.md`, THEN THE Auditor SHALL record a Finding with the affected file path, the arbitrary value, and exactly one Severity value from {Critical, High, Medium, Low}.
4. THE Frontend SHALL use a Data_Table row height of 40px for default density, 36px for compact density, and 48px for comfortable density.
5. WHILE default density is active, THE Frontend SHALL set card and panel padding to a value from 20px to 24px inclusive.
6. WHEN the Auditor compares Data_Table density against card density at the same density level, THE Audit_Report SHALL record a density-mismatch Finding, with exactly one Severity value from {Critical, High, Medium, Low}, for each case where the Data_Table row height or cell vertical padding is below the value defined for that density in `spacing-rhythm.md` while the adjacent card padding conforms to that density.
7. THE Frontend SHALL use section gaps of 24px to 32px inclusive between major workspace sections.
8. WHILE compact density is active, THE Frontend SHALL set card and panel padding to 16px.
9. WHILE comfortable density is active, THE Frontend SHALL set card and panel padding to a value from 24px to 32px inclusive.

### Requirement 5: Dark Mode Audit

**User Story:** As a user working in low-light environments, I want a clean, readable dark mode, so that I can work comfortably without eye strain.

#### Acceptance Criteria

1. IF a component references Hardcoded_Value light-mode colors instead of dark-mode surface and text Design_Tokens, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.
2. WHILE dark mode is active, THE Frontend SHALL maintain a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text and UI components.
3. IF a text or UI element fails the dark-mode contrast threshold defined in criterion 2, THEN THE Auditor SHALL record a Finding with Severity Critical, the affected file path, and the measured contrast ratio.
4. WHILE dark mode is active, THE Frontend SHALL differentiate adjacent surface layers by a lightness difference of between 2% and 3%.
5. WHILE dark mode is active, THE Frontend SHALL use the same indigo #6366f1 accent Design_Token as light mode.
6. IF a dark-mode surface uses a colored radial gradient or a glow effect (blur radius greater than 4px or opacity greater than 30%), THEN THE Auditor SHALL record a Finding with Severity High.
7. WHILE dark mode is active, THE Frontend SHALL render background surfaces using the dark-mode surface Design_Tokens rather than pure black (#000000).
8. IF a dark-mode background surface uses pure black #000000, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.

### Requirement 6: Data Tables Audit

**User Story:** As an operator, I want consistent, dense, readable data tables, so that I can review manufacturing data efficiently.

#### Acceptance Criteria

1. THE Auditor SHALL inventory all Data_Table implementations and record, for each, the presence or absence of sticky headers, column alignment, hover states, selected states, sort indicators, empty states, loading states, virtualization, Tabular_Numbers, and overflow handling.
2. WHEN a Data_Table scrolls vertically within its own scroll container, THE Data_Table SHALL keep its header row visible using sticky positioning.
3. THE Data_Table SHALL right-align numeric columns and left-align text columns.
4. WHEN a user hovers over a Data_Table row, THE Data_Table SHALL apply a background change of 5-15% opacity within 80-120ms.
5. WHEN a row is selected, THE Data_Table SHALL indicate the selected state with an indigo-accent-derived background that is distinguishable from both the default row background and the hover row background.
6. WHERE a column is sortable, THE Data_Table SHALL display a sort indicator that distinguishes the ascending, descending, and unsorted states.
7. WHEN a Data_Table has no rows, THE Data_Table SHALL display an empty state with guidance text describing the next action the operator can take rather than a blank area.
8. WHILE a Data_Table is loading, THE Data_Table SHALL display a skeleton placeholder whose row height and column widths match the final rendered rows so that no layout shift occurs on data arrival.
9. WHERE a Data_Table renders more than 50 rows, THE Data_Table SHALL use list virtualization to render only the rows within the visible viewport.
10. WHEN a Data_Table sets a sticky header z-index, THE Data_Table SHALL use a value from the standardized Z_Index_Scale.
11. THE Auditor SHALL preserve existing virtualization behavior and SHALL record any remediation that would alter virtualization as requiring the approval process defined in `forbidden-mutations.md`.
12. WHERE Data_Table cell content exceeds the column width, THE Data_Table SHALL truncate the content with an ellipsis or wrap it within the cell rather than causing horizontal page overflow.

### Requirement 7: Sidebar and Navigation Audit

**User Story:** As a user, I want calm, clear navigation, so that I can move between sections without visual noise.

#### Acceptance Criteria

1. THE Auditor SHALL inventory the Sidebar visual weight, active state, hover state, item alignment, grouping, expanded width, and label typography, and record findings against `Enterprise_Reference` standards.
2. THE Sidebar SHALL use an expanded width between 220px and 260px.
3. THE Sidebar SHALL render navigation labels at a font size of 13px or 14px in the Inter font family.
4. WHEN a route is active, THE Sidebar SHALL indicate the active state on exactly the one navigation item whose target matches the active route, using the indigo accent Design_Token with a font weight of 500 or 600.
5. WHEN a user hovers over a non-active navigation item, THE Sidebar SHALL apply a background change of 5-10% opacity within 80-120ms.
6. THE Sidebar SHALL render navigation labels in sentence case.
7. THE Sidebar SHALL render navigation icons at a uniform size and align all navigation labels to a common left text-start edge across every navigation group.
8. IF the Sidebar uses UPPERCASE labels or monospace label text outside permitted exceptions, THEN THE Auditor SHALL record a Finding with the affected line reference.
9. WHEN a navigation item receives keyboard focus, THE Sidebar SHALL display a visible focus indicator with a contrast ratio of at least 3:1 against the adjacent background.

### Requirement 8: AppShell and Layout Audit

**User Story:** As a developer, I want layout scroll ownership and surface layering preserved and correct, so that the application layout stays stable across all routes.

#### Acceptance Criteria

1. THE Auditor SHALL verify that AppShell's `.factory-workstation-frame` retains the `overflow-y-auto` Scroll_Ownership behavior and record the result in the Audit_Report.
2. IF a page component creates a page-level scroll container (a container with `overflow-y-auto` or `overflow-y-scroll` spanning the page content region, excluding permitted Data_Table, Modal, drawer, and dropdown scroll containers) that competes with AppShell Scroll_Ownership, THEN THE Auditor SHALL record a Finding with Severity Critical.
3. WHERE a flex child component scrolls, THE Frontend SHALL include the `min-h-0` class on that flex child.
4. WHERE a component uses sticky positioning, THE Frontend SHALL ensure the sticky element resides within a scroll container that has an explicitly set height rather than an implicit content-derived height.
5. THE Frontend SHALL assign the sticky header stacking level from the standardized Z_Index_Scale.
6. THE Auditor SHALL record any Finding that recommends modifying AppShell scroll architecture as requiring the approval process in `forbidden-mutations.md`.
7. THE Frontend SHALL express layout surface layers (app, shell, panel, card) using surface Design_Tokens that differ by at least 2% lightness between adjacent surface layers.
8. THE Auditor SHALL verify that no remediation introduces horizontal overflow at the 375px, 768px, and 1440px viewport widths.
9. IF AppShell's `.factory-workstation-frame` loses its `overflow-y-auto` Scroll_Ownership behavior, THEN THE Auditor SHALL record a Finding with Severity Critical.
10. IF remediation introduces horizontal overflow at the 375px, 768px, or 1440px viewport width, THEN THE Auditor SHALL record a Finding with Severity High and the affected viewport width.

### Requirement 9: Forms and Inputs Audit

**User Story:** As an operator, I want consistent, accessible form controls, so that data entry is fast and error-free.

#### Acceptance Criteria

1. THE Auditor SHALL inventory input, textarea, select, and button components and record height, focus state, error state, disabled state, and loading state coverage.
2. THE Frontend SHALL render text input and select control heights consistently within the 32px to 36px range for default density.
3. WHEN an input receives keyboard focus, THE Frontend SHALL display a focus indicator that is at least 2px thick and has a contrast ratio of at least 3:1 against the adjacent background.
4. WHEN a field fails validation, THE Frontend SHALL display an error state with a red (#ef4444) indicator and a text error message identifying the affected field.
5. WHILE a control is disabled, THE Frontend SHALL display the control with reduced opacity in the 40% to 60% range, apply a not-allowed cursor, and prevent pointer and keyboard interaction with the control.
6. WHILE a submit button is in a loading state, THE Frontend SHALL display a spinner in the indigo accent Design_Token and prevent additional form submissions until the operation completes or fails.
7. THE Frontend SHALL render primary, secondary, and destructive buttons with styles that are visually distinguishable from one another, where the primary action uses the indigo accent Design_Token.
8. IF an icon-only button lacks an accessible label, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.
9. WHEN a field fails validation, THE Frontend SHALL retain the value the user entered in that field rather than clearing it.

### Requirement 10: AI Components Audit

**User Story:** As an operator, I want AI features to feel like trustworthy infrastructure, so that I rely on AI assistance with confidence rather than treating it as a gimmick.

#### Acceptance Criteria

1. THE Auditor SHALL inventory all AI_Component instances and record confidence indicator presence, processing state styling, error state styling, AI-versus-human distinction, and accent consistency.
2. WHEN an AI_Component displays a confidence level, THE AI_Component SHALL present it using a text label (High, Medium, Low) together with a color-coded indicator (green #22c55e for High, amber #f59e0b for Medium, slate #64748b for Low).
3. WHILE an AI_Component is processing, THE AI_Component SHALL display a static or single-cycle indigo (#4338ca) indicator without pulsing, looping, or glow effects.
4. IF AI processing fails, THEN THE AI_Component SHALL display an error state with a red indicator and an error message that states the failure and the next step the operator can take.
5. WHEN AI processing fails, THE AI_Component SHALL retain any user-entered content rather than clearing it.
6. THE AI_Component SHALL visually distinguish AI-generated content from user-entered content using surface differentiation.
7. THE AI_Component SHALL use the indigo #6366f1 accent Design_Token consistently for AI-related interactive elements.
8. IF an AI_Component uses a pulsing animation, a looping animation, or a glow effect (shadow blur radius greater than 4px or opacity greater than 30%), THEN THE Auditor SHALL record a Finding with Severity High.

### Requirement 11: Modals and Dialogs Audit

**User Story:** As a user, I want predictable, accessible dialogs, so that focused tasks are easy to complete and dismiss.

#### Acceptance Criteria

1. THE Auditor SHALL inventory all Modal implementations and record focus trap, backdrop, escape-to-close, click-outside-to-close, scroll lock, open animation duration, size consistency, and stacking behavior.
2. WHILE a Modal is open, THE Modal SHALL confine keyboard focus to the focusable elements within the topmost open Modal, such that Tab from the last focusable element moves focus to the first, Shift+Tab from the first focusable element moves focus to the last, and focus does not reach elements outside that Modal.
3. WHEN a user presses the Escape key while a Modal is open, THE Modal SHALL close, except where the Modal is documented in the Audit_Report as requiring an explicit action to dismiss.
4. WHEN a user clicks outside the Modal content on the backdrop, THE Modal SHALL close, except where the Modal is documented in the Audit_Report as requiring an explicit action to dismiss.
5. WHILE a Modal is open, THE Frontend SHALL prevent the background content behind the Modal from scrolling.
6. WHEN a Modal opens, THE Modal SHALL complete its entrance animation within 150ms.
7. THE Frontend SHALL render every Modal using exactly one size variant drawn from a defined, finite set of named Modal size variants documented in the Audit_Report, and SHALL NOT apply a Hardcoded_Value width outside that named set.
8. WHEN multiple Modals stack, THE Frontend SHALL assign each Modal layer and its backdrop a stacking level from the standardized Z_Index_Scale.
9. WHEN a Modal opens, THE Modal SHALL set initial keyboard focus to the first focusable element within the Modal, or to the Modal container itself when the Modal contains no focusable element.
10. WHEN a Modal closes, THE Modal SHALL return keyboard focus to the element that held focus immediately before the Modal opened.
11. WHILE Prefers_Reduced_Motion is set, WHEN a Modal opens, THE Modal SHALL display in its final state without an entrance animation.

### Requirement 12: Loading and Empty States Audit

**User Story:** As an operator, I want clear loading and empty states, so that I always understand system status and what to do next.

#### Acceptance Criteria

1. THE Auditor SHALL inventory loading states and empty states across all data views (screens or regions that render asynchronously fetched data) and record, for each, whether it uses a skeleton placeholder, a spinner, or no indicator.
2. WHILE content is loading in a layout region, THE Frontend SHALL display a skeleton placeholder that occupies the same region dimensions as the final content and reserves layout space such that adjacent content does not move when data arrives.
3. THE Frontend SHALL reserve spinner indicators for indeterminate operations expected to complete within 1 second (1000 ms) rather than for full-region content loading.
4. WHEN a data view has no content, THE Frontend SHALL display an empty state containing a message that identifies the empty condition and at least one actionable next step the operator can take.
5. WHERE a data region can fail to load, THE Frontend SHALL wrap the region in an error boundary that renders an error state containing a message indicating the load failed and a visible retry control.
6. IF a loading state shifts the position of adjacent visible content by more than 4px when data arrives, THEN THE Auditor SHALL record a Finding with the affected component file path.
7. WHEN the operator activates the retry control on an error state, THE Frontend SHALL re-attempt the data load for the affected region without requiring a full page reload.

### Requirement 13: Animation and Interaction Audit

**User Story:** As a user, I want fast, functional motion, so that the interface feels responsive and professional rather than gimmicky.

#### Acceptance Criteria

1. THE Auditor SHALL inventory all transitions and animations across `web/src` and record duration, easing, and trigger in the animation inventory.
2. THE Frontend SHALL limit state-change transitions (hover, focus, active) to a maximum of 200ms.
3. THE Frontend SHALL limit expand and collapse animations to a maximum of 150ms.
4. IF a component uses a bounce, spring, or infinite pulse animation, THEN THE Auditor SHALL record a Finding with Severity High.
5. IF an interaction changes application state without producing a visual change (background, color, border, opacity, position, or an explicit status indicator) within 200ms, THEN THE Auditor SHALL record a Finding with Severity Medium and the affected file path.
6. WHILE Prefers_Reduced_Motion is set, THE Frontend SHALL disable decorative and looping animations including bounce, spring, pulse, parallax, and auto-playing motion.
7. THE Frontend SHALL use CSS transitions for state changes rather than JavaScript-driven animation.
8. WHILE Prefers_Reduced_Motion is set, THE Frontend SHALL limit any remaining transition or animation to a maximum of 100ms.

### Requirement 14: Accessibility Audit

**User Story:** As a user with accessibility needs, I want the interface to meet WCAG AA, so that I can operate the system effectively.

#### Acceptance Criteria

1. THE Auditor SHALL inventory accessibility violations including keyboard inaccessibility, missing ARIA or semantic HTML, missing alt text, and color contrast failures, and record each in the accessibility violation list.
2. IF an element has an `onClick` handler but cannot be focused via the Tab key or cannot be activated via the Enter or Space key, THEN THE Auditor SHALL record a Finding with Severity Critical.
3. THE Frontend SHALL use semantic HTML elements for interactive controls rather than non-semantic elements with click handlers.
4. THE Frontend SHALL provide descriptive alt text for images that convey information and SHALL mark purely decorative images as decorative to assistive technologies.
5. THE Frontend SHALL maintain a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text and UI components.
6. THE Frontend SHALL make all interactive elements operable using Tab, Shift+Tab, Enter, Space, and Escape keys as appropriate to the control.
7. WHEN a user navigates with the keyboard, THE Frontend SHALL display a visible focus indicator with at least 3:1 contrast against the adjacent background on the focused element.
8. WHERE a non-semantic element handles a user interaction, THE Frontend SHALL assign it an appropriate ARIA role, include it in the keyboard tab order, and provide Enter or Space key activation.
9. IF a body text element falls below a 4.5:1 contrast ratio, or a large text element or UI component falls below a 3:1 contrast ratio, THEN THE Auditor SHALL record a Finding with Severity Critical.
10. IF an image that conveys information lacks descriptive alt text, THEN THE Auditor SHALL record a Finding with Severity High and the affected file path.

### Requirement 15: Performance Audit

**User Story:** As a user, I want fast load and smooth interaction, so that the interface stays responsive under operational load.

#### Acceptance Criteria

1. THE Auditor SHALL inventory bundle composition and SHALL record each third-party dependency that contributes more than 50 KB gzipped to the production bundle in the Audit_Report.
2. WHERE an animation library is used only for effects achievable with CSS (fade, slide, scale, color, or opacity), THE Auditor SHALL record a Finding that recommends replacement with CSS and identifies the affected component.
3. IF a component passes a newly-allocated inline object, array, or function literal as a prop on every render, THEN THE Auditor SHALL record a Finding with the affected component and the prop name.
4. WHERE a list renders more than 50 items, THE Frontend SHALL use virtualization to render only the items visible within the scroll viewport.
5. THE Auditor SHALL record any performance remediation that would alter existing virtualization or data-fetching behavior as a Finding requiring the approval process defined in `forbidden-mutations.md`.
6. THE Frontend SHALL use CSS transitions rather than JavaScript animation for visual state changes.
7. WHEN a user interacts with an interactive element, THE Frontend SHALL begin a visible response within 100ms.

### Requirement 16: Consistency and Fragmentation Audit

**User Story:** As a developer, I want fragmentation and duplication mapped, so that the codebase converges on a single set of components and conventions.

#### Acceptance Criteria

1. THE Auditor SHALL produce a fragmentation map that records, for each group of two or more component implementations that serve the same UI purpose and differ only in styling or minor prop variations (for example multiple card, button, or table variants), the shared purpose, the file path of every variant in the group, and the count of variants in the group.
2. THE Auditor SHALL document in the Audit_Report a single expected naming convention for component names and for prop names, and SHALL record each component name or prop name that deviates from that documented convention together with its affected file path.
3. THE Auditor SHALL produce a z-index inventory that lists every stacking value used across `web/src` together with the file path of each occurrence, and SHALL propose a standardized Z_Index_Scale that defines one named level for each required stacking context.
4. THE Frontend SHALL assign stacking contexts using named levels from the standardized Z_Index_Scale rather than arbitrary numeric z-index values.
5. THE Auditor SHALL record in the Audit_Report the project's standard responsive breakpoint set, and SHALL record each component that uses a responsive breakpoint diverging from that standard set together with the affected file path and the divergent breakpoint value.
6. WHEN the Auditor identifies a group of duplicate or near-duplicate implementations, THE Audit_Report SHALL recommend a single canonical component for that group and SHALL list the file path of every call site that must migrate to the canonical component.

### Requirement 17: Specific Screen Audits

**User Story:** As a frontend lead, I want representative screens deep-audited end to end, so that the audit captures real workflow context, not just component-level issues.

#### Acceptance Criteria

1. THE Auditor SHALL audit at least one dashboard or overview screen and SHALL record, for each applicable Audit_Dimension, either the Findings discovered or an explicit "no Finding" or "not applicable" determination.
2. THE Auditor SHALL audit at least one data-entry or forms screen and SHALL record, for each applicable Audit_Dimension, either the Findings discovered or an explicit "no Finding" or "not applicable" determination.
3. THE Auditor SHALL audit at least one table or list screen and SHALL record, for each applicable Audit_Dimension, either the Findings discovered or an explicit "no Finding" or "not applicable" determination.
4. THE Auditor SHALL audit the OCR verification side-by-side screen and SHALL record, for each applicable Audit_Dimension, either the Findings discovered or an explicit "no Finding" or "not applicable" determination.
5. WHEN auditing each screen, THE Auditor SHALL record the screen's file path and, for each Finding, the Severity and the specific governance rule or Enterprise_Reference standard it violates.
6. THE Auditor SHALL evaluate each audited screen against the Enterprise_Reference quality bar and SHALL record an overall health rating drawn from the same rating set used in the Audit_Report executive summary table, together with that screen's count of Findings by Severity.
7. WHEN auditing each screen, THE Auditor SHALL record the screen's primary user workflow.
8. WHEN auditing each screen, THE Auditor SHALL evaluate the screen in its populated, loading, empty, and error states.
9. IF an audited screen is missing a loading, empty, or error state, or presents one inconsistently with the relevant Audit_Dimension criteria, THEN THE Auditor SHALL record a Finding with the affected file path and Severity.

### Requirement 18: Remediation Safety and Governance Boundaries

**User Story:** As a frontend lead, I want remediation bounded by governance, so that modernization does not break architecture or contracts.

#### Acceptance Criteria

1. THE Frontend SHALL retain `.factory-workstation-frame` as the single page scroll container with `overflow-y-auto` and no competing page-level scroll container through all remediation work.
2. THE Frontend SHALL resolve every route that existed before remediation to the same destination component after remediation, with no removed or broken paths.
3. THE Frontend SHALL retain virtualization for every list and Data_Table that rendered more than 50 items with virtualization before remediation.
4. THE Frontend SHALL preserve existing backend and API contracts through all remediation work, changing no endpoint called, no request parameter sent, and no response field consumed.
5. WHEN a remediation requires changing an architecture-critical file (`app-shell.tsx`, the design token layer, or `globals.css` structure), THE remediation SHALL NOT be applied until the approval process defined in `forbidden-mutations.md` is recorded as complete.
6. IF a proposed remediation would introduce a pattern forbidden by `anti-patterns.md` or `forbidden-mutations.md`, THEN THE remediation SHALL be rejected without being applied and an alternative SHALL be recorded in the Audit_Report.
7. WHEN a remediation is completed, THE Frontend SHALL be verified to still satisfy criteria 1 through 4 before the remediation is marked complete.
8. IF a completed remediation is found to violate any of criteria 1 through 4, THEN the remediation SHALL be reverted and a Finding SHALL be recorded in the Audit_Report.
