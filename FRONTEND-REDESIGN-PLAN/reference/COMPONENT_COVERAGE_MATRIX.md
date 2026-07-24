# Component Coverage Matrix (quick lookup)

One row per UI atom. Status: HAVE / RAW / MISSING / GAP. USE = which source to pull from.
Full rationale in ATOMIC_COMPONENT_REFERENCE.md. Counts = files/hits in web/src (2026-07-18).

| # | Atom | Status | Used (f/h) | shadcn item | Magic pull | USE |
|--:|------|--------|-----------|-------------|-----------|-----|
| 1 | Checkbox | RAW | 9/18 | checkbox | checkbox list item | shadcn |
| 2 | Radio group | MISSING | 0 | radio-group | option cards | shadcn (+Magic for plan cards) |
| 3 | Switch/Toggle | RAW | 16/81 | switch | settings toggle row | shadcn |
| 4 | Select | HAVE(native) | 29/79 | select | multi-select | shadcn (replace native) |
| 5 | Combobox (searchable) | MISSING | - | combobox | combobox | shadcn |
| 6 | Textarea | HAVE | 22/37 | textarea | - | existing (token pass) |
| 7 | Number/Stepper | RAW | 21/53 | input+button | quantity stepper | Magic visual + shadcn |
| 8 | Date/Time picker | RAW | 17/32 | calendar+popover | date range picker | shadcn |
| 9 | File dropzone | RAW | 13/68 | (compose) | file upload dropzone | Magic + own pipeline |
| 10 | OTP input | RAW | 2/26 | input-otp | otp input | shadcn |
| 11 | Search input | RAW | 6/6 | input+lucide | - | shadcn (SearchInput) |
| 12 | Slider/Range | RAW | 2/5 | slider | - | shadcn |
| 13 | Form/validation | MISSING | - | form (RHF+zod) | - | shadcn |
| 14 | Dialog/Modal | RAW | 3/67 | dialog, alert-dialog | confirm dialog | shadcn |
| 15 | Sheet/Drawer | RAW | 3/6 | sheet | bottom sheet | shadcn |
| 16 | Popover | MISSING | 0 | popover | - | shadcn |
| 17 | Tooltip | RAW(title=) | 71/131 | tooltip | tooltip | shadcn |
| 18 | Dropdown menu | MISSING | 0 | dropdown-menu | kebab menu | shadcn |
| 19 | Command palette | RAW | 3/4 | command (cmdk) | command menu | shadcn |
| 20 | Context menu | GAP | - | context-menu | - | shadcn (optional) |
| 21 | Spinner/Loading | RAW | 79/454 | lucide Loader2 | button loading | shadcn (Spinner + Button.loading) |
| 22 | Skeleton | HAVE | 71/288 | skeleton | - | existing |
| 23 | Progress bar | RAW | 19/61 | progress | step progress | shadcn |
| 24 | Badge/Chip | HAVE+RAW | 12/63 | badge | removable chip | shadcn (upgrade) + Chip |
| 25 | Alert/Banner | RAW | 14/32 | alert | inline notification | shadcn (keep GuidanceBlock) |
| 26 | Toast | RAW(bus) | 14/86 | sonner | toast notification | shadcn (wrap pushAppToast) |
| 27 | Empty state | RAW | 41/168 | (compose) | empty/restricted/error | Magic -> shared EmptyState |
| 28 | Error page/boundary | RAW | 5/10 | (compose) | 404/500 illustration | Magic -> ErrorState |
| 29 | Tabs | HAVE | 16/159 | tabs | - | existing (delete local TabButtons) |
| 30 | Breadcrumb | RAW | 1/1 | breadcrumb | breadcrumb | shadcn |
| 31 | Pagination | RAW | 48/280 | pagination | table pagination | shadcn (in DataTable) |
| 32 | Accordion/Collapse | RAW | 44/102 | accordion, collapsible | faq accordion | shadcn |
| 33 | Stepper/Wizard | RAW | 4/27 | (compose) | step wizard | Magic -> Steps |
| 34 | Table | HAVE(basic) | 48/77 | table+data-table | table toolbar | shadcn DataTable |
| 35 | Avatar | RAW | 3/5 | avatar | - | shadcn |
| 36 | Separator | HAVE | 4/6 | separator | - | existing (replace hr) |
| 37 | Description list | MISSING | - | (compose) | key-value panel | shadcn -> MetaRow |
| 38 | Kbd/Code | RAW | 7/8 | (style) | - | own (low priority) |
| 39 | Scroll-area (vertical) | GAP | - | scroll-area | - | shadcn (overlay bodies) |
| 40 | ResponsiveScrollArea (horiz) | HAVE | 44/184 | - | - | existing (wrap all overflow-x) |
| 41 | Custom scrollbar | HAVE(css) | globals | - | - | existing (token thumb) |
| 42 | Sticky headers | RAW | 10/14 | - | - | standardize with z-tokens |
| 43 | Scroll-to-top / restore | GAP | - | - | back-to-top button | own |
| 44 | StatCard (KPI) | RAW | many | card | KPI stat card | Magic -> shared StatCard |
| 45 | PageHeader | MISSING | - | (compose) | detail page header | Magic -> PageHeader |
| 46 | Timeline | MISSING | - | (compose) | activity timeline | Magic -> Timeline |
| 47 | FilterToolbar | RAW | many | input+select+dropdown | filter bar | shadcn -> FilterToolbar |
| 48 | ComingSoon template | RAW | ~13 pages | - | coming soon page | Magic -> ComingSoon |

## Priority order to build (max reuse first)
1. Spinner + Button.loading (454 hits) · 2. DataTable + Pagination (280) · 3. EmptyState (168)
· 4. Tooltip (131) · 5. StatCard (14 dashboards) · 6. Select(Radix)+Combobox · 7. Switch +
Checkbox + SettingRow · 8. Dialog/AlertDialog/Sheet · 9. Accordion · 10. Form + DateRangePicker
+ NumberStepper + FileDropzone · 11. Breadcrumb + PageHeader + Timeline + MetaRow · 12.
Dropdown-menu + Command · 13. ComingSoon + ErrorState + marketing sections.
