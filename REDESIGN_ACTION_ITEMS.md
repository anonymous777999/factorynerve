# DPR.ai Desktop Component Redesign - Action Items by Page

**Last Updated**: 2026-06-04
**Current Phase**: Phase 1 - Authentication Pages

---

## QUICK REFERENCE: Page Redesign Status

| # | Page | Status | File | Reference |
|---|------|--------|------|-----------|
| **PHASE 1: AUTH** |  |  |  |  |
| 1 | Login | ✅ Verified | `web/src/components/ui/login-1.tsx` | `stitch_iteration_tracker/login_desktop_refined` |
| 2 | Register | 🔄 Review | `web/src/app/register/page.tsx` | `stitch_iteration_tracker/register_desktop_refined` |
| 3 | Verify Email | 📋 Next | `web/src/components/verify-email-page.tsx` | `stitch_iteration_tracker/verify_email_desktop_refined` |
| 4 | Forgot Password | 📋 Next | `web/src/app/forgot-password/page.tsx` | `stitch_iteration_tracker/forgot_password_desktop_refined` |
| **PHASE 2: DASHBOARD** |  |  |  |  |
| 5 | Main Dashboard | 📋 TODO | `web/src/app/dashboard/page.tsx` | `dashboard_full_operational_report_refinement` |
| 6 | Attendance | 📋 TODO | `web/src/app/steel/page.tsx` | `attendance_desktop_refined` |
| 7 | Shift Entry | 📋 TODO | `web/src/app/entry/page.tsx` | `shift_entry_desktop_command_center` |
| 8 | Live Monitoring | 📋 TODO | TBD | `live_monitoring_operational_pulse` |
| **PHASE 3: OPERATIONS** |  |  |  |  |
| 9-15 | Customer Ledger, Inventory, Invoices, etc. | 📋 TODO | Multiple | Multiple |
| **PHASE 4: OCR** |  |  |  |  |
| 16-20 | OCR Workflow & Reports | 📋 TODO | Multiple | Multiple |
| **PHASE 5: ADMIN** |  |  |  |  |
| 21-34 | Admin, Settings, Advanced Pages | 📋 TODO | Multiple | Multiple |

---

## PHASE 1: AUTHENTICATION PAGES (4 Pages)

### 1️⃣ LOGIN PAGE - ✅ VERIFIED COMPLETE

**Current Status**: Matches stitch reference perfectly

**File**: `web/src/components/ui/login-1.tsx`
**Reference**: `stitch_iteration_tracker/stitch_iteration_tracker/login_desktop_refined/code.html`

**What's Correct**:
- ✅ 2-column split layout (col-span-4 + col-span-8)
- ✅ Header with DPR.ai logo + Factory OS badge
- ✅ Left sidebar with security guardrails
- ✅ System status indicators with glow effects
- ✅ Centered form with email/password fields
- ✅ OAuth options (Active + Disabled)
- ✅ All typography classes aligned
- ✅ Color system properly applied

**No Changes Needed** - This page is ready!

---

### 2️⃣ REGISTER PAGE - 🔄 REVIEW NEEDED

**Current Status**: Functional but could be enhanced for desktop

**File**: `web/src/app/register/page.tsx`
**Reference**: `stitch_iteration_tracker/stitch_iteration_tracker/register_desktop_refined/code.html`

**What's Working**:
- ✅ Header structure
- ✅ 2-column layout (col-span-7 form, col-span-5 guidelines)
- ✅ Gradient accent line on form
- ✅ Form sections with icons
- ✅ All form fields present

**What Needs Improvement** (Desktop Specific):

1. **Right Column Guidelines Panel** (visible on lg+ only)
   - Add "System Integrity" panel
   - Add "Provisioning Workflow" with 3-step flow
   - Make sure it's visible with `hidden lg:flex`

   ```tsx
   {/* Guidelines (Right, 5 cols, hidden on mobile) */}
   <div className="hidden lg:flex col-span-5 flex-col gap-6">
     {/* System Integrity Panel */}
     <div className="bg-surface-ground border border-border-subtle rounded-lg p-6">
       <h3>System Integrity</h3>
       {/* Compliance items */}
     </div>
     
     {/* Provisioning Workflow */}
     <WorkflowSteps steps={[...]} />
   </div>
   ```

2. **Form Styling Refinements**:
   - Verify all inputs use correct `bg-surface-raised border border-border-default rounded-lg py-3`
   - Ensure focus states: `focus:ring-2 focus:ring-primary focus:border-transparent`

3. **Section Dividers**:
   - Ensure "Security Credentials" has `pt-4 border-t border-border-subtle`

**Action Items**:
- [ ] Add right column guidelines for desktop (hidden lg:flex)
- [ ] Add workflow steps component showing 3-step process
- [ ] Verify all form input styling matches reference
- [ ] Test responsive behavior on desktop
- [ ] Check form validation messages styling

---

### 3️⃣ VERIFY EMAIL PAGE - 📋 NEXT

**Current Status**: Functional, can be enhanced visually

**File**: `web/src/components/verify-email-page.tsx`
**Reference**: `stitch_iteration_tracker/stitch_iteration_tracker/verify_email_desktop_refined/code.html`

**Reference Structure**:
- Centered card (max-w-2xl) with shadow
- Large success icon (animated circle)
- Title: "Email Verified"
- Subtitle describing verification
- **Visual workflow graphic** (ID Vault → Cleared → Core Sys)
- Two action buttons (Sign in, Request new link)
- Metadata footer with lock icon + timestamp

**Current Issues**:
- Missing animated success icon
- Missing visual workflow graphic
- Could use better visual hierarchy
- Missing timestamp indicator

**Action Items**:
- [ ] Add animated success icon with pulse effect
  ```tsx
  <div className="w-16 h-16 rounded-full bg-surface-container-high border border-tertiary-fixed flex items-center justify-center relative">
    <div className="absolute inset-0 rounded-full border border-tertiary-fixed animate-ping opacity-20"></div>
    <CheckCircle className="h-8 w-8 text-tertiary-fixed" />
  </div>
  ```

- [ ] Add workflow graphic showing verification flow
  ```tsx
  <div className="w-full bg-surface-ground border border-border-default rounded-lg p-4">
    <div className="flex items-center justify-between text-text-muted">
      <div>ID Vault</div>
      <div className="flex-1 flex items-center px-4">
        <div className="h-px w-full bg-border-default"></div>
      </div>
      <div>Cleared</div>
      <div className="flex-1 flex items-center px-4">
        <div className="h-px w-1/2 bg-border-default"></div>
      </div>
      <div>Core Sys</div>
    </div>
  </div>
  ```

- [ ] Enhance visual styling to match reference
- [ ] Add metadata footer with timestamp

---

### 4️⃣ FORGOT PASSWORD PAGE - 📋 NEXT

**Current Status**: Needs to be checked

**File**: `web/src/app/forgot-password/page.tsx`
**Reference**: `stitch_iteration_tracker/stitch_iteration_tracker/forgot_password_desktop_refined/code.html`

**Expected Structure** (similar to Login):
- 2-column split layout
- Left column: Recovery guidelines + security info
- Right column: Email input form + submit

**Action Items**:
- [ ] Verify layout matches 2-column pattern
- [ ] Check left sidebar content (recovery steps)
- [ ] Verify form styling matches reference
- [ ] Test success state (after submission)
- [ ] Add "Send Reset Link" flow visualization

---

## PHASE 2: DASHBOARD PAGES (4 Pages)

These pages share an `OperationalCommandCenter` layout pattern:
- Fixed 48px header
- Left sidebar (navigation)
- Right main content (title + action bar + content)

### 5️⃣ MAIN DASHBOARD - 📋 TODO

**File**: `web/src/app/dashboard/page.tsx`
**Reference**: `dashboard_full_operational_report_refinement`

**Expected Structure**:
- Header with logo + navigation
- Sidebar with menu
- Main area with:
  - Page title + subtitle
  - Metrics strip (key indicators)
  - Data table or grid
  - Detail panels

**Tasks**:
- [ ] Implement OperationalCommandCenter layout
- [ ] Add sidebar with main navigation
- [ ] Create metrics strip component
- [ ] Style data table per reference
- [ ] Add action buttons (Export, Filter, etc.)

---

### 6️⃣-8️⃣ OTHER DASHBOARD PAGES

Same pattern as Dashboard but with different content:
- Attendance Page
- Shift Entry Page  
- Live Monitoring Page

---

## PHASE 3-5: OPERATIONS, OCR, ADMIN PAGES

All follow the `OperationalCommandCenter` pattern with variations:
- Inventory management → Table-focused layout
- Invoice dispatch → Multi-panel layout
- Reports → Grid/chart focused
- Admin pages → Settings/configuration panels

---

## IMPLEMENTATION PRIORITY

### Immediate (This Week)
1. ✅ Verify Login is complete
2. 🔄 Enhance Register with guidelines panel
3. 📋 Improve Verify Email with animations
4. 📋 Check Forgot Password implementation

### Next (Next Week)  
5. Implement Dashboard with sidebar + metrics
6. Implement Attendance page
7. Implement Shift Entry page
8. Implement Live Monitoring page

### Following
- Operations pages (Customer Ledger, Inventory, etc.)
- OCR workflow pages
- Admin/Settings pages

---

## COMPONENT TEMPLATES TO USE

Refer to `IMPLEMENTATION_TEMPLATES.md` for:

1. `AuthSplitLayout` - For Login, Forgot Password
2. `RegistrationLayout` - For Register pages
3. `OperationalCommandCenter` - For Dashboard & Operations
4. `FormFieldWithIcon` - For all form inputs
5. `FormSection` - For grouping form fields
6. `WorkflowSteps` - For showing progress/steps
7. `StatusPanel` - For displaying security/status info

---

## COLOR & TYPOGRAPHY QUICK GUIDE

### Essential Colors
```
Primary CTA: bg-primary hover:bg-primary-container
Secondary Button: bg-surface-raised border border-border-default
Headers: text-text-primary
Body Text: text-text-secondary
Muted Text: text-text-muted
Borders: border-border-default (normal) or border-border-strong (emphasis)
Accent: text-tertiary-container (success/confirmation)
```

### Typography Classes
```
Page Titles: "text-2xl font-bold text-text-primary"
Section Headers: "text-xs font-medium text-text-secondary uppercase tracking-widest"
Body Text: "text-sm text-text-secondary"
Labels: "text-xs font-medium text-text-secondary uppercase tracking-wider"
Helper Text: "text-xs text-text-muted"
```

---

## FILES TO REFERENCE

| File | Purpose |
|------|---------|
| `COMPONENT_STRUCTURE_GUIDE.md` | High-level structure overview |
| `IMPLEMENTATION_TEMPLATES.md` | Detailed TSX templates & examples |
| `stitch_iteration_tracker/` | HTML reference designs |
| `web/src/components/ui/` | Existing UI components |
| `web/src/components/ui/login-1.tsx` | ✅ Perfect example to follow |

---

## COMMON MISTAKES TO AVOID

1. ❌ Don't mix old color names - use `text-text-primary` not `text-foreground`
2. ❌ Don't hardcode colors - use Tailwind classes from config
3. ❌ Don't use `col-span-6` for form fields - follow component patterns
4. ❌ Don't skip the header (48px bar) - every page needs it
5. ❌ Don't forget hover/focus states on buttons
6. ❌ Don't use pixel-specific spacing - use `px-8 py-6` from system
7. ❌ Don't forget `z-50` for headers
8. ❌ Don't forget icon sizing (18px for major, 16px for standard)

---

## SUCCESS CRITERIA FOR EACH PAGE

Each page should have:
- ✅ Proper header (48px, correct styling)
- ✅ Correct layout structure (split, sidebar, etc.)
- ✅ All form fields with icons
- ✅ Proper typography hierarchy
- ✅ Correct color usage throughout
- ✅ Hover/focus states on interactive elements
- ✅ Mobile responsive (col-span-12 on mobile)
- ✅ Proper spacing (px-8, py-6, gap-8)
- ✅ All borders with correct color
- ✅ Button styling correct

---

## NEED HELP?

1. Check `COMPONENT_STRUCTURE_GUIDE.md` for overview
2. Check `IMPLEMENTATION_TEMPLATES.md` for code examples
3. Compare with `web/src/components/ui/login-1.tsx` (perfect example)
4. Compare HTML with stitch reference in `stitch_iteration_tracker/`

---

## Next Steps: Complete Register Page

The REGISTER page is the next priority. Here's what to do:

```tsx
// In web/src/app/register/page.tsx

// Add this import
import { WorkflowSteps } from "@/components/ui/workflow-steps";

// In the main grid (max-w-6xl w-full grid grid-cols-12 gap-8):
// Add the right column (currently missing or hidden):

<div className="hidden lg:flex col-span-5 flex-col gap-6">
  {/* System Integrity Panel */}
  <div className="bg-surface-ground border border-border-subtle rounded-lg p-6">
    <div className="flex items-center gap-2 mb-4">
      <VerifiedUser className="h-5 w-5 text-secondary-container" />
      <h3 className="text-page-title font-panel-title">System Integrity</h3>
    </div>
    <div className="space-y-4">
      <div className="flex gap-3">
        <Policy className="h-5 w-5 text-text-muted" />
        <div>
          <p className="font-label-sm text-label-sm text-text-secondary">Compliance Standard</p>
          <p className="font-table-cell text-table-cell text-text-muted mt-1">
            All registration attempts are audited and subject to identity verification...
          </p>
        </div>
      </div>
      {/* More compliance items */}
    </div>
  </div>

  {/* Provisioning Workflow */}
  <WorkflowSteps 
    steps={[
      { number: 1, title: "Submit Details", description: "Provide corporate identity.", completed: true },
      { number: 2, title: "Verify Inbox", description: "Confirm secure token link.", completed: false },
      { number: 3, title: "Unlock Sign-in", description: "Access Factory OS environment.", completed: false }
    ]}
  />
</div>
```

This completes the registration page for desktop!
