# Atomic Component Reference — every small UI/UX detail

> Companion to PAGE_REFERENCE_MAP.md. That file works at the page/archetype level; THIS file
> is the exhaustive element-level inventory — checkboxes, switches, scrollbars, tooltips,
> spinners, pagination, every small thing that affects UI/UX. For each atom: what exists
> today, the problem, the exact shadcn item and 21st.dev Magic search, and a USE verdict.
>
> Counts are from a live grep of web/src on 2026-07-18 (files / hits).
>
> Status key: [HAVE]=primitive exists in ui/  ·  [RAW]=used but hand-rolled, no component  ·
> [MISSING]=used but no primitive  ·  [GAP]=not used yet but needed.

## What exists in web/src/components/ui/ today
badge, button, card, guidance-block, input, label, responsive-scroll-area, safe-text,
select (NATIVE select, not Radix), separator, skeleton, table, tabs (Radix), textarea.
Utility: lib/toast.ts (custom window event bus, no visual component in ui/).
Everything below that is NOT in that list is a gap to fill.

---

## 1. Form controls

### 1.1 Checkbox — [RAW] (9 files / 18 raw type=checkbox)
- Today: bare input type=checkbox, only accent-color from globals.css:142. No label wiring,
  no focus ring token, inconsistent size, tap target < 44px.
- shadcn: checkbox (Radix). Magic: "custom checkbox", "checkbox list item".
- USE shadcn checkbox. Accessible, indeterminate state, keyboard, our tokens. Add a
  CheckboxField wrapper (checkbox + label + description) for settings/entry pages.

### 1.2 Radio / RadioGroup — [MISSING] (0 found, needed for single-choice settings)
- Today: single-choice faked with buttons/selects.
- shadcn: radio-group (Radix). Magic: "segmented radio", "option cards".
- USE shadcn radio-group for true single-choice; Magic "option cards" for plan/tier pickers.

### 1.3 Switch / Toggle — [RAW] (16 files / 81 hits)
- Today: hand-rolled toggles (settings, faq, entry). Inconsistent size/animation, some not
  keyboard-operable, missing role=switch.
- shadcn: switch (Radix). Magic: "toggle switch", "settings toggle row".
- USE shadcn switch + a SettingRow wrapper (label + description + switch) for settings.

### 1.4 Select — [HAVE but NATIVE] (native ui/select.tsx; 29 files use Select, 9 raw select)
- Today: native select — can't style option list, inconsistent across OS, no search, no
  multi-select, poor on mobile.
- shadcn: select (Radix, styleable) and combobox (search via command+popover). Magic:
  "custom select dropdown", "multi-select", "combobox".
- USE shadcn select to replace the native one (keep the same Select export name so call sites
  do not churn), and add combobox for big lists (customers, vendors, products).

### 1.5 Textarea — [HAVE] (22 files / 37)
- ui/textarea.tsx exists. Needs Phase-1 token/focus pass + optional auto-grow.
- shadcn: textarea. USE existing, align focus ring to accent, add auto-resize option.

### 1.6 Number / Stepper input — [RAW] (21 files / 53 type=number)
- Today: bare number inputs (quantity steppers on billing/OCR/inventory). No +/- buttons,
  browser-dependent arrows, fat-finger on mobile.
- shadcn: compose input + button(size=icon) into NumberStepper. Magic: "quantity stepper".
- USE Magic visual + shadcn primitives. Build one NumberStepper (billing OCR-pack quantity
  control needs this specifically).

### 1.7 Date / Time picker — [RAW] (17 files / 32 type=date/time)
- Today: native date/time — ugly, inconsistent, no range.
- shadcn: calendar + popover date-picker recipe; date-picker block. Magic: "date range picker".
- USE shadcn calendar+popover. Attendance/reports need ranges — build one DateRangePicker.

### 1.8 File upload / Dropzone — [RAW] (13 files / 68 hits)
- Today: OCR + attachments use raw file inputs; you have browser-image-compression + heic2any.
  No drag-drop affordance, no preview grid, no per-file progress.
- shadcn: none official; compose card+progress+button. Magic: "file upload dropzone",
  "image upload preview grid".
- USE Magic dropzone visual, wire to your compression/HEIC pipeline. Build one FileDropzone.

### 1.9 OTP input — [RAW] (2 files / 26 — verify-email, 2FA)
- shadcn: input-otp. Magic: "otp input", "verification code input".
- USE shadcn input-otp. Purpose-built, accessible, paste-aware.

### 1.10 Search input — [RAW] (6 files / 6)
- Today: placeholder=Search on bare inputs; no icon, no clear button, no debounce affordance.
- USE shadcn input + lucide Search/X in a shared SearchInput (part of FilterToolbar).

### 1.11 Slider / Range — [RAW] (2 files / 5)
- shadcn: slider (Radix). USE shadcn slider where present (rare, low priority).

### 1.12 Form wrapper / validation — [MISSING]
- Today: manual useState + ad-hoc error strings; no consistent error/helper text style.
- shadcn: form (React Hook Form + zod). USE shadcn form as backbone for all Archetype-D pages;
  standardizes label, description, error, required-marker.

---

## 2. Overlays & popouts

### 2.1 Dialog / Modal — [RAW] (3 files / 67 hits, custom modals)
- Today: hand-built modals; risk of no focus-trap, no Escape, no scroll-lock, no aria-modal.
- shadcn: dialog + alert-dialog (confirm/destructive). Magic: "modal dialog", "confirm dialog".
- USE shadcn dialog + alert-dialog. Replace all custom modals; focus-trap + a11y free.
  Confirmations (delete batch, void invoice) -> alert-dialog.

### 2.2 Sheet / Drawer — [RAW] (3 files / 6, jobs-drawer etc.)
- shadcn: sheet (side drawer). Magic: "slide-over panel", "mobile bottom sheet".
- USE shadcn sheet for the mobile nav drawer (Phase 3) and jobs-drawer; add bottom-sheet
  variant for mobile actions.

### 2.3 Popover — [MISSING] (0 found)
- Needed by date picker, combobox, column menu, filter chips.
- shadcn: popover. USE shadcn popover as the base for those composites.

### 2.4 Tooltip — [RAW] (71 files / 131, mostly native title=)
- Today: title= attributes — no styling, delayed, invisible on touch, poor a11y.
- shadcn: tooltip (Radix). Magic: "tooltip".
- USE shadcn tooltip. Replace title= on icon buttons/truncated cells; on touch pair with a
  tap-to-reveal since tooltips do not fire on mobile.

### 2.5 Dropdown menu — [MISSING] (0 found, row actions faked with buttons)
- shadcn: dropdown-menu (Radix). Magic: "actions menu", "kebab menu".
- USE shadcn dropdown-menu for table row actions (kebab), user menu, bulk actions.

### 2.6 Command palette — [RAW] (3 files / 4, the COMMANDS bar in the shell)
- shadcn: command (cmdk). Magic: "command menu", "spotlight search".
- USE shadcn command. Rebuild the shell COMMANDS palette on cmdk (fuzzy, keyboard).

### 2.7 Context menu — [GAP]
- shadcn: context-menu. Low priority; add only if right-click actions wanted on tables.

---

## 3. Feedback & status

### 3.1 Spinner / Loading — [RAW] (79 files / 454 hits, animate-spin)
- Today: hand-rolled spinners everywhere; one uses a STRAY BLUE #185FA5
  (ocr/progress-indicator.tsx) — another color leak. Sizes/colors inconsistent.
- shadcn: use lucide Loader2 + animate-spin in a Spinner primitive. Magic: "loading spinner",
  "button loading state".
- USE a shared Spinner (lucide Loader2, accent color, sizes sm/md/lg) + a Button loading prop.
  Replace all 454 ad-hoc spinners over time. Kill the blue.

### 3.2 Skeleton — [HAVE] (71 files / 288)
- ui/skeleton.tsx + components/skeleton/* exist and are used well.
- USE existing; ensure shimmer respects prefers-reduced-motion and uses card tokens.

### 3.3 Progress bar — [RAW] (19 files / 61)
- Today: hand-rolled bars (OCR progress, upload). No role=progressbar/aria values.
- shadcn: progress (Radix). Magic: "progress bar", "step progress".
- USE shadcn progress (determinate + indeterminate) for OCR/upload.

### 3.4 Badge / Chip / Pill / Tag — [HAVE badge; RAW pills] (12 files / 63 + many inline pills)
- Today: ui/badge.tsx exists but pages also inline their own status pills (the steel-* hex
  offenders). Status colors inconsistent.
- shadcn: badge (variants). Magic: "status badge", "tag chip", "removable chip".
- USE ui/badge (upgrade to CVA status variants success/warning/danger/signal/neutral); add a
  Chip (removable) for filter chips. Delete all inline pills.

### 3.5 Alert / Banner / Callout — [RAW] (14 files / 32)
- Today: guidance-block.tsx exists (nice) but generic alerts are ad-hoc.
- shadcn: alert. Magic: "alert banner", "inline notification".
- USE shadcn alert for inline messages; keep GuidanceBlock for the guided-hint pattern.

### 3.6 Toast — [RAW] (custom event bus in lib/toast.ts; 14 files / 86)
- Today: pushAppToast dispatches a window CustomEvent; a listener renders them. Works, but the
  visual is bespoke and not tokenized consistently.
- shadcn: sonner (recommended) or toast. Magic: "toast notification".
- USE shadcn sonner, adapt pushAppToast to call it (keep the API so call sites do not churn).
  One toast look app-wide.

### 3.7 Empty state — [RAW] (41 files / 168, "No X found" / "Restricted")
- Today: every page reinvents empty/restricted blocks (the repeated Restricted cards on mobile
  reports). Inconsistent, verbose.
- shadcn: none official; Magic: "empty state", "no data illustration", "access restricted".
- USE Magic empty-state visual -> one shared EmptyState (icon, title, body, optional CTA) with
  variant=empty|restricted|error. High impact.

### 3.8 Error boundary / error page — [RAW] (5 files / 10; plus 403, offline pages)
- shadcn: compose card+button; Magic: "error page", "404/500 illustration".
- USE Magic error visual for 403/offline/500; shared ErrorState.

---

## 4. Navigation atoms

### 4.1 Tabs — [HAVE] (16 files / 159; but local TabButton re-defs exist)
- ui/tabs.tsx (Radix, accent) exists; some pages still hand-roll blue TabButtons.
- USE ui/tabs everywhere; delete local TabButtons (steel-financial etc.). Add a scrollable
  variant for many-tab pages on mobile.

### 4.2 Breadcrumb — [RAW] (1 file / 1, basically absent)
- Detail pages (Archetype C) need breadcrumbs for orientation.
- shadcn: breadcrumb. Magic: "breadcrumb". USE shadcn breadcrumb on all detail pages.

### 4.3 Pagination — [RAW/MISSING] (48 files / 280 hits, NO shared component)
- Today: Prev/Next + page math re-implemented per table. Huge duplication, inconsistent.
- shadcn: pagination. Magic: "pagination controls", "table pagination".
- USE shadcn pagination in the shared DataTable. Kills 280 scattered hits.

### 4.4 Accordion / Collapsible — [RAW] (44 files / 102; some details)
- Today: FAQ + many collapsible sections hand-rolled; inconsistent chevron/animation, some not
  keyboard-accessible.
- shadcn: accordion + collapsible. Magic: "accordion", "faq accordion".
- USE shadcn accordion (FAQ, mobile report sections) and collapsible (inline toggles).

### 4.5 Stepper / Wizard — [RAW] (4 files / 27, onboarding, OCR flow)
- shadcn: compose; Magic: "step wizard", "progress steps".
- USE Magic stepper visual -> shared Steps for onboarding + OCR scan->verify flow.

### 4.6 Menubar / Nav rail — see PHASE_3 (shell). Sidebar/bottom-nav handled there.

---

## 5. Data display atoms

### 5.1 Table — [HAVE basic] (48 files / 77; TanStack available but underused)
- ui/table.tsx = styled table parts only. No sort/filter/virtualize/pagination baked in.
- shadcn: table + data-table recipe (TanStack). USE the DataTable wrapper (PAGE_REFERENCE_MAP B).

### 5.2 Avatar — [RAW] (3 files / 5)
- shadcn: avatar (image + fallback initials). USE shadcn avatar for user menu, workforce.

### 5.3 Separator / Divider — [HAVE] (4 files / 6; also raw hr)
- ui/separator.tsx exists. USE it; replace raw hr.

### 5.4 Tooltip on truncated text / SafeText — [HAVE partial] (safe-text.tsx exists)
- Pair SafeText truncation with shadcn tooltip to reveal full value on hover/tap.

### 5.5 KBD / Code — [RAW] (7 files / 8)
- Minor; add a Kbd token style for command-palette shortcuts. Low priority.

### 5.6 Description list / Key-Value — [MISSING]
- Detail pages show meta as ad-hoc rows. Add DescriptionList/MetaRow shared atom (label +
  value, responsive 2-col -> stacked). Compose with shadcn primitives.

---

## 6. Scroll, overflow & viewport details

### 6.1 Custom scrollbar — [HAVE, CSS only] (globals.css:121-140)
- Thin scrollbar + gradient thumb defined globally. Fine — verify contrast and that it does not
  hide on overflow containers. Keep, token the thumb color.

### 6.2 ResponsiveScrollArea — [HAVE] (44 files / 184)
- Custom horizontal scroll with edge-fade indicators (globals.css:469-501). Good for wide
  tables on mobile. Keep; align with shadcn scroll-area for vertical.
- shadcn: scroll-area (Radix) for styled vertical scroll in dialogs/menus. ADD shadcn
  scroll-area for overlay bodies; keep ResponsiveScrollArea for horizontal table scroll.

### 6.3 overflow-x containers — [RAW] (9 files / 10)
- Wide content set to overflow-x-auto. Ensure every one is a ResponsiveScrollArea (edge fades +
  momentum) so mobile users know there is more to the right. Top mobile UX gap for 22 tables.

### 6.4 Sticky headers/toolbars — [RAW] (10 files / 14)
- Table headers and the mobile top bar use sticky. Standardize sticky top-0 z-header (use the
  new z-tokens) so sticky elements never sit under/over the wrong layer.

### 6.5 Safe-area insets — [HAVE] (globals.css safe-*-inset)
- Good iOS notch handling exists. Ensure the mobile bottom nav + FABs all use them (Phase 3).

### 6.6 Scroll restoration / scroll-to-top — [GAP]
- On route change long pages keep scroll. Add scroll-reset on navigation + a back-to-top
  affordance on long intelligence/report pages.

---

## 7. Interaction & a11y micro-details (cross-cutting)

- Focus-visible ring: Button/Input/Select/Tabs have accent rings; the 147 raw buttons + raw
  checkboxes/switches do NOT. Every shadcn primitive above ships one — migrating fixes it.
- Tap targets: 230 py-1/py-1.5 controls < 44px. All shared atoms default to >=44px (checkbox/
  switch hit-area, icon buttons size=icon = 44px).
- Hover vs touch: tooltips + hover-only actions (row kebabs) must have a tap equivalent.
- Disabled states: standardize opacity + cursor-not-allowed + aria-disabled across all atoms
  (Button has it; others do not).
- Loading states: every submit Button -> loading prop (spinner + disabled + aria-busy).
- Reduced motion: globals.css has a block for auth animations; extend to spinners, accordions,
  toasts, skeleton shimmer.
- RTL/i18n: 5 locales exist; ensure atoms use logical properties (ms-/me-) not ml-/mr- where
  direction matters. Low priority unless an RTL locale is added.

---

## 8. Master install list (shadcn) + Magic pulls

shadcn add (run in web/ — see MCP_SETUP.md):
checkbox, radio-group, switch, select, combobox, calendar, popover, input-otp, slider, form,
dialog, alert-dialog, sheet, tooltip, dropdown-menu, command, context-menu, progress, alert,
sonner, badge (upgrade), breadcrumb, pagination, accordion, collapsible, avatar, scroll-area,
table/data-table.

21st.dev Magic pulls (visual, then token-adapt):
NumberStepper, FileDropzone, EmptyState (empty/restricted/error), ErrorState/404-500,
Steps/Wizard, StatCard, PageHeader, Timeline, hero/feature/pricing (marketing), toast look,
option-cards (plan picker), removable filter Chip.

Build-once shared atoms (compose the above):
CheckboxField, SettingRow (switch), NumberStepper, DateRangePicker, FileDropzone, SearchInput,
Spinner, Chip, EmptyState, ErrorState, Pagination(wrap), Steps, Breadcrumb(wrap), Avatar,
DescriptionList/MetaRow, Kbd, DataTable, FilterToolbar.

Rule unchanged: pull from the USE source, strip generic colors to our tokens, route through our
cn, use lucide icons, verify 360/768/1024/1440, log in CHANGELOG. One system only.
