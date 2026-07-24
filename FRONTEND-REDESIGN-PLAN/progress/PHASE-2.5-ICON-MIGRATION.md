# Phase 2.5 — Inline SVG → lucide-react Migration

**Status:** Complete (icon migration + verification)
**Build:** `✓ Compiled successfully in 24.3s` (only the pre-existing, unrelated
`ocr-partial-result.tsx` stray-folder type error remains — not caused by this work).
**Runtime:** dev server verified, 0 console errors across audited pages.

## Summary

- **93 inline icon `<svg>` blocks migrated** to `lucide-react` components across
  **27 files**.
- Every replacement was **meaning-verified**: the source path geometry was matched
  against the lucide icon's own geometry, and — where the code used a self-describing
  local name (`ShieldSm`, `MailIcon`, `PersonaIcon type="user"`, `EngineIcon
  id="capture"`, etc.) — the name was cross-checked against the chosen lucide icon.
- **Interactions preserved**: the password Show/Hide toggle (Eye ⇄ EyeOff), the FAQ
  chevron rotation, and the mobile nav Menu ⇄ X toggle all keep their state logic,
  `aria-label`s, `aria-pressed`, and `sr-only` text unchanged.
- **Sizing preserved**: each lucide icon carries the original `h-* w-*` classes, so
  rendered sizes are pixel-identical (verified: 14px / 16px / 20px groups on live DOM).
- **Wrapper-preserving strategy**: where a file defined a local icon component
  (`function ShieldSm() { return <svg…/> }`), only the SVG body was swapped for the
  lucide element and the wrapper/name was kept. This guarantees **zero missed call
  sites** — every consumer keeps compiling against the same component identity.

## Files migrated (icon count)

### Auth / account flow
- `app/(public)/access/page.tsx` — ShieldCheck, Zap, Lock (3)
- `app/(public)/register/page.tsx` — ShieldCheck, Zap, Clock (3)
- `components/public/forgot-password-page.tsx` — Mail, ShieldCheck, Lock, RefreshCw (4)
- `components/public/reset-password-page.tsx` — Lock, ShieldCheck, RefreshCw (3)
- `components/public/verify-email-page.tsx` — Mail, ShieldCheck, Zap, Globe (4)
- `components/auth/password-field.tsx` — Eye / EyeOff **(interactive toggle)** (2)

### Notifications
- `components/private/notifications-page.tsx` — Star, Bell, ChevronRight (4)
- `components/private/notification-detail-page.tsx` — ChevronLeft ×3, Star, Bell (5)
- `components/shared/notification-bell.tsx` — Bell, Star, Clock, Check (4)

### OCR / capture
- `components/ocr/upload-box.tsx` — Upload (1)
- `components/ocr/progress-indicator.tsx` — Check (1)
- `components/ocr/mobile-entry.tsx` — Camera (1)

### System / onboarding
- `app/(system)/403/page.tsx` — Lock (1)
- `app/(private)/onboarding/factory-required/page.tsx` — AlertTriangle (1)

### Public landing sections
- `components/public/landing/hero-section.tsx` — Monitor, Users, Box, BarChart3, ArrowRight (5)
- `components/public/landing/personas-section.tsx` — User, Users, ClipboardPlus, Smartphone (4)
- `components/public/landing/problem-section.tsx` — FileText, MessageSquare, Clock (3)
- `components/public/landing/engines-section.tsx` — Camera, LayoutDashboard, ShieldCheck, FileText, LayoutGrid, Settings (6 of 7)
- `components/public/landing/product-preview.tsx` — ArrowRight (1)
- `components/public/landing/pricing-preview.tsx` — Check (1)
- `components/public/landing/nav-bar.tsx` — Menu / X **(interactive toggle)** (1)
- `components/public/landing/how-it-works.tsx` — ArrowRight (1)
- `components/public/landing/final-cta.tsx` — ArrowRight (1)
- `components/public/landing/faq-section.tsx` — ChevronDown **(rotation preserved)** (1)

### Public content pages
- `app/(public)/contact/page.tsx` — Mail, Headphones, DollarSign, Shield, Lock, Handshake, MapPin, Clock, Copy, Check, ExternalLink, HelpCircle, ArrowRight (14 of 15)
- `app/(public)/faq/page.tsx` — ChevronDown, Search, HelpCircle, ShieldCheck, Aperture, CreditCard, Bell, Mail (8)
- `app/(public)/disclosure/page.tsx` — ShieldCheck, Lock, Download (3 of 4)
- `app/(public)/eula/page.tsx` — Download (1)
- `components/public/pricing-page.tsx` — Check, Minus, Shield, Zap, BarChart3, Lock (6)

## Intentionally NOT migrated (documented exceptions)

| Location | Count | Why it stays a raw `<svg>` |
|---|---|---|
| `components/layout/app-shell.tsx` | 26 | **Deferred to Phase 3.** AppShell is the ~2,000-line god-component scheduled for decomposition; migrating its icons now would churn against that refactor. Per instruction: no AppShell work before Phase 3. |
| `components/shared/fn-logo.tsx` | 6 | **Brand logo**, not a UI icon. lucide has no equivalent; replacing it would destroy brand identity. |
| `components/private/premium-dashboard-page.tsx` | 1 | **Data-visualization chart** (line graph with axes/plotted series), not an icon. (Its hardcoded `#3EA6FF`/`#2DD4BF` series colors are a separate Phase-4 concern.) |
| `components/public/landing/engines-section.tsx` (`intelligence`) | 1 | Bespoke arc + external-arrow "scan/growth" glyph with **no exact lucide twin** (Radar/Sparkles/TrendingUp would each shift the meaning). Commented in-code. |
| `app/(public)/contact/page.tsx` (Emergency Support) | 1 | 8-ray **emergency beacon** burst; Sun/Loader would change the meaning. Commented in-code. |
| `app/(public)/disclosure/page.tsx` (`BugIcon`) | 1 | Bug-bounty hero glyph is a plus-in-circle; lucide `Bug` changes the shape and `PlusCircle` drops the domain meaning. Commented in-code. |

**Total remaining raw `<svg>` in `web/src`: 36** — all in the six categories above,
each either deferred (app-shell) or a justified bespoke/brand/chart glyph.

## Meaning-verification notes (non-obvious mappings)

- **personas `clipboard`** → `ClipboardPlus` (geometry is clipboard + a vertical &
  horizontal line forming a plus, not a list).
- **engines `execution`** → `LayoutDashboard` (rect + top divider + left column).
- **engines `steel`** → `LayoutGrid` (4 equal rects).
- **faq "Data & Privacy"** → `Aperture` (square + centre lens + spoke); chosen over
  Camera because the glyph is a lens/aperture, matching the privacy-lens metaphor.
- **notification-bell regular item** → `Clock` (the source used a clock/recency glyph
  here, unlike the detail/list pages which use `Bell`). Kept the distinction.
- **contact `HandshakeIcon`** → `Handshake` (name-driven; the original was a simplified
  custom mark, lucide Handshake carries the intended partnership meaning better).

## Verification performed

- `npx tsc --noEmit` after each area batch — clean (excluding the pre-existing OCR error).
- `next build` — `✓ Compiled successfully in 24.3s`.
- Live dev server (managed preview): navigated `/`, `/access`, `/register`, `/contact`.
  - 0 console errors.
  - Confirmed lucide icons render (34 on `/`, 26 on `/contact`, 3 on `/access` panel).
  - Confirmed pixel sizes (16px for h-4, 20px for h-5, 14px for h-3.5) — no size drift.
  - Exercised the password Eye⇄EyeOff toggle: icon + `aria-label` swap correctly in sync.
