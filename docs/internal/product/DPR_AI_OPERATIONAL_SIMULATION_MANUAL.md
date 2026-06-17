# DPR.ai: OPERATIONAL ROLEPLAY TESTING & WORKFLOW SIMULATION MANUAL
## The "Real-World Factory" Validation Playbook
**Version:** 1.0.0
**Status:** ENTERPRISE OPERATIONAL GUIDE

---

## EXECUTIVE SUMMARY
This manual is designed to help founders and engineers test DPR.ai not as software, but as a **Factory Operating System**. Software bugs are annoying; operational failures are expensive. This guide simulates the high-pressure, low-bandwidth, and messy environment of an Indian industrial factory floor.

---

## ROLE 1: THE MULTI-FACTORY OWNER (RAKESH)
**Persona:** Strategic, time-poor, travels between sites, cares about "The Big Picture" and "Money Leakage."
**Technical Skill:** Medium (Power user of WhatsApp and Mobile Dashboards).
**Main Goal:** Identify risk across all 3 factories in 5 minutes.

### 1.1 The Morning Ritual (Home/Car)
1. **Action:** Open `Control Tower`.
2. **Simulation:** Internet is flaky while driving. Observe how the page handles loading.
3. **Validation:** Does the "Risk Score" tell me *which* factory needs my attention immediately?
4. **UX Audit:** Is the text large enough to read on a phone in a moving car?

### 1.2 The "Emergency Signal" Workflow (Escalation)
1. **Action:** Receive a WhatsApp alert: "Anomaly: Yield loss > 8% in Bhilai Factory."
2. **Action:** Click the link in WA to jump to the `AI Insights` page.
3. **Simulation:** Attempt to ask the AI Copilot: "Why is the yield loss high today?"
4. **Validation:** Does the AI provide a breakdown (e.g., "Shift B had 3 breakdowns") or just generic data?

---

## ROLE 2: THE FACTORY MANAGER (SURESH)
**Persona:** The bridge between floor and owner. Cares about "Bottlenecks" and "Dispatch Targets."
**Stress Point:** Being blamed for late shipments.

### 2.1 The "Next Action" Workflow (Office)
1. **Morning Action:** Open `Dashboard Home`.
2. **Validation:** Does the "Work Queue" highlight exactly how many OCR scans are pending my approval?
3. **Simulation:** 5 different supervisors call at once. Suresh must approve 20 items in 2 minutes.
4. **UX Audit:** Can Suresh "Batch Approve" or does he have to click every single one? (Fatigue check).

---

## ROLE 3: THE SUPERVISOR (AMIT)
**Persona:** Floor-based, high-pressure, managing 50 workers. Cares about "Clean Data" and "Shift Handover."

### 3.1 The "OCR Chaos" Simulation (Shift Change)
**Scenario:** 10 workers come to Amit's desk with physical logs at 8:00 AM.
1. **Action:** Take 10 photos rapidly using the `OCR Scan Page`.
2. **Simulation:** Upload 5 photos, then turn off the internet.
3. **Validation:** Does the app queue the remaining 5? Do they sync automatically when the internet returns?
4. **UX Audit:** Does the camera capture work fast? Is there a "Gallery" fallback if the live camera fails?

---

## ROLE 4: THE OCR VERIFICATION STAFF (PRIYA)
**Persona:** Desk-based, repetitive work. Cares about "Speed" and "Accuracy."

### 4.1 The "Correction Desk" Marathon
1. **Action:** Open `OCR Verification Page`.
2. **Scenario:** The AI extracted "88.5" but the image clearly shows "80.5".
3. **Action:** Edit the value.
4. **Validation:** Does the field turn Green/Yellow to show it was human-corrected?
5. **UX Audit:** Can Priya use keyboard shortcuts (Tab, Enter) to move between fields, or is it Mouse-heavy? (Keyboard is faster for industrial data entry).

---

## ROLE 5: THE PRODUCTION OPERATOR (VINOD)
**Persona:** Floor-worker, low-tech, mobile-only. Cares about "Doing my job" and "Getting paid."

### 5.1 The "Paperless" Production Record
1. **Action:** Open `Production Record Page`.
2. **Scenario:** Vinod is recording 50 tons of TMT bars. He makes a typo: "500" instead of "50".
3. **Validation:** Does the system flag an anomaly ("Quantity exceeds machine capacity") before he hits Save?
4. **UX Audit:** Are the buttons big enough for "Factory fingers" (dusty/sweaty hands)?

---

## ROLE 6: THE DISPATCH MANAGER (ANIL)
**Persona:** Logistics-focused, dealing with truck drivers. Cares about "Gate Passes" and "Weight Matches."

### 6.1 The "Loading Bay" Pressure Test
1. **Scenario:** A truck is waiting. The driver is shouting. Anil needs to generate a Gate Pass.
2. **Action:** Create a `Steel Dispatch`. Select a Sales Invoice.
3. **Validation:** Does the system show "Remaining Balance" on that invoice?
4. **Simulation:** Anil tries to dispatch 15 Tons when only 10 Tons are on the invoice.
5. **Validation:** Does the backend block the POST request? Is the error message clear ("Exceeds Invoice Balance")?

---

## ROLE 7: THE ACCOUNTANT (MAHESH)
**Persona:** Back-office, detail-oriented. Cares about "GST Compliance" and "Customer Ledgers."

### 7.1 The "Invoicing" Workflow
1. **Action:** Upload a PDF Invoice.
2. **Validation:** Does the AI extract the Vendor Name and GST Number correctly?
3. **Action:** Check `Customer Ledger`.
4. **Validation:** Did the Dispatch approved by Anil automatically create a Debit entry here?

---

## OPERATIONAL STRESS SCENARIOS

### SCENARIO A: THE INTERNET BLACKOUT
- **Action:** Open the app. Disable Wifi/Data.
- **Workflow:** Punch Attendance -> Scan 1 OCR -> Create 1 Production Entry.
- **Test:** Close the app completely. Re-open. Turn on internet.
- **Success Criteria:** All 3 actions should sync within 60 seconds without data loss.

### SCENARIO B: THE "MESSY PAPER" TEST
- **Action:** Write a production log with messy handwriting on a crumpled piece of paper.
- **Workflow:** Use `OCR Scan`.
- **Test:** Observe the "Confidence Score."
- **Success Criteria:** Low-confidence values MUST be highlighted in Red.

### SCENARIO C: THE "DUPLICATE UPLOAD"
- **Action:** Two supervisors (Amit and Neeraj) take a photo of the EXACT same logbook at the same time.
- **Validation:** Does the backend `ocr_document_pipeline.py` detect the duplicate and flag it?

---

## UX REALISM AUDIT CHECKLIST

- [ ] **One-Handed Use:** Can the Operator do 90% of his job with just his thumb? (Common in factory floors).
- [ ] **Contrast Check:** Is the "Industrial Dark Theme" readable under bright factory lights or dim night shifts?
- [ ] **Feedback Speed:** When I hit "Save", do I get an instant confirmation, or am I left wondering if it worked?
- [ ] **Terminology:** Does the app use words like "CRUD" and "Payload" (Fail) or "Record" and "Details" (Pass)?
- [ ] **Role Isolation:** If I am an Operator, do I see scary "Billing" or "Owner Charts" that I don't need?

---

## FINAL VALIDATION GOAL
The product is ready when:
1. **Amit (Supervisor)** can clear his queue while walking the floor.
2. **Rakesh (Owner)** gets a "Good Morning" summary that matches reality.
3. **Vinod (Operator)** stops using his paper diary because the app is faster.

---
**END OF SIMUALTION MANUAL**
