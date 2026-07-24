# Workflow 6: Reports & Export Pipeline

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy
**Workflow ID:** W-06
**Priority:** HIGH

---

## Workflow Map

**Start:** Dashboard or sidebar → `/reports`
**End:** Downloadable export (Excel/CSV/JSON/PDF) or AI executive summary
**Goal:** Select date range, filter entries, export trusted factory data for owner/management reporting

### Flow Diagram
```
/reports
  ├── Set date range (presets: Today/7d/Month or custom)
  ├── Apply filters (shift, issues, status, search)
  ├── Export options
  │     ├── Excel (async job with progress polling)
  │     ├── Weekly/Monthly JSON
  │     ├── Visible CSV
  │     └── Per-entry PDF/Excel
  ├── Trust & insights section (collapsed)
  │     ├── ReportInsightsBoard (charts)
  │     ├── OCR trust summary
  │     └── Steel overview
  └── AI Executive Summary
        └── Async job with polling → narrative + metrics
```

### Click Count: 3-6 clicks per export
**Efficiency:** 5/10

### Critical Findings

**CRITICAL: Trust gate dependency not enforced**
The page shows OCR trust summary and recommends reviewing pending documents, but does not block export if untrusted OCR data exists. An operator can export Excel with unreviewed OCR rows mixed in.

**HIGH: Async job polling adds latency**
Both Excel export and AI summary use 1.2s polling intervals. Users wait 5-30+ seconds. No WebSocket or SSE for real-time updates.

**HIGH: Accountant view is restrictive**
Accountant role: cannot see raw entries, cannot load page data. Only summary exports and insights. This is enforced by `isAccountant` flag that skips loadRows(). The page skeleton shows, then shows nothing useful for 2+ seconds before rendering restricted message.

**MEDIUM: "Connected lanes" and most content collapsed behind `<details>`**
The page collapses: advanced filters, trust/insights, executive summary, connected lanes report hub cards. Users must click open 4-5 sections to understand the full page.

### Efficiency Score: 50/80 (62.5%)

### Recommendations
1. Warn/block export if pending OCR documents exist
2. Replace polling with SSE or WebSocket for job status
3. Better accountant experience (show at least summary numbers immediately)
4. Reduce `<details>` nesting — at most 2 levels deep
