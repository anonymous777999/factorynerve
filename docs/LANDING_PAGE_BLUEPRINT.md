# FactoryNerve Landing Page Blueprint

This document is the source of truth for the public homepage redesign.

The current problem is not visual quality alone. The current homepage feels too much like a polished component library or internal product page. A first-time visitor should quickly understand:

- what FactoryNerve is
- who it is for
- why it is better than paper, WhatsApp, and Excel
- what the product actually looks like
- what action to take next

## Design Goal

Build a landing page that feels:

- operational
- trustworthy
- premium
- factory-first
- mobile-ready

Avoid making it feel:

- like a component showcase
- like a generic AI startup
- like a dashboard preview made of repeated cards

## Why The Current Version Misses

- Too many sections use the same card language and the same visual weight.
- The page explains the product before showing the product.
- There is not enough proof, trust, or business grounding.
- The hierarchy is too flat, so nothing feels like the single most important thing.
- Visitors do not get a strong “this is built for factories” emotional reaction in the first screen.

## Reference Direction

We are not copying one template. We are borrowing proven section patterns.

Useful pattern libraries from 21st.dev:

- Hero and banner direction:
  - https://21st.dev/community/components/s/landing-page-banner
  - https://21st.dev/community/components/s/hero
  - https://21st.dev/community/components/s/hero-section-bg
- Structured feature storytelling:
  - https://21st.dev/community/components/s/feature-section
  - https://21st.dev/community/components/s/overview-section
  - https://21st.dev/community/components/s/bento-features
  - https://21st.dev/community/components/s/bento-grid
- Trust and conversion:
  - https://21st.dev/community/components/s/logo-cloud
  - https://21st.dev/community/components/s/testimonial-section
  - https://21st.dev/community/components/s/call-to-action

## Locked Design Decisions

- The landing page is only for signed-out users.
- Signed-in users should continue to redirect into their role-based workspace.
- We should use fewer sections than the current version.
- We should use at least one real product visual above the fold.
- We should not rely on a wall of feature cards to explain value.
- We should show trust and proof earlier.
- The page should still feel strong on mobile first.

## New Page Structure

### 1. Header

Purpose:
- orient the visitor immediately
- make the primary actions obvious

Contents:
- FactoryNerve wordmark
- small supporting label like `Factory-first operating system`
- actions:
  - `Book demo`
  - `Sign in`
  - `Start free`

Notes:
- Keep this light and calm.
- Avoid too many nav links.

### 2. Hero

Purpose:
- create a strong first impression
- clearly explain the outcome
- show the actual product

Layout:
- left: headline, subheadline, CTA cluster, trust line
- right: real product visual

Copy direction:
- Headline should focus on outcome, not feature inventory.
- Example direction:
  - `Run daily factory work from one mobile-ready system.`
  - `Replace paper registers, WhatsApp follow-up, and scattered sheets with one trusted workflow.`

Primary CTA:
- `Start free`

Secondary CTAs:
- `Book demo`
- `Sign in`

Visual direction:
- Use a strong product mockup, not a text-heavy card.
- Prefer:
  - one mobile screen
  - one desktop screen
  - or one layered workflow visual showing attendance + OCR + dashboard

Do not:
- fill the hero with many small cards
- over-explain before the user scrolls

### 3. Trust Strip

Purpose:
- reduce doubt quickly
- make the product feel real

Possible content:
- `Built for daily factory operations`
- `Attendance`
- `OCR`
- `Approvals`
- `Reports`
- `Offline-aware`

Preferred upgrade:
- show real proof if available:
  - factories onboarded
  - shifts tracked
  - OCR docs processed
  - review items cleared

If real customer logos are not available yet:
- use metric-based trust instead of fake logos

### 4. Problem To Solution Section

Purpose:
- connect with real factory pain
- prove the product solves daily friction

Recommended structure:
- 3 side-by-side cards or 3 alternating rows

Problems to cover:
- paper attendance slows the floor
- OCR creates retyping and review chaos
- supervisors lose time across chats and spreadsheets

Each item format:
- pain statement
- clear FactoryNerve outcome
- optional mini visual or number

Important:
- this should feel like business empathy, not generic SaaS feature copy

### 5. Product Walkthrough

Purpose:
- show how the system works end to end

Recommended 3-step flow:
- `Capture`
- `Review`
- `Report`

This should be the main bento-style section.

Each block should show:
- a small product screenshot or visual
- one short label
- one short explanation

Best direction:
- asymmetrical grid
- one large featured panel
- two supporting panels

Do not:
- make this a wall of text

### 6. Role-Based Outcomes

Purpose:
- help each kind of visitor self-identify

Roles:
- Operators
- Supervisors
- Managers
- Owners

Each card should answer:
- what they do here
- what gets easier for them

Keep it shorter than the current version.

Preferred style:
- four clean cards
- not too much body copy
- stronger role labels and one-line outcomes

### 7. Proof / Social Trust

Purpose:
- give credibility before the final CTA

Best options:
- one strong testimonial
- two or three pilot metrics
- one operations result strip

Example proof types:
- `Punch visibility became same-shift instead of end-of-day`
- `OCR review moved from retyping to approve/reject`
- `Managers stopped waiting for manual Excel consolidation`

If we do not have customer quotes yet:
- use product proof + operational metrics instead of fake testimonials

### 8. Final CTA

Purpose:
- make the next action obvious

Recommended:
- one strong final panel
- short, high-confidence copy

Actions:
- `Start free`
- `Book demo`
- `Sign in`

This should feel simpler and stronger than the current footer CTA.

## Copy Rules

- Lead with business outcomes, not module names.
- Use plain English.
- Avoid generic AI phrases.
- Keep paragraph length short.
- Make every section answer one question only.

Good:
- `Supervisors clear review blockers before the next shift loses momentum.`

Bad:
- `Leverage a unified AI-powered workflow ecosystem for operational excellence.`

## Visual Rules

- Use more whitespace.
- Use fewer cards overall.
- Make one section visually dominant at a time.
- Use product screenshots earlier.
- Keep one accent family, not too many competing highlight colors.
- Avoid making every section look like the same bordered rectangle.

## What To Remove From The Current Homepage

- repeated equal-weight card blocks
- too many explanatory sections before proof
- product preview as just another card cluster
- long-form role descriptions
- sections that feel like internal roadmap copy instead of customer-facing copy

## Recommended Build Order

1. Hero + header
2. Trust strip
3. Product walkthrough
4. Problem to solution
5. Role-based outcomes
6. Proof section
7. Final CTA

## Phase 1 Implementation Goal

For the first redesign pass, the homepage should achieve this:

- a new visitor understands the product in under 10 seconds
- the page looks like a real company/product website
- the first screen shows the product, not just design blocks
- the primary CTA is clear
- the whole page feels less like a library and more like a business product

## Definition Of Done

- Signed-out users see the new landing page
- Signed-in users still redirect normally
- Above-the-fold includes a real product visual
- Mobile layout remains strong
- CTA hierarchy is obvious
- The page no longer feels like repeated component cards
