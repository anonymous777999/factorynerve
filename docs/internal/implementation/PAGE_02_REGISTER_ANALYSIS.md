# PAGE 2: REGISTER PAGE - REDESIGN ANALYSIS

**Status**: Analysis Complete - Ready for Implementation  
**File**: web/src/app/register/page.tsx  
**Stitch Reference**: stitch_iteration_tracker/register_desktop_refined

---

## 📋 CHANGES IDENTIFIED

### 1. Form Title - Display 4XL
**Current**: `className="text-4xl font-bold"`
**Target**: `className="font-display-4xl text-display-4xl"`
**Location**: Line ~315 in JSX "Initialize Access" title
**Impact**: Title should be 36px, 700w from design system

### 2. Form Description - Body MD
**Current**: `className="text-sm text-text-muted"`
**Target**: `className="font-body-md text-body-md text-text-muted"`
**Location**: Line ~316 in JSX description text
**Impact**: Description should be 14px from design system

### 3. Section Headers - Label SM
**Current**: `className="text-xs font-medium text-text-secondary uppercase tracking-widest"` (for "Operator Identity", "Security Credentials")
**Target**: `className="font-label-sm text-label-sm text-text-secondary uppercase tracking-widest"`
**Locations**: 
  - "Operator Identity" section header (~334)
  - "Security Credentials" section header (~386)
**Impact**: Headers should be 12px, 500w from design system

### 4. Field Labels - Metadata XS
**Current**: `className="text-xs font-semibold text-text-muted uppercase"` (for all input labels)
**Target**: `className="font-metadata-xs text-metadata-xs text-text-muted uppercase"`
**Locations**: 
  - "Organization / Company" label (~345)
  - "Admin name" label (~358)
  - "Role selection" label (~369)
  - "Corporate Email" label (~382)
  - "Passphrase" label (~406)
  - "Verify Passphrase" label (~424)
  - "Company code" label (~441)
  - "Operations phone" label (~455)
**Impact**: All labels should use 11px, 600w from design system

### 5. Input Fields - Table Cell Font
**Current**: `className="bg-surface-raised border border-border-default rounded text-text-primary px-3 py-2"` (missing font class)
**Target**: `className="bg-surface-raised border border-border-default rounded font-table-cell text-table-cell text-text-primary px-3 py-2"`
**Locations**: 
  - Factory name input (~350)
  - Admin name input (~363)
  - Role select (~376)
  - Email input (~390)
  - Passphrase input (~420)
  - Confirm password input (~432)
  - Company code input (~450)
  - Phone number input (~465)
**Impact**: Input text should be 13px from design system

### 6. Submit Button - Label SM
**Current**: `className="text-xs font-medium uppercase tracking-wider"`
**Target**: `className="font-label-sm text-label-sm uppercase tracking-wider"`
**Location**: Line ~487 in Button
**Impact**: Button text should be 12px, 500w from design system

### 7. Footer Link - Body MD
**Current**: `className="text-sm text-text-muted"` and `className="text-sm text-primary"`
**Target**: `className="font-body-md text-body-md text-text-muted"` and `className="font-body-md text-body-md text-primary"`
**Location**: Line ~497-498
**Impact**: Footer should use 14px font from design system

### 8. Right Panel - System Integrity Title - Page Title
**Current**: `className="text-xl font-semibold text-text-primary"`
**Target**: `className="font-page-title text-page-title text-text-primary"`
**Location**: Line ~515 "System Integrity" heading
**Impact**: Title should be 24px, 600w from design system

### 9. Right Panel - Section Headers - Label SM
**Current**: `className="text-xs font-medium text-text-secondary uppercase mb-1"` (for "Compliance Standard", "AI Processing")
**Target**: `className="font-label-sm text-label-sm text-text-secondary uppercase mb-1"`
**Locations**: 
  - "Compliance Standard" header (~525)
  - "AI Processing" header (~532)
**Impact**: Headers should be 12px, 500w from design system

### 10. Right Panel - Description Text - Table Cell
**Current**: `className="text-sm text-text-muted leading-relaxed"`
**Target**: `className="font-table-cell text-table-cell text-text-muted leading-relaxed"`
**Locations**: 
  - Compliance description (~527)
  - AI Processing description (~534)
**Impact**: Text should be 13px from design system

### 11. Right Panel - Workflow Title - Label SM
**Current**: `className="text-xs font-medium text-text-secondary uppercase tracking-widest"`
**Target**: `className="font-label-sm text-label-sm text-text-secondary uppercase tracking-widest"`
**Location**: Line ~543 "Provisioning Workflow" heading
**Impact**: Title should be 12px, 500w from design system

### 12. Right Panel - Step Titles - Body MD
**Current**: `className="text-sm font-bold text-text-primary"` (for "Submit Details", "Verify Inbox", "Unlock Sign-in")
**Target**: `className="font-body-md text-body-md font-bold text-text-primary"`
**Locations**: 
  - "Submit Details" (~553)
  - "Verify Inbox" (~566)
  - "Unlock Sign-in" (~577)
**Impact**: Step titles should be 14px from design system

### 13. Right Panel - Step Descriptions - Metadata XS
**Current**: `className="text-xs text-text-muted block mt-0.5"` (for step descriptions)
**Target**: `className="font-metadata-xs text-metadata-xs text-text-muted block mt-0.5"`
**Locations**: 
  - "Provide corporate identity." (~555)
  - "Confirm secure token link." (~568)
  - "Access Factory OS environment." (~579)
**Impact**: Descriptions should be 11px, 600w from design system

### 14. Right Panel - Step Number - Label SM
**Current**: `className="text-xs font-medium text-text-muted"` (for step numbers)
**Target**: `className="font-label-sm text-label-sm text-text-muted"`
**Locations**: 
  - Step 2 number (~564)
  - Step 3 number (~575)
**Impact**: Numbers should be 12px, 500w from design system

### 15. Header - DPR.ai Text
**Current**: `className="text-lg font-bold"`
**Target**: `className="font-panel-title text-panel-title"`
**Location**: Line ~264
**Impact**: Logo text should use design system font

### 16. Header - FACTORY OS Badge
**Current**: `className="text-xs font-semibold"`
**Target**: `className="font-metadata-xs text-metadata-xs"`
**Location**: Line ~266
**Impact**: Badge should use 11px, 600w from design system

### 17. Header - FACTORY OS Button
**Current**: `className="text-sm font-medium uppercase"`
**Target**: `className="font-label-sm text-label-sm uppercase"`
**Location**: Line ~271
**Impact**: Button text should be 12px, 500w from design system

### 18. Role Preview Panel - Labels
**Current**: 
  - Title: `className="text-xs font-semibold"`
  - Role: `className="text-sm font-semibold"`
  - Detail: `className="text-sm text-text-secondary"`
**Target**:
  - Title: `className="font-metadata-xs text-metadata-xs"`
  - Role: `className="font-body-md text-body-md"`
  - Detail: `className="font-body-md text-body-md text-text-secondary"`
**Location**: Line ~478
**Impact**: All panel text should use design system fonts

---

## 🎯 VERIFICATION CHECKLIST

- [ ] All typography classes updated to use design system (font-display-4xl, font-body-md, font-label-sm, font-metadata-xs, font-table-cell, font-page-title, font-panel-title)
- [ ] All color tokens correct
- [ ] All spacing tokens correct
- [ ] Header styling matches stitch reference
- [ ] Form layout matches stitch reference
- [ ] Right panel styling matches stitch reference
- [ ] Visual design matches screenshot
- [ ] Responsive design working

---

## 📐 DESIGN SYSTEM FONT REFERENCE

| Token | Size | Weight | Line Height |
|-------|------|--------|-------------|
| display-4xl | 36px | 700 | 1.15 |
| page-title | 24px | 600 | 1.25 |
| panel-title | 18px | 600 | 1.40 |
| body-md | 14px | 400 | 1.50 |
| table-cell | 13px | 400 | 1.50 |
| label-sm | 12px | 500 | 1.45 |
| metadata-xs | 11px | 600 | 1.45 |

---

## 🚀 NEXT STEPS

1. Apply all 18 typography updates via replace_string_in_file
2. Verify changes compile without errors
3. Test responsive design
4. Compare visually against stitch screenshot
5. Move to next page (VERIFY EMAIL)
