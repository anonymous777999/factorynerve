# OCR Execution Plan

## Production-Grade Implementation Roadmap for DPR.ai

---

> **Target:** A Claude-only document intelligence system that handles 15+ document types (including handwritten notes, ledger images, and screenshots), presents data beautifully, exports perfectly, costs <$0.003 per page average, and is implementable by a senior engineer.

---

## Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   INGESTION LAYER   │ ──▶ │   INTELLIGENCE LAYER │ ──▶ │  PRESENTATION LAYER  │
│                     │     │                      │     │                      │
│  Upload & Validate  │     │  Document Classifier  │     │  Adaptive UI Render  │
│  Preprocess Image   │     │  Type-Specific Prompt │     │  Field-Level Review  │
│  Cache Hashing      │     │  Claude Haiku/Sonnet  │     │  Issue Detection     │
│  Quality Scoring    │     │  Schema Validation    │     │  Multi-Format Export │
│                     │     │  Correction Pass      │     │  Downstream Actions  │
└─────────────────────┘     └──────────────────────┘     └──────────────────────┘
         │                           │                            │
         └───────────────────────────┴────────────────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   DOCUMENT REGISTRY  │
                          │  (Single Source of   │
                          │    Truth for all     │
                          │   document types)    │
                          └─────────────────────┘
```

---

## Phase 0: Connect Existing Pieces (Week 1–2)

**Goal:** Wire the existing classifier + document registry + UI components together. This single phase unlocks 60% of the value.

### 0.1 Fix Production Bug First (30 min)

**File:** `backend/routers/ocr/_common.py`
**Bug:** `_build_table_preview_payload()` has dead code after early `return` causing `UnboundLocalError` for "table"/"form"/"text" types.

**Fix:**
```python
# ==== BUG: structured is only assigned in else branch ====
if extracted_type == "table" or extracted_type == "form":
    # headers and rows set here...
elif extracted_type == "text":
    headers = ["Text"]
    rows = [[str(line)] for line in normalized.get("lines", [])]
else:
    # "mixed" type
    structured = format_for_ui(...)
    structured["type"] = _table_preview_doc_type(doc_type_hint)
    # ...warnings, validation...
    return structured  # ← This return makes the code after the if/elif/else unreachable for "mixed"

# For "table"/"form"/"text", structured was NEVER assigned!
# But this code ACCESSES structured["warnings"] → UnboundLocalError
```

**Fix:** Move `return structured` inside the `else:` block and remove the duplicated code block after it.

---

### 0.2 Wire Classifier into Pipeline (1 day)

**Current state:** `DocumentClassifier` in `backend/understanding/classifier.py` exists but is **never called** from the OCR pipeline.

**File to modify:** `backend/routers/ocr/_common.py` → `_run_table_preview_pipeline()`

**Implementation plan:**

```
In _run_table_preview_pipeline():
1. After OCR text is extracted but BEFORE calling Claude:
   a. Call classify(ocr_text, image_bytes)
   b. Get [(type_id, confidence), ...] sorted by confidence
   c. If top confidence > 0.6:
      - Set doc_type_hint = type_id
      - Look up DocumentTypeConfig from registry
      - Use its extraction_prompt + schema in the Claude call
   d. If confidence < 0.6:
      - Use existing generic prompt
      - Set doc_type_hint = "unknown"
      - Flag for manual classification in UI
2. Return the type_id and confidence in the API response
```

**Key code changes:**

```python
# In _run_table_preview_pipeline():
from backend.understanding.classifier import classify

# After OCR extraction, before Claude call:
classification_results = classify(ocr_text, image_bytes)
doc_type_hint = "unknown"
classification_confidence = 0.0

if classification_results:
    top_type, top_confidence = classification_results[0]
    classification_confidence = top_confidence
    
    if top_confidence >= 0.6:
        doc_type_hint = top_type
        # Get type-specific prompt
        config = get_document_type(top_type)
        if config:
            prompt = _build_type_specific_prompt(config, ocr_text)
        else:
            prompt = _build_generic_prompt(ocr_text)
    else:
        prompt = _build_generic_prompt(ocr_text)
else:
    prompt = _build_generic_prompt(ocr_text)

# Add classification results to response metadata:
result["classification"] = {
    "type_id": doc_type_hint,
    "confidence": classification_confidence,
    "method": "keyword+structure+vision" if image_bytes else "keyword+structure"
}
```

---

### 0.3 Wire Document Registry Prompts into Claude Call (1 day)

**Current state:** `backend/services/ocr_document_types/__init__.py` has 3 registered types with prompts, schemas, few-shot examples, validation rules — all **completely unused**.

**File to modify:** `backend/routers/ocr/_common.py` → `_call_table_excel_anthropic()`

**Implementation plan:**

```python
def _build_type_specific_prompt(config: DocumentTypeConfig, ocr_text: str) -> str:
    """Build a prompt using the registry's type-specific prompt template."""
    prompt = config.extraction_prompt
    
    lines = [
        prompt.system,
        "",
        "OUTPUT SCHEMA:",
        json.dumps(prompt.schema, indent=2),
        "",
    ]
    
    if prompt.few_shot_examples:
        lines.append("EXAMPLES:")
        for ex in prompt.few_shot_examples:
            lines.append(json.dumps(ex, indent=2))
        lines.append("")
    
    lines.append("DOCUMENT TEXT:")
    lines.append(ocr_text)
    lines.append("")
    lines.append(prompt.user)
    
    return "\n".join(lines)
```

**Response format change:** Add `document_type_config` to the response:
```json
{
  "type_id": "gst_invoice",
  "display_name": "GST Invoice",
  "confidence": 0.87,
  "validation_rules": [...],
  "ui_component": "InvoiceReviewView",
  "preview_fields": [...],
  "export_formats": ["pdf", "excel", "json"],
  "downstream_actions": [...]
}
```

---

### 0.4 Wire Frontend DocumentTypeAdapter (1 day)

**Current state:** `DocumentTypeAdapter.tsx` exists, `InvoiceReviewView.tsx`, `DeliveryNoteReviewView.tsx`, `WeighbridgeReviewView.tsx` all exist — but **never get selected**.

**File to modify:** `web/src/components/ocr/DocumentTypeAdapter.tsx`

**Fix:**
```tsx
// In DocumentTypeAdapter.tsx — read type_id from the response and route correctly
export function DocumentTypeAdapter({ data, onUpdate }: Props) {
  const typeId = data.document_type_config?.type_id;
  
  switch (typeId) {
    case "gst_invoice":
      return <InvoiceReviewView data={data} onUpdate={onUpdate} />;
    case "delivery_note":
      return <DeliveryNoteReviewView data={data} onUpdate={onUpdate} />;
    case "weighbridge_slip":
      return <WeighbridgeReviewView data={data} onUpdate={onUpdate} />;
    default:
      return <GenericTableReviewView data={data} onUpdate={onUpdate} />;
  }
}
```

---

### 0.5 Update Frontend ocr.ts Types (0.5 day)

**File to modify:** `web/src/lib/ocr.ts`

Add `document_type_config` to `OcrPreviewResult`:
```typescript
export type DocumentTypeConfig = {
  type_id: string;
  display_name: string;
  confidence: number;
  icon: string;
  description: string;
  validation_rules: Array<{
    name: string;
    severity: "error" | "warning";
    message: string;
  }>;
  preview_fields: string[];
  export_formats: Array<{ name: string; label: string }>;
  downstream_actions: Array<{
    key: string;
    label: string;
    description: string;
    required_permissions: string[];
  }>;
};

// Add to OcrPreviewResult:
document_type_config?: DocumentTypeConfig | null;
```

---

## Phase 1: Document Type Expansion (Week 3–4)

**Goal:** Register 15+ document types to cover the full factory document ecosystem.

### 1.1 New Document Types to Register

| # | Type ID | Display Name | Category | UI Component | Priority |
|---|---------|-------------|----------|-------------|----------|
| 1 | `purchase_order` | Purchase Order (PO) | FINANCIAL | POReviewView | P0 |
| 2 | `goods_receipt_note` | Goods Receipt Note (GRN) | LOGISTICS | GRNReviewView | P0 |
| 3 | `material_receipt` | Material Receipt | INVENTORY | MaterialReceiptView | P0 |
| 4 | `production_report` | Production Report | PRODUCTION | ProductionReportView | P0 |
| 5 | `packing_list` | Packing List | LOGISTICS | PackingListView | P1 |
| 6 | `vendor_quotation` | Vendor Quotation | FINANCIAL | QuotationView | P1 |
| 7 | `dispatch_note` | Dispatch Note | LOGISTICS | DispatchNoteView | P1 |
| 8 | `stock_sheet` | Inventory / Stock Sheet | INVENTORY | StockSheetView | P1 |
| 9 | `credit_note` | Credit / Debit Note | FINANCIAL | CreditNoteView | P1 |
| 10 | `gate_entry` | Gate Entry / Inward | LOGISTICS | GateEntryView | P1 |
| 11 | `job_card` | Job Card / Work Order | PRODUCTION | JobCardView | P2 |
| 12 | `quality_cert` | Test Certificate | QUALITY | QualityCertView | P2 |
| 13 | `handwritten_form` | Handwritten Form | GENERAL | HandwrittenFormView | P2 |
| 14 | `chat_transcript` | Chat / Screenshot | GENERAL | ChatTranscriptView | P2 |
| 15 | `ledger_sheet` | Account Ledger | ACCOUNTING | LedgerSheetView | P2 |

### 1.2 Registration Pattern (Per Type)

Each type follows this exact pattern in `backend/services/ocr_document_types/__init__.py`:

```python
register_document_type(DocumentTypeConfig(
    type_id="purchase_order",
    display_name="Purchase Order",
    category=DocumentCategory.FINANCIAL,
    icon="shopping-cart",
    description="Purchase order from vendor/supplier",

    extraction_prompt=ExtractionPrompt(
        system="""Extract Purchase Order for factory procurement.

Focus on:
- PO number, date, vendor details
- Line items: description, unit, quantity, rate, amount
- Delivery terms, payment terms
- Tax information (if applicable)
- Special instructions or notes

Structure the output as a JSON object with clear separation of header and line items.""",
        user="Extract this Purchase Order. Return ONLY valid JSON.",
        schema={
            "type": "object",
            "required": ["po_number", "po_date", "vendor", "line_items"],
            "properties": {
                "po_number": {"type": "string"},
                "po_date": {"type": "string", "format": "date"},
                "vendor": {
                    "type": "object",
                    "required": ["name"],
                    "properties": {
                        "name": {"type": "string"},
                        "address": {"type": "string"},
                        "gstin": {"type": "string"},
                        "contact": {"type": "string"}
                    }
                },
                "ship_to": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "address": {"type": "string"}
                    }
                },
                "delivery_date": {"type": "string", "format": "date"},
                "payment_terms": {"type": "string"},
                "delivery_terms": {"type": "string"},
                "line_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["description", "qty", "rate", "amount"],
                        "properties": {
                            "sr_no": {"type": "integer"},
                            "description": {"type": "string"},
                            "hsn_code": {"type": "string"},
                            "qty": {"type": "number"},
                            "unit": {"type": "string"},
                            "rate": {"type": "number"},
                            "amount": {"type": "number"}
                        }
                    }
                },
                "totals": {
                    "type": "object",
                    "properties": {
                        "subtotal": {"type": "number"},
                        "tax": {"type": "number"},
                        "total": {"type": "number"},
                        "advance": {"type": "number"},
                        "balance": {"type": "number"}
                    }
                }
            }
        },
        few_shot_examples=[
            {
                "po_number": "PO-2024-0056",
                "po_date": "2024-06-15",
                "vendor": {"name": "ABC Steel Supply", "gstin": "27AABCS1234K1Z8"},
                "line_items": [
                    {"description": "Mild Steel Plate 6mm", "qty": 50, "unit": "MT", "rate": 48000, "amount": 2400000}
                ],
                "totals": {"subtotal": 2400000, "total": 2832000}
            }
        ]
    ),

    classifier_keywords=[
        "purchase order", "po no", "vendor", "supplier", 
        "ship to", "bill to", "order date", "delivery date",
        "payment terms", "vendor ref"
    ],
    classifier_weight=1.2,

    validation_rules=[...],

    ui_component="PurchaseOrderReviewView",  # To be built in Phase 3
    preview_fields=["po_number", "po_date", "vendor.name", "totals.total"],

    export_formats=[
        ExportFormat(name="pdf", mime_type="application/pdf", generator=generate_purchase_order_pdf, ...),
        ExportFormat(name="excel", mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", generator=generate_purchase_order_excel, ...),
    ],

    downstream_actions=[
        DownstreamAction(key="create_po", label="Create PO in ERP", ...),
    ],
))
```

---

## Phase 2: Cost-Optimized Claude Pipeline (Week 5–6)

**Goal:** Average <$0.003 per page using intelligent model tiering.

### 2.1 Three-Tier Claude Strategy

| Tier | Model | Cost/Page | Used For | Conditions |
|------|-------|-----------|----------|------------|
| **Fast** | `claude-3-5-haiku-latest` | ~$0.001 | Clean printed docs, high-quality scans | Image quality score ≥ 0.7, no handwriting detected |
| **Balanced** | `claude-3-5-sonnet-latest` | ~$0.003 | Most factory docs (invoices, delivery notes, PO) | Default when quality is medium |
| **Best** | `claude-3-5-sonnet-latest` + correction pass | ~$0.006 | Handwriting, low-quality scans, complex layouts | Quality < 0.5, or Haiku/Balanced fails validation |

### 2.2 Cost Router Implementation

**New file:** `backend/services/ocr_cost_router.py`

```python
"""
Intelligent cost router that selects Claude model tier based on:
1. Image quality analysis (blur, contrast, skew)
2. Handwriting detection
3. Document complexity (layout density, number of fields)
4. Classification confidence
"""

from dataclasses import dataclass
from enum import Enum

class ModelTier(str, Enum):
    FAST = "claude-3-5-haiku-latest"
    BALANCED = "claude-3-5-sonnet-latest"
    BEST = "claude-3-5-sonnet-latest"  # with correction pass

@dataclass
class RoutingDecision:
    tier: ModelTier
    reason: str
    estimated_cost: float
    needs_correction_pass: bool = False
    
def route_model(
    image_bytes: bytes,
    quality_score: float,
    has_handwriting: bool,
    doc_type: str | None,
    classification_confidence: float,
) -> RoutingDecision:
    """
    Route to the most cost-effective Claude model.
    
    Decision logic:
    1. Clean, high-quality, no handwriting → Haiku ($0.001)
    2. Standard document or medium quality → Sonnet ($0.003)
    3. Handwriting, low quality, or strict validation → Sonnet + correction pass ($0.006)
    """
    
    # If image quality is high and no handwriting, use Haiku
    if not has_handwriting and quality_score >= 0.7:
        return RoutingDecision(
            tier=ModelTier.FAST,
            reason=f"High quality (score={quality_score:.2f}), no handwriting detected",
            estimated_cost=0.001,
        )
    
    # If handwriting or low quality, use Sonnet with correction pass
    if has_handwriting or quality_score < 0.5:
        return RoutingDecision(
            tier=ModelTier.BEST,
            reason=f"Handwriting={has_handwriting}, quality={quality_score:.2f} — needs correction pass",
            estimated_cost=0.006,
            needs_correction_pass=True,
        )
    
    # Default to balanced
    return RoutingDecision(
        tier=ModelTier.BALANCED,
        reason=f"Standard document, quality={quality_score:.2f}",
        estimated_cost=0.003,
    )
```

### 2.3 Quality Analysis Integration

**Files to modify:**
- `backend/services/ocr_image_preprocessing.py` — Add `analyze_quality()` function
- `backend/routers/ocr/_common.py` — Integrate quality analysis before model selection

```python
def analyze_image_quality(image: np.ndarray) -> dict:
    """
    Analyze image quality for cost routing.
    
    Returns:
    - blur_score: 0.0 (very blurry) to 1.0 (sharp)
    - contrast_score: 0.0 (low) to 1.0 (high)
    - skew_angle: degrees of rotation needed
    - has_handwriting: boolean estimate
    - overall_quality: weighted composite
    - has_low_quality: boolean (overall < 0.5)
    """
    # Laplacian variance for blur detection
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_score = min(1.0, laplacian_var / 500.0)
    
    # Histogram-based contrast
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    contrast = hist.std()
    contrast_score = min(1.0, contrast / 80.0)
    
    # Hough transform for skew detection
    # ... (simplified)
    
    # Handwriting heuristic: connected components analysis
    # ... (simplified)
    
    overall = 0.4 * blur_score + 0.3 * contrast_score + 0.3 * (1.0 - has_handwriting)
    
    return {
        "blur_score": round(blur_score, 2),
        "contrast_score": round(contrast_score, 2),
        "has_handwriting": has_handwriting,
        "overall_quality": round(overall, 2),
        "has_low_quality": overall < 0.5,
    }
```

### 2.4 Correction Pass Logic

```python
async def _attempt_correction(raw_content: str, validation_errors: list[str], schema: dict) -> str:
    """
    When validation fails, send the raw output + validation errors back to Claude
    with instructions to fix specific issues. This is much cheaper than Opus.
    """
    correction_prompt = f"""
The previous extraction had these validation errors:
{chr(10).join(f'- {err}' for err in validation_errors)}

The original output was:
{raw_content}

Please fix ALL the above errors and return ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}

Pay special attention to:
- Numeric fields must be numbers (not strings)
- Required fields must not be null or missing
- Date fields must be in YYYY-MM-DD format
- Array fields must not be empty
"""
    return await _call_claude(correction_prompt, model="claude-3-5-sonnet-latest")
```

### 2.5 Cost Tracking & Transparency

**Add to response metadata:**
```json
{
  "routing": {
    "model_tier": "balanced",
    "model_used": "claude-3-5-sonnet-latest",
    "actual_cost_usd": 0.0028,
    "cost_saved_usd": 0.0002,
    "reason": "Standard document, quality=0.72",
    "correction_pass_needed": false
  }
}
```

---

## Phase 3: Frontend Adaptive UI (Week 7–9)

**Goal:** Beautiful, document-type-specific UI that adapts to data complexity.

### 3.1 UI Component Architecture

```
DocumentTypeAdapter (router)
├── InvoiceReviewView        (tabbed: Header | Items | Tax | Totals)
├── DeliveryNoteReviewView   (tabbed: Header | Items | Vehicle)
├── WeighbridgeReviewView    (single-card form)
├── PurchaseOrderReviewView  (tabbed: Header | Items | Terms)  ← NEW
├── GRNReviewView            (tabbed: Header | Items | QC)     ← NEW
├── MaterialReceiptView      (form + table)                     ← NEW
├── ProductionReportView     (section-based)                    ← NEW
├── HandwrittenFormView      (dynamic key-value form)           ← NEW
├── ChatTranscriptView       (message list)                     ← NEW
├── LedgerSheetView          (financial table)                  ← NEW
├── GenericTableReviewView   (editable table — FALLBACK)
└── AdaptiveLayoutEngine     (card | compact | sectioned | paginated)
```

### 3.2 Adaptive Layout Engine

**New file:** `web/src/lib/adaptive-layout.ts`

```typescript
export type LayoutMode = "card" | "compact" | "sectioned" | "paginated" | "split" | "key-value" | "message-list";

export function determineLayout(data: OcrPreviewResult): LayoutMode {
  const fieldCount = data.headers?.length ?? 0;
  const rowCount = data.rows?.length ?? 0;
  const totalCells = fieldCount * rowCount;
  const docType = data.document_type_config?.type_id;
  
  // Document-type-specific layouts
  if (docType === "handwritten_form" || docType === "unknown") {
    return "key-value";  // Dynamic key-value form
  }
  if (docType === "chat_transcript") {
    return "message-list";  // Chronological message view
  }
  if (docType === "weighbridge_slip") {
    return "card";  // Simple form card
  }
  
  // Data-density-based layouts
  if (rowCount <= 3 && fieldCount <= 8) {
    return "card";  // Form-style layout for small docs
  }
  if (totalCells <= 50) {
    return "compact";  // Simple editable table
  }
  if (totalCells <= 200) {
    return "sectioned";  // Collapsible sections with summary
  }
  return "paginated";  // Virtual scrolling for large docs
}
```

### 3.3 Layout Mode Implementations

| Mode | Component | Description | When Used |
|------|-----------|-------------|-----------|
| **card** | `CardFormLayout.tsx` | Label-value pairs in styled cards | <3 rows, <8 columns, or form-type docs |
| **compact** | `CompactTableLayout.tsx` | Simple editable table with inline confidence badges | <50 cells |
| **sectioned** | `SectionedTableLayout.tsx` | Collapsible sections (Header, Items, Totals, Tax) with summary rows | 50-200 cells |
| **paginated** | `PaginatedTableLayout.tsx` | Virtual scrolling, 50 rows per page, header statistics | >200 cells |
| **split** | `SplitPanelLayout.tsx` | Two-panel view: header fields on left, items table on right | Delivery notes, invoices |
| **key-value** | `KeyValueFormLayout.tsx` | Dynamic field listing with auto-detected key:value pairs | Handwritten forms, unknown docs |
| **message-list** | `MessageListLayout.tsx` | Chronological messages with sender, timestamp, content | Chat transcripts, screenshots |

### 3.4 Visual Design System

| Element | Desktop | Mobile |
|---------|---------|--------|
| **Field density** | 4-column grid | 2-column grid |
| **Confidence badges** | Color-coded (green ≥0.85, yellow 0.6-0.85, red <0.6) | Same, with tooltip on tap |
| **Issue panel** | Fixed right sidebar | Bottom sheet |
| **Image viewer** | Side-by-side with data | Swipeable carousel |
| **Export bar** | Sticky top bar | Collapsible action sheet |
| **Keyboard nav** | Alt+Up/Down, Tab, Enter | N/A (touch-first) |
| **Empty states** | Illustrated guidance with next action | Same, condensed |

### 3.5 Export Presentation

**Enhance `backend/services/ocr_export_generators.py` with type-specific exports:**

| Document Type | PDF Format | Excel Format |
|--------------|-----------|-------------|
| GST Invoice | Legal GST-compliant with tax breakdown, QR-ready | Multi-sheet: Invoice + Tax Summary + Line Items |
| Purchase Order | Formal PO with terms, signature block | PO form with dropdown validation for units |
| Delivery Challan | Two-column: Ordered vs Delivered | Comparison sheet with highlighting |
| Weighbridge Slip | Small receipt format (100×150mm) | Single row with validation |
| Production Report | Section-based with totals | Multiple sheets per section |
| Handwritten Form | Key-value table | Row-per-field with source column |
| Chat Transcript | Chronological with timestamps | Each message as row |
| Ledger Sheet | Financial format with running balance | Full Excel with formulas |
| Generic Table | Clean table with title | Simple spreadsheet |

**Excel enhancements (using openpyxl):**
- Frozen header rows
- Auto-filter on all columns
- Conditional formatting (red for low confidence cells)
- Data validation dropdowns (units, categories)
- Summary row with formulas
- Second sheet with metadata (processing info, confidence scores)
- Column auto-width
- Indian number format (`#,##,##0.00`)

**PDF enhancements (using reportlab):**
- Company logo header
- Document type watermark
- Footer with page numbers, timestamp, QR code for verification
- Color-coded confidence indicators
- Font fallback for multilingual support (Hindi, Marathi)

---

## Phase 4: Enhanced Validation Pipeline (Week 10–11)

**Goal:** Multi-stage validation that catches errors before they reach the user.

### 4.1 Validation Stages

```
1. STRUCTURAL VALIDATION (always runs)
   - Row/column consistency checks
   - Empty cell ratio < 50%
   - Header uniqueness check
   
2. SCHEMA VALIDATION (always runs)
   - Required fields present?
   - Type checking (numbers, strings, dates)
   - Pattern validation (GSTIN, vehicle number, HSN)
   
3. BUSINESS RULE VALIDATION (per document type)
   - GST invoice: qty × rate = taxable_value
   - Weighbridge: gross > tare, net = gross - tare
   - Delivery note: delivered ≤ ordered
   
4. CROSS-VALIDATION (when applicable)
   - AI output vs Tesseract baseline
   - Discrepancy detection for numeric fields
   
5. CONSISTENCY VALIDATION (always runs)
   - Date logic (delivery after PO date)
   - Totals match sum of line items
   - Tax percentage consistency
```

### 4.2 Validation Rule Format

Each validation rule returns `{field: string, message: string, severity: "error" | "warning" | "info"}`

```python
# Example: GST Invoice math validation
@g_validation_rule("invoice_line_item_math")
def validate_line_item_math(data: dict) -> list[ValidationIssue]:
    issues = []
    for idx, item in enumerate(data.get("line_items", [])):
        try:
            qty = float(item.get("qty", 0))
            rate = float(item.get("rate", 0))
            taxable = float(item.get("taxable_value", 0))
            expected = round(qty * rate, 2)
            if abs(expected - taxable) > 0.01:
                issues.append(ValidationIssue(
                    field=f"line_items.{idx}.taxable_value",
                    message=f"Qty × Rate = {expected}, but declared as {taxable}",
                    severity="error"
                ))
        except (ValueError, TypeError):
            issues.append(ValidationIssue(
                field=f"line_items.{idx}",
                message=f"Invalid numeric values in line {idx+1}",
                severity="error"
            ))
    return issues
```

### 4.3 Validation Results in API Response

```json
{
  "validation": {
    "passed": false,
    "summary": "3 errors, 2 warnings",
    "stages": {
      "structural": {"passed": true, "issues": []},
      "schema": {"passed": true, "issues": []},
      "business_rule": {
        "passed": false,
        "issues": [
          {
            "field": "invoice_header.supplier.gstin",
            "message": "GSTIN must be 15 characters (found 14)",
            "severity": "error",
            "suggested_value": "24AABCS1234K1Z5"
          },
          {
            "field": "line_items.0.taxable_value",
            "message": "Qty × Rate = 500000, but declared as 50000",
            "severity": "error",
            "suggested_value": "500000"
          }
        ]
      }
    },
    "blockers": true,
    "can_export_with_warnings": true
  }
}
```

---

## Phase 5: Handling Unstructured Documents (Week 12–13)

**Goal:** Claude-only approach for handwritten notes, ledger images, and screenshots.

### 5.1 Handwritten Forms

**Strategy:** Send to Sonnet with a structured prompt that extracts any key-value pairs it can find.

```python
HANDWRITTEN_FORM_PROMPT = """You are an expert handwriting reader for Indian factory documents.

Extract ALL visible information from this handwritten form or note.

INSTRUCTIONS:
1. Read all handwritten text carefully
2. Organize into key-value pairs based on context
3. For numbers, prefer numeric values where clear
4. If text is illegible, mark as [illegible] with position
5. Note the handwriting quality assessment
6. Include any printed/form fields visible

OUTPUT FORMAT:
{
  "fields": [
    {"label": "Field Name", "value": "extracted value", "confidence": 0.0-1.0}
  ],
  "notes": ["Any observations about the document"],
  "quality": {
    "readability": "good|fair|poor",
    "partial_extraction": bool,
    "challenging_areas": ["description of difficult areas"]
  }
}

IMPORTANT: Do NOT hallucinate values. If you cannot read something, mark it as unclear.
"""
```

### 5.2 Ledger Images

**Strategy:** Send to Sonnet with a table-extraction prompt optimized for financial data.

```python
LEDGER_SHEET_PROMPT = """You are a financial document extraction expert.

Extract this ledger/account statement into structured tabular data.

INSTRUCTIONS:
1. Identify the account header (name, account number, period)
2. Extract ALL rows in order (date, description, debit, credit, balance)
3. Balance column is critical — ensure running balance is mathematically correct
4. Note any strike-through or corrections
5. Handle merged cells or multi-line descriptions

OUTPUT FORMAT:
{
  "account_header": {
    "account_name": "name",
    "account_number": "number if visible",
    "period": "Month/Year range",
    "opening_balance": 0.00
  },
  "entries": [
    {
      "date": "DD-MM-YYYY",
      "description": "Transaction description",
      "debit": 0.00 or null,
      "credit": 0.00 or null,
      "balance": 0.00,
      "voucher_ref": "reference if visible"
    }
  ],
  "totals": {
    "total_debit": 0.00,
    "total_credit": 0.00,
    "closing_balance": 0.00
  },
  "quality": {
    "complete": bool,
    "entries_extracted": int,
    "estimated_total_entries": int
  }
}

VALIDATION:
- Verify: opening_balance + sum(debits) - sum(credits) = closing_balance
- Running balance after each entry must be correct
- Flag any mathematical inconsistencies
"""
```

### 5.3 Chat/Screenshot Transcripts

**Strategy:** Send to Sonnet with a conversation-extraction prompt.

```python
CHAT_TRANSCRIPT_PROMPT = """You are a chat transcript extraction expert.

Extract this screenshot of a conversation into structured message data.

INSTRUCTIONS:
1. Identify different speakers (names, colors, positions — left/right)
2. Extract each message in order
3. Preserve timestamps where visible
4. Note message content — text, images, documents
5. Handle read receipts, delivery status
6. Preserve emoji and formatting where meaningful

OUTPUT FORMAT:
{
  "platform": "WhatsApp | Telegram | SMS | Other",
  "participants": ["name1", "name2"],
  "messages": [
    {
      "sender": "name",
      "timestamp": "time if visible or relative",
      "message_type": "text|image|document|audio",
      "content": "message text or description of media",
      "status": "sent|delivered|read" if visible
    }
  ],
  "summary": {
    "total_messages": int,
    "date_range": ["start_date", "end_date"],
    "topics": ["detected conversation topics"]
  },
  "quality": {
    "clarity": "good|fair|poor",
    "complete_conversation": bool,
    "missing_messages_suspected": bool
  }
}
"""
```

### 5.4 Automatic Detection Pipeline

```python
def detect_document_nature(image_bytes: bytes, ocr_text: str) -> str:
    """
    Detect if the document is printed, handwritten, a screenshot, or ledger.
    Returns: "printed" | "handwritten" | "screenshot" | "ledger" | "unknown"
    """
    # Heuristic 1: Check for ledger patterns
    ledger_patterns = ["dr.", "cr.", "balance", "account", "particulars", "folio"]
    if any(p in ocr_text.lower() for p in ledger_patterns):
        if _has_tabular_structure(ocr_text):
            return "ledger"
    
    # Heuristic 2: Check for chat patterns
    chat_patterns = ["✓✓", "✓", "today", "yesterday", "typing", "online"]
    chat_score = sum(1 for p in chat_patterns if p in ocr_text) / len(chat_patterns)
    if chat_score > 0.3:
        return "screenshot"
    
    # Heuristic 3: Handwriting detection via connected components
    if _has_irregular_text_pattern(image_bytes):
        return "handwritten"
    
    # Heuristic 4: Check for printed text patterns
    if _has_regular_layout(ocr_text):
        return "printed"
    
    return "unknown"
```

---

## Phase 6: Export System Overhaul (Week 14–15)

**Goal:** Production-grade exports with perfect formatting, validation, and audit trails.

### 6.1 Excel Export Architecture

```python
# New file: backend/services/excel_export_engine.py

class ExcelExportEngine:
    """
    Production-grade Excel export engine.
    
    Features:
    - Type-specific sheet layouts
    - Frozen panes and auto-filters
    - Conditional formatting for confidence
    - Data validation dropdowns
    - Indian number format (#,##,##0.00)
    - Multiple sheets per document type
    - Summary sheet with processing metadata
    - Audit trail sheet
    """
    
    def export(self, data: dict, doc_type: str, format: str = "excel") -> bytes:
        if format == "excel":
            generator = self._get_excel_generator(doc_type)
        elif format == "pdf":
            generator = self._get_pdf_generator(doc_type)
        else:
            generator = self._get_generic_generator(format)
        
        result = generator(data)
        self._attach_audit_sheet(result, data)
        self._apply_conditional_formatting(result, data)
        return result._to_bytes()
```

### 6.2 Type-Specific Excel Generators

| Type | Generator | Sheets | Special Features |
|------|-----------|--------|-----------------|
| gst_invoice | `_generate_invoice_excel()` | Invoice, Tax Summary, Line Items, Audit | GST format, QR code placeholder, tax formulas |
| purchase_order | `_generate_po_excel()` | PO, Line Items, Terms, Audit | Unit dropdowns, approval status |
| delivery_note | `_generate_dn_excel()` | Delivery Note, Items, Vehicle, Audit | Ordered vs Delivered comparison |
| weighbridge_slip | `_generate_wb_excel()` | Slip, Audit | Single row, weight validation |
| ledger_sheet | `_generate_ledger_excel()` | Ledger, Summary, Audit | Running balance formula, financial format |
| handwritten_form | `_generate_kv_excel()` | Fields, Audit | Key-value pairs, confidence column |
| chat_transcript | `_generate_chat_excel()` | Messages, Summary, Audit | Chronological, sender column |
| generic_table | `_generate_generic_excel()` | Data, Audit | Auto-filter, frozen headers |

### 6.3 PDF Export Architecture

```
Each type-specific PDF generator follows this template:
1. Company header (from settings)
2. Document title + type badge
3. Metadata line (date, document ID, confidence)
4. Type-specific content
5. Footer: page X of Y, QR verification code, timestamp
6. Audit trail on last page
```

### 6.4 Export Validation Gate

```python
def validate_export_readiness(verification: VerificationRecord) -> ExportGateResult:
    """
    Check if a document is ready for export.
    
    Requirements:
    - Document must be "approved" status
    - All critical validation issues resolved
    - Reviewer notes present (for audit)
    - Confidence above block threshold
    
    Returns: ExportGateResult with pass/fail and details
    """
    checks = []
    
    # Status check
    checks.append(Check("status", verification.status == "approved"))
    
    # Validation check
    checks.append(Check("validation", not verification.has_blocking_issues()))
    
    # Notes check
    if verification.status == "approved":
        checks.append(Check("reviewer_notes", bool(verification.reviewer_notes)))
    
    # Confidence check
    doc_type = get_document_type(verification.doc_type_hint)
    if doc_type:
        checks.append(Check(
            "confidence",
            verification.avg_confidence >= doc_type.block_below_confidence
        ))
    
    return ExportGateResult(
        passed=all(c.passed for c in checks),
        checks=checks,
        blocking_issues=[c for c in checks if not c.passed]
    )
```

---

## Phase 7: Observability & Monitoring (Week 16)

**Goal:** Complete visibility into OCR performance, cost, and accuracy.

### 7.1 Key Metrics to Track

| Metric | Type | What It Measures | Alert Threshold |
|--------|------|-----------------|-----------------|
| `ocr_requests_total` | Counter | Total documents processed | — |
| `ocr_request_duration_seconds` | Histogram | Processing time per document | p95 > 30s |
| `ocr_cost_per_document` | Histogram | Cost per page | avg > $0.01 |
| `ocr_classification_accuracy` | Gauge | % correct document type identification | < 80% |
| `ocr_extraction_success_rate` | Gauge | % extractions passing validation | < 90% |
| `ocr_correction_pass_rate` | Gauge | % requiring correction pass | > 20% |
| `ocr_cache_hit_ratio` | Gauge | Cache effectiveness | < 10% |
| `ocr_export_count` | Counter | Documents exported | — |
| `ocr_model_tier_distribution` | Gauge | % Haiku / Sonnet / correction | — |
| `ocr_user_correction_rate` | Gauge | % fields corrected by users | > 15% suggests poor extraction |

### 7.2 Dashboard Layout

```
ROW 1: [Throughput (cards/min)] [Average Cost/Doc] [Success Rate] [Cache Hit Ratio]
ROW 2: [Processing Time p50/p95/p99 line chart]
ROW 3: [Cost Trend (daily/weekly)]
ROW 4: [Model Tier Distribution (stacked bar)]
ROW 5: [Error Rate by Document Type] [Correction Pass Rate]
ROW 6: [Recent Processing Logs (last 50)]
```

### 7.3 Cost Monitoring Dashboard

| View | Columns | Refreshes |
|------|---------|-----------|
| Daily cost by document type | Type, Count, Total Cost, Avg Cost, % Change | Every 5 min |
| Monthly forecast | Current Spend, Projected, Budget, % Used | Every hour |
| Model tier breakdown | Tier, Count, Cost, Avg Duration | Every 5 min |
| Anomaly detection | Spike alerts when cost deviates > 3σ from 7-day average | Realtime |

---

## Implementation Timeline

| Phase | Weeks | Effort (Engineer-Days) | Value Delivered |
|-------|-------|----------------------|-----------------|
| **P0:** Connect Existing Pieces | 1-2 | 6 days | 🔥🔥🔥 60% value unlock |
| **P1:** Document Type Expansion | 3-4 | 10 days | 🔥🔥🔥 15 new types |
| **P2:** Cost-Optimized Pipeline | 5-6 | 8 days | 🔥🔥 3x cost reduction |
| **P3:** Frontend Adaptive UI | 7-9 | 12 days | 🔥🔥 Beautiful UX |
| **P4:** Validation Pipeline | 10-11 | 8 days | 🔥 Data quality |
| **P5:** Unstructured Documents | 12-13 | 8 days | 🔥 Handwriting + chat |
| **P6:** Export System Overhaul | 14-15 | 8 days | 🔥 Perfect exports |
| **P7:** Observability | 16 | 4 days | ✅ Production readiness |
| **Total** | **16 weeks** | **64 days** | |

---

## Cost Analysis

### Current Cost
- All documents → Sonnet (~$3/M tokens)
- Average document: ~2,000 tokens → **$0.006/doc**
- Correction pass on failures: **+$0.003/doc**
- **Average: ~$0.007/doc**

### Optimized Cost (Phase 2)

| Tier | % of Documents | Model | Cost/Doc | Total |
|------|---------------|-------|---------|-------|
| Fast (Haiku) | 40% | claude-3-5-haiku | $0.0008 | $0.00032 |
| Balanced (Sonnet) | 45% | claude-3-5-sonnet | $0.003 | $0.00135 |
| Best (Sonnet + correction) | 15% | claude-3-5-sonnet ×2 | $0.006 | $0.00090 |
| **Weighted Average** | **100%** | — | **$0.00257** | **$0.00257/doc** |

**Savings: ~63% cost reduction ($0.007 → $0.0026/doc)**

### Monthly Projection

| Volume | Current Cost | Optimized Cost | Savings |
|--------|-------------|---------------|---------|
| 1,000 docs | $7 | $2.57 | $4.43 |
| 10,000 docs | $70 | $25.70 | $44.30 |
| 50,000 docs | $350 | $128.50 | $221.50 |
| 100,000 docs | $700 | $257 | **$443** |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Classification accuracy < 80% | Medium | High | Fallback to generic prompt. Build confusion matrix, add classifier training data iteratively. |
| Cost overruns from correction passes | Medium | Medium | Hard cap on correction attempts (max 2). Monitor cost/dashboard daily. |
| Claude hallucination on handwriting | High | Medium | Schema validation catches structural errors. All fields show confidence scores. |
| Frontend performance with 1000+ rows | Low | Medium | Virtual scrolling via react-window. Debounced cell editing. |
| Export format inconsistencies | Low | High | Unit tests for every export generator. Snapshot comparison testing. |
| Test failures in CI | Medium | Low | Fix pre-existing test failures. New tests pass before merge. |

---

## Definition of Done

- [ ] **Phase 0:** Classifier → Registry → Prompt → Claude → UI fully wired. `DocumentTypeAdapter` maps 3 types to correct views. Production bug fixed.
- [ ] **Phase 1:** 15 document types registered with prompts, schemas, validation rules, export generators, and UI components.
- [ ] **Phase 2:** Cost router selecting Haiku/Sonnet/Best by image quality. Correction pass on validation failure. Cost tracking visible in response metadata.
- [ ] **Phase 3:** All 7 layout modes implemented (card, compact, sectioned, paginated, split, key-value, message-list). AdaptiveLayoutEngine selecting correct mode. Mobile-responsive.
- [ ] **Phase 4:** Multi-stage validation pipeline (structural, schema, business-rule, cross-validation, consistency). Issues visible in UI with field-level guidance.
- [ ] **Phase 5:** 3 specialized prompts for handwritten forms, ledger sheets, and chat transcripts. Auto-detection pipeline routing to correct prompt.
- [ ] **Phase 6:** Type-specific Excel generators with formatting, validation, Indian number format, multi-sheet output. PDF with headers, footers, QR codes. Export validation gate blocking unapproved documents.
- [ ] **Phase 7:** Prometheus metrics for all key indicators. Grafana dashboard. Cost monitoring with daily/weekly/monthly views. Anomaly detection alerts.
- [ ] All existing tests pass. New tests added for all new functionality.
- [ ] All 5 pre-existing test failures fixed or documented with known root cause.
