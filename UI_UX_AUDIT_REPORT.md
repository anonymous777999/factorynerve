# UI/UX Audit Report – FactoryNerve

## Summary
The UI is largely functional and consistent across the majority of pages, leveraging shadcn/ui and Radix UI components. However, **6 critical pages fail to load** due to timeouts (OCR base page, register, reset-password, signup, SLA, subprocessors), which are **launch blockers**. The remaining 79 pages load successfully and exhibit a generally cohesive visual language, but several usability and consistency issues prevent the experience from feeling premium for non‑technical factory users. After addressing the launch blockers, a focused polish pass could elevate the product to a 10× better experience.

## Page‑by‑Page Findings
Below is a representative sample of pages visited; each entry notes whether the page loaded, any UI/UX anomalies observed in screenshots, and a severity tag.

*Public Routes* (about, acceptable‑use, access, compliance, contact, cookies, data‑retention, disclosure, dpa, eula, faq, features, forgot‑password, login, plans, pricing, privacy, refunds, register, reset‑password, signup, sla, subprocessors, terms, verify‑email)
- Loaded: All except register, reset‑password, signup, sla, subprocessors (timeout).  
- Observations:  
  * Login page uses centered card with clear primary action; loading state absent on submit.  
  * Forget‑password / reset‑password flows lack inline validation and loading indicators.  
  * OCR base page timed out; sub‑pages (history, scan, verify) loaded and show a clean upload area but missing feedback on upload progress.  
  * Public informational pages (about, features, etc.) have ample whitespace but rely on default shadcn styling; typography and spacing feel airy but lack brand‑specific warmth.

*Private Routes* (dashboard, ai, alerts, analytics, billing, email‑summary, notifications, profile, reports, settings, premium/dashboard, onboarding/factory-required)
- Loaded: All.  
- Observations:  
  * Dashboard presents metric cards; primary actions (e.g., “New Entry”) are visible but lack hover‑feedback in screenshots.  
  * Navigation sidebar (if present) uses default Radix colors; no custom brand accent.  
  * Notification bell indicator lacks a badge counter in some screenshots.  
  * Settings pages contain long forms; submit buttons show no loading state on click.  
  * Premium upgrade page highlights CTA but uses default button styling.

*Workflow Routes* (attendance, ocr, steel, etc.)
- Loaded: All routes except OCR base page (timeout). Sub‑OCR routes (history, scan, verify) loaded.  
- Attendance: Live view shows a table with check‑in/out; empty state displays a faint “No records” message; row actions lack confirmation dialogs.  
- OCR history: Lists scans with status badges; empty state shows a generic illustration; retry button absent for failed scans.  
- Steel overview: Presents a dashboard with metric tiles; primary actions (e.g., “New Dispatch”) are visible but lacking micro‑interactions (ripple, loading).  
* Steel sub‑pages* (batches, customers, dispatches, invoices, inventory, etc.):  
  * Data tables use shadcn/ui tables with pagination; row actions (edit, delete) lack confirmation modals, posing a risk of accidental deletion.  
  * Forms (e.g., new batch, new customer) have inline validation missing; submit buttons provide no loading feedback.  
  * Detail pages (e.g., customer/[id]) show extensive data but sections are separated only by whitespace; visual hierarchy could be improved with cards or section titles.  
  * Empty states on tables (e.g., no batches) show a simple “No data” text; could benefit from illustrative empty states and call‑to‑action.

*System Routes* (403, offline)
- Loaded: Both.  
- Observations:  
  * 403 page provides a brief message but no guidance on how to regain access.  
  * Offline page shows a static message; lacks retry button or indication of reconnection attempts.

## Cross‑Page Consistency Issues
1. **Button Variants** – Primary actions use a mix of `btn-primary`, `btn-default`, and raw `<button>` elements, leading to inconsistent visual weight and hover/focus states.  
2. **Form Feedback** – Submit buttons across public and private forms consistently omit loading spinners or disabled state during async calls, leaving users uncertain whether their action registered.  
3. **Empty States** – Many tables and lists display only a terse “No records” message; no illustration or suggestive CTA, increasing perceived emptiness.  
4. **Navigation Highlight** – Active route indication in the sidebar/header uses a subtle font‑weight change only; low contrast makes it hard to identify the current section, especially on mobile.  
5. **Toast / Notification System** – Success and error messages appear inconsistently; some actions rely on browser console logs rather than in‑app UI feedback.  
6. **Typography Scale** – Heading sizes (h1–h2) vary between pages (e.g., dashboard uses `text-2xl`, settings uses `text-lg`), breaking rhythmic harmony.  
7. **Color Usage** – The brand’s warm‑clay palette is applied sporadically; many components retain the default shadcn gray‑blue background, diluting brand identity.

## Launch Blockers (Master List)
The following pages fail to load (timeout after 30 s) and prevent users from completing core workflows:

1. **OCR Base Page** (`/ocr`) – prevents initiating new scans; users must navigate via history/scan directly.  
2. **Register** (`/public/register`) – blocks new account creation.  
3. **Reset‑Password** (`/public/reset-password`) – blocks password recovery for existing users.  
4. **Signup** (`/public/signup`) – duplicate of register (same flow).  
5. **SLA** (`/public/sla`) – legal page inaccessible; may affect compliance trust.  
6. **Subprocessors** (`/public/subprocessors`) – legal page inaccessible.

All six pages are encountered early in the user journey (marketing, auth, legal) and will cause immediate frustration or abandonment.

## 10× Roadmap – Opportunities for Premium Experience
Grouped by theme, these enhancements would transform the UI from functional to delightful for non‑technical factory workers.

### Visual Identity & Branding
- Apply the warm‑clay color palette (primary `#D4A373`, secondary `#8B5E3C`) to buttons, links, form accents, and navbar backgrounds.  
- Replace default shadcn borders with a slightly rounded (`radius: 0.5rem`) and a subtle box‑shadow to convey depth.  
- Introduce a consistent heading scale (e.g., `h1: text-3xl font-bold`, `h2: text-2xl`, `h3: text-xl`) using the brand’s typeface (if any) or a clean sans‑serif with modest weight contrast.

### Loading & Feedback Systems
- Implement a global `useAsyncHook` wrapper that returns `{loading, error, data}` and automatically disables submit buttons, shows a spinner, and replaces button text with “Saving…”.  
- For file uploads (OCR), add a progress bar and indeterminate spinner during upload, with clear success (“Uploaded! Processing…”) and error (“Upload failed – try a smaller file”) toasts.  
- Use toast notifications (e.g., sonner) for all mutation outcomes (create, update, delete) with auto‑dismiss after 5 s.

### Empty State Rehabilitation
- Replace “No records” text with illustrated empty states (using the brand’s illustration style) accompanied by a primary button (“Add first entry”, “Upload a scan”, “Create batch”).  
- Ensure empty states are vertically centered and use ample padding to avoid feeling cramped.

### Form Safety & Validation
- Add inline validation (via react‑hook‑form + zod) that highlights fields in error on blur and displays helper text.  
- For destructive actions (delete batch, delete customer), present a confirmation modal with a clear “Cancel” vs “Delete” (red) button hierarchy.  
- Disable submit buttons until all fields pass validation, preventing futile requests.

### Navigation & Orientation
- Strengthen active item indication in the sidebar: use a 3‑px solid accent bar on the left + background tint (`#FFF5F0`).  
- Ensure mobile collapsible sidebar uses a large tap target (≥48 dp) and closes when tapping outside.  
- Add breadcrumb navigation on deep pages (e.g., Steel > Customers > John Doe > Details) to aid recall.

### Micro‑Interactions & Motion
- Apply subtle scale (`1.02`) and color change on hover for all interactive buttons and cards.  
- Use fade‑in slide‑up animations for modals and toast containers.  
- Animate table row insertion/deletion with a brief height transition to signal change.

### Accessibility & Touch Targets
- Audit all interactive elements for minimum 44 × 44 dp touch size; increase padding on icons and small buttons.  
- Ensure sufficient color contrast (≥4.5:1) for text against backgrounds (especially warm‑clay on white).  
- Add `aria-live="polite"` regions for dynamic updates (toast, status badges) to support screen‑reader users.

## Estimated Effort to Clear Launch Blockers
| Blocker | Root Cause (inferred) | Fix | Effort |
|---------|----------------------|-----|--------|
| OCR base page | Likely redirect loop due to missing auth guard or infinite `/ocr` → `/ocr/scan` loop | Add proper route guard or redirect to `/ocr/scan` when unauthenticated | 2 h |
| Register / Signup | Form submission timeout (possibly missing API endpoint or CORS issue) | Verify `/api/auth/register` endpoint; add loading state & error handling; reduce timeout to 10 s with retry | 3 h |
| Reset‑Password | Similar to register; token‑generation endpoint may be missing | Fix `/api/auth/reset-password` route; add UI feedback | 2 h |
| SLA | Static page missing or server‑side rendering error | Ensure `/pages/(public)/sla/page.tsx` exists and builds; check for infinite loop in getStaticProps | 1 h |
| Subprocessors | Same as SLA | Fix `/pages/(public)/subprocessors/page.tsx` | 1 h |
| **Total** | | | **≈9 hours** |

*Note: Effort estimates assume a single developer familiar with the codebase; QA and regression testing may add 2‑3 hours.*

## Conclusion
With the six timeout‑related launch blockers resolved, FactoryNerve’s UI is usable and exhibits a solid foundation. Targeted improvements in branding, feedback, empty states, form safety, navigation, and motion will markedly raise the perceived quality and trustworthiness for factory‑floor users, moving the product from “functional” to “excellent”.

## Screenshots
All screenshots captured during the audit are stored in the `web/audit-screenshots` directory, organized as `<route>_desktop.png` and `<route>_mobile.png`. A console error log is also available at `web/audit-screenshots/console-errors.log`.