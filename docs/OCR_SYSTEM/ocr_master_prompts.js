// ============================================================
// OCR MASTER PROMPTS — FactoryNerve DPR.ai
// Drop-in replacement for table_scan.py + ledger_scan.py
// Covers: all 12 steel factory document types
// ============================================================

// ─────────────────────────────────────────────────────────────
// STEP 1 — DOCUMENT CLASSIFIER PROMPT
// Use this FIRST, before calling any extraction prompt.
// Call with: Claude Haiku (fast + cheap)
// Returns: doc_type string used to route to the right extractor
// ─────────────────────────────────────────────────────────────

const CLASSIFIER_PROMPT = `
You are a document classifier for Indian steel factory records.
Look at this image and identify which document type it is.

Return ONLY a JSON object — no explanation, no markdown, no preamble.

Respond with exactly this structure:
{
  "doc_type": "<one of the values below>",
  "confidence": <0.0 to 1.0>,
  "language": "<eng | hin | mar | eng+hin | eng+mar | eng+hin+mar>",
  "structure": "<tabular | form | form+table | multi-section | wide-tabular>",
  "sections_count": <integer — number of logical sections on this page>,
  "has_printed_template": <true | false>,
  "has_handwriting": <true | false>,
  "notes": "<any unusual features to tell the extractor about, max 20 words>"
}

Allowed doc_type values:
- "ledger"          → Trial balance, final account, Dr/Cr ledger
- "stock_register"  → Material inward/outward, inventory movement
- "gate_challan"    → Gate entry, weighbridge slip, vehicle challan
- "invoice"         → Purchase invoice, supplier bill with GST
- "dispatch_challan"→ Sales challan, delivery note, customer dispatch
- "production_log"  → Shift production report, heat-wise output
- "salary_register" → Wages sheet, salary register, PF/ESI register
- "maintenance_log" → Job card, breakdown report, PM schedule
- "energy_log"      → Power/utility meter reading register
- "quality_cert"    → Test certificate, chemical analysis, MTC
- "purchase_order"  → PO to supplier
- "scrap_register"  → Scrap/rejection note, home scrap log
- "unknown"         → Cannot identify confidently

Indian number formats are common: 1,00,000 = 1 lakh. Devanagari script labels are normal.
`;


// ─────────────────────────────────────────────────────────────
// STEP 2 — EXTRACTION PROMPTS (one per document type)
// Each prompt is a function that takes template context and
// returns the full system+user prompt to send to Claude.
// All prompts return the SAME JSON schema (see OUTPUT_SCHEMA).
// ─────────────────────────────────────────────────────────────

// ── UNIVERSAL OUTPUT SCHEMA ──────────────────────────────────
// Every extraction prompt must return this exact structure.
// Your existing normalize_structured_payload() reads this as-is.
const OUTPUT_SCHEMA = `
Return ONLY a JSON object. No markdown, no preamble, no explanation.
Use this exact schema:

{
  "doc_type": "<same as input doc_type>",
  "title": "<document title as written, or inferred>",
  "date": "<DD/MM/YYYY or null>",
  "headers": ["col1", "col2", ...],
  "rows": [
    {
      "cells": [
        {
          "value": "<extracted text exactly as written>",
          "normalized": "<cleaned version: number without commas, date as YYYY-MM-DD, or null>",
          "confidence": <0.0 to 1.0>,
          "review_required": <true | false>,
          "flags": []
        }
      ]
    }
  ],
  "summary_rows": [
    {
      "label": "TOTAL",
      "cells": [{ "value": "47,22,000", "normalized": 4722000, "confidence": 0.95 }]
    }
  ],
  "metadata": {
    "factory_name": "<if visible>",
    "doc_number": "<invoice/PO/challan number if present>",
    "party_name": "<supplier/customer name if present>",
    "gstin": "<15-char GSTIN if present, else null>",
    "period": "<month/year or date range if present>",
    "extra_fields": {}
  },
  "warnings": [],
  "balance_check": null
}

CRITICAL NUMBER RULES — Indian steel factory format:
- Indian number system: 1,00,000 = 1 lakh = 100000. 10,00,000 = 10 lakh = 1000000.
  DO NOT treat Indian commas as thousands separators. Parse correctly.
- Always set "value" to exactly what is written: "47,22,000"
- Always set "normalized" to the integer: 4722000
- Currency prefix ₹, Rs., Re., रु. — strip from normalized value, keep in value
- Units MT, KG, NOS, PCS — keep in value, strip from normalized
- Confidence rules for numbers:
  * confidence < 0.7 if: digit looks ambiguous (1 vs 7, 4 vs 9, 0 vs 6, 2 vs 9, 5 vs 6, 8 vs 0)
  * confidence < 0.6 if: number is isolated with no surrounding context
  * set review_required: true if confidence < 0.75

CRITICAL HEADER NORMALISATION:
Map these common handwritten variations to standard names:
  "Particular" / "Particuler" / "Paticulars" → "Particulars"
  "Dx" / "Dr" / "DR" → "Dr. (₹)"
  "Cx" / "Cr" / "CR" → "Cr. (₹)"
  "Qty" / "Qnty" / "Quant" → "Quantity"
  "Amt" / "Amnt" / "Amount" → "Amount (₹)"
  "Dt" / "Dt." → "Date"
  "Mat" / "Matl" / "Material" → "Material"
  "Desc" / "Descp" → "Description"
  "S.No" / "Sr" / "Sl.No" → "Sr. No."
  "Wt" / "Wgt" / "Weight" → "Weight"
  "Bal" / "Blnc" → "Balance"
`;

// ── COMMON INDIAN STEEL DOMAIN KNOWLEDGE ─────────────────────
// Injected into every prompt via ${DOMAIN_CONTEXT}
const DOMAIN_CONTEXT = `
You are reading documents from an Indian steel manufacturing factory.
Common domain knowledge:
- Steel products: TMT bars (8mm–32mm), billets, angles, channels, plates, coils, wire rod
- Raw materials: scrap, pig iron, sponge iron (DRI), ferroalloys, limestone, dolomite
- Units: MT (metric ton), KG, NOS (numbers), PCS (pieces), MM (millimetre), M (metre)
- Furnaces: IF (induction furnace), EAF (electric arc furnace), CCM (continuous casting machine)
- Heat numbers: H-YYYY-NNNN or similar factory-specific format
- IS standards: IS2062, IS1786, IS432, IS1977 (for steel grades)
- Chemical elements in quality certs: C (carbon), Mn (manganese), Si (silicon), S (sulphur), P (phosphorus)
- GST context: steel attracts 18% GST; scrap may be 18%; some items 5% or 12%
- GSTIN format: 2-digit state code + 10-char PAN + 1 digit + Z + 1 check digit = 15 chars total
- Indian factory shifts: A shift (6am–2pm), B shift (2pm–10pm), C shift (10pm–6am)
- Downtime codes: EB (electricity board cut), PM (planned maintenance), BD (breakdown), NC (no charge)
`;


// ─────────────────────────────────────────────────────────────
// PROMPT 1 — LEDGER (Trial Balance / Final Account)
// doc_type: "ledger"
// ─────────────────────────────────────────────────────────────
const PROMPT_LEDGER = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a LEDGER or TRIAL BALANCE document from an Indian steel factory.
This is a Dr/Cr format document. Rules:

STRUCTURE RULES:
1. This document has exactly 3 columns: Particulars, Dr. (₹), Cr. (₹)
2. Every row has an entry in EITHER Dr OR Cr — never both. If both are filled, flag it.
3. The last row is always a TOTAL row — put it in "summary_rows", not "rows"
4. Rows above the TOTAL are data rows
5. If you see a heading row in the middle (e.g. "Opening Stock", underlined), treat it as a section label in metadata, not a data row

BALANCE CHECK:
After extracting, check if Dr total = Cr total.
Set "balance_check" in output:
{
  "dr_total": <integer>,
  "cr_total": <integer>,
  "balanced": <true | false>,
  "difference": <integer, 0 if balanced>
}

COMMON LEDGER ENTRIES in steel factories (helps you read ambiguous handwriting):
Dr side (expenses/assets): Cash, Bank, Debtors, Stock, Furniture, Equipment, Buildings,
  Motor Car, Purchases, Sales Returns, Salaries, Rent, Interest, Rates & Taxes,
  Discount allowed, Freight, Carriages, Drawings, Printing, Electricity, Insurance,
  General expenses, Bad Debts, Bank charges, Motor Car expenses
Cr side (liabilities/income): Creditors, Loans, Provisions, Purchase Returns, Sales,
  Discount received, Capital A/c

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 2 — STOCK / MATERIAL REGISTER
// doc_type: "stock_register"
// ─────────────────────────────────────────────────────────────
const PROMPT_STOCK_REGISTER = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a STOCK or MATERIAL REGISTER from an Indian steel factory.
This tracks inward and outward movement of materials.

STRUCTURE RULES:
1. Standard columns (map any variations): Date | Item/Material | Heat No | Qty In | Qty Out | Balance | Unit | Challan/Ref No | Remarks
2. "Qty In" = material received, "Qty Out" = material issued/dispatched
3. "Balance" = running balance = previous balance + Qty In - Qty Out
   Validate: if balance column exists, check each row: balance[n] = balance[n-1] + in[n] - out[n]
   If validation fails: set review_required: true on that balance cell
4. Unit column: normalize values → "MT" for metric tons, "KG" for kilograms, "NOS" for numbers, "PCS" for pieces
5. Item/material names — common steel items:
   TMT/Bars (8mm, 10mm, 12mm, 16mm, 20mm, 25mm, 32mm), Billets, Scrap, Pig Iron,
   DRI/Sponge Iron, Ferro Alloys, Limestone, Bentonite, Coal, Electrodes
6. Heat numbers: extract exactly as written (e.g. "H-2024-1234", "24-1234", "IF-1234")
7. If a row has both Qty In AND Qty Out filled: flag with review_required: true

METADATA to extract:
- Period (month/year) from header
- Material type (if register is for one specific material)
- Opening balance (first balance row or header note)

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 3 — GATE ENTRY / WEIGHBRIDGE CHALLAN
// doc_type: "gate_challan"
// ─────────────────────────────────────────────────────────────
const PROMPT_GATE_CHALLAN = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a GATE ENTRY CHALLAN or WEIGHBRIDGE SLIP from an Indian steel factory.
These record vehicle entry/exit and material weight.

STRUCTURE RULES:
This document has TWO parts — extract both:

PART A — Header fields (form-style, key-value pairs):
Extract as metadata.extra_fields:
  Gate Challan No, Date, Time, Vehicle Number, Driver Name,
  Supplier/Customer Name, Material, Purpose (Inward/Outward),
  Gross Weight (MT/KG), Tare Weight (MT/KG), Net Weight (MT/KG),
  Challan/Invoice reference, Remark/Note

PART B — Line items table (if present):
Standard columns: Sr No | Material | HSN | Quantity | Unit | Rate | Amount

CRITICAL VALIDATION:
- Vehicle number format (India): 2-letter state code + 2 digits + 2 letters + 4 digits
  Examples: MH12AB1234, GJ05CD5678. Flag if format doesn't match.
- Net Weight = Gross Weight - Tare Weight. Validate this.
  If Net ≠ Gross - Tare: set review_required: true on Net Weight cell
- Weighbridge documents often have TWO WEIGHMENTS: first = gross (loaded truck),
  second = tare (empty truck). Extract both timestamps if present.
- Thermal prints fade — if text is partially illegible, set confidence < 0.5 on that cell

Set "doc_number" in metadata = Gate Challan Number.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 4 — PURCHASE INVOICE (GST Invoice)
// doc_type: "invoice"
// ─────────────────────────────────────────────────────────────
const PROMPT_INVOICE = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a PURCHASE INVOICE / GST BILL from an Indian steel factory supplier.

STRUCTURE RULES:
PART A — Invoice header (extract as metadata.extra_fields):
  Invoice Number, Invoice Date, Supplier Name, Supplier Address,
  Supplier GSTIN (15 chars), Buyer Name, Buyer GSTIN, Place of Supply,
  PO Reference Number

PART B — Line items table:
Standard columns: Sr No | Description | HSN Code | Quantity | Unit | Rate (₹) | Taxable Amount (₹)

PART C — GST summary (extract as summary_rows):
  Taxable Amount, CGST %, CGST Amount, SGST %, SGST Amount (OR IGST %, IGST Amount), Total

CRITICAL VALIDATIONS:
- GSTIN format: exactly 15 characters. First 2 = state code (01-38), next 10 = PAN, then digit, Z, check digit.
  Flag with review_required: true if format doesn't match.
  Common state codes: MH=27, GJ=24, RJ=08, UP=09, HR=06, MP=23, CG=22, OR=21
- GST rates for steel: 18% most common. Scrap = 18%. Some consumables = 5% or 12%.
  Flag if GST % is unusual (not 5, 12, 18, or 28).
- Math check: Taxable × GST% = GST Amount. If difference > 1 rupee: set review_required: true
- HSN codes for steel: 7213 (wire rod), 7214 (bars/rods), 7216 (angles/sections),
  7217 (wire), 7208-7212 (flat products). Flag if HSN doesn't match steel range.
- IGST is used for inter-state supply; CGST+SGST for intra-state. Both can't appear on same invoice.

Set "gstin" in metadata = supplier GSTIN.
Set "doc_number" in metadata = Invoice Number.
Set "party_name" in metadata = Supplier Name.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 5 — DISPATCH / SALES CHALLAN
// doc_type: "dispatch_challan"
// ─────────────────────────────────────────────────────────────
const PROMPT_DISPATCH_CHALLAN = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a DISPATCH CHALLAN or DELIVERY NOTE from an Indian steel factory.
This records finished goods dispatched to a customer.

STRUCTURE RULES:
PART A — Challan header (extract as metadata.extra_fields):
  Challan Number, Date, Customer Name, Customer Address, Vehicle Number,
  Destination, PO Reference, Delivery Terms

PART B — Item table:
Standard columns: Sr No | Material/Description | Size/Spec | Grade | Bundles/Coils | Quantity | Unit | Rate (₹) | Amount (₹)

PART C — Footer (as summary_rows):
  Total Quantity, Total Amount, E-way Bill Number (if present)

STEEL-SPECIFIC RULES:
- Size column for TMT bars: extract as "12mm x 6m" or just "12mm" — keep together
- Grade: IS2062 Gr.A, IS2062 Gr.B, IS1786 Fe415, IS1786 Fe500, IS1786 Fe500D, IS1786 Fe550
- Quantity: may be in MT, KG, or NOS (number of bundles). Preserve unit.
- Bundle weight: 1 bundle of 12mm TMT ≈ 1.2 MT. Use as sanity check.
- "Duplicate" / "Triplicate" watermarks across the document are normal — ignore them.
- E-way Bill: 12-digit number. Extract if visible.

Math check: sum of all row amounts = Total Amount in footer. Flag if mismatch > ₹10.

Set "doc_number" in metadata = Challan Number.
Set "party_name" in metadata = Customer Name.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 6 — PRODUCTION / SHIFT REPORT
// doc_type: "production_log"
// ─────────────────────────────────────────────────────────────
const PROMPT_PRODUCTION_LOG = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a PRODUCTION SHIFT REPORT or HEAT REGISTER from an Indian steel factory.
This document may have MULTIPLE SECTIONS — one section per shift (A/B/C) or per furnace.

MULTI-SECTION RULES:
1. Identify how many shifts/sections are on this page (usually 1–3).
2. Set sections_count in metadata.extra_fields = number of sections found.
3. Extract each section as a GROUP of consecutive rows with the section label in metadata.
4. Add a "section" column to headers if multiple sections exist.

PART A — Page header (as metadata.extra_fields):
  Date, Factory Name, Furnace Name/ID (e.g. "IF-1", "CCM-2"), Shift (A/B/C), Supervisor Name

PART B — Heat-wise production table:
Standard columns: Shift | Heat No | Charge (MT) | Start Time | End Time | Tap Time | Output (MT) | Grade | Remarks

PART C — Summary (as summary_rows):
  Total Heats, Total Output (MT), Total Downtime (hours), Total Running Time (hours)

DOWNTIME section (if present, extract separately as metadata.extra_fields.downtime_log):
  Start Time, End Time, Duration, Code, Reason
  Common codes: EB (power cut), PM (planned maintenance), BD (breakdown), NC (no charge material)

STEEL PROCESS RULES:
- Heat number format varies by factory (e.g. "H-2024-1234", "24-1234", "IF-1-001") — extract as-is
- Output in MT usually 5–30 MT per heat for induction furnaces
- Start time to end time = heat duration. Typical: 45–90 minutes for IF, 90–180 min for EAF
- Grade should match IS standard codes above
- Remarks: free text — extract exactly, preserve abbreviations

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 7 — SALARY / WAGES REGISTER
// doc_type: "salary_register"
// ─────────────────────────────────────────────────────────────
const PROMPT_SALARY_REGISTER = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a SALARY or WAGES REGISTER from an Indian steel factory.
These registers are VERY WIDE (12–18 columns) and may span multiple pages.

WIDE TABLE RULES:
1. This may be page 1 of a multi-page register. Extract all visible columns.
2. If columns continue past the right edge of the page, note it in warnings.
3. If this is a continuation page (no employee names, just numbers):
   note it in metadata.extra_fields.is_continuation_page = true

STANDARD COLUMNS (in order, some may be absent):
Sr No | Employee Code | Employee Name | Designation | Days Present | Basic (₹) |
DA (₹) | HRA (₹) | Other Allowances (₹) | OT Hours | OT Amount (₹) | Gross (₹) |
PF (₹) | ESI (₹) | PT (Professional Tax) (₹) | TDS (₹) | Advance (₹) |
Other Deductions (₹) | Total Deductions (₹) | Net Pay (₹) | Bank A/c No | Signature

EMPLOYEE NAME RULES:
- Names may be in Hindi/Marathi (Devanagari script) or English or mixed
- Extract Devanagari names as-is — do not attempt to transliterate
- If name is unclear, set confidence < 0.6 and review_required: true

MATH VALIDATION:
- Gross = Basic + DA + HRA + Allowances + OT Amount
- Net = Gross - PF - ESI - PT - TDS - Advance - Other Deductions
- Set review_required: true on Net Pay if it doesn't match this formula

STATUTORY DEDUCTIONS (for context):
- PF (Provident Fund): 12% of Basic+DA, employee share
- ESI (Employee State Insurance): 0.75% of Gross (employee share; employer pays more)
- PT (Professional Tax): state-specific, typically ₹200/month in Maharashtra

METADATA:
  Period (month/year), Factory Name, Total Employees, Total Gross, Total Net

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 8 — MAINTENANCE LOG / JOB CARD
// doc_type: "maintenance_log"
// ─────────────────────────────────────────────────────────────
const PROMPT_MAINTENANCE_LOG = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a MAINTENANCE JOB CARD or BREAKDOWN REPORT from an Indian steel factory.
This is a semi-structured document with form fields and a parts table.

PART A — Job Card header (as metadata.extra_fields):
  Job Card No, Date, Equipment Name, Equipment Code (e.g. "IF-01", "CCM-2", "OH-CRANE-1"),
  Reported By, Reported Time, Fault Description (free text),
  Work Completed By (technician name/code),
  Maintenance Type: PM (Planned) | BD (Breakdown) | CM (Corrective) | PD (Predictive)
  Start Time, End Time, Total Downtime (hours:minutes)

PART B — Spare parts consumed table:
Standard columns: Sr No | Part Name | Part Code | Quantity | Unit | Rate (₹) | Amount (₹)

PART C — Action taken (as metadata.extra_fields.action_taken):
  Free text — extract exactly as written, preserve technical abbreviations

SPECIAL RULES:
- Equipment codes are factory-specific — extract exactly as written
- Fault descriptions and action taken are free text — extract verbatim, even if unclear
- Checkboxes (if printed template): extract as "Yes"/"No" or "✓"/"✗"
- Technician signatures/initials: ignore, do not extract
- Part codes like bearing numbers (e.g. "6205-2RS", "NU-2310"), gear specs — extract exactly

Math check: sum of part amounts = Total parts cost. Flag if mismatch.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 9 — ENERGY / UTILITY LOG
// doc_type: "energy_log"
// ─────────────────────────────────────────────────────────────
const PROMPT_ENERGY_LOG = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting an ENERGY or UTILITY METER READING REGISTER from an Indian factory.
This records daily/shift electricity, water, gas meter readings.

STRUCTURE RULES:
Standard columns: Date | Shift | Meter ID/Name | Opening Reading | Closing Reading | Units Consumed | Rate (₹/unit) | Amount (₹)

MULTIPLE METERS:
A page may have readings for multiple meters (different rows or sections).
Common meter types in steel factories:
  Power (kWH — kilowatt hours, kVAH — kilovolt-ampere hours)
  Reactive (kVARH — reactive energy)
  Max Demand (kVA)
  Water (m³ or KL)
  Compressed Air (m³)
  LPG/Oxygen/Acetylene (m³ or cylinders)

CRITICAL VALIDATION:
- Units Consumed = Closing Reading - Opening Reading
  If negative: meter may have rolled over. Set review_required: true and note in warnings.
  If zero: may be a shutdown day — acceptable. Flag in warnings only if unexpected.
- Closing of one shift = Opening of next shift. Validate continuity across rows.

UNITS: Preserve original unit notation exactly: "kWH", "kVAH", "m³", "KL"
METER IDs: extract exactly as written (may be numeric codes or names like "Main Incomer", "IF-1 Panel")

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 10 — QUALITY TEST CERTIFICATE (MTC)
// doc_type: "quality_cert"
// ─────────────────────────────────────────────────────────────
const PROMPT_QUALITY_CERT = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a QUALITY TEST CERTIFICATE or MATERIAL TEST CERTIFICATE (MTC)
from an Indian steel factory. This contains chemical composition and mechanical test results.

PART A — Certificate header (as metadata.extra_fields):
  Certificate No, Date, Heat Number, Grade (IS standard), Size/Spec,
  Quantity (MT), Customer Name, Customer PO No, Lab Name, Lab Accreditation

PART B — Chemical composition table:
Standard columns: Element | Specified % | Actual % | Result (OK/FAIL)
Common elements: C (Carbon) | Mn (Manganese) | Si (Silicon) | S (Sulphur) | P (Phosphorus) |
  Cr (Chromium) | Ni (Nickel) | Cu (Copper) | Mo (Molybdenum) | V (Vanadium)

PART C — Mechanical properties table:
Standard columns: Test | Specified | Actual | Unit | Result
Common tests: Tensile Strength | Yield Strength | Elongation % | Bend Test | Re-bend Test |
  UTS/YS Ratio | Total Elongation at Fracture

CRITICAL PRECISION RULES:
- Chemical percentages are SMALL DECIMALS — read carefully:
  0.012% is NOT the same as 0.12% or 1.2% — these are completely different values
  Set confidence < 0.6 if the decimal point position is unclear
- Carbon % for Fe415: max 0.30%. For Fe500: max 0.30%. For Fe500D: max 0.25%.
  Flag with review_required: true if value seems outside expected range.
- Mechanical values: Tensile 500–700 MPa, Yield 415–550 MPa — flag obvious outliers.
- IS standard codes: extract exactly — IS1786, IS2062, IS432. Do not correct or abbreviate.
- Result column: accept "OK", "PASS", "SATISFACTORY", "CONFORM", "∞" — all mean pass.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 11 — PURCHASE ORDER
// doc_type: "purchase_order"
// ─────────────────────────────────────────────────────────────
const PROMPT_PURCHASE_ORDER = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a PURCHASE ORDER from an Indian steel factory.

PART A — PO header (as metadata.extra_fields):
  PO Number, PO Date, Supplier Name, Supplier Code, Supplier Address,
  Supplier GSTIN, Delivery Address, Delivery Date, Payment Terms,
  Special Instructions

PART B — Line items table:
Standard columns: Sr No | Item Description | Specification | HSN | Qty | Unit | Rate (₹) | Amount (₹)

PART C — Footer:
  Sub-total, GST %, GST Amount, Grand Total
  Terms & Conditions (if brief — extract; if long boilerplate — skip)

MULTI-LINE DESCRIPTIONS:
Item descriptions often wrap across multiple lines (e.g. "TMT Bars\nIS1786 Fe500\n12mm dia").
Merge these into a single cell value using " | " as separator.

Amendment POs:
If this is an amendment, it may reference "Amendment No" and "Against PO No" — extract both.

${OUTPUT_SCHEMA}
`;

// ─────────────────────────────────────────────────────────────
// PROMPT 12 — SCRAP / REJECTION REGISTER
// doc_type: "scrap_register"
// ─────────────────────────────────────────────────────────────
const PROMPT_SCRAP_REGISTER = ({ template_columns, factory_name }) => `
${DOMAIN_CONTEXT}

You are extracting a SCRAP REGISTER or REJECTION NOTE from an Indian steel factory.

STRUCTURE:
Standard columns: Date | Heat No | Furnace/Unit | Scrap Category | Quantity (MT) | Reason | Disposition | Remarks

SCRAP CATEGORIES in steel factories:
  Home Scrap / Internal Scrap: Crop end, Top cut, Bottom cut, Skull, Skull top, Splashing, Test pieces
  Process Scrap: Reject billets, Off-spec material, Scale
  Disposition: Remelting (goes back to furnace), Sale, Write-off

SPECIAL RULES:
- Quantity in MT often has 3 decimal places: "0.450 MT" — preserve precision
- Heat number links this record to the production log — extract exactly
- Scrap categories may use factory-specific codes — extract as-is, do not normalise
- Reason codes: common but factory-specific — extract verbatim

Math check: sum of all scrap quantities per heat ≈ (charge weight - output weight) × expected yield.
Do NOT perform this check — just extract. Flag if quantity seems unusually large (> 20% of typical heat).

${OUTPUT_SCHEMA}
`;


// ─────────────────────────────────────────────────────────────
// PROMPT ROUTER — maps doc_type → correct prompt function
// Used in table_scan.py to select the right prompt
// ─────────────────────────────────────────────────────────────
const PROMPT_ROUTER = {
  "ledger":            PROMPT_LEDGER,
  "stock_register":    PROMPT_STOCK_REGISTER,
  "gate_challan":      PROMPT_GATE_CHALLAN,
  "invoice":           PROMPT_INVOICE,
  "dispatch_challan":  PROMPT_DISPATCH_CHALLAN,
  "production_log":    PROMPT_PRODUCTION_LOG,
  "salary_register":   PROMPT_SALARY_REGISTER,
  "maintenance_log":   PROMPT_MAINTENANCE_LOG,
  "energy_log":        PROMPT_ENERGY_LOG,
  "quality_cert":      PROMPT_QUALITY_CERT,
  "purchase_order":    PROMPT_PURCHASE_ORDER,
  "scrap_register":    PROMPT_SCRAP_REGISTER,
  "unknown":           PROMPT_LEDGER,   // fallback — ledger is most common
};

// Usage:
// const prompt = PROMPT_ROUTER[doc_type]({ template_columns, factory_name });
// Pass prompt as the user message to Claude Sonnet/Opus with the image attached.


// ─────────────────────────────────────────────────────────────
// STEP 3 — POST-PROCESSING: INDIAN NUMBER NORMALISATION
// Drop this into ocr_normalization.py
// REPLACES the current broken number parsing
// ─────────────────────────────────────────────────────────────
const NUMBER_NORMALISER_PYTHON = `
# indian_number_normalizer.py
# Drop into backend/services/ and call from ocr_normalization.py

import re
from typing import Optional, Union

def parse_indian_number(value: str) -> Optional[int]:
    """
    Parse Indian number format to integer.
    
    Indian grouping: 47,22,000 = 47 lakh 22 thousand = 4,722,000
    This is NOT the same as Western 4,722,000.
    
    Examples:
        "47,22,000"  → 4722000   (47 lakh 22 thousand)
        "1,00,000"   → 100000    (1 lakh)
        "10,00,000"  → 1000000   (10 lakh)
        "1,00,00,000"→ 10000000  (1 crore)
        "14,000"     → 14000     (14 thousand — same in both systems)
        "₹47,22,000" → 4722000   (strip ₹ prefix)
        "47,22,000 MT"→ 4722000  (strip unit suffix)
        "4722000"    → 4722000   (plain integer, no commas)
    """
    if not value:
        return None
    
    # Strip currency symbols and common prefixes
    cleaned = re.sub(r'^[₹Rs\\.\\s]+', '', str(value).strip())
    
    # Strip unit suffixes (MT, KG, NOS, PCS, etc.)
    cleaned = re.sub(r'\\s*(MT|KG|NOS|PCS|MM|M|L|KL|m³|kWH|kVAH)\\s*$', '', cleaned, flags=re.IGNORECASE)
    
    # Strip remaining whitespace
    cleaned = cleaned.strip()
    
    # Remove all commas — Indian or Western, doesn't matter for integer parsing
    # The commas are just visual grouping. After removing them we get the raw digits.
    no_commas = cleaned.replace(',', '')
    
    # Handle decimal point (for values like "0.450" MT)
    if '.' in no_commas:
        try:
            return float(no_commas)  # keep as float if decimal present
        except ValueError:
            return None
    
    # Pure integer
    try:
        return int(no_commas)
    except ValueError:
        return None


def format_indian_number(value: int) -> str:
    """
    Format integer to Indian number system string.
    
    Examples:
        4722000  → "47,22,000"
        100000   → "1,00,000"
        1000000  → "10,00,000"
        14000    → "14,000"
        999      → "999"
    """
    if value < 1000:
        return str(value)
    
    # Split into groups: last 3 digits, then groups of 2
    s = str(abs(value))
    result = s[-3:]  # Last 3 digits
    s = s[:-3]
    
    while s:
        result = s[-2:] + ',' + result
        s = s[:-2]
    
    return ('-' if value < 0 else '') + result


def is_indian_number(value: str) -> bool:
    """
    Detect if a string is likely an Indian-formatted number.
    Pattern: optional ₹, then digits with Indian comma grouping.
    """
    cleaned = re.sub(r'^[₹Rs\\.\\s]+', '', str(value).strip())
    # Indian pattern: X,XX,XXX or X,XX,XXX.XX
    return bool(re.match(r'^\\d{1,2}(,\\d{2})*,\\d{3}(\\.\\d+)?$', cleaned))


def normalise_cell_number(cell_value: str) -> dict:
    """
    Main entry point. Given a cell value string, returns:
    {
        "value": original string (preserved),
        "normalized": integer or float or None,
        "is_numeric": True/False,
        "format": "indian" | "western" | "decimal" | "text"
    }
    """
    if not cell_value or not str(cell_value).strip():
        return {"value": cell_value, "normalized": None, "is_numeric": False, "format": "text"}
    
    s = str(cell_value).strip()
    
    # Try Indian format first
    parsed = parse_indian_number(s)
    if parsed is not None:
        fmt = "indian" if is_indian_number(re.sub(r'^[₹Rs\\.\\s]+', '', s).split()[0]) else "western"
        if isinstance(parsed, float):
            fmt = "decimal"
        return {"value": s, "normalized": parsed, "is_numeric": True, "format": fmt}
    
    return {"value": s, "normalized": None, "is_numeric": False, "format": "text"}
`;


// ─────────────────────────────────────────────────────────────
// STEP 4 — EXCEL OUTPUT RULES
// These are the rules your build_excel_bytes() must follow
// for each doc_type. One section per document type.
// ─────────────────────────────────────────────────────────────
const EXCEL_OUTPUT_RULES = {

  ledger: {
    sheet_name: "Ledger",
    columns: ["Particulars", "Dr. (₹)", "Cr. (₹)"],
    col_widths: [40, 20, 20],
    col_formats: ["text", "indian_number", "indian_number"],
    header_style: { fill: "#1F3864", font_color: "#FFFFFF", bold: true, align: "center" },
    dr_col_font: "#00008B",   // dark blue for Dr amounts
    cr_col_font: "#8B0000",   // dark red for Cr amounts
    alternating_rows: "#F2F2F2",
    low_confidence_fill: "#FFFF00",
    total_row_style: { fill: "#D9E1F2", bold: true },
    balance_row: {
      balanced: { fill: "#00B050", text_color: "#FFFFFF", text: "✓ Balanced" },
      unbalanced: { fill: "#C00000", text_color: "#FFFFFF", text: "✗ Difference: ₹{diff}" }
    },
    draft_warning_row: {
      text: "⚠ DRAFT — Not approved. Do not use for official records.",
      fill: "#FFF2CC", font_color: "#7F6000", bold: true, insert_after_header: true
    },
    summary_sheet: {
      name: "Summary",
      fields: ["Extraction timestamp", "Total rows", "Dr total", "Cr total",
               "Balance status", "Low confidence rows", "Trusted export"]
    },
    metadata_sheet: {
      name: "OCR Metadata",
      always_create: true   // DO NOT gate behind CELL_FORMAT_V2 — always create
    }
  },

  stock_register: {
    sheet_name: "Stock Register",
    col_widths: [8, 25, 15, 12, 12, 12, 8, 15, 20],
    col_formats: ["text", "text", "text", "indian_number", "indian_number", "indian_number", "text", "text", "text"],
    header_style: { fill: "#1F3864", font_color: "#FFFFFF", bold: true },
    running_balance_col: "Balance",
    running_balance_formula: true,   // Use Excel formula =prev_balance + qty_in - qty_out
    low_confidence_fill: "#FFFF00",
    review_required_fill: "#F4CCCC",
    draft_warning_row: { text: "⚠ DRAFT", fill: "#FFF2CC" }
  },

  gate_challan: {
    sheet_name: "Gate Challan",
    layout: "form_then_table",   // Header block first, then line items
    header_block_style: { label_fill: "#EDF2F7", label_bold: true, value_fill: "#FFFFFF" },
    table_start_row_offset: 12,  // Start line items table 12 rows after header block
    col_widths: [8, 30, 15, 12, 8, 12, 14],
    col_formats: ["text", "text", "text", "indian_number", "text", "indian_number", "indian_number"],
    net_weight_formula: true,    // Excel formula: Net = Gross - Tare
    validation_highlight: { net_mismatch: "#F4CCCC", invalid_vehicle_no: "#FFF2CC" }
  },

  invoice: {
    sheet_name: "Invoice",
    layout: "form_then_table",
    header_block_style: { label_fill: "#EDF2F7", label_bold: true },
    table_col_widths: [6, 35, 10, 10, 6, 12, 15, 8, 14, 8, 14, 15],
    gst_summary_style: { fill: "#E2F0D9", bold: true },
    gstin_validation_highlight: "#FFF2CC",   // highlight invalid GSTIN in yellow
    grand_total_style: { fill: "#1F3864", font_color: "#FFFFFF", bold: true },
    draft_warning_row: { text: "⚠ DRAFT", fill: "#FFF2CC" }
  },

  dispatch_challan: {
    sheet_name: "Dispatch Challan",
    layout: "form_then_table",
    col_widths: [6, 30, 15, 12, 10, 12, 8, 12, 14],
    col_formats: ["text", "text", "text", "text", "text", "indian_number", "text", "indian_number", "indian_number"],
    total_row_formula: true,
    draft_warning_row: { text: "⚠ DRAFT", fill: "#FFF2CC" }
  },

  production_log: {
    sheet_name: "Production Log",
    multi_section_tabs: true,   // If 3 shifts: create 3 sub-sections with shift headers
    col_widths: [10, 15, 12, 12, 12, 12, 14, 15, 25],
    summary_row_style: { fill: "#D9E1F2", bold: true },
    downtime_sheet: { name: "Downtime Log", create_if_present: true }
  },

  salary_register: {
    sheet_name: "Salary Register",
    freeze_cols: 3,    // Freeze first 3 cols (Sr, Code, Name) so they stay visible when scrolling
    col_widths: [5, 12, 25, 18, 8, 10, 8, 8, 12, 8, 10, 12, 8, 8, 6, 8, 10, 14, 14, 6],
    earnings_cols: ["Basic", "DA", "HRA", "Other Allow", "OT Amount"],
    deduction_cols: ["PF", "ESI", "PT", "TDS", "Advance", "Other Ded"],
    earnings_header_fill: "#E2F0D9",    // green tint for earnings columns
    deductions_header_fill: "#FCE4D6",  // orange tint for deductions columns
    net_pay_fill: "#DEEAF1",
    math_error_fill: "#F4CCCC",
    total_row_style: { fill: "#1F3864", font_color: "#FFFFFF", bold: true }
  },

  maintenance_log: {
    sheet_name: "Job Card",
    layout: "form_then_table",
    header_block_fields: ["Job Card No", "Date", "Equipment", "Equipment Code",
                          "Fault Description", "Action Taken", "Maintenance Type",
                          "Start Time", "End Time", "Downtime Hours", "Technician"],
    parts_table_col_widths: [6, 30, 15, 8, 6, 12, 14],
    total_parts_cost_formula: true
  },

  energy_log: {
    sheet_name: "Energy Log",
    col_widths: [12, 10, 20, 14, 14, 14, 10, 12],
    units_consumed_formula: true,   // Excel: =Closing - Opening (with rollover check)
    negative_consumption_fill: "#F4CCCC",
    meter_group_headers: true   // Group rows by meter ID with sub-headers
  },

  quality_cert: {
    sheet_name: "Quality Certificate",
    layout: "form_then_two_tables",  // Header + Chemical table + Mechanical table
    chemical_table: {
      col_widths: [15, 15, 15, 10],
      fail_row_fill: "#F4CCCC",
      pass_row_fill: "#E2F0D9",
      decimal_precision: 4   // Chemical %: show 4 decimal places (0.0120%)
    },
    mechanical_table: {
      col_widths: [25, 15, 15, 8, 10],
      fail_row_fill: "#F4CCCC",
      pass_row_fill: "#E2F0D9"
    }
  },

  purchase_order: {
    sheet_name: "Purchase Order",
    layout: "form_then_table",
    col_widths: [6, 35, 20, 10, 10, 6, 12, 14],
    gst_summary_style: { fill: "#E2F0D9", bold: true },
    grand_total_style: { fill: "#1F3864", font_color: "#FFFFFF", bold: true }
  },

  scrap_register: {
    sheet_name: "Scrap Register",
    col_widths: [12, 15, 15, 25, 12, 25, 20, 25],
    col_formats: ["text", "text", "text", "text", "decimal_mt", "text", "text", "text"],
    decimal_mt_places: 3,   // Scrap weight: 0.450 MT
    total_scrap_row_style: { fill: "#FCE4D6", bold: true }
  }
};


// ─────────────────────────────────────────────────────────────
// STEP 5 — VALIDATION RULES (post-extraction, pre-export)
// Each doc_type has specific validation checks
// Plugs into your existing _verification_export_validation()
// ─────────────────────────────────────────────────────────────
const VALIDATION_RULES = {

  ledger: [
    { type: "balance_check", blocking: false,
      message: "Dr total ({dr}) does not equal Cr total ({cr}). Difference: ₹{diff}" },
    { type: "both_dr_cr_filled", blocking: true,
      message: "Row {n} has both Dr and Cr values filled. Only one should be filled." },
    { type: "indian_number_parse", blocking: true,
      message: "Row {n}: value '{v}' could not be parsed as Indian number." }
  ],

  gate_challan: [
    { type: "net_weight_formula", blocking: false,
      message: "Net weight ({net}) does not equal Gross ({gross}) - Tare ({tare})." },
    { type: "vehicle_number_format", blocking: false,
      message: "Vehicle number '{v}' does not match expected format (e.g. MH12AB1234)." }
  ],

  invoice: [
    { type: "gstin_format", blocking: false,
      message: "GSTIN '{g}' is not 15 characters or has invalid format." },
    { type: "gst_math", blocking: false,
      message: "Row {n}: GST amount ({gst}) does not match Taxable ({tax}) × {rate}%." },
    { type: "grand_total_math", blocking: false,
      message: "Grand total ({total}) does not match Taxable + GST ({computed})." }
  ],

  salary_register: [
    { type: "net_pay_formula", blocking: false,
      message: "Row {n}: Net pay ({net}) does not match Gross ({gross}) - Deductions ({ded})." },
    { type: "gross_pay_formula", blocking: false,
      message: "Row {n}: Gross ({gross}) does not match sum of earnings columns." }
  ],

  quality_cert: [
    { type: "chemical_result_check", blocking: false,
      message: "Row {n}: Element {elem} value {val}% marked OK but may exceed spec." }
  ],

  stock_register: [
    { type: "running_balance_check", blocking: false,
      message: "Row {n}: Balance ({bal}) does not match computed value ({computed})." }
  ]
};


module.exports = {
  CLASSIFIER_PROMPT,
  PROMPT_ROUTER,
  OUTPUT_SCHEMA,
  DOMAIN_CONTEXT,
  EXCEL_OUTPUT_RULES,
  VALIDATION_RULES,
  NUMBER_NORMALISER_PYTHON,
  // Individual prompts exported for direct import
  PROMPT_LEDGER, PROMPT_STOCK_REGISTER, PROMPT_GATE_CHALLAN,
  PROMPT_INVOICE, PROMPT_DISPATCH_CHALLAN, PROMPT_PRODUCTION_LOG,
  PROMPT_SALARY_REGISTER, PROMPT_MAINTENANCE_LOG, PROMPT_ENERGY_LOG,
  PROMPT_QUALITY_CERT, PROMPT_PURCHASE_ORDER, PROMPT_SCRAP_REGISTER
};
