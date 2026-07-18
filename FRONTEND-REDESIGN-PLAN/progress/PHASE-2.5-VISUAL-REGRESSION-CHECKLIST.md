# Phase 2.5 — Visual Regression Checklist (Icon Migration)

Scope: every page/component touched by the inline-SVG → lucide migration.
Check each for **spacing, sizing, alignment, accessibility, and contrast** regressions.

Legend: ✅ verified on live dev server · 🔍 spot-check recommended · n/a not applicable

Global invariant (verified): each lucide icon keeps the original element's `h-* w-*`
classes, so intrinsic size is unchanged. lucide defaults `strokeWidth=2`; where the
source used a different weight (1.4–2.5) the value was passed explicitly, so stroke
weight matches too.

---

## Auth / account flow

### `/access` (login)  ✅
- [x] **Sizing** — ShieldCheck/Zap/Lock render 16×16 (was `h-4 w-4`). Verified live.
- [x] **Alignment** — trust-point row: icon baseline-aligned with label text.
- [ ] 🔍 **Contrast** — icons inherit `--accent`; confirm ≥3:1 against panel bg (AA for
      non-text graphics). Accent `#c56d2d` on dark panel passes.
- [x] **A11y** — icons decorative (paired with visible text); no aria needed.

### `/register`  ✅
- [x] ShieldCheck / Clock / Zap trust icons at 16px, accent color. Verified live.
- [x] **Interaction** — PasswordField Eye⇄EyeOff toggles; `aria-label` "Show/Hide
      password" stays in sync. Verified live (click test).
- [ ] 🔍 Confirm the "Account Type" select and phone field spacing unaffected.

### `/forgot-password`, `/reset-password`, `/verify-email`  🔍
- [ ] Mail / ShieldCheck / Lock / RefreshCw / Clock / Globe render at `h-4 w-4`.
- [ ] Trust-point rows align; no wrap/overflow at mobile 375px.
- [ ] RefreshCw and Globe (multi-path) render fully (no clipped strokes).

---

## Notifications

### `/notifications`  🔍
- [ ] **NotificationIcon** badge: Star (approval_bypass, amber, 18px) / Bell (accent,
      18px) centered in the 36px rounded tile — check optical centering.
- [ ] Empty-state Bell at 40px, `opacity-30`, muted color — contrast intentionally low.
- [ ] Row hover ChevronRight fades in (`group-hover:opacity-60`) — interaction intact.
- [ ] Pagination ChevronLeft/ChevronRight unaffected.

### `/notifications/[id]` (detail)  🔍
- [ ] Back-nav ChevronLeft ×2 (round 40px buttons) centered; hover border intact.
- [ ] Header Star/Bell at 24px (`h-6 w-6`).
- [ ] "Back to notifications" button ChevronLeft has `mr-2` gap preserved.

### notification-bell (dropdown, in AppShell header)  🔍
- [ ] Bell trigger icon + unread badge alignment.
- [ ] Dropdown item Star/Clock at 16px; Mark-as-read Check at 14px.
- [ ] **A11y** — trigger keeps `aria-label`/`aria-expanded`/`aria-haspopup`; mark-read
      button keeps `aria-label="Mark as read"`.
- [ ] NOTE: rendered inside app-shell (Phase-3 territory) but the bell component itself
      is migrated and independent.

---

## OCR / capture

### upload-box  🔍
- [ ] Upload icon 28px (`h-7 w-7`) centered in 64px ring; drop-zone unaffected.
### progress-indicator  🔍
- [ ] Check at 14px inside step dot; completed-step contrast unchanged.
### mobile-entry  🔍
- [ ] Camera icon 28px, `mx-auto` centered; "Scan with camera" aria-label intact.

---

## System / onboarding

### `/403`  🔍
- [ ] Lock icon 28px centered in error card.
### `/onboarding/factory-required`  🔍
- [ ] AlertTriangle 20px, amber; aligns with the uppercase label baseline.

---

## Public landing (single-page, sections)  ✅ (page-level)

Verified live on `/`: 34 lucide icons render, 0 console errors.

### hero-section  ✅
- [x] Feature tiles: Monitor/Users/Box/BarChart3 at 16px in 32px amber tiles.
- [x] Primary CTA ArrowRight 16px, `strokeWidth 2.5`, gap preserved.
### personas-section  🔍
- [ ] User/Users/ClipboardPlus/Smartphone at 24px, `text-teal-300`.
- [ ] ⚠️ **Contrast note (Phase-4)**: `text-teal-300` is a color leak vs the accent
      identity — flagged, not changed in 2.5 (geometry-only migration).
### problem-section  🔍
- [ ] FileText/MessageSquare/Clock at 24px, `text-amber-400/80`.
### engines-section  🔍
- [ ] 6 migrated icons at 24px; `intelligence` bespoke glyph still renders (exception).
- [ ] ⚠️ `text-amber-300` — same Phase-4 color-leak note.
### nav-bar  ✅
- [x] **Interaction** — mobile Menu⇄X toggle (verified: `lucide-menu` present at mobile).
- [ ] 🔍 Confirm X shows when `mobileOpen` (resize ≤768px, click toggle).
### product-preview / how-it-works / final-cta  🔍
- [ ] ArrowRight at 16px / 24px / 16px respectively; CTA gaps intact.
### pricing-preview  🔍
- [ ] Check at 14px, `text-emerald-400`, feature-list alignment.
### faq-section  🔍
- [ ] ChevronDown rotates 180° on expand (`rotate-180` class preserved).

---

## Public content pages

### `/contact`  ✅
- [x] 26 lucide icons render; sizes group cleanly at 14/16/20px. Verified live.
- [x] Contact-method cards: Lock/Shield/Handshake/DollarSign/MapPin/Mail aligned.
- [x] Emergency Support beacon (bespoke exception) renders emerald, aligned.
- [ ] 🔍 Copy→Check swap on "copy email" click (CheckIcon/CopyIcon conditional).
- [ ] 🔍 Send-Message ArrowRight + HelpCircle FAQ pill gaps.

### `/faq`  🔍
- [ ] Category icons at 20px: ShieldCheck(emerald)/Aperture(violet)/CreditCard(amber)/
      Bell(accent) — colors intentional, check contrast each.
- [ ] Search icon in filter input 16px, aligned with placeholder text.
- [ ] Accordion ChevronDown rotation preserved.

### `/disclosure`  🔍
- [ ] ShieldCheck(emerald, 20px)/Lock(16px)/Download(16px); BugIcon bespoke (32px) intact.
### `/eula`  🔍
- [ ] Download icon 16px in the download button; gap preserved.

### `/pricing`  🔍
- [ ] Feature table Check(accent, 16px) / Minus(muted 40% opacity, 16px) alignment in
      cells — the muted dash contrast is intentionally low.
- [ ] Trust-band Shield/Zap/BarChart3/Lock at 24px, accent.

---

## Cross-cutting checks

- [x] **Build** compiles (`next build` ✓, 24.3s).
- [x] **No console errors** on `/`, `/access`, `/register`, `/contact`.
- [ ] 🔍 **Dark-mode** (app is dark-only) — n/a light theme, but confirm accent icons
      readable on both `--card` and `--card-strong` surfaces.
- [ ] 🔍 **Mobile 375px** — re-check auth trust panels are `hidden` (they are) and
      content-page icon rows wrap without overlap.
- [ ] 🔍 **Keyboard focus** — interactive icon buttons (password toggle, nav toggle,
      mark-as-read) still receive focus ring (they wrap `<Button>`/`<button>` — unchanged).

## Known deferrals feeding later phases
- `text-teal-300` / `text-amber-300` icon colors on landing = **Phase-4** color-identity
  unification (out of scope for geometry-only 2.5).
- app-shell (26 icons) = **Phase-3** decomposition.
- premium-dashboard chart colors `#3EA6FF`/`#2DD4BF` = **Phase-4**.
