# i18n Migration Strategy: Splitting the 1,316-Line Provider

**Target file:** `web/src/lib/i18n.tsx` (1,316 lines)
**Goal:** Extract into a slim provider wrapper + per-feature namespace files (already present in `src/locales/en/`).

---

## 1. Current State

### Provider (`src/lib/i18n.tsx`) — 1,316 lines
The monolithic file contains four distinct concerns:

| Concern | Lines | Description |
|---|---|---|
| **React context + provider** | ~120 | `I18nProvider`, `useI18n`, `useI18nNamespaces`, `useDocumentDirection` |
| **Inline translation maps** | ~360 | `PHRASE_TRANSLATIONS` (Hindi), `WORD_TRANSLATIONS` (Marathi + Hindi), `TAMIL_TRANSLATIONS`, `TELUGU_TELUGU_TRANSLATIONS` — hardcoded legacy translations for Indian languages |
| **DOM mutation observer** | ~200 | `translateNode()`, `walkDOM()`, `observeMutations()` — walks the DOM to replace text nodes in non-React legacy pages |
| **Locale loader bridge** | ~236 | `loadNamespacedTranslations()`, locale detection, `language` state management, storage sync |

### Locale files (`src/locales/en/`) — Already modular
| File | Keys | Purpose |
|---|---|---|
| `common.json` | 13 | Shared utility labels: `save`, `cancel`, `open`, `loading`, `close`, `confirm` |
| `auth.json` | 225 | Login, register, forgot password, verify email, reset password |
| `attendance.json` | 156 | Attendance tracking, clock-in/out, shifts, reports |
| `ocr.json` | ~80 | OCR scan, verification, job management |
| `tasks.json` | 69 | Task management, work queue |
| `ai.json` | 73 | AI insights, analysis |
| `analytics.json` | 50 | Dashboard analytics |
| `settings.json` | 27 | User settings |
| `queue.json` | 22 | Work queue |
| `reports.json` | 32 | Reports |
| `billing.json` | 9 | Billing and plans |
| `forms.json` | 4 | Field labels |
| `notifications.json` | 2 | Notification strings |
| `errors.json` | 2 | Error strings |
| `navigation.json` | — | Navigation labels |
| `dashboard.json` | 0 | (Empty — likely unused) |

### Usage patterns — ~1,720 `t()` calls across 80+ files
- **`t("key")`** — Direct key lookup (flat namespace, no prefix)
- **`useI18n()`** — Returns `{ t, locale, language, ... }`
- **`useI18nNamespaces(["auth", "common"])`** — Preloads specific locale files
- **`I18nProvider`** — Wraps root in `src/components/app-providers.tsx`

---

## 2. Migration Strategy: Phase 5.3 Deliverables

### A. Slim `src/i18n/index.ts` ✅ (already created, 48 lines)
A thin re-export module that re-exports the existing provider, hook, and namespace loader from `@/lib/i18n` so new code can import from `@/i18n` instead of `@/lib/i18n`.

```ts
// src/i18n/index.ts — 48 lines
export { I18nProvider, useI18n, useI18nNamespaces, useDocumentDirection } from "@/lib/i18n";
export type { I18nContextValue, I18nProviderProps, TranslateFn } from "@/lib/i18n";
```

This allows a gradual import migration without touching the existing provider.

### B. Import Pattern Migration
**Before:**
```tsx
import { useI18n, useI18nNamespaces } from "@/lib/i18n";

function MyComponent() {
  const { t } = useI18n();
  useI18nNamespaces(["attendance"]);

  return <h1>{t("attendance.title")}</h1>;
}
```

**After (Phase 1 — namespace-aware imports):**
```tsx
import { useI18n, useI18nNamespaces } from "@/i18n";

function MyComponent() {
  const { t } = useI18n();
  useI18nNamespaces(["attendance"]);

  return <h1>{t("title")}</h1>;  // namespace stripped — context provides it
}
```

**After (Phase 2 — per-feature provider scoping):**
```tsx
import { useI18n } from "@/i18n";
import { useAttendanceTranslations } from "@/features/attendance/i18n";

function MyComponent() {
  const { t } = useAttendanceTranslations();  // scoped to attendance namespace
  return <h1>{t("title")}</h1>;
}
```

### C. Incremental Migration Order

| Phase | Scope | Impact | Risk |
|---|---|---|---|
| **Phase 0** (now) | Create `src/i18n/index.ts` re-export ✅ | None | None |
| **Phase 1** | Migrate imports `@/lib/i18n` → `@/i18n` across all 20 files | ~20 files | Low — pure import alias |
| **Phase 2** | Extract legacy inline translation maps → `src/locales/hi/`, `src/locales/mr/`, `src/locales/ta/`, `src/locales/te/` JSON files | Shrinks provider by ~360 lines | Medium — ensure fallback chain works |
| **Phase 3** | Extract DOM mutation observer → `src/lib/i18n-dom.ts` (separate module) | Shrinks provider by ~200 lines | Low — DOM translator is only used in legacy OCR pages |
| **Phase 4** | Extract locale loader bridge → `src/lib/i18n-loader.ts` | Shrinks provider by ~236 lines | Medium — test all locales load correctly |
| **Phase 5** | Slim remaining provider to ~80 lines — pure React context | ~1,236 lines removed | Low — well-tested by this point |

### D. Shared Key Strategy

**Shared keys** (`common.json` — 13 keys) are the most frequently referenced across features:

| Key | Used By | Migration Action |
|---|---|---|
| `common.save` | attendance, settings, profile forms | Keep in `common.json` |
| `common.cancel` | attendance, settings, approval modals | Keep in `common.json` |
| `common.loading` | all features (default loading state) | Keep in `common.json` |
| `common.open` | navigation, attachment previews | Keep in `common.json` |
| `common.close` | modals, drawers, notifications | Keep in `common.json` |
| `common.confirm` | approval workflows, destructive actions | Keep in `common.json` |

**Rule:** If a key is used in 3+ features, it goes in `common.json`. If used in 1-2 features, it stays in the feature namespace and is imported directly.

### E. File-by-File Migration Checkpoints

To make the migration safe, each step has a build checkpoint:

1. `npm run typecheck` — must pass after each batch of file migrations
2. Vitest smoke tests — must pass
3. Manual `console.log(JSON.stringify(translations))` per namespace to verify all keys load

**Recommended batch order for import migrations:**
```
Batch 1: src/components/ui/         (form-field, button, card, badge)
Batch 2: src/features/auth/         (login, register, forgot-password, verify-email)
Batch 3: src/features/attendance/   (attendance-page, attendance-live, reports)
Batch 4: src/features/ocr/          (ocr-page, ocr-verify)
Batch 5: src/components/            (app-shell, billing, work-queue, settings)
Batch 6: src/features/dashboard/    (dashboard workspaces, charts)
Batch 7: src/features/steel/        (steel production, inventory)
Batch 8: src/features/approvals/    (approval workspace)
```

---

## 3. Out-of-Scope for This Migration

The following are **intentionally excluded** from this migration plan because they are frozen legacy features:

- **DOM mutation observer** (`translateNode`, `walkDOM`, `observeMutations`) — only runs on legacy PHP pages; will be removed when the legacy OCR pages are decommissioned.
- **Inline Hindi/Marathi/Tamil/Telugu translation maps** — these are static dictionaries for languages that do not have JSON locale files yet; they are a lexical fallback, not proper i18n. Will be extracted to JSON only when those locales are officially supported.
- **`dashboard.json`** (empty file) — should be deleted after confirming no code references any `dashboard.*` key.

---

## 4. Rollback Plan

Each phase is reversible within a single PR:

| Action | Rollback |
|---|---|
| Import alias (`@/lib/i18n` → `@/i18n`) | `sed -i 's|@/i18n|@/lib/i18n|g'` |
| DOM observer extraction | Revert the singular file delete |
| Locale JSON extraction | Revert the file addition |
| Provider slim-down | Revert to the previous `i18n.tsx` |

---

## 5. Success Criteria

- [ ] `src/lib/i18n.tsx` reduced from 1,316 → ≤80 lines
- [ ] All 20 consumer files import from `@/i18n` instead of `@/lib/i18n`
- [ ] `src/i18n/index.ts` stays ≤50 lines
- [ ] Legacy inline translations extracted to JSON (Hindi, Marathi, Tamil, Telugu)
- [ ] DOM mutation observer in separate module
- [ ] `npm run typecheck` passes after each batch
- [ ] All 15 Vitest smoke tests pass
