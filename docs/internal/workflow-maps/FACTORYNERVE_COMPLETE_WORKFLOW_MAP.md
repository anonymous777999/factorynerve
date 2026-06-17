# FACTORYNERVE COMPLETE WORKFLOW MAP

## SECTION 1 — BUSINESS MODULE INVENTORY

### Core Industrial Modules (Steel Focus)
* **Steel Production Management** (Batch tracking, input/output, variance analysis)
* **Steel Inventory Management** (Item registry, stock levels, transaction history)
* **Steel Sales & Invoicing** (Customer invoicing, credit limits, outstanding balances)
* **Steel Dispatch & Logistics** (Gate passes, truck/driver tracking, delivery status)
* **Steel Customer Management** (Customer profiles, credit terms, follow-up tasks)

### Operational & Support Modules
* **OCR & Document Intelligence** (Automated extraction, structural grouping, schema validation)
* **Attendance & Workforce Management** (Attendance and absence tracking)
* **Operations Alerting** (System monitoring, automated dispatchers, detector-based alerts)
* **Billing & Subscription Management** (SaaS tiering, Razorpay integration, usage billing)

### System & Platform Modules
* **User & Access Management** (Auth, RBAC, Tenancy, Multi-factory support)
* **Communication Services** (WhatsApp, SMS, Email)
* **AI Orchestration** (AI Routing, Intelligence Service, Model usage tracking)
* **System Observability** (Audit logging, error monitoring, rate limiting)

---

## SECTION 2 — COMPLETE WORKFLOW INVENTORY

### STEEL PRODUCTION MANAGEMENT
* **Record Production Batch**: Log input/output quantities, calculate loss/variance, and update inventory.
* **Production Issue**: Deduct raw material from stock upon batch creation.
* **Production Output**: Add finished goods to stock upon batch completion.
* **Variance Analysis**: Automatic severity calculation based on production loss.

### STEEL INVENTORY MANAGEMENT
* **Stock Tracking**: Monitor real-time balances of steel items.
* **Transaction Auditing**: Trace movement via `SteelInventoryTransaction` (Production vs Dispatch).
* **Stock Reconciliation**: (Implied by `steel_stock_reconciliation` endpoint).

### STEEL SALES & INVOICING
* **Create Sales Invoice**: Generate invoice with line items (Finished Goods only).
* **Customer Credit Check**: Validate invoice against customer credit limits before creation.
* **Invoice Detail View**: View financials, lines, and dispatch history.
* **Payment Recording**: Record payments and allocate them to specific invoices.
* **Payment Allocation**: Distribute single payments across multiple outstanding invoices.
* **Outstanding Management**: Track overdue days and unpaid balances.

### STEEL DISPATCH & LOGISTICS
* **Create Dispatch**: Generate dispatch records and gate passes linked to invoices.
* **Dispatch Status Lifecycle**: Manage flow from `pending` $\rightarrow$ `loaded` $\rightarrow$ `dispatched` $\rightarrow$ `delivered`.
* **Inventory Posting**: Automatically deduct stock when dispatch status hits specific milestones.
* **Gate Pass Generation**: Auto-generate unique gate pass numbers for vehicle entry/exit.
* **Vehicle/Driver Tracking**: Log truck number, driver name, license, and capacity.
* **Dispatch-to-Invoice Linkage**: Ensure dispatch quantities do not exceed invoice remaining weight.

### OCR & DOCUMENT INTELLIGENCE
* **Document Pipeline**: Automated end-to-end OCR processing.
* **Structural Analysis**: Detect layout and group cells/tables.
* **Schema Validation**: Verify extracted data against expected formats.
* **Human-in-the-loop Review**: Review and correct OCR-extracted cells.

### OPERATIONS ALERTING
* **Anomaly Detection**: Detect operational issues via `detectors.py`.
* **Alert Dispatch**: Send alerts via configured channels (WhatsApp/SMS/Email).
* **Recipient Management**: Define who receives specific operational alerts.

---

## SECTION 3 — USER ACTION INVENTORY

### Production & Inventory Actions
* `create_steel_batch` (Record production)
* `check_stock_balance` (View availability)
* `reconcile_stock` (Adjust inventory)

### Sales & Finance Actions
* `create_steel_invoice` (Issue invoice)
* `record_customer_payment` (Log incoming funds)
* `allocate_payment` (Match payment to invoice)
* `view_customer_credit_status` (Check limits)

### Dispatch & Logistics Actions
* `create_steel_dispatch` (Initiate delivery)
* `update_dispatch_status` (Move through lifecycle: Loaded $\rightarrow$ Delivered)
* `log_truck_entry_exit` (Record timestamps)
* `generate_gate_pass` (Issue exit permit)

### Administrative & System Actions
* `manage_user_roles` (Update RBAC)
* `configure_alert_rules` (Set detection parameters)
* `manage_subscription` (Update billing plans)
* `review_ocr_results` (Correct AI extraction)

---

## SECTION 4 — ROLE-BASED WORKFLOW MAP

### **Factory Owner / Admin**
* **Accessible Modules**: All (Steel, User, Billing, Settings, Analytics, Alerts).
* **Actions**: Full CRUD on all entities, user management, financial overrides, system configuration.
* **Approval**: Ultimate authority on all recorded transactions.

### **Accountant**
* **Accessible Modules**: Steel Invoicing, Steel Payments, Billing, Reports.
* **Actions**: Create/View Invoices, Record Payments, View Outstanding, Access Financial Reports.
* **Hidden**: Production details (batch specifics), technical system logs.

### **Supervisor / Manager**
* **Accessible Modules**: Steel Production, Steel Dispatch, Steel Inventory, Attendance.
* **Actions**: Create Batches, Create Dispatches, Manage Dispatch Status, View Inventory.
* **Approval**: Approval of dispatch status changes.

### **Operator**
* **Accessible Modules**: Steel Production, Attendance.
* **Actions**: Record Production Batches, Mark Attendance.
* **Hidden**: Invoicing, Payments, Customer Data, Financials, System Settings.

### **Inventory Manager**
* **Accessible Modules**: Steel Inventory, Steel Dispatch, Steel Production.
* **Actions**: View Stock, Manage Dispatches, Monitor Production Output.
* **Hidden**: Customer Credit Limits, Billing/Subscription management.

---

## SECTION 5 — NAVIGATION DISCOVERABILITY AUDIT

| Workflow | Entry Points Found | Missing Entry Points | Discoverability Score | Flag |
| :--- | :--- | :--- | :---: | :--- |
| **Create Invoice** | Sales Module, Customer Page | Dashboard Quick Action | 7/10 | None |
| **Record Production** | Production Module | Mobile Quick-entry | 6/10 | Potential Mobile Friction |
| **Dispatch Status Update** | Dispatch List, Dispatch Detail | Mobile/Driver App shortcut | 5/10 | High Operational Friction |
| **Payment Allocation** | Invoice Detail, Payment Page | Dashboard "Unallocated" widget | 6/10 | Hidden Complexity |
| **OCR Review** | Document Upload, Jobs List | Dashboard "Needs Review" | 4/10 | **Workflow Dead End** |

---

## SECTION 6 — WORKFLOW DEPENDENCY MAP

**Production Flow:**
`Input Material (Inventory)` $\rightarrow$ `Steel Production Batch` $\rightarrow$ `Output Material (Inventory)` $\rightarrow$ `Finished Goods Stock`

**Sales & Delivery Flow:**
`Steel Customer` $\rightarrow$ `Steel Sales Invoice` $\rightarrow$ `Steel Dispatch` $\rightarrow$ `Inventory Deduction` $\rightarrow$ `Gate Pass/Delivery` $\rightarrow$ `Steel Customer Payment` $\rightarrow$ `Invoice Settlement`

**Alerting Flow:**
`System/Operational Event` $\rightarrow$ `Detector` $\rightarrow$ `Alert Dispatcher` $\rightarrow$ `Recipient` $\rightarrow$ `Notification (WhatsApp/SMS)`

---

## SECTION 7 — MISSING WORKFLOWS

* **Purchase Management**: No workflow for ordering raw materials (implied by "Input Material" in production).
* **Vendor/Supplier Management**: No workflow for managing steel suppliers.
* **Returns/Credit Notes**: No workflow for handling returned goods or incorrect invoices.
* **Stock Adjustments**: No explicit "Manual Stock Adjustment" workflow (Relies on production/dispatch).
* **Approval Workflow**: Most actions (Invoicing/Dispatch) appear to be direct; no multi-step "Pending Approval" stage found in code.

---

## SECTION 8 — CRITICAL WORKFLOWS

| Rank | Workflow | Why |
| :--- | :--- | :--- |
| **CRITICAL** | **Steel Production Batch** | This is the engine of the system. It drives both input and output inventory. |
| **CRITICAL** | **Steel Dispatch Lifecycle** | Controls the physical movement of goods and triggers the financial/inventory finalization. |
| **HIGH** | **Steel Sales Invoicing** | The primary revenue driver; requires strict credit limit enforcement. |
| **HIGH** | **OCR Document Pipeline** | The core automation value proposition; failure here halts data entry. |
| **MEDIUM** | **Attendance Tracking** | Operational necessity but decoupled from the primary steel business logic. |
