# DPR.ai Desktop Component Structure Guide

**Status**: Starting Page-by-Page Implementation from Stitch Reference

---

## PHASE 1: AUTHENTICATION PAGES (4 pages)

### 1. LOGIN PAGE ✅ [COMPLETED]
**File**: `web/src/components/ui/login-1.tsx`
**Reference**: `stitch_iteration_tracker/login_desktop_refined`

**Structure**:
```
- Header (48px)
  - Logo: DPR.ai + Factory OS badge
  - Right: Steel Industry label + FACTORY OS button

- Main Content (2-column grid)
  Left Column (col-span-4):
    - Page title + subtitle
    - Security status panel (guardrails)
    - System status indicators
    - Emergency contact footer
  
  Right Column (col-span-8):
    - Centered form container (max-w-md)
    - Email input (with icon)
    - Password input (with visibility toggle)
    - Primary CTA button
    - OAuth options (Active: Microsoft/Google)
    - Register link
```

**Key Classes**:
- Header: `bg-surface-primary border-b border-border-strong h-12`
- Main: `grid grid-cols-12 gap-8 px-8 py-8`
- Left sidebar: `col-span-4 border-r border-border-default`
- Form: `bg-surface-elevated border-2 border-border-strong rounded-xl p-8`

---

### 2. REGISTER PAGE 🔄 [IN PROGRESS]
**File**: `web/src/app/register/page.tsx`
**Reference**: `stitch_iteration_tracker/register_desktop_refined`

**Structure**:
```
- Header (same as Login)

- Main Content (Ambient glow background)
  Container: max-w-6xl grid grid-cols-12 gap-8

  Left Column (col-span-12 lg:col-span-7):
    - Top gradient accent line
    - Title + subtitle
    - Form sections:
      * Operator Identity (icon + section)
        - Factory/Company name
        - Admin name  
        - Role selection (dropdown)
        - Corporate email
      * Security Credentials (icon + section)
        - Password fields
        - Company code
        - Phone number (formatted)
    - Form actions
    - Already provisioned link

  Right Column (col-span-5, hidden on mobile):
    - System Integrity panel
      * Compliance standards
      * AI Processing info
    - Provisioning Workflow map
      * Step 1: Submit Details (completed circle)
      * Step 2: Verify Inbox (numbered circle)
      * Step 3: Unlock Sign-in (numbered circle)
```

**Key Structure Elements**:
- Accent line: `absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary-container to-transparent`
- Section header: icon + "SECTION TITLE" (uppercase, tracked)
- Form blocks: separated by `border-t border-border-subtle pt-base`
- Progress circles: filled (#primary) or empty (surface-raised)

---

### 3. VERIFY EMAIL PAGE 📋 [TODO]
**File**: `web/src/app/verify-email/page.tsx`
**Reference**: `stitch_iteration_tracker/verify_email_desktop_refined`

**Expected Structure**:
```
- Header (same)

- Main Content (centered)
  - Verification status indicator
  - Email display
  - Verification code input
  - Resend button
  - Back to register link
  - Status messages
```

---

### 4. FORGOT PASSWORD PAGE 📋 [TODO]
**File**: `web/src/app/forgot-password/page.tsx`
**Reference**: `stitch_iteration_tracker/forgot_password_desktop_refined`

**Expected Structure**:
```
- Header (same)

- Main Content (2-column)
  Left Column (col-span-4):
    - Recovery instructions
    - Security guidelines
    - Support contact
  
  Right Column (col-span-8):
    - Email input
    - Submit button
    - Success message (if sent)
    - Alternative options
```

---

## PHASE 2: DASHBOARD PAGES (4 pages)

### 5. DASHBOARD PAGE 📋 [TODO]
**Reference**: `stitch_iteration_tracker/dashboard_full_operational_report_refinement`

**Structure**:
```
- Fixed Header (48px)
- Flex layout:
  - Sidebar (left, collapsible)
  - Main content:
    * Top action bar
    * Metrics strip
    * Data table / Grid
    * Detail panels
```

---

### 6. ATTENDANCE PAGE 📋 [TODO]
**Reference**: `stitch_iteration_tracker/attendance_desktop_refined`

---

### 7. SHIFT ENTRY PAGE 📋 [TODO]
**Reference**: `stitch_iteration_tracker/shift_entry_desktop_command_center`

---

### 8. LIVE MONITORING PAGE 📋 [TODO]
**Reference**: `stitch_iteration_tracker/live_monitoring_operational_pulse`

---

## PHASE 3: OPERATIONS PAGES (7 pages)

9. Customer Ledger
10. Inventory  
11. Invoice Dispatch
12. Invoice Management
13. Approval Queue
14. Work Queue
15. Entry Review

---

## PHASE 4: OCR & REPORTS (5 pages)

16. OCR Upload
17. OCR Processing
18. OCR Review/Edit
19. OCR Export
20. Attendance Reports

---

## PHASE 5: ADMIN & ADVANCED (14 pages)

21-34: Factory Administration, User Governance, Usage Analytics, Alert Routing, Loss Analytics, Customer Intelligence, Attendance Review, OCR Workspace, Live Attendance, Unified Command Center, High Density Workstation, Email Operations, Profile

---

## IMPLEMENTATION GUIDELINES

### Standard Desktop Layout Pattern
```tsx
<div className="min-h-screen flex flex-col bg-surface-canvas">
  {/* 48px Header */}
  <header className="bg-surface-primary border-b border-border-strong h-12 flex justify-between items-center px-margin-desktop z-50">
    {/* Logo/Title + Controls */}
  </header>

  {/* Main Content */}
  <main className="flex-grow flex">
    {/* Content */}
  </main>
</div>
```

### Form Fields (Standard Pattern)
```tsx
<Field>
  <Label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
    Label Text
  </Label>
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-text-muted" />
    <Input
      className="w-full bg-surface-raised border border-border-default rounded-lg py-3 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
    />
  </div>
  {error && <HelperText>{error}</HelperText>}
</Field>
```

### Panel Container (Standard)
```tsx
<GlassPanel className="bg-surface-elevated border-2 border-border-strong rounded-xl p-8 shadow-xl">
  {/* Content */}
</GlassPanel>
```

### Section Header with Icon
```tsx
<div className="flex items-center gap-2 mb-4">
  <Icon className="h-[18px] w-[18px] text-primary" />
  <h2 className="text-xs font-medium text-text-secondary uppercase tracking-widest">
    Section Title
  </h2>
</div>
```

### Divider
```tsx
<div className="flex items-center gap-3 my-6">
  <div className="h-px bg-border-subtle flex-1"></div>
  <span className="text-xs font-semibold text-text-muted uppercase">Text</span>
  <div className="h-px bg-border-subtle flex-1"></div>
</div>
```

---

## COLOR SYSTEM (from tailwind config)

| Token | Value |
|-------|-------|
| primary | #ffb868 |
| surface-canvas | #111318 |
| surface-primary | #161a21 |
| surface-elevated | #1c2029 |
| surface-raised | #212633 |
| text-primary | #f1f5f9 |
| text-muted | #64748b |
| text-secondary | #cbd5e1 |
| border-strong | #4a5568 |
| border-default | #333b48 |
| tertiary | #62df7d |

---

## NEXT STEPS

1. ✅ Analyze Stitch Reference
2. ✅ Refine Login Page
3. 🔄 Complete Register Page improvements
4. 📋 Create Verify Email Page
5. 📋 Create Forgot Password Page
6. 📋 Continue with Dashboard Pages
