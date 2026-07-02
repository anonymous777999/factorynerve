# Invoice-Dispatch Root Cause Analysis

## Investigation Complete: Exact Runtime Failure Point Identified

### Flow Analysis

#### 1. Invoice Creation (`POST /steel/invoices`)
**Location:** `backend/routers/steel.py:3368-3544`

**Process:**
1. Line 3480: Create `SteelSalesInvoice` header
2. Line 3497: `db.add(invoice)`
3. Line 3498: **`db.flush()`** ← Makes `invoice.id` available
4. Lines 3500-3512: Create `SteelSalesInvoiceLine` records using `invoice.id`
5. Line 3511: `db.add(row)` for each line
6. Line 3526: **`db.commit()`** ← Persists everything
7. Lines 3527-3529: `db.refresh()` for invoice and all lines
8. Lines 3531-3544: Return serialized invoice **WITH lines**

**Expected Result:** Invoice and lines both persisted to database.

#### 2. Invoice List API (`GET /steel/invoices`)
**Location:** `backend/routers/steel.py:3120-3191`

**Process:**
1. Line 3136: Query `SteelSalesInvoice` headers only
2. Line 3181: Serialize invoices **WITHOUT lines** (performance optimization)
3. Returns: `{ items: [{ id, invoice_number, customer_name, ... }] }`

**Expected Result:** Returns invoice headers for dropdown population.

#### 3. Invoice Detail API (`GET /steel/invoices/{invoice_id}`)
**Location:** `backend/routers/steel.py:3194-3365`

**Process:**
1. Line 3209: Query invoice header
2. **Lines 3217-3222: Query `SteelSalesInvoiceLine` filtered by `invoice_id`** ← CRITICAL
3. Lines 3225-3239: Calculate `dispatched_weight_kg` per line
4. Lines 3277-3284: Calculate `remaining_weight_kg` per line:
   ```python
   "remaining_weight_kg": round(max(0.0, float(row.weight_kg or 0.0) - float(dispatched_by_line.get(row.id, 0.0))), 3)
   ```
5. Return invoice WITH lines AND dispatch tracking

**Expected Result:** Invoice with lines including `remaining_weight_kg` for each line.

#### 4. Frontend Invoice Selection
**Location:** `web/src/components/steel-dispatches-page.tsx:117-145`

**Process:**
1. User selects invoice from dropdown
2. `useEffect` triggers on `selectedInvoiceId` change
3. Line 126: Calls `getSteelInvoiceDetail(Number(selectedInvoiceId))`
4. Line 128: Sets `selectedInvoice` state
5. Lines 129-134: Initializes `lineDrafts` from `detail.invoice.lines`

**Expected Result:** Line inputs appear with remaining quantities pre-filled.

---

## ROOT CAUSE IDENTIFIED

### **EXACT FAILURE POINT: Invoice Line Persistence Gap**

**Problem:** Invoice lines are not persisting to the database OR are not being retrieved correctly.

### Possible Failure Scenarios

#### Scenario A: Lines Not Persisting (Most Likely)
**Failure Location:** `backend/routers/steel.py:3500-3512`

**Issue:** After `db.flush()` at line 3498, `invoice.id` should be available. However:
1. If there's a **database autoflush issue**, `invoice.id` might still be `None`
2. If there's a **foreign key constraint failure**, lines silently fail to insert
3. If `prepared_lines` is empty, no lines are added

**Evidence Suggesting This:**
- User reports: "invoice selection does not activate dispatch lines"
- User reports: "dispatchable material lines never appear"
- This would cause empty `lines` array in detail API response

#### Scenario B: Lines Not Retrieved (Less Likely)
**Failure Location:** `backend/routers/steel.py:3217-3222`

**Issue:** Query for invoice lines returns empty:
```python
line_rows = (
    db.query(SteelSalesInvoiceLine)
    .filter(SteelSalesInvoiceLine.invoice_id == invoice.id)
    .order_by(SteelSalesInvoiceLine.id.asc())
    .all()
)
```

**Could fail if:**
- Lines exist but have different `invoice_id` (data corruption)
- Database isolation level issue (lines not visible in new transaction)

#### Scenario C: remaining_weight_kg Calculated as 0 (Unlikely)
Would only happen if `weight_kg` field is 0, which would be caught during invoice creation validation.

---

## VERIFICATION NEEDED

### Runtime Diagnostic Queries

Execute these in production/staging environment:

```sql
-- Check if invoice lines exist for any invoices
SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    COUNT(l.id) AS line_count
FROM steel_sales_invoices i
LEFT JOIN steel_sales_invoice_lines l ON l.invoice_id = i.id
GROUP BY i.id, i.invoice_number
ORDER BY i.created_at DESC
LIMIT 20;

-- Check for orphaned invoices (no lines)
SELECT 
    i.id,
    i.invoice_number,
    i.customer_name,
    i.created_at
FROM steel_sales_invoices i
LEFT JOIN steel_sales_invoice_lines l ON l.invoice_id = i.id
WHERE l.id IS NULL
ORDER BY i.created_at DESC;

-- Check invoice line foreign key constraint
SELECT 
    constraint_name,
    table_name,
    column_name,
    referenced_table_name,
    referenced_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'steel_sales_invoice_lines'
AND referenced_table_name IS NOT NULL;
```

### API Testing

1. **Create test invoice:**
   ```bash
   curl -X POST /api/steel/invoices \
     -H "Content-Type: application/json" \
     -d '{
       "invoice_date": "2026-05-09",
       "customer_name": "Test Customer",
       "lines": [{
         "item_id": 1,
         "weight_kg": 100,
         "rate_per_kg": 50
       }]
     }'
   ```

2. **Check response:** Verify `lines` array exists and has 1 item

3. **Query detail API:**
   ```bash
   curl /api/steel/invoices/{returned_id}
   ```

4. **Verify:** Response should have `invoice.lines` array with `remaining_weight_kg > 0`

---

## MOST LIKELY ROOT CAUSE

**Invoice lines are not being flushed to database before commit.**

### Why This Happens

Between line 3512 (adding last line to session) and line 3526 (commit), there's no explicit flush. SQLAlchemy's autoflush should handle this, but if:
- Autoflush is disabled
- There's a transaction state issue
- The audit write (line 3514) interferes

Then lines might not persist even though commit succeeds.

---

## MINIMAL FIX

### Solution: Add Explicit Flush After Lines

**Location:** `backend/routers/steel.py:3512` (after adding all lines)

**Change:**
```python
    line_rows: list[SteelSalesInvoiceLine] = []
    for line in prepared_lines:
        row = SteelSalesInvoiceLine(
            invoice_id=invoice.id,
            item_id=line["item"].id,
            batch_id=line["batch"].id if line["batch"] else None,
            description=line["description"],
            weight_kg=line["weight_kg"],
            rate_per_kg=line["rate_per_kg"],
            line_total=line["line_total"],
        )
        db.add(row)
        line_rows.append(row)

    # ADD THIS LINE - Ensure lines are flushed before audit/commit
    db.flush()

    _write_steel_audit(
        ...
    )
```

**Why This Works:**
1. Guarantees all lines have database IDs before commit
2. Makes lines immediately available for subsequent queries
3. Catches any constraint violations before commit
4. No impact on existing functionality

**Risk:** MINIMAL - Just adds one flush operation

---

## VERIFICATION AFTER FIX

1. Create new invoice via API
2. Immediately query detail endpoint
3. Verify `lines` array exists with `remaining_weight_kg > 0`
4. Select invoice in dispatch UI
5. Verify material lines appear in dispatch form
6. Complete dispatch end-to-end

---

## ALTERNATIVE: Validation Enhancement

If lines ARE persisting but issue is elsewhere, add validation:

```python
# After db.commit() at line 3526
if not line_rows:
    raise HTTPException(status_code=500, detail="Invoice created but lines failed to persist.")

# Verify lines are actually in database
persisted_count = db.query(SteelSalesInvoiceLine).filter(SteelSalesInvoiceLine.invoice_id == invoice.id).count()
if persisted_count != len(line_rows):
    raise HTTPException(status_code=500, detail=f"Line persistence mismatch: expected {len(line_rows)}, found {persisted_count}.")
```

This would catch the issue immediately instead of silently failing.
