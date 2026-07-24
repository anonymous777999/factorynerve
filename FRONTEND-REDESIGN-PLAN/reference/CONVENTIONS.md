# Conventions Cheatsheet (read before every change)

## DO
- Import primitives from `@/components/ui/*`.
- Use token classes: `text-[var(--text)]`, `bg-[var(--card)]`, `border-[var(--border)]`,
  `text-[var(--muted)]`, accent via `var(--accent)`.
- Use Tailwind breakpoints (`sm md lg xl`) for layout.
- Use `lucide-react` for icons, fixed sizes 16/20/24, with `aria-label` when icon-only.
- Keep interactive controls >= 44x44px (`h-11`/`min-h-11`, adequate padding).
- Route className through `cn()` (which, after Phase 0, uses `tailwind-merge`).
- Keep diffs small and behavior-preserving.

## DON'T
- No raw `#hex` / `rgba()` in `.tsx`. (grep gate in Phase 0.)
- No raw `<button>` — use `Button`. No local `TabButton/StatCard/Badge/Pill` re-defs.
- No `window.innerWidth` breakpoint logic — use `useMediaQuery`.
- No fixed `w-[..px]`/`h-[..px]` on layout containers (overflow risk).
- No second UI kit. No pasting v0/Magic output unadapted.
- No changing API/auth/routing/business logic in a styling PR.

## Per-change checklist
- [ ] Uses primitives + tokens only.
- [ ] Responsive at 360 / 768 / 1024 / 1440 (no horizontal scroll).
- [ ] Tap targets >= 44px; visible `focus-visible` ring.
- [ ] `npm run build` clean; `npm run audit:overflow` clean for touched routes.
- [ ] Logged in `progress/CHANGELOG.md`.

## Quick grep gates (run from repo root)
```bash
# raw hex in changed files (should be 0 for files you touched)
grep -rEn "#[0-9a-fA-F]{6}" web/src/<yourfile>
# raw buttons
grep -rn "<button" web/src/<yourfile>
# innerWidth usage
grep -rn "innerWidth" web/src
```
