# Frontend Architecture Governance

**Version**: 1.0  
**Date**: 2026-05-20  
**Status**: OFFICIAL EXECUTION STANDARD  
**Authority**: Principal Frontend Systems Architect  
**Scope**: All DPR.ai frontend development, AI-assisted engineering, and future migrations

---

## 0. Document Purpose and Authority

This document is the **official frontend engineering constitution** for DPR.ai.

### What This Document Is

- The architectural source of truth for all frontend decisions
- The execution standard for AI-assisted development (Codex, Claude, Gemini)
- The migration blueprint for route continuity restoration
- The anti-regression policy for preventing fragmented workflows
- The foundation layer before any UI/UX redesign

### What This Document Is Not

- A visual design system
- A component library specification
- A CSS framework guide
- A generic frontend best practices collection

### Authority Hierarchy

1. **Platform Philosophy** (this document) → defines architectural principles
2. **Migration Strategy** (this document) → defines safe evolution path
3. **Domain Blueprints** (this document) → defines target route structures
4. **AI Execution Rules** (this document) → defines AI development constraints
5. **Quality Gates** (this document) → defines merge requirements

**NO code change may violate this document without explicit architectural approval.**

---

## 1. Platform Architecture Philosophy

### 1.1 Core Architectural Truths

DPR.ai is a **factory-first SaaS operating system** with these non-negotiable architectural requirements:

1. **URL is the canonical source of truth** for all workflow state
2. **Browser-native navigation is sacred** (back/forward/refresh/bookmark must work)
3. **Application state must survive page transitions** without loss
4. **Every workflow must be deep-linkable and shareable**
5. **Component-local state may not own workflow identity**

### 1.2 The URL-First Principle

**Definition**: Every piece of state that defines "where you are" or "what you're doing" MUST exist in the URL.

**Why This Matters**:
- Factory managers share links via WhatsApp
- Supervisors bookmark review queues
- Owners open multiple tabs for different factories
- Browser crashes must not lose work context
- Mobile browsers aggressively kill background tabs

**What This Means**:
```typescript
// ❌ FORBIDDEN: Hidden component state
const [selectedTab, setSelectedTab] = useState('pending');
const [reviewId, setReviewId] = useState(null);
const [workflowStep, setWorkflowStep] = useState(1);

// ✅ REQUIRED: URL-owned state
// /approvals?tab=pending&review=ocrv_123&step=verification
const searchParams = useSearchParams();
const tab = searchParams.get('tab') || 'pending';
const reviewId = searchParams.get('review');
const step = searchParams.get('step');
```

### 1.3 Browser-Native Navigation Philosophy

**Requirement**: Every user-facing navigation action MUST use browser history, not component state.

**Why This Matters**:
- Users expect back button to work
- Refresh should restore exact state
- Deep links should work from any entry point
- Multi-tab workflows must not interfere

**Implementation Pattern**:
```typescript
// ❌ FORBIDDEN: State-based fake pages
const [currentPage, setCurrentPage] = useState('list');

// ✅ REQUIRED: Real route-based navigation
router.push('/steel/invoices/inv_123');
```

### 1.4 Why Popup-Style SPA Behavior Is Forbidden

**Problem**: DPR.ai historically used component state to simulate pages within single routes, creating:
- Broken back button behavior
- Lost work on accidental navigation
- Inability to share specific screens
- sessionStorage-dependent continuity
- Hidden workflow ownership

**Banned Patterns**:
1. ❌ Overlays that change entire screen content without URL change
2. ❌ Tab systems that hide workflow state in component memory
3. ❌ Wizard flows that use step counters instead of route segments
4. ❌ Modal editors that own entity selection without route params
5. ❌ Fake page systems using conditional rendering without routes

**Required Alternative**:
Every distinct "page" or "workflow screen" gets:
- A real route or route parameter
- Query params for filters/tabs/modes
- Proper browser history integration
- Deep-link capability

---

## 2. Route Ownership Governance

### 2.1 What Qualifies as a Real Route

A component/screen MUST have its own route if:

| Criterion | Example | Route Required |
|-----------|---------|----------------|
| Represents a distinct workflow screen | Invoice detail page | ✅ `/steel/invoices/[id]` |
| Contains form that should survive refresh | OCR verification editor | ✅ `/ocr/verify?draft=[id]` |
| Users would want to bookmark it | Pending approvals queue | ✅ `/approvals?status=pending` |
| Contains entity-specific data | Customer profile | ✅ `/steel/customers/[id]` |
| Represents a step in multi-step workflow | Review verification step | ✅ `/ocr/verify?id=[id]&step=review` |
| Should be shareable via link | Attendance report for date | ✅ `/attendance/reports?date=2026-05-20` |

### 2.2 Route Hierarchy Standards

**Principle**: Routes should reflect information architecture, not implementation details.

**Pattern**:
```
/[domain]/[entity-type]/[entity-id]?[filters]&[mode]
```

**Examples**:
```
✅ /steel/invoices/inv_123?tab=lines
✅ /ocr/verify?id=draft_456&mode=edit
✅ /attendance/review?date=2026-05-20&status=pending
✅ /steel/dispatches/disp_789?view=tracking

❌ /page?screen=invoice-detail&id=123  (generic route)
❌ /steel?tab=invoices&invoice=123     (hidden entity)
❌ /ocr?mode=verify&draft=456          (ambiguous domain)
```

### 2.3 Nested Routes vs Query Params

**Use Route Segments** (`/parent/child/grandchild`) when:
- Hierarchy is entity-based (invoice → line items)
- Navigation is sequential/drilldown
- Each level represents a distinct resource

**Use Query Params** (`?tab=X&filter=Y`) when:
- State is filter/view/mode based
- Multiple params can combine
- State should persist across navigation
- Default values make sense

**Examples**:
```typescript
// ✅ Route segments for entity hierarchy
/steel/customers/cust_123/invoices/inv_456

// ✅ Query params for filters/modes
/approvals?status=pending&type=ocr&priority=high

// ✅ Mixed: entity in path, view in query
/steel/dispatches/disp_789?view=lines&mode=edit
```

### 2.4 Route Overlay Standards

**Concept**: Some workflows need overlay UI (modals, drawers) but still require URL ownership.

**Pattern**: Use query params or route segments with optional modal/drawer rendering.

```typescript
// Example: Edit customer payment in overlay
// URL: /steel/customers/cust_123?modal=payment&payment=pay_456

// Implementation:
const searchParams = useSearchParams();
const modalType = searchParams.get('modal');
const paymentId = searchParams.get('payment');

return (
  <>
    <CustomerProfile customerId={customerId} />
    {modalType === 'payment' && paymentId && (
      <PaymentEditorModal 
        paymentId={paymentId}
        onClose={() => router.push(`/steel/customers/${customerId}`)}
      />
    )}
  </>
);
```

**Critical**: Modal close MUST update URL (remove modal params), enabling browser back button to close modal.

### 2.5 Deep-Linking Requirements

**Every route MUST support**:
1. **Cold start**: Opening URL directly in new tab works
2. **Hot navigation**: Navigating from within app works
3. **Back button**: Returns to previous state correctly
4. **Forward button**: Replays navigation correctly
5. **Refresh**: Restores exact same state
6. **Bookmark**: Opening later works identically

**Test Pattern**:
```typescript
// Test: Deep link to review verification
// 1. Open: /ocr/verify?id=draft_123&step=2
// 2. Should load: draft data + navigate to step 2
// 3. Should NOT: show loading error or reset to step 1
// 4. Should NOT: require prior navigation from /ocr/scan
```

### 2.6 Refresh Continuity Requirements

**Rule**: Pressing F5/Cmd+R on any route MUST restore identical state (with optional server re-fetch).

**Forbidden**:
- ❌ Refresh causes loss of selected entity
- ❌ Refresh resets wizard to step 1
- ❌ Refresh clears filters/tabs
- ❌ Refresh loses edited form data (unless explicitly saved as draft)

**Required**:
- ✅ All state reconstructable from URL alone
- ✅ Optional: Load draft from backend if `?draft=X` present
- ✅ Loading states during hydration
- ✅ Error states if entity not found

---

## 3. Local State Governance

### 3.1 Allowed Local State

Component-local `useState` is ALLOWED for:

| State Type | Example | Justification |
|------------|---------|---------------|
| **Hover state** | `isHovered` | Transient, not meaningful to preserve |
| **Focus state** | `isFocused` | Browser-managed, UI-only |
| **Animation state** | `isExpanding` | Transient transition |
| **Temporary form input** | `emailInput` before submit | Not committed yet |
| **UI loading state** | `isSubmitting` | Request-scoped |
| **Modal open/closed** | `isModalOpen` (IF modal has no route) | For purely ephemeral confirmations |
| **Dropdown open/closed** | `isDropdownOpen` | Transient UI |
| **Toast/notification** | `showToast` | Temporary feedback |

**Rule**: If the state disappearing on refresh would confuse the user, it belongs in the URL.

### 3.2 Forbidden Local State

Component `useState` is **FORBIDDEN** for:

| Forbidden State | Why Forbidden | Required Alternative |
|-----------------|---------------|----------------------|
| **Workflow identity** | Breaks deep links | Route param: `/:workflowId` |
| **Selected entity** | Breaks sharing | Query param: `?selected=[id]` |
| **Active workspace/factory** | Breaks continuity | Route segment or server session |
| **Wizard step** | Breaks refresh | Query param: `?step=2` |
| **Active tab** | Breaks bookmarks | Query param: `?tab=pending` |
| **Selected review item** | Breaks back button | Query param: `?review=[id]` |
| **Verification mode** | Breaks navigation | Query param: `?mode=edit` |
| **Filter state** | Breaks sharing | Query params: `?status=X&date=Y` |
| **Sort state** | Breaks sharing | Query params: `?sort=date&order=desc` |
| **Pagination** | Breaks deep links | Query param: `?page=3` |

**Violation Examples**:
```typescript
// ❌ FORBIDDEN: Invoice selection in state
const [selectedInvoice, setSelectedInvoice] = useState(null);

// ✅ REQUIRED: Invoice in URL
// URL: /steel/invoices?selected=inv_123
const selectedInvoice = searchParams.get('selected');

// ❌ FORBIDDEN: Wizard step in state
const [wizardStep, setWizardStep] = useState(1);

// ✅ REQUIRED: Step in URL
// URL: /ocr/verify?draft=X&step=2
const step = parseInt(searchParams.get('step') || '1');
```

### 3.3 Transient vs Persistent State Decision Tree

```
Is the state meaningful after:
├─ Page refresh? → URL state
├─ Browser back? → URL state
├─ Deep link? → URL state
├─ Tab switch? → URL state
├─ Share link? → URL state
└─ None of above? → Local state (maybe)

If user closes tab and returns tomorrow:
├─ Should state be restored? → Backend draft
├─ Should state be gone? → Local state
└─ Should filters persist? → URL state
```

---

## 4. URL State Governance

### 4.1 Pathname vs Query Params

**Use Pathname** for:
- Entity type: `/steel/invoices`
- Entity ID: `/steel/invoices/inv_123`
- Resource hierarchy: `/customers/cust_123/invoices/inv_456`
- Primary workflow mode: `/ocr/scan` vs `/ocr/verify`

**Use Query Params** for:
- Filters: `?status=pending&priority=high`
- Tabs: `?tab=lines`
- Modes: `?mode=edit`
- Pagination: `?page=3`
- Sort: `?sort=date&order=desc`
- Search: `?q=steel%20batch`
- Date ranges: `?from=2026-05-01&to=2026-05-20`
- Selected sub-items: `?selected=line_123`
- Modal/overlay triggers: `?modal=add-payment`

### 4.2 Query Param Naming Conventions

**Standard Param Names** (use consistently across app):

| State Type | Param Name | Example | Format |
|------------|------------|---------|--------|
| Selected entity | `selected` | `?selected=inv_123` | Entity ID |
| Active tab | `tab` | `?tab=pending` | Lowercase string |
| Workflow step | `step` | `?step=2` | Integer |
| Status filter | `status` | `?status=approved` | Lowercase enum |
| Date filter | `date` | `?date=2026-05-20` | ISO date |
| Date range | `from`, `to` | `?from=2026-05-01&to=2026-05-20` | ISO dates |
| Search query | `q` | `?q=batch%20123` | URL-encoded |
| Sort field | `sort` | `?sort=created_at` | Field name |
| Sort order | `order` | `?order=desc` | `asc` or `desc` |
| Page number | `page` | `?page=3` | Integer (1-indexed) |
| Page size | `limit` | `?limit=50` | Integer |
| Modal trigger | `modal` | `?modal=edit-invoice` | Lowercase-kebab |
| View mode | `view` or `mode` | `?view=grid` | Lowercase string |

### 4.3 Required URL State for Each Domain

#### OCR Domain
```
/ocr/scan
  ?mode=camera|gallery
  
/ocr/verify
  ?id=[draft_id]           # Which draft
  &step=preview|review|export  # Workflow step
  &mode=view|edit          # Edit mode
  &highlight=confidence    # UI mode
  
/ocr/history
  ?status=draft|approved|rejected
  &from=[date]
  &to=[date]
  &q=[search]
```

#### Billing Domain
```
/billing
  ?tab=usage|invoices|payment
  &invoice=[invoice_id]    # Selected invoice
  &modal=add-card          # Payment modal
```

#### Settings Domain
```
/settings
  ?section=profile|factory|attendance
  
/settings/attendance
  ?tab=employees|shifts|holidays
  &selected=[employee_id]
  &modal=add-employee
```

#### Steel Domain
```
/steel/invoices
  ?status=draft|sent|paid
  &customer=[customer_id]
  &from=[date]
  &to=[date]
  &sort=date
  &order=desc
  
/steel/invoices/[id]
  ?tab=lines|payments|dispatches
  &edit=line_123           # Editing specific line
  
/steel/dispatches
  ?status=planned|loaded|dispatched|delivered
  &date=[date]
  
/steel/dispatches/[id]
  ?view=details|tracking|documents
  &modal=add-line
```

#### Reports Domain
```
/reports
  ?type=attendance|production|steel
  &from=[date]
  &to=[date]
  &factory=[factory_id]
  &format=table|chart
  
/attendance/reports
  ?date=[date]
  &view=summary|detail
  &employee=[employee_id]
```

#### Intelligence Domain
```
/analytics
  ?metric=production|attendance|quality
  &from=[date]
  &to=[date]
  &factory=[factory_id]
  &view=trend|comparison
  
/ai
  ?context=anomaly|summary|prediction
  &entity_type=batch|dispatch|invoice
  &entity_id=[id]
```

---

## 5. SessionStorage / LocalStorage Governance

### 5.1 Storage Purpose Hierarchy

```
URL State (source of truth)
    ↓ canonical
localStorage (persistence)
    ↓ cache/preference
sessionStorage (crash recovery only)
    ↓ temporary
Component State (transient UI)
```

### 5.2 localStorage: ALLOWED Use Cases

**Purpose**: Non-critical user preferences that should persist across sessions.

**Allowed**:
```typescript
// ✅ UI preferences
localStorage.setItem('sidebar-open', 'true');
localStorage.setItem('theme-mode', 'dark');
localStorage.setItem('language', 'en');
localStorage.setItem('nav-favorites', JSON.stringify(['dashboard', 'approvals']));
localStorage.setItem('table-column-order', JSON.stringify(['date', 'status']));

// ✅ Performance optimization (cache)
localStorage.setItem('user-factories-cache', JSON.stringify(factories));
localStorage.setItem('last-sync-timestamp', Date.now().toString());

// ✅ Offline draft queue (temporary)
localStorage.setItem('offline-drafts', JSON.stringify([draft1, draft2]));
```

**Data Characteristics**:
- Loss is acceptable (user just resets preferences)
- Not canonical (source of truth is backend/URL)
- User-specific settings
- Performance optimizations

### 5.3 localStorage: FORBIDDEN Use Cases

**Forbidden**:
```typescript
// ❌ Route identity
localStorage.setItem('current-page', 'invoices');

// ❌ Navigation ownership
localStorage.setItem('selected-invoice', 'inv_123');

// ❌ Canonical workflow state
localStorage.setItem('wizard-step', '3');

// ❌ Selected entity
localStorage.setItem('active-factory', 'factory_123');

// ❌ Filter state (should be in URL)
localStorage.setItem('invoice-filters', JSON.stringify({status: 'pending'}));

// ❌ Authentication tokens (use httpOnly cookies)
localStorage.setItem('auth-token', 'dangerous');
```

### 5.4 sessionStorage: ALLOWED Use Cases

**Purpose**: Crash recovery and tab-specific temporary state.

**Allowed**:
```typescript
// ✅ Crash recovery marker
sessionStorage.setItem('chunk-load-recovery', window.location.href);

// ✅ Build version check
sessionStorage.setItem('reload-marker', '1');

// ✅ Tab-specific draft (before backend save)
sessionStorage.setItem('entry-draft-temp', JSON.stringify(unsavedEntry));

// ✅ Tab-specific UI state (accordion expansion)
sessionStorage.setItem('expanded-sections', JSON.stringify(['billing', 'usage']));
```

### 5.5 sessionStorage: FORBIDDEN Use Cases

**Forbidden**:
```typescript
// ❌ Navigation state
sessionStorage.setItem('previous-route', '/dashboard');

// ❌ Workflow identity
sessionStorage.setItem('active-workflow', 'ocr-verify');

// ❌ Selected records (should be URL)
sessionStorage.setItem('selected-items', JSON.stringify([1, 2, 3]));

// ❌ Pagination (should be URL)
sessionStorage.setItem('current-page', '3');

// ❌ Tab state (should be URL)
sessionStorage.setItem('active-tab', 'pending');
```

### 5.6 Storage Decision Matrix

```
Question: Should I store X?

1. Is X needed for correct functionality?
   YES → Backend API (source of truth)
   NO → Continue

2. Should X survive browser restart?
   YES → Continue to #3
   NO → sessionStorage or component state

3. Should X work across devices?
   YES → Backend API
   NO → Continue to #4

4. Should X be shareable via URL?
   YES → URL query params
   NO → Continue to #5

5. Is X a user preference?
   YES → localStorage
   NO → Backend draft or component state

6. Would losing X confuse the user?
   YES → ❌ WRONG APPROACH, USE URL OR BACKEND
   NO → localStorage (acceptable loss)
```

---

## 6. Backend Draft Governance

### 6.1 When to Use Backend Drafts

**Use backend draft storage when**:
- Workflow takes > 2 minutes (user may lose focus)
- Work should survive device switch
- Work represents significant progress
- Work needs async processing
- Work should appear in "my tasks"

**Examples**:
```typescript
// ✅ OCR verification draft
POST /api/ocr/verification-drafts
{
  original_image_url: "...",
  original_rows: [...],
  reviewed_rows: null,  // Work in progress
  status: "draft"
}

// ✅ Report generation job
POST /api/reports/generate
{
  type: "attendance",
  params: {...},
  status: "pending"
}

// ✅ Entry draft (offline capability)
POST /api/entries/drafts
{
  date: "2026-05-20",
  shift: "morning",
  data: {...},
  synced: false
}
```

### 6.2 Draft Hydration Pattern

**Rule**: URL points to draft ID, backend returns draft state, frontend renders.

```typescript
// URL: /ocr/verify?id=draft_123

// Component hydration:
useEffect(() => {
  const draftId = searchParams.get('id');
  if (!draftId) {
    // No draft, show empty state
    return;
  }
  
  // Fetch draft from backend
  fetch(`/api/ocr/verification-drafts/${draftId}`)
    .then(res => res.json())
    .then(draft => {
      // Hydrate state from draft
      setOriginalRows(draft.original_rows);
      setReviewedRows(draft.reviewed_rows || draft.original_rows);
      setConfidenceMatrix(draft.cell_confidence || []);
      setStatus(draft.status);
    });
}, [searchParams]);
```

### 6.3 Stale Draft Handling

**Problem**: User opens draft, backend data changed (invoice approved, dispatch completed).

**Required Behavior**:
```typescript
// Backend response includes stale check
{
  "draft": {...},
  "stale": true,
  "stale_reason": "Invoice already approved by another user",
  "entity_current_status": "approved"
}

// Frontend handles stale state
if (response.stale) {
  showWarning("This draft is outdated. Recent changes detected.");
  disableEditing();
  showRefreshOption();
}
```

### 6.4 Multi-Device Continuity

**Requirement**: Draft created on mobile should be editable on desktop.

**Implementation**:
```typescript
// Mobile: Create draft
POST /api/ocr/verification-drafts
{...}
// Response: { id: "draft_123" }

// Share URL: https://app.dpr.ai/ocr/verify?id=draft_123
// Desktop: Open URL → fetches draft_123 → continues work

// Both devices can edit (last-write-wins or optimistic locking)
```

### 6.5 Draft Expiration Policy

**Rules**:
- Drafts older than 30 days: Auto-archive (soft delete)
- Drafts older than 90 days: Hard delete
- Approved/rejected drafts: Promote to permanent records
- User can explicitly delete drafts

---

## 7. Modal / Overlay Governance

### 7.1 Modal vs Route Decision Matrix

**Use Local-Only Modal** (no URL change) when:
- ✅ Confirmation dialog ("Are you sure?")
- ✅ Simple picker (select from 5 items)
- ✅ Tooltip or info popover
- ✅ Ephemeral success/error message
- ✅ Quick action (< 10 seconds to complete)

**Use Route-Owned Overlay** (URL change) when:
- ✅ Editor (form with multiple fields)
- ✅ Viewer (invoice detail, batch detail)
- ✅ Verification workflow
- ✅ Async workflow with steps
- ✅ Review pipeline
- ✅ Detail panel with tabs
- ✅ Any workflow that takes > 30 seconds

### 7.2 Route-Owned Overlay Pattern

**Implementation**:
```typescript
// URL: /steel/invoices?modal=add-line&invoice=inv_123

const InvoicesPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modalType = searchParams.get('modal');
  const invoiceId = searchParams.get('invoice');
  
  const closeModal = () => {
    // Remove modal params, keep other params
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    params.delete('invoice');
    router.push(`/steel/invoices?${params.toString()}`);
  };
  
  return (
    <>
      <InvoiceList />
      
      {modalType === 'add-line' && invoiceId && (
        <AddLineModal
          invoiceId={invoiceId}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            refreshData();
          }}
        />
      )}
    </>
  );
};
```

### 7.3 Browser Back Button Behavior

**Rule**: Browser back button MUST close overlay if overlay is route-owned.

**Implementation**:
```typescript
// When modal opens:
router.push('/path?modal=edit', { scroll: false });

// When user clicks back:
// → URL changes to /path (no modal param)
// → Modal automatically unmounts
// → No need for special back button handling
```

### 7.4 Overlay URL Standards

**Query Param Pattern**:
```
?modal=[action-type]&[entity]=[id]&[other-params]
```

**Examples**:
```
?modal=edit-invoice&invoice=inv_123
?modal=add-payment&customer=cust_456
?modal=verify-reconciliation&reconciliation=rec_789&step=2
?modal=export-report&format=excel&from=2026-05-01
```

### 7.5 Overlay Restoration Standards

**Requirement**: Opening URL with modal params MUST open overlay directly.

**Test**:
```typescript
// 1. Open: /steel/customers?modal=add-payment&customer=cust_123
// 2. Should: Show customer list + payment modal open
// 3. Should NOT: Show customer list only (modal closed)

// Implementation:
useEffect(() => {
  const modalType = searchParams.get('modal');
  if (modalType === 'add-payment') {
    // Modal component renders automatically
    // No need to manually "open" it
  }
}, [searchParams]);
```

---

## 8. Hydration Governance

### 8.1 Canonical Hydration Pipeline

**Required Flow**:
```
1. Parse URL (pathname + query params)
      ↓
2. Validate params (type check, existence check)
      ↓
3. Fetch data from backend (if entity ID present)
      ↓
4. Render component with fetched data
      ↓
5. Optional: Restore UI preferences from localStorage
```

**Code Pattern**:
```typescript
const VerificationPage = () => {
  const searchParams = useSearchParams();
  const draftId = searchParams.get('id');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }
    
    // Canonical hydration: URL → backend → render
    fetch(`/api/ocr/verification-drafts/${draftId}`)
      .then(res => {
        if (!res.ok) throw new Error('Draft not found');
        return res.json();
      })
      .then(data => {
        setDraft(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [draftId]);
  
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!draftId) return <EmptyState />;
  
  return <VerificationEditor draft={draft} />;
};
```

### 8.2 FORBIDDEN: Hydration Guessing

**Never do this**:
```typescript
// ❌ FORBIDDEN: Guess state from local cache
const [data, setData] = useState(() => {
  // BAD: Assume cached data is valid
  const cached = localStorage.getItem('cached-invoice');
  return cached ? JSON.parse(cached) : null;
});

// Then maybe fetch later...
useEffect(() => {
  if (!data) {
    fetchData(); // Too late, user saw stale data
  }
}, []);
```

**Why Forbidden**:
- Cached data may be stale
- User sees wrong information initially
- Race conditions between cache and fetch
- No loading state shown
- Breaks multi-device sync

### 8.3 Stale Data Policy

**Rules**:
1. **Never render stale data as if it's current**
2. **Show loading state during fetch**
3. **Show timestamp for time-sensitive data**
4. **Provide explicit refresh action**

**Pattern**:
```typescript
const [data, setData] = useState(null);
const [lastFetch, setLastFetch] = useState(null);
const [isRefreshing, setIsRefreshing] = useState(false);

const fetchData = async () => {
  setIsRefreshing(true);
  const result = await fetch('/api/...');
  setData(result);
  setLastFetch(Date.now());
  setIsRefreshing(false);
};

// Show staleness indicator
<div>
  Last updated: {formatRelative(lastFetch)}
  <button onClick={fetchData}>Refresh</button>
</div>
```

### 8.4 Loading State Standards

**Required Loading States**:

| State | UI Requirement | Example |
|-------|----------------|---------|
| **Initial load** | Full page skeleton | Loading draft... |
| **Refresh** | Spinner on content | ↻ Refreshing... |
| **Optimistic update** | Immediate UI + subtle indicator | Saving... ✓ Saved |
| **Background fetch** | Subtle progress bar | ━━━━━ |

**Implementation**:
```typescript
if (loading && !data) {
  return <PageSkeleton />; // Initial load
}

return (
  <div>
    {isRefreshing && <RefreshIndicator />}
    <Content data={data} />
  </div>
);
```

### 8.5 Race Condition Prevention

**Problem**: User navigates fast, multiple fetches in flight.

**Solution**: Abort stale requests
```typescript
useEffect(() => {
  const abortController = new AbortController();
  
  fetch('/api/data', { signal: abortController.signal })
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name === 'AbortError') return; // Expected
      setError(err);
    });
  
  return () => abortController.abort(); // Cleanup on unmount
}, [draftId]);
```

### 8.6 Cross-Tab Synchronization

**Requirement**: Changes in one tab should reflect in other tabs.

**Patterns**:
1. **BroadcastChannel API** (modern browsers)
```typescript
const channel = new BroadcastChannel('dpr-updates');

// Tab 1: Saves invoice
channel.postMessage({ type: 'invoice-updated', id: 'inv_123' });

// Tab 2: Listens and refreshes
channel.onmessage = (event) => {
  if (event.data.type === 'invoice-updated') {
    refetchInvoice(event.data.id);
  }
};
```

2. **Polling** (fallback)
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refetchIfStale();
  }, 30000); // 30 seconds
  
  return () => clearInterval(interval);
}, []);
```

### 8.7 Optimistic Update Boundaries

**When to use optimistic updates**:
- ✅ High-confidence mutations (simple updates)
- ✅ User expects immediate feedback
- ✅ Rollback is straightforward

**When NOT to use**:
- ❌ Complex validation on backend
- ❌ Multi-step workflows
- ❌ Financial transactions
- ❌ State changes that affect multiple entities

**Pattern**:
```typescript
const updateStatus = async (newStatus) => {
  // Optimistic UI update
  const previousStatus = status;
  setStatus(newStatus);
  
  try {
    await fetch('/api/update', {
      method: 'POST',
      body: JSON.stringify({ status: newStatus })
    });
  } catch (error) {
    // Rollback on failure
    setStatus(previousStatus);
    showError('Update failed');
  }
};
```

---

## 9. Workflow Continuity Governance

### 9.1 Continuity Requirements

**Every workflow MUST survive**:

| Event | Expected Behavior | Test |
|-------|-------------------|------|
| **Refresh (F5)** | Restore exact state | Press F5, state unchanged |
| **Browser back** | Return to previous URL state | Click back, previous screen appears |
| **Browser forward** | Replay navigation forward | Click forward after back |
| **Deep link open** | Open directly to that state | Copy URL, open in new tab |
| **Tab restore** | Restore after browser crash | Chrome: Settings → Restore tabs |
| **Accidental navigation** | Warn or restore | Click external link accidentally |
| **Network interruption** | Queue or resume after reconnect | Go offline, come back online |

### 9.2 Workflow Continuity Checklist

**For each workflow, verify**:
```
□ URL contains all necessary state
□ Refresh restores state correctly
□ Back button works as expected
□ Forward button replays navigation
□ Deep link opens workflow correctly
□ No data loss on navigation
□ Draft auto-saves or warns before exit
□ Loading states handle slow network
□ Error states allow retry or recovery
□ Multi-tab workflow doesn't conflict
```

### 9.3 Navigation Warning Pattern

**When to warn user before navigation**:
- Unsaved form data exists
- Long-running upload in progress
- Critical workflow incomplete

**Implementation**:
```typescript
useEffect(() => {
  const hasUnsavedChanges = isDirty && !isSaved;
  
  if (!hasUnsavedChanges) return;
  
  // Browser native confirmation
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // Chrome requires this
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [isDirty, isSaved]);
```

### 9.4 Draft Auto-Save Pattern

**Implementation**:
```typescript
const [formData, setFormData] = useState(initialData);
const [lastSaved, setLastSaved] = useState(null);
const saveTimeoutRef = useRef(null);

useEffect(() => {
  // Clear previous timeout
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  
  // Debounced auto-save after 2 seconds
  saveTimeoutRef.current = setTimeout(() => {
    saveDraft(formData).then(() => {
      setLastSaved(Date.now());
    });
  }, 2000);
  
  return () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  };
}, [formData]);
```

---

## 10. Domain Route Blueprints

### 10.1 OCR Domain

**CURRENT** (fragmented):
```
/ocr → generic landing
  ?mode=scan|verify → hidden mode switching
  &draftId=X → hidden draft
```

**TARGET** (clear ownership):
```
/ocr/scan
  ?mode=camera|gallery
  &template=[template_id]
  
/ocr/verify
  ?id=[draft_id]              # Which draft to verify
  &step=preview|edit|export   # Workflow step
  &highlight=confidence|errors # UI mode
  
/ocr/history
  ?status=draft|pending|approved|rejected
  &from=[date]
  &to=[date]
  &template=[template_id]
  &q=[search_query]
  
/ocr/history/[draft_id]
  ?view=rows|metadata|audit
  
/ocr/templates
  (Admin: OCR template management)
```

**Migration**: 
- Phase 1: Add new routes, keep old ones working
- Phase 2: Redirect old patterns to new routes
- Phase 3: Remove old route handlers

### 10.2 Billing Domain

**CURRENT**:
```
/billing
  → giant page with tabs in state
```

**TARGET**:
```
/billing
  ?tab=usage|subscription|invoices|payment
  
/billing?tab=usage
  &metric=ocr|ai|storage
  &from=[date]
  &to=[date]
  
/billing?tab=invoices
  &invoice=[invoice_id]
  
/billing?tab=payment
  &modal=add-card
```

### 10.3 Settings Domain

**CURRENT**:
```
/settings → everything in one page
/settings/attendance → separate page
```

**TARGET**:
```
/settings
  ?section=profile|factory|users|billing|integrations
  
/settings/factory
  ?factory=[factory_id]
  &tab=details|roles|templates
  
/settings/attendance
  ?tab=employees|shifts|holidays|rules
  &modal=add-employee
  &employee=[employee_id]
  
/settings/users
  ?role=admin|manager|supervisor|operator
  &status=active|invited|suspended
  &user=[user_id]
```

### 10.4 Steel Domain

**CURRENT**:
```
/steel → command center with hidden state
/steel/charts → separate
/steel/customers → list
/steel/customers/[id] → detail
```

**TARGET**:
```
/steel
  ?view=overview|stock|production|revenue
  &from=[date]
  &to=[date]
  
/steel/inventory
  ?location=[location_id]
  &category=[category]
  &status=available|allocated|dispatched
  &view=list|grid
  
/steel/inventory/transactions
  ?type=receipt|issue|adjustment
  &from=[date]
  &to=[date]
  
/steel/production
  ?status=planned|inprogress|completed
  &from=[date]
  &to=[date]
  
/steel/production/record
  ?batch=[batch_id]
  &step=1|2|3
  
/steel/batches
  ?status=active|completed|cancelled
  &q=[search]
  
/steel/batches/[id]
  ?tab=details|transactions|quality
  
/steel/customers
  ?status=active|inactive
  &risk=high|medium|low
  &sort=name|exposure|last_order
  
/steel/customers/[id]
  ?tab=profile|invoices|payments|ledger
  &modal=add-payment
  
/steel/invoices
  ?status=draft|sent|paid|overdue
  &customer=[customer_id]
  &from=[date]
  &to=[date]
  
/steel/invoices/[id]
  ?tab=lines|payments|dispatches|audit
  &modal=add-line|edit-line|record-payment
  
/steel/dispatches
  ?status=planned|loaded|dispatched|delivered
  &customer=[customer_id]
  &vehicle=[vehicle_id]
  &from=[date]
  &to=[date]
  
/steel/dispatches/[id]
  ?tab=details|lines|tracking|documents
  &modal=add-line|update-status
  
/steel/reconciliations
  ?status=pending|approved|rejected
  &location=[location_id]
  &from=[date]
  &to=[date]
  
/steel/reconciliations/[id]
  ?step=count|review|adjust|approve
  
/steel/charts
  ?metric=production|stock|revenue|dispatch
  &view=trend|comparison|distribution
  &from=[date]
  &to=[date]
```

### 10.5 Dashboard Domain

**TARGET**:
```
/dashboard
  ?factory=[factory_id]
  &date=[date]
  &view=operator|supervisor|manager|owner
  
/dashboard?view=owner
  &metric=revenue|production|quality|risk
  &from=[date]
  &to=[date]
```

### 10.6 Alerts Domain

**TARGET**:
```
/alerts
  ?status=unread|acknowledged|resolved
  &priority=high|medium|low
  &type=anomaly|threshold|system
  
/alerts/[id]
  ?action=view|acknowledge|resolve
```

### 10.7 Reports Domain

**TARGET**:
```
/reports
  ?type=attendance|production|steel|finance
  
/reports?type=attendance
  &from=[date]
  &to=[date]
  &employee=[employee_id]
  &format=table|chart
  &export=pdf|excel
  
/reports?type=production
  &metric=output|efficiency|downtime
  &shift=morning|evening|night
  &from=[date]
  &to=[date]
  
/reports?type=steel
  &metric=inventory|dispatch|revenue
  &customer=[customer_id]
  &from=[date]
  &to=[date]
```

### 10.8 Intelligence Domain

**TARGET**:
```
/analytics
  ?metric=production|attendance|steel|quality
  &view=dashboard|trend|comparison
  &from=[date]
  &to=[date]
  &factory=[factory_id]
  
/ai
  ?context=summary|anomaly|prediction|recommendation
  &entity_type=batch|dispatch|invoice|reconciliation
  &entity_id=[id]
  &from=[date]
  &to=[date]
  
/premium/dashboard
  (Owner desk with comprehensive intelligence)
```

### 10.9 Users Domain

**TARGET**:
```
/users
  ?factory=[factory_id]
  &role=admin|manager|supervisor|operator
  &status=active|invited|suspended
  
/users/[id]
  ?tab=profile|access|activity|audit
  &modal=edit-role|reset-password
```

### 10.10 Factories Domain

**TARGET**:
```
/factories
  (Multi-factory owners)
  ?status=active|inactive
  &view=list|grid
  
/factories/[id]
  ?tab=overview|settings|users|billing
```

---

## 11. Frontend Anti-Patterns

### 11.1 Giant Single-Screen Workflows

**Problem**: One route renders completely different content based on hidden state.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN: Fake pages within /steel
const SteelPage = () => {
  const [screen, setScreen] = useState('list'); // Hidden!
  
  if (screen === 'list') return <InvoiceList />;
  if (screen === 'detail') return <InvoiceDetail />;
  if (screen === 'edit') return <InvoiceEditor />;
};
```

**Required**:
```typescript
// ✅ REQUIRED: Real routes
/steel/invoices           → <InvoiceList />
/steel/invoices/[id]      → <InvoiceDetail />
/steel/invoices/[id]?mode=edit → <InvoiceEditor />
```

### 11.2 Hidden Tab Ownership

**Problem**: Tabs stored in component state, not URL.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN
const [activeTab, setActiveTab] = useState('pending');
// URL: /approvals (no tab param)
// User refreshes → loses tab selection
```

**Required**:
```typescript
// ✅ REQUIRED
const searchParams = useSearchParams();
const activeTab = searchParams.get('tab') || 'pending';
// URL: /approvals?tab=pending
// User refreshes → tab restored
```

### 11.3 Fake Pages

**Problem**: Conditional rendering simulates pages without route changes.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN
const [currentView, setCurrentView] = useState<'scan' | 'verify'>('scan');

return (
  <>
    {currentView === 'scan' && <ScanView />}
    {currentView === 'verify' && <VerifyView />}
  </>
);
// URL never changes, back button broken
```

**Required**:
```typescript
// ✅ REQUIRED
// /ocr/scan → <ScanView />
// /ocr/verify → <VerifyView />
// Separate routes, browser navigation works
```

### 11.4 sessionStorage-Owned Navigation

**Problem**: Using sessionStorage to remember navigation context.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN: Storing route context in sessionStorage
sessionStorage.setItem('return-to', '/steel/invoices');
sessionStorage.setItem('selected-invoice', 'inv_123');

// Later...
const returnTo = sessionStorage.getItem('return-to');
router.push(returnTo); // Fragile, breaks cross-tab
```

**Required**:
```typescript
// ✅ REQUIRED: Encode return context in URL
const returnUrl = encodeURIComponent('/steel/invoices?selected=inv_123');
router.push(`/steel/payments/add?return=${returnUrl}`);

// Later...
const searchParams = useSearchParams();
const returnUrl = searchParams.get('return');
router.push(decodeURIComponent(returnUrl));
```

### 11.5 Forced Reloads

**Problem**: Using `window.location.reload()` instead of state updates.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN
const onSave = async () => {
  await saveData();
  window.location.reload(); // Loses scroll, flashes screen
};
```

**Required**:
```typescript
// ✅ REQUIRED
const onSave = async () => {
  await saveData();
  mutate(); // SWR revalidation
  // or
  refetch(); // React Query refetch
  // Smooth update, no reload
};
```

### 11.6 Local-State Routing

**Problem**: Navigation logic based on component state, not URL.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN
const [step, setStep] = useState(1);

const nextStep = () => setStep(step + 1);
const prevStep = () => setStep(step - 1);
// Browser back button doesn't work
```

**Required**:
```typescript
// ✅ REQUIRED
const searchParams = useSearchParams();
const step = parseInt(searchParams.get('step') || '1');

const nextStep = () => {
  router.push(`/wizard?step=${step + 1}`);
};
const prevStep = () => {
  router.back(); // Uses browser history
};
```

### 11.7 Overlay-Only Architecture

**Problem**: All workflows are overlays, no dedicated routes.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN: Everything is a modal
<Modal open={verifyModalOpen}>
  <VerifyWorkflow />
</Modal>
// No URL ownership, can't deep link, can't refresh
```

**Required**:
```typescript
// ✅ REQUIRED: Route-owned overlay or dedicated route
// URL: /ocr/verify?id=draft_123
// Can open directly, can refresh, can share
```

### 11.8 Hydration Guessing

**Problem**: Rendering stale cached data before fetching fresh data.

**Example** (FORBIDDEN):
```typescript
// ❌ FORBIDDEN
const [data, setData] = useState(() => {
  const cached = localStorage.getItem('data');
  return cached ? JSON.parse(cached) : null;
});
// User sees potentially stale data immediately
```

**Required**:
```typescript
// ✅ REQUIRED
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(data => {
      setData(data);
      setLoading(false);
      // Optional: Cache for offline
      localStorage.setItem('data', JSON.stringify(data));
    });
}, []);

if (loading) return <LoadingState />;
return <Content data={data} />;
```

---

## 12. Migration Strategy

### 12.1 Migration Principles

**Non-Negotiable**:
1. ✅ **No big-bang rewrite** - Migrate incrementally
2. ✅ **Domain-by-domain** - Complete one domain before next
3. ✅ **Minimal blast radius** - New code coexists with old
4. ✅ **Backward compatibility** - Old URLs redirect to new
5. ✅ **Gradual rollout** - Flag-based feature toggle

### 12.2 Safe Migration Phases

**Phase 0: Audit** (1 week)
```
□ Document all existing routes
□ Document all localStorage/sessionStorage usage
□ Document all state-based navigation
□ Identify high-priority continuity breaks
□ Prioritize domains by business impact
```

**Phase 1: OCR Domain** (2 weeks)
```
□ Create new /ocr/scan route (isolated)
□ Create new /ocr/verify route (isolated)
□ Create new /ocr/history route (isolated)
□ Implement URL-based state management
□ Test deep links, refresh, back button
□ Run parallel with old /ocr route
□ Add redirect logic: /ocr?mode=scan → /ocr/scan
□ Monitor for errors, revert if critical issues
□ Deprecate old /ocr generic route
```

**Phase 2: Billing Domain** (1 week)
```
□ Extract tab state from component to URL
□ Convert modal state to URL params
□ Test refresh continuity
□ Deploy with backward compatibility
□ Monitor for errors
```

**Phase 3: Settings Domain** (1 week)
```
□ Convert section state to URL params
□ Convert modal state to URL params
□ Test deep links
□ Deploy
```

**Phase 4: Steel Domain** (3 weeks)
```
□ Audit all steel routes
□ Create target route structure
□ Migrate /steel/invoices
□ Migrate /steel/customers
□ Migrate /steel/dispatches
□ Migrate /steel/reconciliations
□ Test cross-linking between routes
□ Deploy incrementally
```

**Phase 5: Dashboard Domain** (1 week)
```
□ Extract view mode to URL
□ Extract factory selection to URL
□ Deploy
```

**Phase 6: Reports & Intelligence** (2 weeks)
```
□ Migrate /reports
□ Migrate /analytics
□ Migrate /ai
□ Deploy
```

**Phase 7: Cleanup** (1 week)
```
□ Remove old route patterns
□ Remove unused sessionStorage keys
□ Remove state-based navigation helpers
□ Update documentation
□ Final QA
```

### 12.3 Backward Compatibility Pattern

**Strategy**: Old URLs redirect to new URLs.

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Old pattern: /ocr?mode=verify&id=123
  if (url.pathname === '/ocr' && url.searchParams.has('mode')) {
    const mode = url.searchParams.get('mode');
    const id = url.searchParams.get('id');
    
    if (mode === 'verify' && id) {
      // Redirect to new pattern
      return NextResponse.redirect(
        new URL(`/ocr/verify?id=${id}`, request.url)
      );
    }
    
    if (mode === 'scan') {
      return NextResponse.redirect(
        new URL('/ocr/scan', request.url)
      );
    }
  }
  
  return NextResponse.next();
}
```

### 12.4 Feature Flag Pattern

**Purpose**: Enable new routes gradually.

```typescript
// config/features.ts
export const FEATURES = {
  NEW_OCR_ROUTES: process.env.NEXT_PUBLIC_NEW_OCR_ROUTES === 'true',
  NEW_STEEL_ROUTES: process.env.NEXT_PUBLIC_NEW_STEEL_ROUTES === 'true',
};

// Component
import { FEATURES } from '@/config/features';

const OcrPage = () => {
  if (FEATURES.NEW_OCR_ROUTES) {
    return <NewOcrScan />;
  }
  return <LegacyOcrScan />;
};
```

### 12.5 Rollback Plan

**If critical issues occur**:
```
1. Set feature flag to false
2. Deploy immediately
3. Old routes resume working
4. No data loss
5. Investigate issue offline
6. Fix and re-deploy
```

---

## 13. AI Execution Governance

### 13.1 When AI May Create Routes

**AI (Codex/Claude/Gemini) MAY create new routes when**:
- ✅ User explicitly requests a new page/screen
- ✅ Workflow clearly needs dedicated route
- ✅ Route follows naming conventions (Section 10)
- ✅ Route is documented in this governance doc

**AI MUST NOT create routes that**:
- ❌ Duplicate existing functionality
- ❌ Use generic patterns (`/page?screen=X`)
- ❌ Bypass URL governance rules
- ❌ Hide state in component memory

### 13.2 When AI May Use Local State

**AI MAY use local `useState` for**:
- ✅ Hover, focus, animation states
- ✅ Temporary form input before submit
- ✅ Dropdown/popover open/closed
- ✅ Loading/submitting states
- ✅ Toast/notification visibility

**AI MUST NOT use local state for**:
- ❌ Selected entity ID
- ❌ Active tab
- ❌ Workflow step
- ❌ Filter state
- ❌ Sort state
- ❌ Pagination
- ❌ Modal open state (if route-owned modal)

**Validation Rule**:
```
Before using useState, AI must ask:
"Would losing this state on refresh confuse the user?"
  → YES: Use URL state
  → NO: Local state is acceptable
```

### 13.3 Forbidden Architecture Patterns

**AI MUST NEVER implement**:
- ❌ State-based page switching
- ❌ sessionStorage for navigation state
- ❌ Hidden tab ownership
- ❌ Fake pages within single route
- ❌ localStorage for canonical state
- ❌ Forced `window.location.reload()`
- ❌ Navigation without browser history

### 13.4 Required Continuity Guarantees

**AI MUST ensure every new page supports**:
1. ✅ Deep linking (URL alone is sufficient)
2. ✅ Refresh continuity (F5 works)
3. ✅ Back button (browser back works)
4. ✅ Forward button (browser forward works)
5. ✅ Multi-tab isolation (tabs don't interfere)

**Test Checklist for AI**:
```
□ Open page via URL directly
□ Refresh page with F5
□ Navigate away and press back button
□ Open same URL in different tab
□ Copy URL and share with another user
□ All scenarios work identically
```

### 13.5 Required Hydration Behavior

**AI MUST implement hydration as**:
```typescript
// ✅ REQUIRED PATTERN
const MyPage = () => {
  const searchParams = useSearchParams();
  const entityId = searchParams.get('id');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!entityId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/entities/${entityId}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [entityId]);
  
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!entityId) return <EmptyState />;
  
  return <Content data={data} />;
};
```

### 13.6 Required URL Ownership

**AI MUST put these in URL**:
- ✅ Selected entity: `?id=[entity_id]`
- ✅ Active tab: `?tab=[tab_name]`
- ✅ Workflow step: `?step=[step_number]`
- ✅ Filter state: `?status=X&priority=Y`
- ✅ Sort state: `?sort=[field]&order=[asc|desc]`
- ✅ Pagination: `?page=[number]`
- ✅ Search query: `?q=[query]`
- ✅ Date filters: `?from=[date]&to=[date]`
- ✅ Modal trigger: `?modal=[modal_type]`

**AI prompt template**:
```
Before generating code, verify:
1. Is this state navigation-related? → Use URL
2. Is this state shareable? → Use URL
3. Would refresh lose important context? → Use URL
4. Otherwise → Local state acceptable
```

---

## 14. Frontend Quality Gates

### 14.1 Pre-Merge Checklist

**All PRs MUST pass**:
```
□ URL Ownership
  □ All workflow state in URL, not local state
  □ No hidden tabs/steps in component memory
  □ No navigation state in sessionStorage

□ Refresh Continuity
  □ F5 restores exact state
  □ No loss of context on refresh
  □ Loading states handle re-fetch

□ Deep Link Validation
  □ Opening URL directly works
  □ No dependency on prior navigation
  □ All required data fetchable from URL alone

□ Back Button Validation
  □ Browser back returns to previous state
  □ Back button works in modal overlays
  □ No broken back button behavior

□ Route Reconstruction
  □ URL can be bookmarked
  □ URL can be shared via WhatsApp/email
  □ URL works in different browser/device

□ URL Ownership Verification
  □ Filters in URL
  □ Tabs in URL
  □ Selected entities in URL
  □ Pagination in URL

□ Storage Dependency Verification
  □ No localStorage for navigation state
  □ No sessionStorage for workflow state
  □ Storage only for preferences/cache
```

### 14.2 Automated Tests

**Required test coverage**:
```typescript
describe('OCR Verify Page', () => {
  test('supports deep linking', async () => {
    // Open page directly with URL
    render(<OcrVerifyPage />, {
      router: { query: { id: 'draft_123', step: '2' } }
    });
    
    // Should load draft and navigate to step 2
    await waitFor(() => {
      expect(screen.getByText('Step 2: Review')).toBeInTheDocument();
    });
  });
  
  test('survives refresh', async () => {
    const { rerender } = render(<OcrVerifyPage />, {
      router: { query: { id: 'draft_123', step: '2' } }
    });
    
    // Simulate refresh (unmount + remount)
    rerender(<OcrVerifyPage />);
    
    // State should be restored from URL
    await waitFor(() => {
      expect(screen.getByText('Step 2: Review')).toBeInTheDocument();
    });
  });
  
  test('back button works', async () => {
    const mockRouter = { back: jest.fn() };
    render(<OcrVerifyPage />, { router: mockRouter });
    
    // Click back button in UI
    fireEvent.click(screen.getByText('Back'));
    
    // Should use browser back
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
```

### 14.3 Manual QA Checklist

**Before marking feature complete**:
```
Navigation QA:
□ Open URL directly in new tab
□ Refresh page at various states
□ Press back button multiple times
□ Press forward button
□ Copy URL and open in incognito
□ Bookmark URL and reopen later
□ Share URL to another user (test their access)

Multi-Tab QA:
□ Open same page in two tabs
□ Make changes in tab 1
□ Switch to tab 2
□ Verify no unexpected behavior
□ Close tab 1, tab 2 still works

Mobile QA:
□ Open URL on mobile
□ Background app
□ Return after 5 minutes
□ Verify state restored
□ Browser back button works

Error QA:
□ Open URL with invalid ID
□ Shows proper error state
□ Provides recovery action
□ Doesn't crash

Offline QA:
□ Disconnect network
□ Attempt navigation
□ Reconnect network
□ Verify recovery behavior
```

### 14.4 Code Review Checklist

**Reviewers MUST verify**:
```
Architecture Compliance:
□ No new local state for workflow identity
□ No new sessionStorage for navigation
□ New routes follow naming conventions
□ URL state is properly hydrated
□ Back button behavior tested

Code Quality:
□ Proper loading states
□ Proper error states
□ Proper empty states
□ Race condition handling
□ TypeScript types complete

Documentation:
□ Route documented in this file
□ Migration path documented (if applicable)
□ Breaking changes noted
```

### 14.5 Regression Prevention

**Automated checks**:
```bash
# Check for banned patterns
npm run lint:architecture

# Checks:
# - sessionStorage used for navigation
# - localStorage used for workflow state
# - useState used for selected entity
# - window.location.reload() usage
# - Missing URL state
```

---

## 15. Implementation Examples

### 15.1 Example: Route-Owned Tab System

**Requirement**: Invoice detail page with tabs

```typescript
// URL: /steel/invoices/inv_123?tab=lines

'use client';

import { useSearchParams, useRouter } from 'next/navigation';

type TabType = 'details' | 'lines' | 'payments' | 'dispatches';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabType) || 'details';
  
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    router.push(`/steel/invoices/${params.id}?${params.toString()}`);
  };
  
  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details"><InvoiceDetails /></TabsContent>
        <TabsContent value="lines"><InvoiceLines /></TabsContent>
        <TabsContent value="payments"><InvoicePayments /></TabsContent>
        <TabsContent value="dispatches"><InvoiceDispatches /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### 15.2 Example: Route-Owned Modal

**Requirement**: Customer list with payment modal

```typescript
// URL: /steel/customers?modal=add-payment&customer=cust_123

'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modalType = searchParams.get('modal');
  const customerId = searchParams.get('customer');
  
  const openPaymentModal = (customerId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('modal', 'add-payment');
    params.set('customer', customerId);
    router.push(`/steel/customers?${params.toString()}`);
  };
  
  const closeModal = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    params.delete('customer');
    router.push(`/steel/customers?${params.toString()}`);
  };
  
  return (
    <>
      <CustomerList onAddPayment={openPaymentModal} />
      
      {modalType === 'add-payment' && customerId && (
        <PaymentModal
          customerId={customerId}
          onClose={closeModal}
          onSuccess={() => {
            closeModal();
            // Refresh data
          }}
        />
      )}
    </>
  );
}
```

### 15.3 Example: Wizard with URL Steps

**Requirement**: Multi-step OCR verification

```typescript
// URL: /ocr/verify?id=draft_123&step=2

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const STEPS = ['preview', 'edit', 'review', 'export'] as const;
type Step = typeof STEPS[number];

export default function OcrVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('id');
  const currentStepIndex = parseInt(searchParams.get('step') || '1') - 1;
  const currentStep = STEPS[currentStepIndex] || STEPS[0];
  
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/ocr/verification-drafts/${draftId}`)
      .then(res => res.json())
      .then(data => {
        setDraft(data);
        setLoading(false);
      });
  }, [draftId]);
  
  const goToStep = (stepIndex: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', String(stepIndex + 1));
    router.push(`/ocr/verify?${params.toString()}`);
  };
  
  const nextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };
  
  if (loading) return <LoadingState />;
  if (!draftId) return <EmptyState />;
  
  return (
    <div>
      <WizardProgress steps={STEPS} currentStep={currentStepIndex} />
      
      {currentStep === 'preview' && <PreviewStep draft={draft} onNext={nextStep} />}
      {currentStep === 'edit' && <EditStep draft={draft} onNext={nextStep} onBack={prevStep} />}
      {currentStep === 'review' && <ReviewStep draft={draft} onNext={nextStep} onBack={prevStep} />}
      {currentStep === 'export' && <ExportStep draft={draft} onBack={prevStep} />}
    </div>
  );
}
```

### 15.4 Example: Filters in URL

**Requirement**: Invoice list with filters

```typescript
// URL: /steel/invoices?status=pending&customer=cust_123&from=2026-05-01&sort=date&order=desc

'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Extract filters from URL
  const filters = {
    status: searchParams.get('status') || 'all',
    customer: searchParams.get('customer') || '',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    sort: searchParams.get('sort') || 'date',
    order: (searchParams.get('order') || 'desc') as 'asc' | 'desc',
  };
  
  const updateFilters = (updates: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    
    router.push(`/steel/invoices?${params.toString()}`);
  };
  
  return (
    <div>
      <FilterBar
        filters={filters}
        onFilterChange={updateFilters}
      />
      
      <InvoiceList
        filters={filters}
        onSort={(field) => updateFilters({
          sort: field,
          order: filters.sort === field && filters.order === 'asc' ? 'desc' : 'asc'
        })}
      />
    </div>
  );
}
```

### 15.5 Example: Backend Draft with Auto-Save

**Requirement**: Entry form with crash recovery

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';

export default function EntryPage() {
  const [formData, setFormData] = useState(initialData);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Auto-save draft to backend
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        await fetch('/api/entries/drafts', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000); // Debounce 2 seconds
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData]);
  
  // Warn before leaving with unsaved changes
  useEffect(() => {
    const hasUnsavedChanges = !lastSaved ||
      new Date().getTime() - lastSaved.getTime() < 5000;
    
    if (!hasUnsavedChanges) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lastSaved]);
  
  return (
    <form>
      {/* Form fields */}
      
      <div className="save-status">
        {isSaving && 'Saving...'}
        {!isSaving && lastSaved && `Saved ${formatRelative(lastSaved)}`}
      </div>
    </form>
  );
}
```

---

## 16. Enforcement and Compliance

### 16.1 Architecture Review Board

**Authority**: Principal Frontend Architect + Lead Engineers

**Responsibilities**:
- Review architecture proposals
- Approve exceptions to governance rules
- Update governance document
- Resolve architectural disputes

**Meeting Cadence**: As needed for major changes

### 16.2 Governance Updates

**This document may be updated when**:
- New patterns emerge
- Technology stack changes
- Platform requirements evolve
- Lessons learned from production

**Update Process**:
1. Proposal created with rationale
2. Team review and discussion
3. Architecture board approval
4. Document updated with version bump
5. Team notified of changes

### 16.3 Exception Process

**When governance rules cannot be followed**:
1. Document exception request
2. Explain why rule doesn't apply
3. Propose alternative approach
4. Get architecture board approval
5. Document exception in code

**Example Exception Comment**:
```typescript
/**
 * ARCHITECTURE EXCEPTION
 * Rule: All workflow state must be in URL
 * Exception: Camera preview state is ephemeral and cannot be serialized to URL
 * Approved by: Principal Architect, 2026-05-20
 * Mitigation: Camera preview is isolated component with clear boundaries
 */
const [cameraPreview, setCameraPreview] = useState<MediaStream | null>(null);
```

---

## 17. Success Metrics

### 17.1 Continuity Metrics

**Track monthly**:
- % of routes supporting deep links
- % of routes surviving refresh
- % of routes with working back button
- Average time to restore state after crash
- User-reported navigation confusion incidents

**Target**:
- 100% of primary workflows support deep links
- 100% refresh continuity
- Zero broken back button reports
- < 2 second state restoration
- < 1 navigation confusion report per month

### 17.2 Developer Metrics

**Track quarterly**:
- Time to implement new feature (with governance)
- Navigation-related bug count
- localStorage misuse incidents
- Route refactoring frequency
- AI code generation success rate

**Target**:
- Stable or decreasing implementation time
- < 5 navigation bugs per quarter
- Zero localStorage misuse in new code
- Minimal route refactoring (stable patterns)
- > 90% AI code passes architecture review

### 17.3 User Experience Metrics

**Track continuously**:
- Shared link success rate
- Bookmark restoration success rate
- Session recovery success rate
- Multi-tab workflow success rate
- Mobile background/foreground recovery rate

**Target**:
- > 98% shared link success
- > 99% bookmark restoration
- > 95% session recovery
- > 98% multi-tab success
- > 90% mobile recovery

---

## 18. Training and Onboarding

### 18.1 New Developer Onboarding

**Week 1**: Platform Philosophy
- Read this document (all sections)
- Review existing route patterns
- Study URL state management
- Understand continuity requirements

**Week 2**: Hands-On Practice
- Fix a route continuity bug
- Migrate a component state to URL
- Implement a new route following standards
- Code review with architecture focus

**Week 3**: AI Execution
- Configure AI tools with governance rules
- Generate code with AI assistance
- Review AI-generated code for compliance
- Document learnings

### 18.2 AI Tool Configuration

**Provide to Codex/Claude/Gemini**:
```
You are implementing features for DPR.ai, a factory-first SaaS platform.

CRITICAL ARCHITECTURE RULES (never violate):

1. URL is source of truth
   - All workflow state goes in URL (query params or path)
   - Never use useState for: selected entity, active tab, wizard step, filter state
   - Always use useSearchParams() to read state
   - Always use router.push() to update state

2. Browser navigation is sacred
   - Back button must work (use browser history)
   - Refresh must restore state (hydrate from URL)
   - Deep links must work (no prior navigation required)

3. Storage is for preferences only
   - localStorage: UI preferences, cache
   - sessionStorage: crash recovery only
   - Never store workflow state in storage

4. Required for every page:
   - Deep link support
   - Refresh continuity
   - Back button functionality
   - Loading states
   - Error states

5. Before using useState, ask:
   "Would losing this on refresh confuse the user?"
   YES → Use URL state
   NO → Local state OK

6. Route naming:
   /[domain]/[entity-type]/[entity-id]?[filters]&[mode]
   Example: /steel/invoices/inv_123?tab=lines&modal=add-line

When generating code, follow these patterns exactly.
Explain any deviations before implementing.
```

---

## 19. Reference Patterns Library

### 19.1 URL State Patterns

```typescript
// ✅ Tab system
const tab = searchParams.get('tab') || 'default';
router.push(`/path?tab=${newTab}`);

// ✅ Selected entity
const selected = searchParams.get('selected');
router.push(`/path?selected=${entityId}`);

// ✅ Filters
const status = searchParams.get('status') || 'all';
const updateFilter = (key: string, value: string) => {
  const params = new URLSearchParams(searchParams);
  params.set(key, value);
  router.push(`/path?${params.toString()}`);
};

// ✅ Multi-filter with reset
const resetFilters = () => {
  router.push('/path'); // Clear all params
};

// ✅ Pagination
const page = parseInt(searchParams.get('page') || '1');
router.push(`/path?page=${nextPage}`);

// ✅ Modal
const modalType = searchParams.get('modal');
const openModal = (type: string) => {
  const params = new URLSearchParams(searchParams);
  params.set('modal', type);
  router.push(`/path?${params.toString()}`);
};
const closeModal = () => {
  const params = new URLSearchParams(searchParams);
  params.delete('modal');
  router.push(`/path?${params.toString()}`);
};
```

### 19.2 Hydration Patterns

```typescript
// ✅ Entity hydration
const [entity, setEntity] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const id = searchParams.get('id');
  if (!id) {
    setLoading(false);
    return;
  }
  
  fetchEntity(id)
    .then(setEntity)
    .finally(() => setLoading(false));
}, [searchParams]);

// ✅ Draft restoration
useEffect(() => {
  const draftId = searchParams.get('draft');
  if (!draftId) return;
  
  restoreDraft(draftId).then(setFormData);
}, [searchParams]);

// ✅ Abort stale requests
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    });
  
  return () => controller.abort();
}, [entityId]);
```

### 19.3 Navigation Patterns

```typescript
// ✅ Navigate with state preservation
const navigateWithFilters = (path: string) => {
  const params = new URLSearchParams(searchParams);
  router.push(`${path}?${params.toString()}`);
};

// ✅ Back button handling
const goBack = () => {
  router.back(); // Use browser history
};

// ✅ Conditional navigation
const onSuccess = () => {
  const returnUrl = searchParams.get('return');
  if (returnUrl) {
    router.push(returnUrl);
  } else {
    router.push('/default-page');
  }
};

// ✅ Replace (no history entry)
router.replace('/path'); // For redirects
```

---

## 20. Conclusion

### 20.1 Summary

This governance document establishes **URL-first, browser-native architecture** as the foundation of DPR.ai's frontend.

**Key Principles**:
1. **URL owns workflow state** - No hidden component state
2. **Browser navigation works** - Back/forward/refresh/bookmark
3. **Deep linking is universal** - Every screen is directly accessible
4. **Continuity is guaranteed** - No state loss on navigation
5. **Storage is for preferences** - Not for workflow state

### 20.2 Why This Matters

**For Users**:
- Links shared via WhatsApp work reliably
- Bookmarks work after weeks
- Back button behaves predictably
- Refresh doesn't lose work
- Multi-tab workflows don't conflict

**For Developers**:
- Clear patterns to follow
- AI tools generate correct code
- Fewer navigation bugs
- Easier debugging
- Predictable state management

**For Business**:
- Higher user trust
- Fewer support tickets
- Faster feature development
- Easier onboarding
- Scalable architecture

### 20.3 Living Document

This document evolves with the platform. Submit proposals for:
- New patterns discovered
- Technology improvements
- Lessons from production
- Developer feedback

**Version History**:
- v1.0 (2026-05-20): Initial governance standard

---

## Appendix A: Quick Reference

### Route Naming Convention
```
/[domain]/[entity-type]/[entity-id]?[filters]&[mode]
```

### Query Param Standards
```
?tab=[tab_name]
&selected=[entity_id]
&modal=[modal_type]
&status=[status]
&from=[date]&to=[date]
&q=[search]
&sort=[field]&order=[asc|desc]
&page=[number]
```

### State Decision Tree
```
URL State:
- Selected entity
- Active tab
- Workflow step
- Filters
- Sort/pagination
- Modal trigger

Local State:
- Hover/focus
- Animation
- Dropdown open
- Loading indicators
- Temporary input

Backend Draft:
- Long-running work
- Multi-device sync
- Crash recovery
- Async workflows
```

### Required Tests
```
□ Deep link test
□ Refresh test
□ Back button test
□ Multi-tab test
□ Bookmark test
```

---

## Appendix B: Migration Roadmap

### Phase Timeline (11 weeks total)

| Phase | Domain | Duration | Priority |
|-------|--------|----------|----------|
| 0 | Audit | 1 week | P0 |
| 1 | OCR | 2 weeks | P1 |
| 2 | Billing | 1 week | P1 |
| 3 | Settings | 1 week | P2 |
| 4 | Steel | 3 weeks | P1 |
| 5 | Dashboard | 1 week | P2 |
| 6 | Reports & Intelligence | 2 weeks | P2 |
| 7 | Cleanup | 1 week | P3 |

### Weekly Milestones

**Week 1**: Complete audit, prioritize issues
**Week 3**: OCR routes migrated and tested
**Week 4**: Billing continuity restored
**Week 5**: Settings routes cleaned
**Week 8**: Steel domain fully route-owned
**Week 9**: Dashboard state in URL
**Week 11**: All cleanup complete, documentation updated

---

## Appendix C: Glossary

**URL State**: State stored in the URL (pathname, query params, hash)

**Local State**: State stored in component memory (useState)

**Backend Draft**: State stored on server for persistence

**Route Ownership**: A route has ownership when it fully controls its displayed state via URL

**Deep Link**: A URL that works when opened directly without prior navigation

**Refresh Continuity**: The ability to press F5 and restore exact state

**Browser-Native Navigation**: Using browser back/forward/refresh instead of custom navigation logic

**Hydration**: The process of restoring component state from URL and backend

**Route Overlay**: A modal/drawer that has URL representation

**Workflow Identity**: The core state that defines "what workflow am I in"

**Canonical State**: The authoritative source of truth for a piece of state

**Stale Data**: Cached data that may no longer match backend reality

**Optimistic Update**: Updating UI before server confirms success

**Race Condition**: Multiple async operations completing in unpredictable order

---

**END OF DOCUMENT**

This governance standard is now in effect for all DPR.ai frontend development.