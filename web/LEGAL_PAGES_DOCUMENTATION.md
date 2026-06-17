# Legal & Trust Pages — Developer Reference

## Overview

This document describes the complete suite of legal, trust, and policy pages for the DPR.ai B2B SaaS platform. All pages are built as Next.js App Router routes under `src/app/` following a consistent dark-theme design system.

**Total pages: 15**

---

## Architecture & Patterns

### Page Structure

Every page follows this pattern:
```
src/app/<route>/page.tsx
```
- All pages use `"use client"` (interactivity like print, accordion, search)
- Helper components (`Section`, `Body`, `SubHeading`, `DataTable`, `Th`, `Td`) are defined **locally in each file** (no shared imports) to keep pages self-contained
- Layout is a single-column `<main>` with a full-width dark background, then a max-w-4xl centered card with gradient

### Boilerplate Theme

```tsx
<main className="min-h-screen bg-[#090d14] px-4 py-8 text-[#e8edf7] sm:px-6 sm:py-12">
  <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:p-12">
```

### Shared Inline Components

Each page defines these locally (identical signatures across pages):

| Component | Props | Purpose |
|-----------|-------|---------|
| `Section` | `{ id: string; title: string; children }` | Section with anchor link and heading |
| `SubHeading` | `{ children }` | H3 sub-heading |
| `Body` | `{ children }` | Wrapper with `space-y-4 text-sm leading-7 text-slate-300` |
| `DataTable` | `{ children }` | Overflow-x-auto table wrapper with rounded-xl border |
| `Th` | `{ children }` | Table header cell with uppercase tracking |
| `Td` | `{ children, className? }` | Table data cell (some pages omit className prop) |

> **Note:** `/sla` and `/acceptable-use` define `Th`/`Td` inline without the `className` prop. The `/dpa` page has `Td` with optional `className`. When copying table components to a new page, use the `/dpa` version (`className?: string`) for maximum compatibility.

### Download / Print Button

Every legal page includes a "Download PDF" button in the header:
```tsx
<a href="#" onClick={(e) => { e.preventDefault(); window.print(); }} ...>
  <svg ... /> Download PDF
</a>
```

---

## Complete Page Registry

| # | Route | Page Title | Sections | Last Updated | Version |
|---|-------|-----------|----------|-------------|---------|
| 1 | `/privacy` | Privacy Policy | 12 | June 17, 2026 | — |
| 2 | `/terms` | Terms of Service | 16 | June 17, 2026 | 1.0 |
| 3 | `/cookies` | Cookie Policy | 7 + 12-row cookie table | June 17, 2026 | — |
| 4 | `/refunds` | Refund & Cancellation Policy | 8 (FAQ style) | June 17, 2026 | 1.0 |
| 5 | `/contact` | Contact Us | 7 contact cards + quick links | June 17, 2026 | — |
| 6 | `/security` | Security | 14 (with SVG icons per section) | June 17, 2026 | — |
| 7 | `/data-retention` | Data Retention Policy | 10 + 5 retention tables | June 17, 2026 | 1.0 |
| 8 | `/sla` | Service Level Agreement | 11 + 4 severity levels | June 17, 2026 | 1.0 |
| 9 | `/dpa` | Data Processing Addendum | 16 + 3 annexes | June 17, 2026 | 1.0 |
| 10 | `/compliance` | Trust Center | Badges + roadmap + 10 policy links | June 17, 2026 | — |
| 11 | `/acceptable-use` | Acceptable Use Policy | 9 + 12-row prohibited activities table | June 17, 2026 | — |
| 12 | `/subprocessors` | Sub-processors | 5 + 12-row sub-processor table | June 17, 2026 | 1.0 |
| 13 | `/faq` | FAQ | 5 accordion categories + search | June 17, 2026 | — |
| 14 | `/disclosure` | Responsible Disclosure Policy | 8 + 4-tier bounty table | June 17, 2026 | 1.0 |
| 15 | `/eula` | End User License Agreement | 12 | June 17, 2026 | 1.0 |

---

## Route Registration

All legal pages are excluded from the app shell sidebar. Add new routes to `shellHiddenRoutes` in:

**File:** `web/src/components/app-shell.tsx:550`

```typescript
const shellHiddenRoutes = new Set([
  "/", "/403", "/login", "/access", "/register",
  "/forgot-password", "/reset-password", "/onboarding/factory-required",
  "/privacy", "/terms", "/cookies", "/refunds", "/contact",
  "/security", "/data-retention", "/sla", "/dpa",
  "/compliance", "/acceptable-use", "/subprocessors",
  "/faq", "/disclosure", "/eula",
]);
```

---

## Footer Links

Footer legal links are maintained in **two separate files** that must be kept in sync:

### File 1: `web/src/components/auth-shell.tsx:170`
### File 2: `web/src/app/login/page.tsx:530`

Both use the same pattern:
```tsx
<div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/5 pt-6 text-xs text-slate-500">
  <span>&copy; {new Date().getFullYear()} DPR.ai Technologies</span>
  <Link href="/privacy" className="...">Privacy Policy</Link>
  <Link href="/terms" className="...">Terms of Service</Link>
  ...
  <a href="mailto:privacy@dpr.ai" className="...">Contact</a>
</div>
```

> **Important:** When adding a new legal page, you must update BOTH `auth-shell.tsx` AND `login/page.tsx` footer links, plus add the route to `shellHiddenRoutes`.

---

## Shared Configuration Reference

### Company Identity

| Field | Value |
|-------|-------|
| Legal Name | DPR.ai Technologies Pvt. Ltd. |
| Short Name | DPR.ai |
| Address | 4th Floor, Tech Tower, Industrial District, Shillong, Meghalaya 793001, India |
| Governing Law | India (courts of Shillong, Meghalaya) |

### Dates

| Date | Pages |
|------|-------|
| Last updated: June 17, 2026 | All pages |
| Effective: June 17, 2026 | `/terms`, `/dpa`, `/sla`, `/refunds`, `/data-retention`, `/disclosure`, `/eula` |
| Version 1.0 | `/terms`, `/sla`, `/dpa`, `/refunds`, `/data-retention`, `/subprocessors`, `/disclosure`, `/eula` |

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `bg-[#090d14]` | Page background | Outermost `<main>` |
| Card gradient | `linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))` | Content card |
| Card border | `border border-white/10` | Card outline |
| Card shadow | `0_24px_60px_rgba(2,6,23,0.45)` | Card depth |
| Text primary | `text-white` | H1/H2/H3 |
| Text body | `text-slate-300` | Body paragraphs |
| Text muted | `text-slate-400` | Dates, descriptions |
| Accent link | `text-sky-300 hover:underline` | All `<a>` and `<Link>` |
| Warning box | `rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-amber-200` | Disclaimers |
| Data row bg | `bg-white/[0.02]` | Table row alternative |
| TOC nav bg | `bg-white/[0.03]` | Table of contents box |

---

## Contact Emails Reference

These 9 emails are used across the legal pages. **To change an email in the future, search the entire `src/app/` directory for the old value.**

| Email | Purpose | Pages Used On |
|-------|---------|--------------|
| `privacy@dpr.ai` | Privacy inquiries, Data Subject Requests | `/privacy`, `/cookies`, `/data-retention`, `/dpa`, `/compliance` |
| `dpo@dpr.ai` | Data Protection Officer, GDPR, DPA, sub-processor objections | `/privacy`, `/dpa`, `/compliance`, `/subprocessors`, `/faq` |
| `legal@dpr.ai` | Legal notices, DPA execution, EULA | `/terms`, `/contact`, `/dpa`, `/acceptable-use`, `/eula` |
| `support@dpr.ai` | General support, technical issues, data export | `/terms`, `/refunds`, `/contact`, `/data-retention`, `/sla`, `/faq` |
| `billing@dpr.ai` | Billing inquiries, refunds, SLA credits | `/refunds`, `/contact`, `/sla` |
| `security@dpr.ai` | Vulnerability reports, security incidents | `/contact`, `/security`, `/dpa`, `/compliance`, `/acceptable-use`, `/faq`, `/disclosure` |
| `sales@dpr.ai` | Sales inquiries, demos, pricing | `/contact` |
| `hello@dpr.ai` | Business partnerships, media, integrations | `/contact` |
| `abuse@dpr.ai` | AUP violations, abuse reporting | `/acceptable-use` |

---

## How to Make Changes

### Change an Email Address

1. Search for the old email across all files: `grep -r "old@dpr.ai" app/`
2. Check both `src/app/` pages AND `src/components/auth-shell.tsx` AND `src/app/login/page.tsx`
3. Replace all occurrences with the new email
4. Run `npx tsc --noEmit` to verify

### Change Company Name or Address

1. Search for the current string across all files
2. Pages with full postal address: `/privacy`, `/terms`, `/cookies`, `/refunds`, `/contact`, `/acceptable-use`, `/eula`
3. Pages with company name only: `/security`, `/data-retention`, `/sla`, `/dpa`, `/compliance`, `/subprocessors`, `/faq`, `/disclosure`
4. Footer copyright in: `auth-shell.tsx`, `login/page.tsx`

### Change "Last Updated" or Version Date

Every page has a date string near the top. Search for `June 17, 2026` and replace globally when updating all pages.

### Add a New Legal Page

1. Create the directory: `New-Item -ItemType Directory -Path "src/app/<route>"`
2. Create `page.tsx` following the boilerplate above
3. Add the route to `shellHiddenRoutes` in `app-shell.tsx`
4. Add footer links to BOTH `auth-shell.tsx` AND `login/page.tsx`
5. Optionally add a card on `/compliance` (Trust Center) policy links grid
6. Run `npx tsc --noEmit` to verify

### Modify an Existing Page's Content

Each page is a single `page.tsx` file. Content is inline as JSX (not fetched from CMS or markdown). To change content:
1. Open the relevant `page.tsx`
2. Find the section by its `id` or heading text
3. Edit the JSX content directly
4. Run `npx tsc --noEmit` to verify

---

## Page-Specific Notes

| Route | Special Notes |
|-------|--------------|
| `/contact` | Uses `useState` for copy-to-clipboard; 7 contact cards with icons |
| `/security` | Uses `Section` with optional `icon` prop (not used on other pages) |
| `/faq` | Uses `useState` for accordion and search; `CategorySection` and `AccordionItem` sub-components |
| `/compliance` | No TOC nav; layout is a "hub" with cards instead of sections |
| `/refunds` | FAQ-style Q&A layout instead of numbered clauses |
| `/sla` | `Td` component does NOT have `className` prop (unlike `/dpa`) |
| `/disclosure` | Severity badges use inline conditional classes for color coding |
| `/terms`, `/dpa`, `/sla` | Use numbered clauses (e.g., "1.1", "2.3") |

---

## TypeScript Verification

All pages compile cleanly with:
```
npx tsc --noEmit
```
Pre-existing errors in `approvals-page.tsx` (unrelated `onEscalate` prop issue) are ignored — they are not part of the legal page suite.
