# Factory Nerve — Complete User Manual
## Poora User Guide | हर Role, हर Kaam, हर Workflow

---

## How to Use This Manual

**English:** This manual is for every person who uses Factory Nerve — from the operator on the factory floor to the owner in the boardroom. Each section is written for a specific role. Find your role in the Quick Role Index below, jump to that section, and read your Daily Workflow first. Then go through each Task Guide one by one as you encounter them in your day. The Hindi sections explain the same steps in simple, everyday Hindi so that every worker can understand.

**हिंदी:** यह मैन्युअल Factory Nerve में काम करने वाले हर व्यक्ति के लिए है — फैक्ट्री फ्लोर पर काम करने वाले ऑपरेटर से लेकर ऑफिस में बैठने वाले मालिक तक। हर रोल के लिए अलग सेक्शन बनाया गया है। नीचे Quick Role Index में अपनी भूमिका ढूँढें, उस सेक्शन पर जाएँ, और पहले अपना Daily Workflow पढ़ें। फिर हर Task Guide को एक-एक करके पढ़ते जाएँ। हिंदी में हर कदम को सरल भाषा में समझाया गया है ताकि हर कामगर आसानी से समझ सके।

---

## Quick Role Index

| Role Name | Hindi Name | What They Do | Sections to Read |
|---|---|---|---|
| Attendance | हाज़िरी कर्मचारी | Punch in/out, view own attendance, request regularization | Attendance → |
| Operator | ऑपरेटर/मशीन चलाने वाला | Create DPR entries, scan documents, punch attendance, work queue | Operator → |
| Supervisor | सुपरवाइज़र/शिफ्ट इंचार्ज | Approve entries, verify OCR, review attendance, manage dispatches | Supervisor → |
| Accountant | अकाउंटेंट/हिसाब-किताब | Manage customers, invoices, payments, attendance reports, email summaries | Accountant → |
| Manager | मैनेजर/प्लांट प्रमुख | Oversee production, analytics, workforce, inventory, dispatches, approvals | Manager → |
| Admin | एडमिन/सिस्टम संचालक | Manage users, settings, factories, billing, master data, alerts config | Admin → |
| Owner | मालिक/उद्यमी | Full access: executive dashboard, AI insights, control tower, charts, fraud | Owner → |

---

# Role: Attendance | हाज़िरी कर्मचारी

### Who Is This Role?

**English:** The Attendance role is for factory workers whose only job in the system is to mark their attendance — punch in when they arrive, punch out when they leave, and request correction if they forget to punch. They do NOT create production entries, view reports, or access any other part of the system. This is the most restricted role in Factory Nerve. They report to their Shift Supervisor for attendance issues.

**हिंदी:** Attendance रोल उन फैक्ट्री कामगारों के लिए है जिनका सिस्टम में सिर्फ एक काम है — अपनी हाज़िरी लगाना। आते समय पंच इन, जाते समय पंच आउट, और अगर पंच करना भूल गए तो सुधार के लिए रिक्वेस्ट करना। यह Factory Nerve का सबसे सीमित रोल है। ये लोग अपने शिफ्ट सुपरवाइज़र को रिपोर्ट करते हैं।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/attendance` | Punch in/out screen and own attendance history |
| `/profile` | Personal profile, change password, account settings |

### Daily Workflow — Step by Step

**English:**
1. **Punch In (Morning):** As soon as you enter the factory, go to Factory Nerve → Attendance page. Click **Punch In**. The system records your entry time.
2. **Punch Out (Evening):** Before leaving, go to Attendance page again. Click **Punch Out**. The system calculates your total hours worked.
3. **Check Your Attendance:** Look at the attendance card on the page. It shows today's status: ✅ Present, ⏳ Half-Day, or ❌ Absent.
4. **If You Forgot to Punch:** If you forgot to punch in or out, click **Request Regularization** → select the date → enter the correct time → write a reason → Submit. Your supervisor will review and approve/reject it.
5. **Check Profile:** Visit Profile page to update your name, phone number, or password.

**हिंदी:**
1. **पंच इन (सुबह):** फैक्ट्री में आते ही Factory Nerve खोलें → Attendance पेज पर जाएँ। **Punch In** बटन दबाएँ। सिस्टम आपके आने का समय रिकॉर्ड कर लेगा।
2. **पंच आउट (शाम):** जाने से पहले Attendance पेज पर जाएँ। **Punch Out** बटन दबाएँ। सिस्टम आपके कुल घंटे कैलकुलेट करेगा।
3. **अपनी हाज़िरी जाँचें:** पेज पर attendance card देखें। यह दिखाता है: ✅ मौजूद, ⏳ आधा दिन, या ❌ अनुपस्थित।
4. **अगर पंच करना भूल गए:** **Request Regularization** पर क्लिक करें → तारीख चुनें → सही समय डालें → कारण लिखें → Submit करें। सुपरवाइज़र इसे approve या reject करेंगे।

### Task Guides — Each Task Explained

#### Task: Punch In
**When to do this:** When you arrive at the factory for your shift.
**Where to go:** Attendance page → Punch In button (large button at the top)
**Step by step:**
1. Open Factory Nerve on your phone or computer
2. Go to **Attendance** page from the navigation menu
3. You will see a large **Punch In** button — tap it
4. Wait for the confirmation message: "Punched in successfully"
5. The page now shows your check-in time
**What happens after:** Your supervisor can see you are present on the Live Attendance board. The system starts counting your working hours.
**⚠️ Common Mistake:** Punching in from home or before you actually enter the factory. Your supervisor checks attendance — always punch when you are physically at the factory.
**✅ Pro Tip:** Set a reminder on your phone for punch-in and punch-out times so you never forget.
**Hindi Guide:**
**कब करें:** जब आप फैक्ट्री में आएँ।
**कहाँ जाएँ:** Attendance पेज → Punch In बटन।
**कैसे करें:**
1. Factory Nerve खोलें
2. Attendance पेज पर जाएँ
3. **Punch In** बटन दबाएँ
4. "Punched in successfully" का मैसेज आने तक wait करें
5. आपका आने का समय स्क्रीन पर दिख जाएगा
**बाद में क्या होता है:** सुपरवाइज़र देख सकते हैं कि आप मौजूद हैं। सिस्टम आपके घंटे गिनना शुरू करता है।

#### Task: Punch Out
**When to do this:** When your shift ends and you are leaving the factory.
**Where to go:** Attendance page → Punch Out button
**Step by step:**
1. Open Attendance page
2. Tap the **Punch Out** button
3. Wait for confirmation: "Punched out successfully"
4. The page shows your total hours worked today
**What happens after:** Your attendance record for the day is complete. If you worked less than the minimum shift hours, the system may flag it as Half-Day.
**⚠️ Common Mistake:** Forgetting to punch out means the system marks you as absent. Always punch out before leaving.
**Hindi Guide:**
**कब करें:** शिफ्ट खत्म होने पर फैक्ट्री से जाने से पहले।
**कहाँ जाएँ:** Attendance पेज → Punch Out बटन।
**कैसे करें:**
1. Attendance पेज खोलें
2. **Punch Out** बटन दबाएँ
3. "Punched out successfully" का मैसेज आए
4. आज के काम के कुल घंटे स्क्रीन पर दिखेंगे

#### Task: Request Regularization
**When to do this:** When you forgot to punch in or out, or the system didn't record your attendance correctly.
**Where to go:** Attendance page → Request Regularization link
**Step by step:**
1. On the Attendance page, find the **Request Regularization** button/link
2. Select the **Date** when you missed the punch
3. Enter the **Correct In Time** and/or **Correct Out Time**
4. Write a **Reason** (e.g., "Forgot to punch in, was on night shift duty")
5. Click **Submit**
6. Wait for your supervisor to approve
**What happens after:** The request goes to your supervisor's review queue. They can approve or reject it. If approved, your attendance is corrected. If rejected, you remain marked as absent.
**⚠️ Common Mistake:** Submitting regularization for the wrong date. Double-check the date before submitting.
**✅ Pro Tip:** Submit regularization requests within 24 hours. The longer you wait, the harder it is for your supervisor to verify.
**Hindi Guide:**
**कब करें:** जब पंच करना भूल गए या सिस्टम ने सही हाज़िरी नहीं ली।
**कहाँ जाएँ:** Attendance पेज → Request Regularization।
**कैसे करें:**
1. Request Regularization पर क्लिक करें
2. तारीख चुनें
3. सही आने और जाने का समय डालें
4. कारण लिखें (जैसे "पंच इन करना भूल गया था")
5. Submit दबाएँ
6. सुपरवाइज़र के approve करने का इंतज़ार करें

### What This Role Should NEVER Do

- **Never try to access reports, entries, or admin pages** — the system will block you with a 403 error
- **Never punch in for another worker** — this is fraud and will be detected by the system
- **Never share your password** — if someone else logs in as you, your attendance will be wrong

### How This Role Connects to Other Roles

- **Supervisor** receives and approves your regularization requests
- **Accountant** uses your attendance data to calculate payroll
- **Manager** sees team attendance summaries on the analytics dashboard

---

# Role: Operator | ऑपरेटर

### Who Is This Role?

**English:** The Operator is the backbone of Factory Nerve. They work on the factory floor — running machines, recording production data, and digitizing paper documents through OCR scanning. Operators create Daily Production Reports (DPR entries), scan challans/invoices, punch their attendance, and work through their queue. They report to the Shift Supervisor and work alongside other operators on their shift.

**हिंदी:** Operator Factory Nerve की रीढ़ है। ये फैक्ट्री फ्लोर पर काम करते हैं — मशीन चलाते हैं, प्रोडक्शन डेटा रिकॉर्ड करते हैं, और OCR स्कैनिंग के ज़रिए कागज़ी दस्तावेज़ डिजिटल करते हैं। Operator DPR एंट्री बनाते हैं, चालान/इनवॉइस स्कैन करते हैं, अपनी हाज़िरी लगाते हैं, और अपने वर्क क्यू में काम करते हैं। ये Shift Supervisor को रिपोर्ट करते हैं।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/dashboard` | Today's board — live priorities, alerts, shift context |
| `/work-queue` | Cross-app task queue — what needs attention right now |
| `/tasks` | My Day — assigned work, handoffs, follow-through |
| `/entry` | Create and manage DPR (Daily Production Report) entries |
| `/ocr/scan` | Document Desk — scan invoices, challans, gate slips |
| `/ocr/history` | Past OCR scans and their status |
| `/attendance` | Punch in/out and own attendance record |
| `/profile` | Personal profile and account settings |

### Daily Workflow — Step by Step

**English:**
1. **Punch In:** Start your day by punching in on the Attendance page.
2. **Check Dashboard (Today Board):** Open the Dashboard to see today's targets, alerts, and what needs your attention.
3. **Check Work Queue:** Open Work Queue to see any tasks assigned to you — OCR verifications, pending entries, or follow-ups.
4. **Enter Production Data (DPR):** Throughout your shift, create entries on the Entry page for each production batch. Fill in shift, machine, quantity produced, downtime, and any quality issues.
5. **Scan Documents:** When you receive paper documents (invoices, challans, gate slips), go to Document Desk → Scan a document → take a photo or upload → verify the OCR result → submit.
6. **Check My Day:** Visit Tasks page to see any handoffs or follow-through items.
7. **Punch Out:** Before leaving, punch out on the Attendance page.

**हिंदी:**
1. **पंच इन:** Attendance पेज पर पंच इन करके दिन शुरू करें।
2. **डैशबोर्ड देखें:** Dashboard खोलें — आज के टारगेट, अलर्ट, और क्या करना है देखें।
3. **वर्क क्यू देखें:** Work Queue खोलें — कोई काम असाइन हुआ है तो देखें।
4. **DPR एंट्री करें:** पूरी शिफ्ट में Entry पेज पर प्रोडक्शन डेटा दर्ज करें — शिफ्ट, मशीन, कितना उत्पादन हुआ, डाउनटाइम, क्वालिटी इश्यू।
5. **दस्तावेज़ स्कैन करें:** जब कागज़ी दस्तावेज़ मिलें (चालान, इनवॉइस, गेट स्लिप), Document Desk पर जाएँ → Scan करें → फोटो लें या अपलोड करें → OCR रिज़ल्ट चेक करें → Submit करें।
6. **My Day देखें:** Tasks पेज पर जाएँ — कोई हैंडऑफ़ या फॉलो-अप है तो देखें।
7. **पंच आउट:** जाने से पहले Attendance पेज पर पंच आउट करें।

### Task Guides — Each Task Explained

#### Task: Create a DPR Entry
**When to do this:** After completing a production run or at shift end.
**Where to go:** Production → Shift Entry → New Entry button
**Step by step:**
1. Go to **Entry** page (under Operations section in sidebar)
2. Click **+ New Entry** button
3. Select your **Shift** (A, B, C, or General)
4. Enter **Date** (defaults to today)
5. Fill in the production fields:
   - **Machine/Line** — select from dropdown
   - **Product** — what was produced
   - **Quantity Produced** — total output in kg/units
   - **Good Quantity** — output that passed quality check
   - **Rejected Quantity** — output that failed
   - **Downtime Minutes** — how many minutes the machine was stopped
   - **Downtime Reason** — why it stopped (from dropdown list)
6. Add any **Remarks** or Notes
7. Click **Save as Draft** (to finish later) or **Submit** (send for approval)
**What happens after:** If submitted, the entry goes to your Supervisor's approval queue. If saved as draft, it stays in your pending list.
**⚠️ Common Mistake:** Entering quantities in wrong units. Always check if the field asks for kg, tons, or pieces.
**✅ Pro Tip:** Submit entries throughout the shift, not all at the end. This helps supervisors catch issues early.
**Hindi Guide:**
**कब करें:** प्रोडक्शन रन खत्म करने के बाद या शिफ्ट के अंत में।
**कहाँ जाएँ:** Entry पेज → + New Entry बटन।
**कैसे करें:**
1. Entry पेज पर जाएँ
2. + New Entry बटन दबाएँ
3. अपनी शिफ्ट चुनें (A, B, C, या General)
4. तारीख डालें (आज की डिफ़ॉल्ट होगी)
5. ये फ़ील्ड भरें:
   - मशीन/लाइन — ड्रॉपडाउन से चुनें
   - प्रोडक्ट — क्या बनाया
   - कुल उत्पादन — kg/यूनिट में
   - अच्छा उत्पादन — जो क्वालिटी में पास हुआ
   - रिजेक्ट — जो फेल हुआ
   - डाउनटाइम — कितने मिनट मशीन बंद रही
   - डाउनटाइम कारण — ड्रॉपडाउन से चुनें
6. कोई नोट हो तो Remarks में लिखें
7. Save as Draft (बाद में पूरा करें) या Submit (अप्रूवल के लिए भेजें) दबाएँ

#### Task: Scan a Document (OCR)
**When to do this:** When you receive a paper document — invoice, challan, gate slip, production register.
**Where to go:** Today → Document Desk → Scan Document
**Step by step:**
1. Go to **Document Desk** (`/ocr/scan`)
2. Click **Scan Document** or **Upload**
3. Choose method:
   - **Take Photo** — use your phone camera
   - **Upload File** — select an image or PDF from your device
4. After upload, the system processes the document with AI (may take 5-15 seconds)
5. The **OCR Result** screen shows what the system read:
   - Check text fields, numbers, and table data
   - Correct any mistakes by tapping on the field and typing
6. Click **Submit** when the data is correct
7. Select **Document Type** (Invoice, Challan, Gate Slip, etc.)
**What happens after:** The scanned data goes to the OCR verification queue. A Supervisor or Accountant will review and approve it.
**⚠️ Common Mistake:** Taking blurry photos. Make sure the document is flat, well-lit, and all text is readable.
**✅ Pro Tip:** Use the "Enhance" button in the editor to improve image quality before processing.
**Hindi Guide:**
**कब करें:** जब कोई कागज़ी दस्तावेज़ मिले — इनवॉइस, चालान, गेट स्लिप, प्रोडक्शन रजिस्टर।
**कहाँ जाएँ:** Document Desk → Scan Document।
**कैसे करें:**
1. Document Desk पर जाएँ
2. Scan Document या Upload दबाएँ
3. तरीका चुनें:
   - फोटो लें — कैमरे से
   - फ़ाइल अपलोड करें — गैलरी या फ़ोल्डर से
4. अपलोड के बाद सिस्टम AI से दस्तावेज़ पढ़ेगा (5-15 सेकंड लग सकते हैं)
5. OCR Result स्क्रीन पर देखें कि सिस्टम ने क्या पढ़ा
6. गलती हो तो field पर टैप करके सुधारें
7. Submit दबाएँ
8. Document Type चुनें (Invoice, Challan, Gate Slip, etc.)

#### Task: Punch Attendance
**When to do this:** At shift start and end (see Attendance role section for details).
**Where to go:** Attendance page
**Step by step:** Same as Attendance role → Punch In / Punch Out tasks above.

#### Task: Work Through the Queue
**When to do this:** At the start of your shift and periodically throughout the day.
**Where to go:** Today → Work Queue
**Step by step:**
1. Open **Work Queue** from the Today section
2. Review items grouped by type:
   - **Pending Entries** — drafts you need to complete
   - **OCR Jobs** — scans waiting for submission
   - **Alerts** — notifications requiring attention
3. Click on any item to open it
4. Complete the required action (fill data, approve, reject)
**What happens after:** Items move out of your queue. Your supervisor sees your progress.
**Hindi Guide:**
**कब करें:** शिफ्ट शुरू में और दिन में बीच-बीच में।
**कहाँ जाएँ:** Work Queue।
**कैसे करें:**
1. Work Queue खोलें
2. आइटम देखें:
   - लंबित एंट्री — जो ड्राफ्ट में हैं
   - OCR जॉब — जो सबमिट होने बाकी हैं
   - अलर्ट — जिन पर ध्यान चाहिए
3. किसी भी आइटम पर क्लिक करें
4. ज़रूरी कार्रवाई करें

### What This Role Should NEVER Do

- **Never approve entries or attendance** — you don't have permission for this
- **Never access billing or settings pages** — restricted to Admin/Owner roles
- **Never try to delete entries created by others** — only supervisors can delete
- **Never manipulate production numbers** — the fraud detection system flags anomalies

### How This Role Connects to Other Roles

- **Supervisor** approves your DPR entries and OCR scans
- **Supervisor** reviews your attendance regularization requests
- **Manager** sees your production data in analytics
- **Accountant** uses your scanned invoices for financial records

---

# Role: Supervisor | सुपरवाइज़र

### Who Is This Role?

**English:** The Supervisor (Shift Lead) is the first level of management. They review and approve the work done by Operators and Attendance workers. Supervisors approve DPR entries, verify OCR-scanned documents, manage the attendance review queue, and oversee dispatches. They report to the Plant Manager and supervise a team of operators on their shift.

**हिंदी:** Supervisor (Shift Lead) प्रबंधन का पहला स्तर है। ये Operators और Attendance workers के काम की समीक्षा और अनुमोदन करते हैं। Supervisors DPR entries को approve करते हैं, OCR-scanned documents को verify करते हैं, attendance review queue को मैनेज करते हैं, और dispatches की देखरेख करते हैं। ये Plant Manager को रिपोर्ट करते हैं।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/approvals` | One place for pending review — entries, OCR, stock reconciliations |
| `/work-queue` | Cross-app queue for daily review load and alerts |
| `/attendance/review` | Review and approve/reject attendance regularization requests |
| `/attendance` | View team attendance and punch own attendance |
| `/attendance/reports` | Attendance summaries and reports |
| `/ocr/verify` | Review and approve/reject OCR-scanned documents |
| `/ocr/history` | Past OCR scans |
| `/steel/dispatches` | View and manage steel dispatches |
| `/steel/reconciliations` | Review stock reconciliation results (steel industry) |
| `/reports` | Production reports and exports |
| `/profile` | Personal profile |

### Daily Workflow — Step by Step

**English:**
1. **Check Approvals Queue:** Start your shift by opening Approvals page. See how many pending items are waiting — entries to approve, OCR documents to verify, reconciliations to review.
2. **Approve DPR Entries:** Go through each pending entry one by one. Check the production numbers, downtime reasons, and quality data. Approve or reject with a reason.
3. **Verify OCR Documents:** Open Review Documents page. Check each scanned document. Does the OCR data match the original paper? Approve or reject.
4. **Review Attendance:** Open Attendance Review page. See regularization requests from your team. Approve genuine ones, reject false ones.
5. **Manage Dispatches (Steel):** If you work in a steel factory, check Dispatches page for any pending dispatch tasks.
6. **Check Reports:** End your shift by reviewing the Reports page for any issues or anomalies in the day's data.
7. **Handoff Notes:** Leave notes for the next shift supervisor about pending items.

**हिंदी:**
1. **Approvals Queue चेक करें:** Approvals पेज खोलें — कितने आइटम pending हैं: entries, OCR documents, reconciliations।
2. **DPR Entries Approve करें:** हर pending entry को check करें। Production numbers, downtime reasons, quality data देखें। Approve या reject करें।
3. **OCR Documents Verify करें:** Review Documents पेज खोलें। हर scanned document check करें — OCR data मूल कागज़ से मेल खाता है? Approve या reject करें।
4. **Attendance Review करें:** Attendance Review पेज खोलें। Team से आए regularization requests देखें। सही को approve, गलत को reject करें।
5. **Dispatches मैनेज करें:** स्टील फैक्ट्री में काम करते हैं तो Dispatches पेज चेक करें।
6. **Reports देखें:** दिन के अंत में Reports पेज देखें — कोई anomaly या issue है तो check करें।
7. **हैंडऑफ़ नोट्स:** अगली shift के supervisor के लिए नोट छोड़ें।

### Task Guides — Each Task Explained

#### Task: Approve/Reject a DPR Entry
**When to do this:** When Operators submit production entries that need review.
**Where to go:** Approvals page → Pending Entries section
**Step by step:**
1. Open **Approvals** page
2. Find the **Pending Entries** section
3. Click on an entry to see details
4. Check:
   - Are quantities realistic for this machine/shift?
   - Is downtime_reason valid?
   - Are good + rejected quantities matching total?
5. Click **Approve** or **Reject**
6. If rejecting, write a clear reason (e.g., "Quantities don't match shift report")
**What happens after:** Approved entries are finalized and included in reports. Rejected entries go back to the Operator who can edit and resubmit.
**⚠️ Common Mistake:** Approving without checking. Always verify numbers against your own shift observations.
**✅ Pro Tip:** Batch-approve similar entries to save time, but always spot-check a few.
**Hindi Guide:**
**कब करें:** जब Operators production entries submit करें।
**कहाँ जाएँ:** Approvals पेज → Pending Entries।
**कैसे करें:**
1. Approvals पेज खोलें
2. Pending Entries section देखें
3. किसी entry पर click करके detail देखें
4. जाँचें: क्या quantities सही हैं? Downtime reason वैध है?
5. Approve या Reject दबाएँ
6. Reject कर रहे हैं तो कारण लिखें

#### Task: Verify an OCR Document
**When to do this:** When Operators or Accountants have submitted scanned documents for verification.
**Where to go:** Review → Review Documents (`/ocr/verify`)
**Step by step:**
1. Open **Review Documents** page
2. See list of pending OCR verifications
3. Click on a document to open it
4. Compare:
   - **Original Image** (shown on the left or top)
   - **Extracted Data** (shown on the right or bottom)
5. Check each field:
   - Are names, numbers, dates correct?
   - Are table rows and columns matching?
   - Is the document type correct?
6. If data is correct → click **Approve**
7. If data is wrong → click **Reject** and explain what to fix
8. For minor errors → click **Edit** to make corrections yourself, then approve
**What happens after:** Approved data flows into reports and inventory. Rejected items return to the submitter's queue.
**⚠️ Common Mistake:** Not zooming in to check small numbers. Use the image zoom feature.
**✅ Pro Tip:** For invoices, always verify the total amount matches across all line items.
**Hindi Guide:**
**कब करें:** जब Operators या Accountants ने scanned documents submit किए हों।
**कहाँ जाएँ:** Review Documents पेज।
**कैसे करें:**
1. Review Documents पेज खोलें
2. Pending OCR verifications की list देखें
3. किसी document पर click करें
4. Original image और extracted data compare करें
5. हर field check करें — नाम, नंबर, तारीख सही हैं?
6. सही है → Approve दबाएँ
7. गलत है → Reject दबाएँ और बताएँ क्या ठीक करना है
8. छोटी गलती है → खुद Edit करें फिर approve करें

#### Task: Review Attendance Regularizations
**When to do this:** Daily, when workers request corrections to their attendance.
**Where to go:** Review → Attendance Review (`/attendance/review`)
**Step by step:**
1. Open **Attendance Review** page
2. See list of regularization requests with:
   - Employee name
   - Date
   - Requested time correction
   - Reason
3. Click on a request to see full details
4. Verify the claim:
   - Was the employee actually on shift? (check with other workers)
   - Is the reason reasonable?
5. Click **Approve** or **Reject**
6. If rejecting, provide a reason
**What happens after:** Approved corrections update the attendance record. Rejected requests stay as the original mark (usually absent).
**⚠️ Common Mistake:** Approving all requests without verification. Some workers may try to regularize days they were actually absent.
**✅ Pro Tip:** Be stricter with late regularization requests (submitted after 3+ days).
**Hindi Guide:**
**कब करें:** रोज़, जब workers अपनी attendance में सुधार चाहते हैं।
**कहाँ जाएँ:** Attendance Review पेज।
**कैसे करें:**
1. Attendance Review पेज खोलें
2. Regularization requests की list देखें — नाम, तारीख, समय, कारण
3. किसी request पर click करें
4. Verify करें — क्या वाकई worker मौजूद था? कारण सही है?
5. Approve या Reject दबाएँ

#### Task: Manage Steel Dispatches
**When to do this:** When trucks arrive for loading or depart from the factory.
**Where to go:** Operations → Dispatch (`/steel/dispatches`)
**Step by step:**
1. Open **Dispatch** page
2. See list of dispatches by status:
   - **Scheduled** — planned but not yet loaded
   - **Loading** — currently being loaded
   - **Departed** — truck has left the factory
   - **Delivered** — reached the customer
3. To create a dispatch: Click **+ New Dispatch**
   - Enter truck number, driver name, customer
   - Select products and quantities
   - Assign gate pass number
4. To update status: Find the dispatch → click **Update Status** → select next status
5. Verify weighbridge tickets match the dispatch quantity
**What happens after:** Dispatch updates flow to inventory (stock decreases), invoicing (invoice created), and customer records.
**⚠️ Common Mistake:** Not verifying the weighbridge ticket. The ticket weight must match the dispatch quantity.
**✅ Pro Tip:** Always assign a gate pass number — security won't let the truck leave without it.
**Hindi Guide:**
**कब करें:** जब ट्रक लोडिंग के लिए आए या फैक्ट्री से रवाना हो।
**कहाँ जाएँ:** Dispatch पेज।
**कैसे करें:**
1. Dispatch पेज खोलें
2. Status के अनुसार dispatches देखें — Scheduled, Loading, Departed, Delivered
3. New Dispatch बनाएँ: ट्रक नंबर, ड्राइवर, कस्टमर, प्रोडक्ट, quantity डालें
4. Status अपडेट करें: dispatch ढूँढें → Update Status → अगला status चुनें
5. Weighbridge ticket dispatch quantity से मिलाएँ

### What This Role Should NEVER Do

- **Never change user roles or invite users** — that's for Manager/Admin
- **Never access billing or subscription settings** — Admin/Owner only
- **Never delete production entries without reason** — always reject with explanation first
- **Never override inventory transactions manually** — use the proper reconciliation process

### How This Role Connects to Other Roles

- **Operators** — send entries and scans to you for approval
- **Attendance Workers** — send regularization requests to you
- **Manager** — sees your approval metrics in reports
- **Accountant** — receives approved OCR invoices from you
- **Admin** — configures the approval rules you follow

---

# Role: Accountant | अकाउंटेंट

### Who Is This Role?

**English:** The Accountant manages all financial data in Factory Nerve. They handle customer records, sales invoices, payment tracking, attendance reports for payroll, and financial intelligence dashboards. Accountants have access to financial permissions that other roles (except Manager, Admin, Owner) don't have — like viewing costs, scrap costs, labour costs, and email summaries. They report to the Plant Manager or Admin.

**हिंदी:** Accountant Factory Nerve में सभी वित्तीय डेटा मैनेज करता है। ये customer records, sales invoices, payment tracking, attendance reports (पेरोल के लिए), और financial intelligence dashboards देखते हैं। Accountants के पास वित्तीय permissions हैं जो दूसरे roles (Manager, Admin, Owner को छोड़कर) के पास नहीं हैं — जैसे costs, scrap costs, labour costs, और email summaries देखना। ये Plant Manager या Admin को रिपोर्ट करते हैं।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/reports` | Production reports and data exports (Excel/PDF) |
| `/attendance/reports` | Attendance summaries for payroll processing |
| `/attendance` | View own attendance |
| `/email-summary` | Generate and view automated email summaries |
| `/steel/customers` | Customer records, credit limits, and lifecycle |
| `/steel/invoices` | Sales invoices, revenue tracking |
| `/steel/financial-intelligence` | Revenue, margins, receivables, payables dashboard |
| `/steel/sales-intelligence` | Sales trends and customer analytics |
| `/steel/vendors` | Vendor master, bills, accounts payable |
| `/steel/expenses` | Operational expenses and cost tracking |
| `/profile` | Personal profile |

### Daily Workflow — Step by Step

**English:**
1. **Check Reports:** Start your day by opening Reports to see yesterday's production data and any anomalies flagged by the system.
2. **Review Attendance Reports:** Open Attendance Reports to get yesterday's attendance data. Check if all workers were marked correctly. Export data for payroll processing.
3. **Manage Customers:** Check Customers page for any new customer records that need verification. Verify PAN/GST details if you have the permission.
4. **Process Invoices:** Open Sales Invoices page. Check for pending invoices to be created from dispatches. Verify amounts, quantities, and customer details.
5. **Record Payments:** When customers make payments, record them against the correct invoices.
6. **Check Financial Intelligence:** Open Financial Intelligence dashboard to review revenue, margins, receivables, and payables.
7. **Generate Email Summary:** If configured, generate the daily email summary and send to management.
8. **Reconcile Vendors:** Check Vendors page for pending bills and payment schedules.

**हिंदी:**
1. **Reports देखें:** Reports पेज खोलें — कल का production data और कोई anomaly है तो देखें।
2. **Attendance Reports देखें:** Attendance Reports से कल की हाज़िरी देखें। Payroll के लिए data export करें।
3. **Customers मैनेज करें:** Customers पेज पर नए customer records check करें। PAN/GST verify करें।
4. **Invoices प्रोसेस करें:** Sales Invoices पेज खोलें। Dispatches से बनने वाले नए invoices देखें। Amount, quantity, customer details verify करें।
5. **Payments रिकॉर्ड करें:** जब customers payment करें, तो सही invoice के साथ रिकॉर्ड करें।
6. **Financial Intelligence देखें:** Financial Intelligence dashboard खोलें — revenue, margins, receivables, payables।
7. **Email Summary जनरेट करें:** Daily email summary बनाकर management को भेजें।
8. **Vendors से reconcile करें:** Vendors पेज पर pending bills और payment schedule देखें।

### Task Guides — Each Task Explained

#### Task: Create a Sales Invoice
**When to do this:** After a dispatch is completed and products have left the factory.
**Where to go:** Operations → Sales Invoices → + New Invoice
**Step by step:**
1. Go to **Sales Invoices** page (`/steel/invoices`)
2. Click **+ New Invoice**
3. Select the **Customer** from the dropdown (create a new customer if needed)
4. Invoice details:
   - **Invoice Date** — default today
   - **Dispatch Reference** — select the related dispatch
   - **Products** — add line items: product name, quantity (kg/units), rate, amount
   - **GST Details** — enter GST rate if applicable
   - **Total Amount** — system calculates automatically
   - **Due Date** — payment expected by
5. Add any **Remarks** (e.g., "Payment within 30 days")
6. Click **Save as Draft** or **Submit**
**What happens after:** The invoice is recorded in the system. It appears in customer's ledger. Payment follow-up tasks can be created.
**⚠️ Common Mistake:** Forgetting to link the dispatch. Always link invoices to their corresponding dispatch for audit trail.
**✅ Pro Tip:** Use the "Copy from Dispatch" feature to auto-fill invoice items from the dispatch record.
**Hindi Guide:**
**कब करें:** डिस्पैच पूरा होने के बाद जब प्रोडक्ट फैक्ट्री से निकल चुके हों।
**कहाँ जाएँ:** Sales Invoices → + New Invoice।
**कैसे करें:**
1. Sales Invoices पेज पर जाएँ
2. + New Invoice दबाएँ
3. Customer चुनें
4. Invoice details भरें: तारीख, dispatch reference, products, quantity, rate, GST, total amount
5. Remarks डालें
6. Save as Draft या Submit दबाएँ

#### Task: Record a Customer Payment
**When to do this:** When a customer sends payment (bank transfer, cheque, cash).
**Where to go:** Customers → Select Customer → Record Payment
**Step by step:**
1. Go to **Customers** page
2. Find and click on the customer
3. In the customer detail view, find **Record Payment** button
4. Enter:
   - **Amount** — the payment received
   - **Payment Mode** — Bank Transfer / Cheque / Cash / UPI
   - **Reference Number** — transaction ID or cheque number
   - **Date** — when payment was received
   - **Allocate To** — select which invoice(s) this payment is for
5. Click **Submit**
**What happens after:** The customer's outstanding balance reduces. The invoice status updates to partially or fully paid.
**⚠️ Common Mistake:** Allocating payment to the wrong invoice. Double-check invoice numbers before submitting.
**✅ Pro Tip:** If a single payment covers multiple invoices, use the "Split Allocation" option.
**Hindi Guide:**
**कब करें:** जब customer payment भेजे (bank transfer, cheque, cash, UPI)।
**कहाँ जाएँ:** Customers → customer चुनें → Record Payment।
**कैसे करें:**
1. Customers पेज पर जाएँ
2. Customer पर click करें
3. Record Payment बटन दबाएँ
4. Amount, Payment Mode, Reference Number, Date, Invoice allocate करें
5. Submit दबाएँ

#### Task: Export Attendance Report for Payroll
**When to do this:** At the end of the month or week, before processing salaries.
**Where to go:** Attendance Reports → Select Date Range → Export
**Step by step:**
1. Go to **Attendance Reports** page (`/attendance/reports`)
2. Select **Date Range** (e.g., last week, last month)
3. Select **Shift** (optional — filter by shift)
4. Click **Generate Report**
5. Review the summary:
   - Total working days
   - Present/Absent/Half-Day counts
   - Overtime hours
6. Click **Export to Excel** or **Export to PDF**
**What happens after:** The file downloads to your computer. Use this data to calculate wages.
**⚠️ Common Mistake:** Not checking for pending regularization requests. Ensure all attendance is finalized before running payroll.
**✅ Pro Tip:** Request OT (overtime) data from your Manager — this doesn't auto-calculate in the standard report.
**Hindi Guide:**
**कब करें:** महीने या हफ्ते के अंत में, सैलरी प्रोसेस करने से पहले।
**कहाँ जाएँ:** Attendance Reports → Date Range → Export।
**कैसे करें:**
1. Attendance Reports पेज पर जाएँ
2. Date Range चुनें
3. Generate Report दबाएँ
4. Summary देखें — present/absent, OT hours
5. Export to Excel या PDF दबाएँ

#### Task: Generate Email Summary
**When to do this:** Daily or weekly, to send automated summaries to management.
**Where to go:** Scheduled Updates → Generate
**Step by step:**
1. Go to **Scheduled Updates** page (`/email-summary`)
2. Click **Generate New Summary**
3. Select **Report Type**:
   - **Daily Production Summary**
   - **Attendance Summary**
   - **Financial Summary**
   - **Custom Mix**
4. Select **Recipients** — who should get this email
5. Click **Generate & Send**
**What happens after:** The system compiles the data, creates a formatted email, and sends it to all recipients.
**Hindi Guide:**
**कब करें:** रोज़ या हफ्ते में, management को automated summary भेजने के लिए।
**कहाँ जाएँ:** Email Summary → Generate।
**कैसे करें:**
1. Email Summary पेज पर जाएँ
2. Generate New Summary दबाएँ
3. Report Type चुनें
4. Recipients चुनें
5. Generate & Send दबाएँ

### What This Role Should NEVER Do

- **Never approve production entries** — that's the Supervisor's job
- **Never void invoices** — only Admin/Owner can void invoices (requires MFA)
- **Never reverse payments** — only Admin/Owner
- **Never change customer GST/PAN without verification** — needs Admin review
- **Never delete customer records** — only Admin/Owner

### How This Role Connects to Other Roles

- **Operator** scans invoices and challans that you process
- **Supervisor** verifies OCR documents before they reach you
- **Manager** reviews your financial reports
- **Admin** configures your email summary templates
- **Owner** monitors financial health through the dashboard

---

# Role: Manager | मैनेजर

### Who Is This Role?

**English:** The Manager (Plant Manager) oversees the entire factory operation. They have access to production analytics, workforce intelligence, inventory management, dispatch management, and financial overviews. Managers can create invoices, manage inventory items, start stock reconciliations, and view all analytics. They report to the Admin/Owner and supervise Supervisors and Accountants.

**हिंदी:** Manager (Plant Manager) पूरी फैक्ट्री के कामकाज की देखरेख करता है। इनके पास production analytics, workforce intelligence, inventory management, dispatch management, और financial overviews तक पहुँच है। Managers invoices बना सकते हैं, inventory items मैनेज कर सकते हैं, stock reconciliations शुरू कर सकते हैं, और सभी analytics देख सकते हैं। ये Admin/Owner को रिपोर्ट करते हैं और Supervisors व Accountants की निगरानी करते हैं।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/dashboard` | Today's board — live priorities and alerts |
| `/work-queue` | Cross-app task queue |
| `/approvals` | Approve/reject entries, batch variances |
| `/reports` | Production reports and exports |
| `/analytics` | Operations analytics — weekly/monthly trends |
| `/workforce` | Workforce intelligence — attendance KPIs, worker rankings, labour costs |
| `/ocr/history` | Past OCR scans |
| `/steel` | Steel Hub — operational overview, KPI health |
| `/steel/inventory` | Live stock balance and material master |
| `/steel/inventory/transactions` | Manual stock adjustments and movement audit |
| `/steel/production/record` | Manual batch production and variance recording |
| `/steel/production/machines` | Machine registry, OEE tracking |
| `/steel/production-intelligence` | Shift throughput, batch quality, operator performance |
| `/steel/machine-alerts` | Machine health alerts: MTBF, maintenance |
| `/steel/inventory-intelligence` | Low-stock alerts, dead stock detection |
| `/steel/customers` | Customer records and ledger |
| `/steel/invoices` | Sales invoices |
| `/steel/dispatches` | Dispatch management |
| `/steel/reconciliations` | Stock reconciliation review |
| `/steel/quality` | Batch quality scores and severity |
| `/steel/anomalies` | Fraud/anomaly detection (view only) |
| `/steel/sales-intelligence` | Sales trends and customer analytics |
| `/steel/financial-intelligence` | Revenue, margins, receivables, payables |
| `/steel/vendors` | Vendor management |
| `/steel/expenses` | Operational expense tracking |
| `/email-summary` | Scheduled email updates |
| `/attendance` | View/punch attendance |
| `/attendance/reports` | Attendance reports |
| `/profile` | Personal profile |

### Daily Workflow — Step by Step

**English:**
1. **Check Dashboard:** Open Today Board first. See production status, yesterday's vs today's comparison, and any critical alerts.
2. **Review Approvals:** Go to Approvals page. Check for pending approvals — especially batch variances and high-value items.
3. **Analytics Review:** Open Analytics page. Review weekly/monthly trends for production, downtime, and quality.
4. **Check Workforce:** Open Workforce Intelligence. Review attendance KPIs, worker rankings, overtime, and labour costs.
5. **Production Oversight (Steel):** Visit Steel Hub for operational overview. Check production-intelligence for shift throughput. Check machine alerts for any maintenance issues.
6. **Inventory Check:** Open Inventory page. Check stock levels. Review low-stock alerts and dead-stock detection.
7. **Review Reports:** Check Reports page for exports. Approve any pending report exports requested by supervisors.
8. **Dispatch Follow-up:** Check Dispatches page to ensure all scheduled dispatches are on track.
9. **End-of-Day Review:** Review Financial Intelligence for revenue and margin updates. Leave notes for the Admin/Owner.

**हिंदी:**
1. **Dashboard देखें:** Today Board खोलें — production status, कल vs आज का comparison, critical alerts।
2. **Approvals Review:** Approvals पेज जाएँ — pending approvals देखें, खासकर batch variances।
3. **Analytics Review:** Analytics पेज खोलें — weekly/monthly trends: production, downtime, quality।
4. **Workforce Check:** Workforce Intelligence खोलें — attendance KPIs, worker rankings, OT, labour costs।
5. **Production Oversight:** Steel Hub पर operational overview देखें। Production intelligence, machine alerts।
6. **Inventory Check:** Inventory पेज खोलें — stock levels, low-stock alerts, dead-stock।
7. **Reports Review:** Reports पेज जाएँ — exports देखें, pending approvals करें।
8. **Dispatch Follow-up:** Dispatches पेज देखें — सभी scheduled dispatches ट्रैक पर हैं?
9. **End-of-Day Review:** Financial Intelligence देखें — revenue, margins। Admin/Owner के लिए notes छोड़ें।

### Task Guides — Each Task Explained

#### Task: Approve Batch Variance
**When to do this:** When a production batch has a significant variance (more scrap than expected, less output than input).
**Where to go:** Approvals → Batch Variance section
**Step by step:**
1. Go to **Approvals** page
2. Find the **Batch Variance** section
3. Click on a variance item to expand
4. Review:
   - Expected output vs actual output
   - Input materials used
   - Variance percentage
   - Operator and shift details
   - Reason provided
5. If variance is within acceptable range → **Approve**
6. If variance needs investigation → **Reject** with instruction to investigate
**What happens after:** Approved variances are recorded in production analytics. Rejected variances trigger an investigation workflow for the Supervisor.
**⚠️ Common Mistake:** Approving large variances without investigation. Always question variances >5%.
**✅ Pro Tip:** Use the historical trend view to see if this machine/operator has a pattern of high variance.
**Hindi Guide:**
**कब करें:** जब production batch में ज़्यादा variance हो (ज़्यादा scrap, कम output)।
**कहाँ जाएँ:** Approvals → Batch Variance।
**कैसे करें:**
1. Approvals पेज खोलें
2. Batch Variance section देखें
3. Variance item पर click करें
4. Review: expected vs actual, variance %, कारण
5. Range में है → Approve
6. जाँच ज़रूरी है → Reject

#### Task: Start a Stock Reconciliation
**When to do this:** When physical stock count needs to be compared with system records (usually monthly).
**Where to go:** Steel Hub → Inventory → Start Reconciliation
**Step by step:**
1. Go to **Inventory** page
2. Click **Start Reconciliation**
3. Select items to reconcile (or select all)
4. Enter **Physical Count** for each item
5. System shows the difference vs system count
6. Add **Remarks** explaining any large differences
7. Click **Submit for Review**
**What happens after:** The reconciliation goes to Admin for approval. Inventory is frozen during reconciliation.
**⚠️ Common Mistake:** Not counting all locations. Steel inventory may be spread across multiple yards.
**✅ Pro Tip:** Do reconciliations at the same time each month for consistency. Notify the team in advance.
**Hindi Guide:**
**कब करें:** जब भौतिक stock count को system records से match करना हो (आमतौर पर महीने में एक बार)।
**कहाँ जाएँ:** Inventory → Start Reconciliation।
**कैसे करें:**
1. Inventory पेज पर जाएँ
2. Start Reconciliation दबाएँ
3. Items चुनें
4. Physical Count डालें
5. System difference देखें
6. Remarks डालें
7. Submit for Review दबाएँ

#### Task: Configure a New Machine
**When to do this:** When a new machine is installed in the factory.
**Where to go:** Operations → Machines → + New Machine
**Step by step:**
1. Go to **Machines** page (`/steel/production/machines`)
2. Click **+ New Machine**
3. Fill in:
   - **Production Line** — select the line this machine belongs to
   - **Machine Code** — e.g., RM-01, F-02
   - **Name** — descriptive name
   - **Type** — Rolling Mill, Furnace, Cutter, etc.
   - **Rated Capacity (kg/hr)** — how much it can produce per hour
   - **Planned Runtime (min/day)** — target daily running time
   - **Operating Runtime (min/day)** — actual expected running time
   - **Description** — any notes
4. Click **Create Machine**
**What happens after:** The machine appears in the machine registry. It can be assigned to production entries and tracked for OEE (Overall Equipment Effectiveness).
**Hindi Guide:**
**कब करें:** जब फैक्ट्री में नई मशीन लगे।
**कहाँ जाएँ:** Machines → + New Machine।
**कैसे करें:**
1. Machines पेज पर जाएँ
2. + New Machine दबाएँ
3. Production Line, Machine Code, Name, Type, Capacity, Runtime भरें
4. Create Machine दबाएँ

### What This Role Should NEVER Do

- **Never change user roles or invite new users** — Admin/Owner only
- **Never access billing or subscription settings** — Admin/Owner only
- **Never void invoices or reverse payments** — Admin/Owner only (requires MFA)
- **Never approve reconciliations** — you can initiate but not approve; Admin must approve
- **Never change system settings or master data** — Admin only

### How This Role Connects to Other Roles

- **Supervisors** report to you — you review their approval metrics
- **Accountants** report to you — you review their financial work
- **Admin** configures the system that you operate within
- **Owner** reviews your analytics and reports at the executive level
- **Operators** create the production data you analyze

---

# Role: Admin | एडमिन

### Who Is This Role?

**English:** The Admin is the system administrator for Factory Nerve. They manage users, roles, factories, billing, settings, master data, and alert configurations. The Admin has nearly all permissions except a few Owner-only actions. They ensure the system is set up correctly, users have the right access, and the organization runs smoothly. They report to the Owner and manage all other roles.

**हिंदी:** Admin Factory Nerve का सिस्टम एडमिनिस्ट्रेटर है। ये users, roles, factories, billing, settings, master data, और alert configurations मैनेज करता है। Admin के पास लगभग सभी permissions हैं सिवाय कुछ Owner-only actions के। ये सुनिश्चित करता है कि सिस्टम सही तरीके से सेट है, users के पास सही access है, और संगठन सुचारू रूप से चल रहा है। ये Owner को रिपोर्ट करता है और बाकी सभी roles को मैनेज करता है।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/settings` | Factory admin — organizations, users, factories, templates, master data |
| `/settings/attendance` | Attendance admin — employee profiles, shift templates, rules |
| `/settings/users` | User directory — manage users, roles, access |
| `/dashboard` | Today's board |
| `/reports` | Reports and exports |
| `/approvals` | Approvals queue (including user role change approvals) |
| `/analytics` | Operations analytics |
| `/work-queue` | Cross-app queue |
| `/workforce` | Workforce intelligence (view) |
| `/steel/production/machines` | Machine registry (full access) |
| `/steel/reconciliations` | Approve stock reconciliations |
| `/steel/quality` | Quality tracking (view) |
| `/steel/anomalies` | Fraud/anomaly detection (including investigation-level) |
| `/billing` | Billing config, invoices, subscription |
| `/plans` | Subscription plans and add-ons |
| `/ocr/history` | OCR history |
| `/email-summary` | Email summaries |
| `/alerts` | Configure alert recipients and channels |
| `/profile` | Personal profile |

### Daily Workflow — Step by Step

**English:**
1. **Check User Management:** Open Settings → Users. Check if any new users need to be created, invited, or deactivated. Review any pending role change requests.
2. **Factory Setup:** Ensure all factories are properly configured with correct names, codes, and industry types.
3. **Attendance Configuration:** Check Settings → Attendance Admin. Verify shift templates are correct. Update employee profiles if needed.
4. **Billing Status:** Open Billing page to check subscription status and invoice history. Verify payments are up to date.
5. **Alert Configuration:** Open Alerts page. Configure alert recipients and notification channels (email, WhatsApp).
6. **Approve Reconciliations:** Go to Approvals. Approve any pending stock reconciliations from Managers.
7. **Master Data Management:** Update lookup tables — defect reasons, downtime reasons, product categories.
8. **Reports Review:** Check Reports for any anomalies flagged by the system.
9. **System Monitoring:** Review audit logs and system health.

**हिंदी:**
1. **User Management:** Settings → Users। नए users बनाने, invite करने, या deactivate करने की ज़रूरत है? Pending role change requests देखें।
2. **Factory Setup:** सभी factories सही names, codes, industry types से कॉन्फ़िगर हैं।
3. **Attendance Configuration:** Settings → Attendance Admin। Shift templates सही हैं? Employee profiles अपडेटेड हैं?
4. **Billing Status:** Billing पेज खोलें — subscription status, invoices, payments।
5. **Alert Configuration:** Alerts पेज — recipients और notification channels configure करें।
6. **Approve Reconciliations:** Approvals से pending stock reconciliations approve करें।
7. **Master Data Management:** Lookup tables update करें — defect reasons, downtime reasons।
8. **Reports Review:** Reports में anomalies चेक करें।
9. **System Monitoring:** Audit logs और system health देखें।

### Task Guides — Each Task Explained

#### Task: Create/Invite a New User
**When to do this:** When a new employee joins and needs access to Factory Nerve.
**Where to go:** Settings → Users → Invite User or + New User
**Step by step:**
1. Go to **Settings** page → **Users** section
2. Click **Invite User**
3. Fill in:
   - **Name** — full name
   - **Email** — work email address
   - **Role** — select from: Attendance, Operator, Supervisor, Accountant, Manager, Admin
   - **Factory** — assign to one or multiple factories
   - **Phone Number** (optional)
4. Click **Send Invite**
5. The user receives an email with login instructions
**What happens after:** The user gets an invitation email. They create a password and log in. Their access is limited to their assigned role and factory.
**⚠️ Common Mistake:** Assigning the wrong role. An Operator who needs to scan documents cannot do that if assigned the Attendance role.
**✅ Pro Tip:** Start new users with a lower role and upgrade them as they learn the system.
**Hindi Guide:**
**कब करें:** जब नया employee join करे और Factory Nerve access चाहिए।
**कहाँ जाएँ:** Settings → Users → Invite User।
**कैसे करें:**
1. Settings → Users पर जाएँ
2. Invite User दबाएँ
3. Name, Email, Role, Factory भरें
4. Send Invite दबाएँ
5. User को email आएगा — वो password बनाकर login करेगा

#### Task: Change a User's Role
**When to do this:** When an employee is promoted or their job responsibilities change.
**Where to go:** Settings → Users → Select User → Change Role
**Step by step:**
1. Go to **Settings** → **Users**
2. Find the user and click on their name
3. Click **Change Role**
4. Select the new **Role** from the dropdown
5. Review the permission changes shown (what they gain/lose)
6. Click **Confirm** (this may require MFA — enter your 2FA code)
**What happens after:** The user's permissions update immediately. They may need to log out and log back in for all changes to take effect. An audit log entry is created.
**⚠️ Common Mistake:** Promoting someone who hasn't been trained. Ensure the user understands their new responsibilities.
**✅ Pro Tip:** Use the "Preview" option to see what the user will be able to access before confirming.
**Hindi Guide:**
**कब करें:** जब employee promote हो या ज़िम्मेदारियाँ बदलें।
**कहाँ जाएँ:** Settings → Users → User select करें → Change Role।
**कैसे करें:**
1. Settings → Users पर जाएँ
2. User ढूँढें और नाम पर click करें
3. Change Role दबाएँ
4. नई Role चुनें
5. Permission changes review करें
6. Confirm दबाएँ (MFA कोड डालना पड़ सकता है)

#### Task: Configure Alert Recipients
**When to do this:** When setting up alerts for the first time, or when a new manager needs alert notifications.
**Where to go:** Alerts page → Configure
**Step by step:**
1. Go to **Alerts** page
2. Click **Configure Alert Recipients**
3. For each alert type, add/remove recipients:
   - **Email** — enter email addresses
   - **WhatsApp** — enter phone numbers with country code
4. Set **Alert Severity Thresholds**:
   - Which alerts are Critical (must notify immediately)
   - Which are Warning (daily digest)
   - Which are Info (optional)
5. Click **Save Configuration**
**What happens after:** The system sends alerts according to your configuration. Critical alerts go out immediately. Warnings are batched into a daily digest.
**Hindi Guide:**
**कब करें:** पहली बार alerts set करते समय, या जब नए manager को notifications चाहिए।
**कहाँ जाएँ:** Alerts → Configure।
**कैसे करें:**
1. Alerts पेज पर जाएँ
2. Configure Alert Recipients दबाएँ
3. Alert types के लिए recipients add/remove करें
4. Severity thresholds set करें
5. Save Configuration दबाएँ

#### Task: Approve Stock Reconciliation
**When to do this:** When a Manager has submitted a stock reconciliation for final approval.
**Where to go:** Approvals → Reconciliation section
**Step by step:**
1. Go to **Approvals** page
2. Find the **Reconciliation** section
3. Click on the pending reconciliation
4. Review:
   - System count vs physical count
   - Difference amount and value
   - Manager's remarks on differences
5. If differences are reasonable → **Approve** (system adjusts inventory)
6. If differences need re-count → **Reject** with instructions
**What happens after:** Approved reconciliations update inventory levels permanently. Rejected ones go back to the Manager.
**⚠️ Common Mistake:** Approving without spot-checking. Large differences may indicate theft or process issues.
**✅ Pro Tip:** Schedule reconciliations at regular intervals (monthly) for consistent inventory management.
**Hindi Guide:**
**कब करें:** जब Manager ने stock reconciliation submit की हो final approval के लिए।
**कहाँ जाएँ:** Approvals → Reconciliation।
**कैसे करें:**
1. Approvals पेज पर जाएँ
2. Reconciliation section देखें
3. Pending reconciliation पर click करें
4. System count vs physical count, difference, remarks review करें
5. Reasonable है → Approve (inventory update होगा)
6. Re-count चाहिए → Reject with instructions

#### Task: Void an Invoice
**When to do this:** When an invoice was created by mistake or needs to be cancelled post-dispatch.
**Where to go:** Sales Invoices → Find Invoice → Void
**⚠️ CRITICAL:** This action requires MFA (2-Factor Authentication). Only Admin and Owner can void invoices.
**Step by step:**
1. Go to **Sales Invoices** page
2. Find the invoice you need to void
3. Click **Void Invoice**
4. Enter a **Reason** for voiding (required)
5. System asks for **MFA verification** — enter your 2FA code
6. Click **Confirm Void**
**What happens after:** The invoice is marked as void in the system. It remains in records for audit but is no longer considered active revenue. An audit log entry is created.
**⚠️ Common Mistake:** Voiding instead of editing. If the goods haven't been dispatched yet, use Edit instead of Void.
**✅ Pro Tip:** Voiding is permanent. Once voided, you cannot un-void an invoice. Create a new corrected invoice instead.
**Hindi Guide:**
**कब करें:** जब invoice गलती से बन गई हो या post-dispatch cancel करनी हो।
**कहाँ जाएँ:** Sales Invoices → Invoice ढूँढें → Void।
**कैसे करें:**
1. Sales Invoices पेज पर जाएँ
2. Invoice ढूँढें
3. Void Invoice दबाएँ
4. Reason डालें (ज़रूरी है)
5. MFA कोड डालें
6. Confirm Void दबाएँ

### What This Role Should NEVER Do

- **Never access platform-level admin functions** — you don't have is_platform_admin
- **Never downgrade the plan without Owner approval** — requires MFA
- **Never delete users without documentation** — creates audit issues
- **Never share MFA codes** — MFA is required for critical actions for a reason

### How This Role Connects to Other Roles

- **All roles** — you manage their access and permissions
- **Owner** — you report to them and they have override on your changes
- **Manager** — you approve their reconciliations and they configure factory settings
- **Supervisor** — you configure the approval rules they work with

---

# Role: Owner | मालिक

### Who Is This Role?

**English:** The Owner has complete access to everything in Factory Nerve. This is typically the factory owner, MD, or CEO. The Owner sees the Executive Dashboard, AI Insights, Fraud Detection, Control Tower (for multi-factory), Steel Charts, and all financial intelligence. The Owner can do everything an Admin can do, plus actions that require the highest level of authority — plan changes, invoice voiding, payment reversals, and system-level configurations. The Owner reports to no one within the system.

**हिंदी:** Owner के पास Factory Nerve में हर चीज़ तक पूरी पहुँच है। यह आमतौर पर फैक्ट्री का मालिक, MD, या CEO होता है। Owner Executive Dashboard, AI Insights, Fraud Detection, Control Tower (कई फैक्ट्रियों के लिए), Steel Charts, और सभी financial intelligence देख सकता है। Owner वह सब कर सकता है जो Admin कर सकता है, साथ ही वे actions भी जिनके लिए सबसे ऊँचे अधिकार की ज़रूरत है — plan changes, invoice voiding, payment reversals, system-level configurations। Owner सिस्टम में किसी को रिपोर्ट नहीं करता।

### What Pages Can They See?

| Page | Description |
|---|---|
| `/premium/dashboard` | Owner Desk — executive summary, risk, performance, factory comparison |
| `/control-tower` | Factory Network — compare factories, switch context |
| `/dashboard` | Today's board |
| `/reports` | Reports and exports (including executive PDF exports) |
| `/analytics` | Operations and premium analytics |
| `/workforce` | Workforce intelligence — full access including cost |
| `/ai` | AI Insights — chat with your data, anomaly scans, suggestions |
| `/email-summary` | Email summaries |
| `/steel` | Steel Hub |
| `/steel/batches` | Steel batches full view |
| `/steel/charts` | Steel charts — stock, production, dispatch, revenue movement |
| `/steel/customers` | Customer records — full access including delete |
| `/steel/invoices` | Sales invoices — full access including void (MFA required) |
| `/steel/dispatches` | Dispatches — full access including cancel (MFA required) |
| `/steel/production/machines` | Machine registry |
| `/steel/production-intelligence` | Production intelligence |
| `/steel/machine-alerts` | Machine health alerts |
| `/steel/quality` | Quality tracking |
| `/steel/anomalies` | Fraud/anomaly — investigation-level detail |
| `/steel/sales-intelligence` | Sales intelligence |
| `/steel/financial-intelligence` | Financial intelligence |
| `/steel/inventory-intelligence` | Inventory intelligence |
| `/steel/vendors` | Vendors |
| `/steel/expenses` | Expenses |
| `/steel/reconciliations` | View all reconciliations |
| `/settings` | Full admin settings |
| `/settings/attendance` | Attendance admin |
| `/billing` | Billing and subscription management |
| `/plans` | Plans and add-ons |
| `/alerts` | Alert configuration |
| `/ocr/history` | OCR history |
| `/approvals` | All approvals |
| `/work-queue` | Queue |
| `/attendance` | Attendance |
| `/api-keys` | API key management (if applicable) |
| `/email-summary` | Email summaries |
| `/profile` | Profile |

### Daily Workflow — Step by Step

**English:**
1. **Start with the Owner Desk:** Open `/premium/dashboard` (Owner Desk). This is your command center. See:
   - **Factory Health Score** — AI-generated overall health rating
   - **Risk Signals** — critical alerts that need your attention
   - **Financial Summary** — revenue, costs, margins
   - **Comparison** — if you have multiple factories, compare them
2. **AI Insights Check:** Open AI Insights page. Ask questions about your data (see AI Insights section for example questions). Review the executive summary.
3. **Control Tower (Multi-Factory):** If managing multiple factories, open Control Tower to switch context and compare performance across plants.
4. **Fraud & Anomaly Review:** Check Anomaly Detection page. Review any high-severity fraud signals. Drill into investigation details.
5. **Financial Review:** Open Financial Intelligence. Review revenue trends, receivables aging, payables status, and margins.
6. **Steel Charts:** Check Steel Charts for visual overview of stock levels, production trends, and dispatch movement.
7. **Review Pending Approvals:** Check Approvals for any high-priority items needing your authority (voided invoices, reversed payments).
8. **Billing Check:** Review Billing page to ensure subscription is active and all invoices are paid.
9. **End-of-Day:** Generate executive summary report and receive it via email.

**हिंदी:**
1. **Owner Desk से शुरू करें:** `/premium/dashboard` खोलें। यह आपका कमांड सेंटर है। देखें:
   - Factory Health Score — AI से बना हेल्थ रेटिंग
   - Risk Signals — critical alerts
   - Financial Summary — revenue, costs, margins
   - Comparison — कई factories हैं तो compare करें
2. **AI Insights:** AI Insights पेज खोलें। अपने डेटा के बारे में सवाल पूछें। Executive summary review करें।
3. **Control Tower:** कई factories हैं तो Control Tower खोलें — switch context, compare performance।
4. **Fraud & Anomaly Review:** Anomaly Detection चेक करें। High-severity fraud signals देखें। Investigation detail में जाएँ।
5. **Financial Review:** Financial Intelligence खोलें — revenue trends, receivables aging, payables।
6. **Steel Charts:** Steel Charts देखें — stock levels, production trends, dispatch movement।
7. **Pending Approvals:** Approvals चेक करें — voided invoices, reversed payments।
8. **Billing Check:** Billing पेज देखें — subscription active है? सभी invoices paid हैं?
9. **End-of-Day:** Executive summary report जनरेट करें।

### Task Guides — Each Task Explained

#### Task: Use AI Insights Chat
**When to do this:** When you need quick answers about your factory's performance.
**Where to go:** AI Insights → Chat
**Step by step:**
1. Go to **AI Insights** page (`/ai`)
2. Type your question in natural language (English or Hindi)
3. Press **Send** or hit Enter
4. AI analyzes your data and responds with:
   - Answer with supporting data
   - Charts/graphs where relevant
   - Sources from your production data
5. Ask follow-up questions to drill deeper
**What happens after:** AI usage is tracked against your plan's NLQ quota. Results are saved to your chat history.
**Example questions:** See the AI Insights section below for 40+ example questions.
**Hindi Guide:**
**कब करें:** जब फैक्ट्री के प्रदर्शन के बारे में जल्दी जवाब चाहिए।
**कहाँ जाएँ:** AI Insights → Chat।
**कैसे करें:**
1. AI Insights पेज पर जाएँ
2. अपना सवाल टाइप करें (English या Hindi में)
3. Send दबाएँ
4. AI जवाब देगा — data, charts, sources के साथ
5. और सवाल पूछें

#### Task: View the Executive Dashboard
**When to do this:** Every morning — this is your daily review screen.
**Where to go:** Owner Desk → Executive Dashboard
**Step by step:**
1. Open **Owner Desk** (`/premium/dashboard`)
2. The dashboard loads with these sections:
   - **Health Score** (top) — Green/Yellow/Red indicator
   - **Today vs Yesterday** — production comparison
   - **Critical Alerts** — red items needing immediate action
   - **Financial Snapshot** — revenue MTD, costs, margins
   - **Top Risks** — highest-priority risks detected by AI
   - **Quick Actions** — one-click links to common tasks
3. Click on any section to drill into details
**What happens after:** None — this is a read-only dashboard. Use the insights to decide what to do next.
**Hindi Guide:**
**कब करें:** हर सुबह — यह आपकी daily review screen है।
**कहाँ जाएँ:** Owner Desk → Executive Dashboard।
**कैसे करें:**
1. Owner Desk खोलें
2. Dashboard में देखें: Health Score, Today vs Yesterday, Critical Alerts, Financial Snapshot, Top Risks, Quick Actions
3. किसी भी section पर click करके detail में जाएँ

#### Task: Cancel a Dispatch (with MFA)
**When to do this:** When a dispatch needs to be cancelled after the truck has been scheduled or has left.
**Where to go:** Dispatches → Find Dispatch → Cancel
**Step by step:**
1. Go to **Dispatch** page
2. Find the dispatch you need to cancel
3. Click **Cancel Dispatch**
4. Enter **Reason** (required — e.g., "Customer cancelled order")
5. System prompts for **MFA** — enter your 2FA code
6. Click **Confirm Cancel**
**What happens after:** The dispatch is cancelled. Inventory is restored (if the goods hadn't left). An audit log entry is created. The customer record is updated.
**⚠️ Common Mistake:** Cancelling instead of updating status. If the truck has already left, use "Update Status" not "Cancel".
**Hindi Guide:**
**कब करें:** जब dispatch cancel करनी हो — truck scheduled हो या जा चुका हो।
**कहाँ जाएँ:** Dispatches → Cancel Dispatch।
**कैसे करें:**
1. Dispatch पेज पर जाएँ
2. Dispatch ढूँढें
3. Cancel Dispatch दबाएँ
4. Reason डालें
5. MFA कोड डालें
6. Confirm Cancel दबाएँ

### What This Role Should NEVER Do

- **Never make hasty changes without reviewing impact** — you have the power to change anything
- **Never delete audit logs** — always maintain records for compliance
- **Never share MFA codes** — MFA protects the most critical actions in the system

### How This Role Connects to Other Roles

- **Admin** — handles day-to-day system management and reports to you
- **Manager** — oversees factory operations and provides you reports
- **All roles** — ultimately, everyone's work feeds into your dashboard
- **External** — you manage the subscription and billing relationship with the Factory Nerve team

---

## Cross-Role Workflows

### Workflow: Raw Material Inward

Stake points: Security Guard → Operator → Supervisor → Accountant

1. **Security Guard** (outside system): Truck arrives at gate. Paper gate slip created.
2. **Operator:** Goes to Document Desk → Scan Document → takes photo of the gate slip → OCR extracts truck number, material, quantity, supplier → Submits.
3. **Supervisor:** Opens Review Documents → verifies OCR data against the physical gate slip → Approves.
4. **Accountant:** Data flows into inventory as "inward" entry. Supplier's bill linked to the receipt.
5. **Manager:** Sees incoming stock in Inventory Intelligence — low-stock alerts update.

### Workflow: Dispatch Process

Stake points: Manager → Supervisor → Operator → Security Guard → Accountant

1. **Manager:** Creates dispatch record in Dispatches → enters customer details, products, quantities → Saves.
2. **Manager/Supervisor:** Assigns gate pass number. Notifies loading team.
3. **Operator:** Loads the truck. Scans the loading completion document via OCR.
4. **Security Guard** (outside system): Checks gate pass. Lets truck exit.
5. **Supervisor:** Updates dispatch status to "Departed" in the system.
6. **Accountant:** Creates invoice from the dispatch → sends to customer.
7. **Customer** (outside system): Makes payment.
8. **Accountant:** Records payment → marks invoice as paid.

### Workflow: Attendance → Payroll

Stake points: Worker → Supervisor → Accountant → Admin

1. **Worker:** Punches in/out daily. Requests regularization if needed.
2. **Supervisor:** Reviews regularization requests → approves/rejects daily.
3. **Supervisor:** By end of the month, all attendance is finalized.
4. **Accountant:** Opens Attendance Reports → selects the month → exports to Excel.
5. **Accountant:** Uses Excel data in payroll system (outside Factory Nerve) to calculate wages.
6. **Admin** (if needed): Adjusts shift templates or employee profiles for the next month.

### Workflow: Fraud Alert → Investigation → Resolution

Stake points: System AI → Owner/Admin → Manager/Accountant

1. **System (AI):** Detects an anomaly — e.g., production quantity is unusually high, or inventory doesn't match dispatch.
2. **Alert generated:** The anomaly appears in Anomaly Detection page. Alert is sent via email/WhatsApp.
3. **Owner/Admin:** Opens Anomaly Detection → sees severity (Critical/Warning/Info) → clicks to investigate.
4. **Owner/Admin:** Reviews investigation-level detail — user behavior, approver history, transaction trail.
5. **If confirmed issue:** Owner/Admin takes action — voids invoice, reverses payment, or escalates.
6. **If false positive:** Marks alert as reviewed. System learns from this feedback.
7. **Resolution logged:** All actions recorded in audit log for compliance.

### Workflow: Owner Morning Review

1. **Open Owner Desk** (`/premium/dashboard`) — review Health Score, Financial Snapshot, Critical Alerts.
2. **Check AI Insights** — ask "What happened yesterday?" or "Any anomalies I should know about?"
3. **Review Anomaly Detection** — check for high-severity fraud signals.
4. **Check Financial Intelligence** — revenue trends, aging receivables.
5. **Control Tower** (if multi-factory) — switch to a different factory, compare, review.
6. **Check Pending Approvals** — approve or reject any items needing your authority.
7. **Email Summary** — if configured, review the auto-generated daily email summary.

---

## AI Insights — Owner Guide

### How to Use AI Chat

The AI Insights feature lets you ask questions about your factory data in plain English (or Hindi/Hinglish). The AI understands your production, attendance, inventory, and financial data and gives you answers with supporting numbers.

**To use:**
1. Go to **AI Insights** (`/ai`) page
2. Type your question in the chat box
3. Press Send
4. Read the AI's response with data and charts
5. Ask follow-up questions to drill deeper

### 20 Example Questions in English

1. "What was our total production in the last 7 days?"
2. "Show me downtime by machine this month."
3. "Which operator had the highest rejection rate last week?"
4. "What's our current inventory level of TMT bars?"
5. "How much scrap was generated yesterday?"
6. "Compare production between Shift A and Shift B this week."
7. "What are our top 5 customers by revenue this quarter?"
8. "Show me pending invoices over 30 days."
9. "What was the OEE for Machine RM-01 last month?"
10. "How many workers were absent yesterday?"
11. "What's the trend for our production over the last 3 months?"
12. "Show me dispatch volume by day for this week."
13. "Which product category has the highest margin?"
14. "What anomalies were detected in the last 24 hours?"
15. "Give me the health score for Factory A."
16. "What's our total revenue month-to-date?"
17. "Show me overtime hours by shift this month."
18. "Compare scrap rates between Machine A and Machine B."
19. "Who are our top 3 performing operators this month?"
20. "Show me the daily production vs target chart."

### 20 Example Questions in Hindi/Hinglish

1. "पिछले 7 दिन में कुल प्रोडक्शन कितना हुआ?"
2. "इस महीने मशीन के हिसाब से डाउनटाइम दिखाओ।"
3. "पिछले हफ्ते किस ऑपरेटर का रिजेक्शन रेट सबसे ज़्यादा था?"
4. "अभी TMT बार का कितना स्टॉक है?"
5. "कल कितना स्क्रैप हुआ?"
6. "इस हफ्ते Shift A और Shift B का प्रोडक्शन compare करो।"
7. "इस क्वार्टर में टॉप 5 कस्टमर कौन हैं रेवेन्यू के हिसाब से?"
8. "30 दिन से ज़्यादा पुराने पेंडिंग इनवॉइस दिखाओ।"
9. "पिछले महीने Machine RM-01 का OEE क्या था?"
10. "कल कितने वर्कर absent थे?"
11. "पिछले 3 महीने में प्रोडक्शन कैसा रहा?"
12. "इस हफ्ते रोज़ के हिसाब से डिस्पैच वॉल्यूम दिखाओ।"
13. "किस प्रोडक्ट कैटेगरी का मार्जिन सबसे ज़्यादा है?"
14. "पिछले 24 घंटे में कोई anomaly मिली?"
15. "Factory A का हेल्थ स्कोर क्या है?"
16. "इस महीने अब तक कुल रेवेन्यू कितना है?"
17. "इस महीने shift के हिसाब से OT घंटे दिखाओ।"
18. "Machine A और Machine B का स्क्रैप रेट compare करो।"
19. "इस महीने टॉप 3 ऑपरेटर कौन हैं?"
20. "रोज़ का प्रोडक्शन vs टारगेट चार्ट दिखाओ।"

### Health Score — What It Means

The **Factory Health Score** is an AI-generated number (0-100) that represents the overall health of your factory. It considers:

- **Production Efficiency** (40% weight) — actual output vs target
- **Quality Score** (25% weight) — rejection rate, scrap percentage
- **Attendance Health** (15% weight) — absenteeism rate
- **Equipment Status** (10% weight) — MTBF, maintenance overdue
- **Financial Health** (10% weight) — margin trends, receivables aging

**Score ranges:**
- **90-100: Excellent** 🟢 — Factory is running well. Maintain current practices.
- **70-89: Good** 🟡 — Some areas need attention. Check the sub-scores.
- **50-69: Warning** 🟠 — Multiple areas need improvement. Investigate.
- **Below 50: Critical** 🔴 — Immediate action required. Review Critical Alerts.

---

## Alerts & Notifications Guide

### Alert Severity Levels

| Severity | Color | Response Time | Examples |
|---|---|---|---|
| **Critical** | 🔴 Red | Immediate (within 1 hour) | Theft detected, large inventory mismatch, machine down, production halt |
| **Warning** | 🟡 Yellow | Same day | High scrap rate, low stock, overtime exceeding budget, pending approvals aging |
| **Info** | 🔵 Blue | Review when possible | Shift completed, new user added, OCR batch processed, daily summary |

### What Each Alert Means

**Production Alerts:**
- **Critical: Zero Production** — No entries created for a shift that was scheduled. Someone may have forgotten to record.
- **Warning: High Downtime** — Machine downtime exceeds threshold for this shift.
- **Warning: Scrap Rate Spike** — Scrap percentage jumped compared to normal.

**Attendance Alerts:**
- **Warning: High Absenteeism** — More than 15% of workers absent.
- **Info: Regularization Pending** — Someone's regularization request is waiting >24 hours.

**Inventory Alerts:**
- **Critical: Stock Below Minimum** — An item has fallen below its reorder point.
- **Warning: Dead Stock Detected** — Inventory item hasn't moved in >90 days.
- **Info: Reconciliation Due** — Monthly reconciliation is overdue.

**Fraud Alerts:**
- **Critical: Dispatch Mismatch** — Weighbridge weight doesn't match dispatch quantity.
- **Critical: Duplicate Invoice** — Two invoices with same number found.
- **Warning: Login Pattern Anomaly** — User logged in from unusual location.

**System Alerts:**
- **Critical: OCR Quota Exceeded** — Monthly scan limit reached.
- **Warning: Subscription Expiring** — Plan renewal coming up in 7 days.

### Owner's Action on Alerts

1. **Critical Alert:** Stop what you're doing. Open the alert, investigate immediately, take action.
2. **Warning Alert:** Add to your day's review list. Investigate before end of shift.
3. **Info Alert:** Acknowledge and move on. No action needed unless pattern emerges.

---

## OCR & Document Scanning Guide

### What Is OCR?

OCR (Optical Character Recognition) is the technology that reads text from images and paper documents and converts it into digital data. In Factory Nerve, you can use OCR to digitize:
- Invoices from suppliers
- Sales challans
- Gate entry slips
- Production registers
- Weighbridge tickets
- Any other paper document

### How to Scan a Document

1. Go to **Document Desk** (`/ocr/scan`)
2. Click **Scan Document** or **Upload**
3. Take a photo (ensure good lighting, flat document, no shadows)
4. Wait for AI processing (5-15 seconds)
5. **Review the OCR result:**
   - Check every field
   - Fix any misread characters
   - Verify numbers (especially totals and quantities)
6. Choose **Document Type** (Invoice, Challan, Gate Slip, etc.)
7. Click **Submit**

### What to Do If OCR Fails or Confidence Is Low

- **Confidence < 70%:** The document is too blurry or damaged. Re-scan with better quality.
- **Fields are wrong:** Manually correct each field. The system learns from corrections.
- **Document not recognized at all:** Try the "Enhance" feature to adjust brightness/contrast. If still failing, create a manual entry instead.

### Documents Requiring Verification

After scanning, documents go to a verification queue:
- **Operator scanned** → Supervisor verifies
- **Supervisor scanned** → Manager or Accountant verifies
- **Invoice scanned** → Accountant verifies

### OCR Tips for Best Results

✅ Use a dark, contrasting background (avoid white-on-white)
✅ Take photos in natural daylight, not under tube light (flicker causes blur)
✅ Keep the document flat — no folds or curls
✅ Capture the entire page, not just parts
✅ For multi-page documents, scan all pages

---

## Common Problems & Solutions

### Problem 1: "I forgot to punch in. What do I do?"
**Solution:** Go to Attendance → Request Regularization → Select today's date → Enter the time you actually arrived → Submit. Your supervisor will approve it.

### Problem 2: "The OCR didn't read my document correctly."
**Solution:** Click the "Edit" button and manually correct the fields. Use the "Enhance" feature to improve image quality. Re-scan with better lighting if needed.

### Problem 3: "I cannot see the page I need."
**Solution:** Your role may not have permission for that page. Contact your Admin to check your role and permissions. Users with Operator role cannot see Reports, for example.

### Problem 4: "My entry was rejected. What do I do?"
**Solution:** Read the rejection reason from the Supervisor. Open the entry, correct the issue mentioned, and resubmit. Common fixes: wrong quantity, missing downtime reason.

### Problem 5: "I'm getting an error 'User limit reached'."
**Solution:** Your organization has hit the maximum users for your plan. Contact your Admin/Owner to upgrade the plan or remove inactive users.

### Problem 6: "The dashboard is showing yesterday's data."
**Solution:** Dashboard data refreshes every few minutes. Try refreshing the page. If still showing old data, check your internet connection.

### Problem 7: "I can't approve something that's pending."
**Solution:** Check your role permissions. Only certain roles can approve specific items:
- DPR entries → Supervisor+
- Batch variance → Manager+
- Stock reconciliation → Admin+ only for final approval
- Invoice void → Admin+ with MFA

### Problem 8: "Where can I download reports?"
**Solution:** Go to Reports page → Select date range → Click Export to Excel or Export to PDF. The file will download to your computer.

### Problem 9: "The system shows a fraud alert. Is it real?"
**Solution:** Open Anomaly Detection → Review the alert details. The AI may flag unusual patterns that are actually legitimate (e.g., a bulk order causing high dispatch volume). Investigate before acting.

### Problem 10: "I need to add a new user."
**Solution:** Only Admin and Owner roles can add users. Go to Settings → Users → Invite User → Fill in details → Send Invite.

### Problem 11: "My dashboard shows 'No data' for some sections."
**Solution:** If you just started using Factory Nerve, there may not be enough data yet. Once you create entries and scan documents, the dashboards will populate.

### Problem 12: "The shift timings don't match our actual shifts."
**Solution:** Contact your Admin to update Shift Templates in Settings → Attendance Admin → Shift Templates.

### Problem 13: "I accidentally submitted the wrong data in an entry."
**Solution:** If the entry is still pending, you can edit it. If it's already approved, contact your Supervisor to reject it so you can edit and resubmit.

### Problem 14: "The AI chat is not responding."
**Solution:** Check your plan's NLQ quota. If you've used all your queries, you'll need to wait for the next billing cycle or upgrade your plan.

### Problem 15: "How do I switch between factories?"
**Solution:** In the sidebar, find the "Switch Factory" dropdown. Select the factory you want to work with. The entire interface will reload for that factory context.

---

## Glossary

| English Term | Hindi Term | Meaning |
|---|---|---|
| Attendance | हाज़िरी / उपस्थिति | Recording when a worker arrives and leaves |
| Batch | बैच | A specific production run with defined input and output |
| Challan | चालान | A document that accompanies goods during transport |
| Control Tower | कंट्रोल टॉवर | Multi-factory management dashboard |
| Dispatch | डिस्पैच | The process of shipping goods to a customer |
| DPR (Daily Production Report) | दैनिक उत्पादन रिपोर्ट | Shift-level production record |
| Downtime | डाउनटाइम | Time when a machine is not running |
| Gating | गेटिंग | Restricting features based on subscription plan |
| Health Score | हेल्थ स्कोर | AI-calculated overall factory health (0-100) |
| Invoice | इनवॉइस / बीजक | A bill sent to a customer for goods supplied |
| MFA (Multi-Factor Authentication) | दो-चरणीय प्रमाणीकरण | Extra security — a code sent to your phone |
| MTBF (Mean Time Between Failures) | विफलताओं के बीच औसत समय | How long a machine runs before breaking down |
| NLQ (Natural Language Query) | प्राकृतिक भाषा प्रश्न | Asking questions in plain language |
| OCR (Optical Character Recognition) | ऑप्टिकल कैरेक्टर रिकॉग्निशन | Technology that reads text from images |
| OEE (Overall Equipment Effectiveness) | समग्र उपकरण प्रभावशीलता | A measure of how well a machine is used |
| Payables | देय राशि | Money the company owes to suppliers |
| Receivables | प्राप्य राशि | Money customers owe to the company |
| Reconciliation | समाधान / मिलान | Matching physical stock with system records |
| Regularization | नियमीकरण | Correcting a missed or incorrect attendance punch |
| Scrap | स्क्रैप / रद्दी | Rejected or waste material from production |
| Severity | गंभीरता | How serious an alert or quality issue is |
| Variance | अंतर / विचलन | The difference between expected and actual results |
| Workflow | कार्यप्रवाह | A sequence of steps that multiple roles follow |
| Work Queue | कार्य कतार | A list of tasks waiting for your attention |

---

## Quick Reference Card

### Attendance Worker
| Task | Page | Key Action |
|---|---|---|
| Punch In | Attendance | Tap Punch In |
| Punch Out | Attendance | Tap Punch Out |
| Check Status | Attendance | Look at status badge (✅/⏳/❌) |
| Fix Missed Punch | Attendance | Request Regularization |

### Operator
| Task | Page | Key Action |
|---|---|---|
| Create Entry | Entry | + New Entry → Fill form → Submit |
| Scan Document | OCR/Scan | Take photo → Check → Submit |
| Check Tasks | Work Queue | Review pending items |
| Punch Attendance | Attendance | Punch In / Punch Out |
| Check Today | Dashboard | View priorities and alerts |

### Supervisor
| Task | Page | Key Action |
|---|---|---|
| Approve Entries | Approvals | Review → Approve/Reject |
| Verify OCR | OCR/Verify | Check data → Approve/Reject/Edit |
| Review Attendance | Attendance/Review | Approve/Reject regularization |
| Manage Dispatches | Dispatches | Create → Update Status |
| View Reports | Reports | Export data as needed |

### Accountant
| Task | Page | Key Action |
|---|---|---|
| Create Invoice | Sales Invoices | + New → Link dispatch → Submit |
| Record Payment | Customers | Find customer → Record Payment |
| Export Attendance | Attendance Reports | Select dates → Export to Excel |
| View Financials | Financial Intelligence | Review revenue/margins |
| Email Summary | Email Summary | Generate → Send |

### Manager
| Task | Page | Key Action |
|---|---|---|
| Review Production | Analytics | Check trends and KPIs |
| Approve Variances | Approvals | Approve/Reject batch variances |
| Start Reconciliation | Inventory | Start Reconciliation → Enter counts |
| Manage Machines | Machines | Add/edit machine records |
| Check Workforce | Workforce | Review attendance and labour costs |

### Admin
| Task | Page | Key Action |
|---|---|---|
| Manage Users | Settings/Users | Invite, edit, deactivate users |
| Change Roles | Settings/Users | Select user → Change Role (MFA) |
| Configure Alerts | Alerts | Add recipients, set thresholds |
| Approve Reconciliations | Approvals | Review → Approve/Reject |
| Billing | Billing | Check subscription and invoices |

### Owner
| Task | Page | Key Action |
|---|---|---|
| Morning Review | Owner Desk | Check health, financials, alerts |
| AI Questions | AI Insights | Ask about factory performance |
| Fraud Check | Anomalies | Review investigation details |
| Multi-Factory View | Control Tower | Switch/compare factories |
| Void Invoice (MFA) | Sales Invoices | Find invoice → Void | 
| Cancel Dispatch (MFA) | Dispatches | Find dispatch → Cancel |
| Executive Report | Reports | Export executive PDF summary |

---

*End of Factory Nerve Complete User Manual. This document covers all 7 roles, 6 subscription plans, and all workflows as of the current system version. For questions or support, contact support@codebuff.com or visit codebuff.com/docs.*

---

