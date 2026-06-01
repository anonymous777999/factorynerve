# Implementation Plan: Frontend Modernization Sprint 3 — Audit-Driven Convergence

## Overview

This plan implements Sprint 3 as two coupled bodies of work, exactly as the design describes:

1. **Audit engine (Phase 1)** — a set of pure, deterministic TypeScript functions (scanners,
   classifiers, auditors, aggregators, report emitter) that walk `web/src`, the governance
   ruleset, and structured observations to produce a single generated artifact,
   `audit-report.md`. Because these are pure functions over file content, they are the
   property-testable core and carry the 28 correctness properties from the design.
2. **Remediation (Phase 2)** — governance-bounded visual/architectural convergence driven by the
   Fix_Roadmap, guarded by the remediation safety harness, and verified with integration,
   snapshot, and smoke tests rather than property tests.

**Implementation language**: TypeScript / TSX (matches the design's data models and the project's
existing Vitest test stack).

**Audit engine location**: `web/scripts/audit/` (consistent with existing tooling such as
`web/scripts/audit-mobile-overflow.mjs` and the `.tmp/a11y-*.mjs` scanners). Generated artifact
lands at `.kiro/specs/frontend-modernization-sprint-3/audit-report.md`.

**Test stack**: `fast-check` + Vitest (node environment) for the audit-engine property/unit tests;
Vitest + Testing Library (jsdom) and Playwright for remediation integration tests; Storybook
snapshot/visual-regression for token-driven changes. Run unit/property tests with `vitest --run`.

**Critical constraints (carried from the design)**:
- Controlled modernization, NOT a redesign.
- AppShell scroll ownership (`.factory-workstation-frame` keeps `overflow-y-auto`), routing,
  TanStack Virtual virtualization, and backend/API contracts MUST be preserved.
- Any change to an architecture-critical file (`app-shell.tsx`, `web/src/styles/tokens.css`,
  `globals.css` structure) is approval-gated per `.mcp/governance/engineering/forbidden-mutations.md`
  and must be flagged in the report.

---

## Tasks

- [ ] 1. Set up audit engine foundation and test tooling
  - [ ] 1.1 Create audit module structure and core data-model types
    - Create `web/scripts/audit/` with `scanners/`, `classifiers/`, `auditors/`, `aggregators/`, `safety/`, `__tests__/`
    - Implement `types.ts` with all design data models: `Severity`, `HealthRating`, `AuditDimensionId` (exactly 16), `Testability`, `ColorFormat`, `Finding`, `ColorObservation`, `TokenGap`, `FontObservation`, `SpacingObservation`, `ZIndexEntry`, `AnimationEntry`, `AccessibilityViolation`, `FragmentationGroup`, `ZIndexScale`, `DimensionSummaryRow`, `ExecutiveSummary`, `ScreenAudit`, `RoadmapItem`, `FixRoadmap`, `SafetySnapshot`, `SafetyResult`
    - Define the severity-precedence constant (Critical 0 < High 1 < Medium 2 < Low 3)
    - _Requirements: 1.6, 1.8_

  - [ ]* 1.2 Add fast-check and configure a node-environment Vitest project for audit-engine tests
    - Add `fast-check` to `web/package.json` devDependencies (pinned version)
    - Add a non-browser Vitest project (node environment) that includes `web/scripts/audit/**/*.test.ts`, separate from the existing Storybook browser project
    - Add a `test:audit` script (`vitest --run --project audit`)
    - _Requirements: (test infrastructure for design Testing Strategy)_

  - [ ] 1.3 Implement Finding factory and validator
    - Implement `finding.ts` with a constructor that enforces non-empty id/location/violatedStandard/recommendation, a valid `AuditDimensionId`, exactly one `Severity`, and an `approvalRequired` flag
    - Provide a validator usable by aggregators and screen audits
    - _Requirements: 1.6, 1.8, 17.5_

  - [ ]* 1.4 Write property test for Finding well-formedness
    - **Property 1: Finding well-formedness**
    - **Validates: Requirements 1.6, 1.8, 17.5**

- [ ] 2. Implement source-tree scanners
  - [ ] 2.1 Implement color scanner
    - `scanners/color-scanner.ts` → `scanColors(files): ColorObservation[]`
    - Detect hex, rgb(a), hsl(a), named colors, arbitrary Tailwind bracket color values, inline `style` color properties; record literal, format category, distinct files, occurrence count, and whether applied to an accent property
    - _Requirements: 2.1_

  - [ ] 2.2 Implement typography scanner
    - `scanners/typography-scanner.ts` → `scanTypography(files): FontObservation[]`
    - Record every font-family, font-size, font-weight with usage context (label/button/heading/body/code/id/timestamp/other)
    - _Requirements: 3.1_

  - [ ] 2.3 Implement spacing scanner
    - `scanners/spacing-scanner.ts` → `scanSpacing(files): SpacingObservation[]`
    - Record every padding/margin/gap/row-height value with resolved pixels (or null), including arbitrary bracket and inline-style values
    - _Requirements: 4.1_

  - [ ] 2.4 Implement z-index scanner
    - `scanners/zindex-scanner.ts` → emit `ZIndexEntry[]` recording each stacking value, whether it references a named `--z-*` level, and the files it occurs in
    - _Requirements: 16.3_

  - [ ] 2.5 Implement animation scanner
    - `scanners/animation-scanner.ts` → emit `AnimationEntry[]` recording duration, easing, trigger, and any forbidden kind (bounce/spring/infinite-pulse/glow)
    - _Requirements: 13.1_

  - [ ] 2.6 Implement accessibility scanner
    - `scanners/a11y-scanner.ts` → emit raw a11y observations (keyboard handlers, ARIA/semantic HTML, alt text, contrast inputs); reuse/extend logic from `.tmp/a11y-*.mjs`
    - _Requirements: 14.1_

  - [ ] 2.7 Implement fragmentation scanner
    - `scanners/fragmentation-scanner.ts` → tag components by UI purpose and collect candidate variant groups, component/prop names, and responsive-breakpoint usages
    - _Requirements: 16.1_

  - [ ]* 2.8 Write property test for scanner completeness and round-trip recovery
    - **Property 6: Scanner completeness and round-trip recovery**
    - **Validates: Requirements 2.1, 3.1, 13.1, 16.3**

  - [ ]* 2.9 Write unit test for scanner diagnostics on unreadable / non-resolvable input
    - Assert unreadable files produce a `scan-error` entry and are skipped; non-resolvable values are recorded with `pixels: null` / `isNamedLevel: false` and classified conservatively
    - _Requirements: 2.1, 4.1 (Error Handling)_

- [ ] 3. Checkpoint - scanners
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement token, typography, and spacing classifiers
  - [ ] 4.1 Implement token-gap detector and forbidden-accent flagger
    - `classifiers/token-gap.ts` → `detectTokenGaps(observations): TokenGap[]` (no token AND ≥2 distinct files OR ≥3 total occurrences), each with a proposed governance-aligned token name/value
    - `classifiers/forbidden-accent.ts` → `flagForbiddenAccents(observations): Finding[]` for warm orange `#c56d2d`, amber `#ffb868`, teal `#1f8a78` on accent properties (High)
    - _Requirements: 2.2, 2.5, 2.6_

  - [ ]* 4.2 Write property test for token-gap detection threshold
    - **Property 7: Token-gap detection threshold**
    - **Validates: Requirements 2.2, 2.6**

  - [ ]* 4.3 Write property test for forbidden-accent classification
    - **Property 8: Forbidden-accent classification**
    - **Validates: Requirements 2.5**

  - [ ] 4.4 Implement typography classifier
    - `classifiers/typography-classifier.ts` → `classifyFontFinding(obs, governance): Finding | null` for monospace UI text (High), UPPERCASE outside exceptions (High), off-scale sizes, forbidden weights (≠400/500/600), forbidden families (≠Inter/JetBrains Mono); each Finding records the offending value and file/line
    - _Requirements: 3.4, 3.7, 3.10, 3.11, 3.12, 7.8_

  - [ ]* 4.5 Write property test for typography classifier
    - **Property 9: Typography classifier records offending values**
    - **Validates: Requirements 3.4, 3.7, 3.10, 3.11, 3.12, 7.8**

  - [ ] 4.6 Implement spacing classifier and density-mismatch detector
    - `classifiers/spacing-classifier.ts` → `classifySpacingValue(value, scale)` (system-aligned iff on the 4px scale) and arbitrary-value Findings
    - `classifiers/density-mismatch.ts` → `detectDensityMismatch(tableMetrics, cardMetrics, density): Finding | null`
    - _Requirements: 4.1, 4.3, 4.6_

  - [ ]* 4.7 Write property test for spacing classification and off-scale findings
    - **Property 10: Spacing classification and off-scale findings**
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 4.8 Write property test for density-mismatch detection
    - **Property 11: Density-mismatch detection**
    - **Validates: Requirements 4.6**

- [ ] 5. Implement contrast, dark-mode, and forbidden-visual classifiers
  - [ ] 5.1 Implement contrast computation utility
    - `classifiers/contrast.ts` → symmetric ratio in `[1, 21]`, equals 1 for identical colors
    - _Requirements: 5.3, 14.9_

  - [ ] 5.2 Implement dark-mode classifier
    - `classifiers/dark-mode.ts` → hardcoded light-mode color in dark context (High), and contrast classification (Critical with measured ratio when body < 4.5:1 or large/UI < 3:1)
    - _Requirements: 5.1, 5.3, 14.9_

  - [ ]* 5.3 Write property test for contrast computation and classification
    - **Property 12: Contrast computation and contrast classification**
    - **Validates: Requirements 5.3, 14.9**

  - [ ]* 5.4 Write property test for hardcoded light-mode color in dark context
    - **Property 14: Hardcoded light-mode color in dark context**
    - **Validates: Requirements 5.1**

  - [ ] 5.5 Implement forbidden-visual / forbidden-motion classifier
    - `classifiers/forbidden-visual.ts` → High Finding for colored radial gradient, glow (blur >4px or opacity >30%), pure-black `#000000` dark background, bounce/spring animation, or infinite/looping pulse
    - _Requirements: 5.6, 5.8, 10.8, 13.4_

  - [ ]* 5.6 Write property test for forbidden-visual / forbidden-motion classification
    - **Property 13: Forbidden-visual / forbidden-motion classification**
    - **Validates: Requirements 5.6, 5.8, 10.8, 13.4**

- [ ] 6. Checkpoint - classifiers
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement dimension auditors (sidebar, AppShell, forms, AI, modals)
  - [ ] 7.1 Implement sidebar auditor and active-nav helper
    - `auditors/sidebar.ts` → inventory visual weight/active/hover/alignment/grouping/width/label typography; pure `activeNavItems(items, route)` helper marking exactly one active item styled with the indigo accent + weight 500/600
    - _Requirements: 7.1, 7.4_

  - [ ]* 7.2 Write property test for exactly one active navigation item per route
    - **Property 15: Exactly one active navigation item per route**
    - **Validates: Requirements 7.4**

  - [ ] 7.3 Implement AppShell / layout auditor
    - `auditors/appshell.ts` → verify `.factory-workstation-frame` retains `overflow-y-auto`; detect page-level competing scroll containers (Critical) excluding permitted Data_Table/Modal/drawer/dropdown; flag AppShell-architecture recommendations as approval-required
    - _Requirements: 8.1, 8.2, 8.6_

  - [ ]* 7.4 Write property test for page-level competing scroll-container detection
    - **Property 16: Page-level competing scroll-container detection**
    - **Validates: Requirements 8.2**

  - [ ] 7.5 Implement forms / inputs auditor
    - `auditors/forms.ts` → inventory input/textarea/select/button height + focus/error/disabled/loading coverage; flag icon-only buttons lacking an accessible label (High)
    - _Requirements: 9.1, 9.8_

  - [ ]* 7.6 Write property test for icon-only button accessible-label classification
    - **Property 17: Icon-only button accessible-label classification**
    - **Validates: Requirements 9.8**

  - [ ] 7.7 Implement AI components auditor and confidence mapping
    - `auditors/ai-components.ts` → inventory confidence/processing/error styling, AI-vs-human distinction, accent consistency; pure `scoreToLevel(score)` mapping High→green `#22c55e`, Medium→amber `#f59e0b`, Low→slate `#64748b`
    - _Requirements: 10.1, 10.2_

  - [ ]* 7.8 Write property test for confidence mapping
    - **Property 18: Confidence mapping is monotonic and well-formed**
    - **Validates: Requirements 10.2**

  - [ ] 7.9 Implement modals auditor
    - `auditors/modals.ts` → inventory focus trap/backdrop/escape/click-outside/scroll-lock/entrance/size/stacking; record the finite named size-variant set and flag widths outside it
    - _Requirements: 11.1, 11.7_

  - [ ]* 7.10 Write property test for modal size-variant membership
    - **Property 19: Modal size-variant membership**
    - **Validates: Requirements 11.7**

- [ ] 8. Implement accessibility, performance, consistency, and screen auditors
  - [ ] 8.1 Implement accessibility auditor
    - `auditors/accessibility.ts` → inaccessible-onClick (Critical), missing-alt-text (High), semantic-HTML/ARIA/contrast violations into the accessibility violation list
    - _Requirements: 14.1, 14.2, 14.10_

  - [ ]* 8.2 Write property test for inaccessible interactive-element classification
    - **Property 20: Inaccessible interactive-element classification**
    - **Validates: Requirements 14.2**

  - [ ]* 8.3 Write property test for missing-alt-text classification
    - **Property 21: Missing-alt-text classification**
    - **Validates: Requirements 14.10**

  - [ ] 8.4 Implement performance auditor
    - `auditors/performance.ts` → record third-party deps > 50KB gzipped, animation libs replaceable by CSS, per-render inline object/array/function-literal props, and virtualization-threshold checks (>50 items); flag virtualization/data-fetching remediations as approval-required
    - _Requirements: 15.1, 15.3, 15.5_

  - [ ]* 8.5 Write property test for per-render inline-literal prop detection
    - **Property 22: Per-render inline-literal prop detection**
    - **Validates: Requirements 15.3**

  - [ ] 8.6 Implement consistency / fragmentation auditor
    - `auditors/consistency.ts` → build the fragmentation map (groups of ≥2, shared purpose, all variant paths, variant count, one canonical, call sites to migrate); document naming convention + deviations; build z-index inventory + propose `ZIndexScale`; record standard breakpoint set + divergences
    - _Requirements: 16.1, 16.2, 16.5, 16.6_

  - [ ]* 8.7 Write property test for fragmentation grouping and canonical selection
    - **Property 23: Fragmentation grouping and canonical selection**
    - **Validates: Requirements 16.1, 16.6**

  - [ ]* 8.8 Write property test for naming-convention and breakpoint-divergence detection
    - **Property 24: Naming-convention and breakpoint-divergence detection**
    - **Validates: Requirements 16.2, 16.5**

  - [ ] 8.9 Implement loading / empty-state auditor
    - `auditors/loading-empty.ts` → inventory skeleton-vs-spinner-vs-none across data views; flag layout shift > 4px on data arrival
    - _Requirements: 12.1, 12.6_

  - [ ] 8.10 Implement screen-audit builder and missing-state checker
    - `auditors/screen-audit.ts` → for each representative screen (dashboard, forms, table/list, OCR side-by-side) produce per-dimension determinations (Findings / "no Finding" / "not applicable"), record workflow + health + per-severity counts, evaluate populated/loading/empty/error states; flag missing/inconsistent states
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9_

  - [ ]* 8.11 Write property test for screen-audit completeness
    - **Property 25: Screen-audit completeness**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.7, 17.8**

  - [ ]* 8.12 Write property test for missing-state classification
    - **Property 26: Missing-state classification**
    - **Validates: Requirements 17.9**

- [ ] 9. Checkpoint - auditors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement severity/approval classifiers and report aggregators
  - [ ] 10.1 Implement severity classifier and approval-required predicate
    - `classifiers/severity.ts` and `classifiers/approval.ts` → `isApprovalRequired(location)` true iff target is `app-shell.tsx`, the token layer, or `globals.css` structure; expose an apply-guard usable by remediation
    - _Requirements: 1.7, 6.11, 8.6, 15.5, 18.5_

  - [ ]* 10.2 Write property test for approval-required predicate and apply-guard
    - **Property 5: Approval-required predicate and apply-guard**
    - **Validates: Requirements 1.7, 6.11, 8.6, 15.5, 18.5**

  - [ ] 10.3 Implement executive-summary builder
    - `aggregators/executive-summary.ts` → exactly one `DimensionSummaryRow` per `AuditDimensionId` (16 rows), faithful per-severity counts, valid health rating; reused at screen scope
    - _Requirements: 1.2, 17.6_

  - [ ]* 10.4 Write property test for executive-summary aggregation
    - **Property 3: Executive-summary aggregation is faithful**
    - **Validates: Requirements 1.2, 17.6**

  - [ ] 10.5 Implement findings-by-severity partition
    - `aggregators/report-sections.ts` → partition Findings into Critical/High/Medium/Low sections (union equals input, no drops, no duplicates)
    - _Requirements: 1.3_

  - [ ]* 10.6 Write property test for severity partition
    - **Property 2: Severity partition is total and exclusive**
    - **Validates: Requirements 1.3**

  - [ ] 10.7 Implement Fix_Roadmap orderer
    - `aggregators/fix-roadmap.ts` → order by severity precedence then prerequisites-before-dependents; deterministically break `dependsOn` cycles (severity-then-id) without dropping items
    - _Requirements: 1.5_

  - [ ]* 10.8 Write property test for Fix_Roadmap ordering
    - **Property 4: Fix_Roadmap respects severity precedence and dependencies**
    - **Validates: Requirements 1.5**

- [ ] 11. Implement inventories and the report emitter
  - [ ] 11.1 Implement inventory builders
    - Build the seven named inventories (token gap, fragmentation map, accessibility violations, z-index, font, spacing, animation) plus per-dimension inventory population for sidebar/forms/AI/modals/loading-empty/data-table
    - _Requirements: 1.4, 6.1, 7.1, 9.1, 10.1, 11.1, 12.1, 14.1_

  - [ ] 11.2 Implement report emitter
    - `aggregators/report-emitter.ts` → deterministically render `{ ExecutiveSummary, Finding[], inventories, ScreenAudit[], FixRoadmap }` to Markdown with the fixed section structure plus an approval-required appendix; flag architecture-critical Findings (Req 1.7)
    - _Requirements: 1.3, 1.4, 1.5, 1.7_

  - [ ]* 11.3 Write unit test for inventory completeness and deterministic rendering
    - Assert the report contains all seven named inventories and that identical input models render byte-identical Markdown
    - _Requirements: 1.4_

  - [ ]* 11.4 Write example tests for token/config target values
    - Accent token = indigo `#6366f1` for primary/link/focus/active (Req 2.4); density tokens resolve to 40/36/48px row heights and per-density card padding (Req 4.4, 4.5, 4.7, 4.8, 4.9); adjacent dark surfaces differ 2–3% and dark accent = light accent (Req 5.4, 5.5); sticky/modal/backdrop reference named `--z-*` levels (Req 8.5, 11.8)
    - _Requirements: 2.4, 4.4, 4.5, 4.7, 4.8, 4.9, 5.4, 5.5, 8.5, 11.8_

- [ ] 12. Implement the audit orchestrator and generate the report artifact
  - [ ] 12.1 Implement run-audit orchestrator
    - `run-audit.ts` → walk `web/src`, wire scanners → classifiers → auditors → aggregators → emitter, collect scan diagnostics, and write `audit-report.md`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 12.2 Run the audit and generate the report artifact
    - Execute the orchestrator to produce `.kiro/specs/frontend-modernization-sprint-3/audit-report.md` with all 16 dimensions, severity-ranked Findings, inventories, roadmap, and approval appendix
    - _Requirements: 1.1_

  - [ ]* 12.3 Write smoke test for report generation and scroll-ownership baseline
    - Assert the report exists at the expected path; assert `.factory-workstation-frame` retains `overflow-y-auto` as the single page scroll owner
    - _Requirements: 1.1, 8.1, 8.9, 18.1_

- [ ] 13. Checkpoint - audit report complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement the remediation safety harness
  - [ ] 14.1 Implement SafetySnapshot capture and invariant check
    - `safety/safety-harness.ts` → capture `SafetySnapshot` (scroll frame, competing scroll containers, routes, virtualized lists, API fingerprint) and `checkSafetyInvariants(before, after): SafetyResult` (AND of the four invariants)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7, 18.8_

  - [ ]* 14.2 Write property test for the remediation safety harness
    - **Property 27: Remediation safety harness preserves invariants**
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.7, 18.8**

  - [ ] 14.3 Implement forbidden-pattern remediation guard
    - `safety/remediation-guard.ts` → reject remediations introducing an `anti-patterns.md` / `forbidden-mutations.md` pattern and record an alternative; integrate `isApprovalRequired` apply-guard
    - _Requirements: 18.5, 18.6_

  - [ ]* 14.4 Write property test for the forbidden-pattern remediation guard
    - **Property 28: Forbidden-pattern remediation guard**
    - **Validates: Requirements 18.6**

- [ ] 15. Reconcile architecture-critical files (approval-gated)
  - [ ] 15.1 Reconcile token values in `web/src/styles/tokens.css`
    - Precondition: forbidden-mutations approval recorded in the report's approval appendix
    - Reconcile `--action-primary`/`--accent` to indigo `#6366f1`; lead `--font-sans` with Inter (remove forbidden IBM Plex Sans lead); correct compact `--density-row-height` to 36px
    - _Requirements: 2.4, 3.2, 3.12, 4.4, 18.5_

  - [ ] 15.2 Reconcile data-table virtualization threshold in `data-table.tsx`
    - Precondition: forbidden-mutations approval recorded; preserve TanStack Virtual behavior
    - Change the virtualization trigger from `> 100` to `> 50` rows
    - _Requirements: 6.9, 6.11, 15.4, 18.5_

  - [ ]* 15.3 Write integration test for safety invariants after critical-file changes
    - Run the safety harness before/after; assert scroll ownership, routes, virtualization, and API contracts are all preserved
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7_

- [ ] 16. Remediate Critical findings (scroll, dark-mode contrast, keyboard access)
  - [ ] 16.1 Fix dark-mode contrast failures in flagged components
    - Replace failing color pairs with dark-mode surface/text tokens meeting 4.5:1 body / 3:1 large-and-UI
    - _Requirements: 5.2, 5.3_

  - [ ] 16.2 Fix keyboard-inaccessible interactive elements
    - Convert `onClick`-only non-semantic elements to semantic controls or add role + tab order + Enter/Space activation
    - _Requirements: 14.2, 14.3, 14.6, 14.8_

  - [ ] 16.3 Remove competing page-level scroll containers
    - For any flagged page component, remove the page-level `overflow-y-*` container so AppShell retains scroll ownership; add `min-h-0` to scrolling flex children (approval-gated only if `app-shell.tsx` is touched)
    - _Requirements: 8.2, 8.3, 18.1_

  - [ ]* 16.4 Write Playwright integration test for layout invariants
    - Assert no horizontal overflow at 375/768/1440px and that scroll ownership is preserved
    - _Requirements: 8.8, 8.9, 8.10_

  - [ ]* 16.5 Write accessibility integration test (axe-core)
    - Assert keyboard operability, visible focus ≥3:1, and rendered-screen contrast on remediated screens
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 17. Remediate High findings (token, typography, dark-mode, AI, forms convergence)
  - [ ] 17.1 Replace forbidden-accent usages with the indigo accent token
    - Migrate warm orange / amber / teal accent usages to the indigo `#6366f1` accent token
    - _Requirements: 2.4, 2.5_

  - [ ] 17.2 Replace remaining hardcoded and light-mode colors with tokens
    - Map hardcoded colors to surface/text/border/status tokens; replace dark-context light-mode colors and pure-black backgrounds with dark surface tokens
    - _Requirements: 2.3, 2.7, 5.1, 5.7, 5.8_

  - [ ] 17.3 Converge UI typography
    - Replace monospace UI labels/buttons/headings with Inter; convert UPPERCASE to sentence case (keep permitted exceptions); map off-scale sizes and forbidden weights to the operational scale and 400/500/600; apply tabular numbers in tables
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ] 17.4 Remove glow/gradient/pulse effects from dark surfaces and AI components
    - Replace pulsing/looping/glow AI processing styling with a static/single-cycle indigo `#4338ca` indicator; remove colored radial gradients / glow on dark surfaces
    - _Requirements: 5.6, 10.3, 10.8, 13.4_

  - [ ] 17.5 Add accessible labels and alt text
    - Add `aria-label` to icon-only buttons; add descriptive alt text to informative images and mark decorative images decorative
    - _Requirements: 9.8, 14.4, 14.10_

  - [ ]* 17.6 Write integration test for AI surface behavior
    - Assert processing styling, surface differentiation of AI vs user content, error state with actionable message, and content retention on failure
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 17.7 Write snapshot tests for token-driven visual changes
    - Capture Storybook snapshots for button, card, badge, confidence-badge, and smart-insights-panel to guard against unintended regressions
    - _Requirements: 2.4, 3.2_

- [ ] 18. Checkpoint - Critical & High remediation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Remediate Medium/Low findings: spacing, data tables, forms
  - [ ] 19.1 Converge spacing to the 4px scale
    - Replace arbitrary padding/margin/gap with scale values; set card/panel padding per density (20–24 default, 16 compact, 24–32 comfortable) and section gaps 24–32px
    - _Requirements: 4.2, 4.5, 4.7, 4.8, 4.9_

  - [ ] 19.2 Apply data-table structure and interaction states
    - Sticky header at a named z-index level, right-align numeric / left-align text, hover 5–15% in 80–120ms, indigo-derived selected state, tri-state sort indicators, truncate/wrap instead of horizontal overflow
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.10, 6.12_

  - [ ] 19.3 Apply data-table empty and loading states
    - Guidance-rich empty states and skeletons matching final row dimensions so no layout shift occurs on data arrival
    - _Requirements: 6.7, 6.8_

  - [ ] 19.4 Normalize form controls
    - Control heights 32–36px default, focus indicator ≥2px and ≥3:1, error state with red `#ef4444` + field-identifying message and value retention, disabled 40–60% opacity + not-allowed + no interaction, indigo loading spinner blocking resubmission, distinct primary/secondary/destructive variants
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_

  - [ ]* 19.5 Write integration test for data-table behaviors
    - Assert sticky header, alignment, hover, selected, sort, empty/loading (no layout shift), truncation, and virtualization above the threshold
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.12, 15.4_

  - [ ]* 19.6 Write integration test for form control states
    - Assert control heights, focus indicator, error/disabled/loading states, value retention, and button variant distinction
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_

- [ ] 20. Remediate Medium/Low findings: modals, loading/empty, animation, sidebar
  - [ ] 20.1 Apply modal behavior and structure
    - Focus trap (Tab cycles first↔last), Escape + backdrop close (unless documented), background scroll lock, ≤150ms entrance, one named size variant, z-index from the scale, initial focus on open + focus return on close, no entrance animation under `prefers-reduced-motion`
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

  - [ ] 20.2 Apply loading/empty/error states across data views
    - Skeletons reserving layout space, spinners only for indeterminate ops < 1s, empty states with condition + actionable next step, error boundaries with region-level retry
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.7_

  - [ ] 20.3 Cap animations and honor reduced motion
    - State-change transitions ≤200ms, expand/collapse ≤150ms, CSS not JS, decorative/looping motion disabled and remaining motion ≤100ms under `prefers-reduced-motion`, visible response within 100ms/200ms (global animation-rule edits in `globals.css` are approval-gated)
    - _Requirements: 13.2, 13.3, 13.5, 13.6, 13.7, 13.8, 15.6, 15.7_

  - [ ] 20.4 Apply sidebar refinements
    - Expanded width 220–260px; labels 13–14px Inter sentence case; non-active hover 5–10% in 80–120ms; uniform icon size; labels aligned to a common left text-start edge; visible focus ≥3:1
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.7, 7.9_

  - [ ]* 20.5 Write integration test for modal behavior
    - Assert focus trap cycling, Escape/backdrop close, scroll lock, ≤150ms entrance, initial focus, focus return, and reduced-motion suppression
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.9, 11.10, 11.11_

  - [ ]* 20.6 Write integration test for loading/empty/error states
    - Assert skeleton layout-space reservation, empty-state guidance, and error boundary retry reloading only the region
    - _Requirements: 12.2, 12.4, 12.5, 12.7_

- [ ] 21. Consolidate fragmentation onto canonical components
  - [ ] 21.1 Consolidate card variants
    - Migrate call sites from `professional-card.tsx` / `section-panel.tsx` to the canonical card component per the fragmentation map
    - _Requirements: 16.4, 16.6_

  - [ ] 21.2 Consolidate button variants
    - Migrate call sites from `professional-button.tsx` to the canonical button component
    - _Requirements: 16.6_

  - [ ] 21.3 Consolidate empty-state and table-wrapper variants
    - Migrate call sites to a single canonical empty-state and a single canonical table wrapper
    - _Requirements: 16.6_

  - [ ] 21.4 Replace arbitrary z-index values with named scale levels
    - Replace numeric z-index literals across `web/src` (including inline values flagged in `globals.css`) with named `--z-*` levels (globals.css structural edits are approval-gated)
    - _Requirements: 6.10, 8.5, 11.8, 16.4_

  - [ ]* 21.5 Write snapshot test for consolidated components
    - Assert canonical components render equivalently across migrated call sites
    - _Requirements: 16.6_

- [ ] 22. Final integration and safety verification
  - [ ] 22.1 Run the safety harness across all remediations
    - Verify the four invariants for every applied remediation; revert and record a Finding for any violation
    - _Requirements: 18.7, 18.8_

  - [ ]* 22.2 Run the full unit, property, and integration test suites
    - Run `vitest --run` for audit-engine and remediation tests and the Playwright suite; ensure all pass
    - _Requirements: 18.7_

- [ ] 23. Final checkpoint - full verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; per the workflow they are
  not auto-implemented. All `*` tasks here are tests (property, unit, integration, snapshot, smoke).
- Property-based tests (`fast-check` + Vitest, ≥100 runs) apply only to the pure audit-engine core;
  each of the 28 design properties maps to exactly one property test sub-task, tagged
  `Feature: frontend-modernization-sprint-3, Property {n}` and annotated with its requirements clause.
- The remediation/target-state layer is verified by integration (Vitest + Testing Library /
  Playwright), snapshot/visual-regression, and smoke tests, not property tests.
- Architecture-critical edits (`app-shell.tsx`, `tokens.css`, `globals.css` structure) and
  virtualization changes are approval-gated per `forbidden-mutations.md` and flagged in the report.
- Checkpoints provide incremental validation; the remediation phase depends on the generated
  audit report and the safety harness being in place first.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 2, "tasks": ["1.4", "2.8", "2.9", "4.1", "4.4", "4.6", "5.1", "5.5", "7.1", "7.3", "7.5", "7.7", "7.9", "8.1", "8.4", "8.6", "8.9", "10.1", "10.3", "10.5", "10.7", "11.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.5", "4.7", "4.8", "5.2", "5.6", "7.2", "7.4", "7.6", "7.8", "7.10", "8.2", "8.3", "8.5", "8.7", "8.8", "8.10", "10.2", "10.4", "10.6", "10.8"] },
    { "id": 4, "tasks": ["5.3", "5.4", "8.11", "8.12", "11.2"] },
    { "id": 5, "tasks": ["11.3", "11.4", "12.1"] },
    { "id": 6, "tasks": ["12.2"] },
    { "id": 7, "tasks": ["12.3", "14.1", "14.3"] },
    { "id": 8, "tasks": ["14.2", "14.4", "15.1", "15.2"] },
    { "id": 9, "tasks": ["15.3", "16.1", "16.2", "16.3"] },
    { "id": 10, "tasks": ["16.4", "16.5", "17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 11, "tasks": ["17.6", "17.7", "19.1", "19.2", "19.4", "20.4"] },
    { "id": 12, "tasks": ["19.3", "19.6", "20.1", "20.2", "20.3"] },
    { "id": 13, "tasks": ["19.5", "20.5", "20.6", "21.1"] },
    { "id": 14, "tasks": ["21.2", "21.3"] },
    { "id": 15, "tasks": ["21.4"] },
    { "id": 16, "tasks": ["21.5"] },
    { "id": 17, "tasks": ["22.1"] },
    { "id": 18, "tasks": ["22.2"] }
  ]
}
```
