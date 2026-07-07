"""Replace remaining validation/export/downstream stubs in ocr_document_types/__init__.py"""
import os

FILE = os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'ocr_document_types', '__init__.py')

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

replaced = 0

# 1. DISPATCH NOTE
old_dn = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="DispatchNoteView",
    preview_fields=["dn_number", "dn_date", "dispatcher.name", "recipient.name"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],

    downstream_actions=[
        # Downstream actions would go here - simplified for now
    ],'''

new_dn = '''    validation_rules=[
        ValidationRule(
            name="dn_mandatory_fields",
            fn=lambda data: [f"Missing: {f}" for f in ["dn_number", "dn_date"] if not data.get(f)],
            severity="error"
        ),
        ValidationRule(
            name="dn_dispatcher_recipient",
            fn=lambda data: [e for e, f in [("Dispatcher", "dispatcher"), ("Recipient", "recipient")] if not data.get(f, {}).get("name")],
            severity="error"
        ),
        ValidationRule(
            name="dn_items",
            fn=lambda data: ["No dispatched items"] if not data.get("items_dispatched") else [],
            severity="error"
        ),
        ValidationRule(
            name="dn_vehicle",
            fn=lambda data: ["Vehicle number is missing"] if not data.get("vehicle_details", {}).get("vehicle_number") else [],
            severity="warning"
        ),
    ],

    ui_component="DispatchNoteView",
    preview_fields=["dn_number", "dn_date", "dispatcher.name", "recipient.name"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_dispatch_note_pdf,
            filename_template="{dn_number}.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_dispatch_note_excel,
            filename_template="{dn_number}.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_dispatch_note_json,
            filename_template="{dn_number}.json"
        ),
    ],

    downstream_actions=[
        DownstreamAction(
            key="process_dispatch_note",
            label="Process Dispatch Note",
            description="Record dispatch and update inventory",
            handler=process_dispatch_note,
            required_permissions=["logistics.dispatch"]
        ),
    ],'''

if old_dn in content:
    content = content.replace(old_dn, new_dn, 1)
    replaced += 1
    print("Replaced dispatch_note stubs")
else:
    print("ERROR: dispatch_note stubs not found")

# 2. STOCK SHEET
old_ss = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="StockSheetView",
    preview_fields=["ss_date", "warehouse.name", "stock_items.0.item_description", "stock_items.0.closing_balance"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],'''

new_ss = '''    validation_rules=[
        ValidationRule(
            name="ss_mandatory_fields",
            fn=lambda data: [f"Missing: {f}" for f in ["ss_date", "warehouse"] if not data.get(f)],
            severity="error"
        ),
        ValidationRule(
            name="ss_stock_items",
            fn=lambda data: ["No stock items"] if not data.get("stock_items") else [],
            severity="error"
        ),
        ValidationRule(
            name="ss_closing_balance",
            fn=lambda data: [
                f"Item {i+1}: closing balance is negative"
                for i, item in enumerate(data.get("stock_items", []))
                if float(item.get("closing_balance", 0)) < 0
            ],
            severity="error"
        ),
        ValidationRule(
            name="ss_inventory_math",
            fn=lambda data: [
                e for i, item in enumerate(data.get("stock_items", []))
                for e in ([f"Item {i+1}: opening+receipts-issues != closing"] if abs(
                    float(item.get('opening_balance', 0) or 0) +
                    float(item.get('receipts', 0) or 0) -
                    float(item.get('issues', 0) or 0) -
                    float(item.get('closing_balance', 0) or 0)
                ) > 1.0 else [])
            ],
            severity="warning"
        ),
    ],

    ui_component="StockSheetView",
    preview_fields=["ss_date", "warehouse.name", "stock_items.0.item_description", "stock_items.0.closing_balance"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_stock_sheet_pdf,
            filename_template="stock_sheet_{ss_date}.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_stock_sheet_excel,
            filename_template="stock_sheet_{ss_date}.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_stock_sheet_json,
            filename_template="stock_sheet_{ss_date}.json"
        ),
    ],'''

if old_ss in content:
    content = content.replace(old_ss, new_ss, 1)
    replaced += 1
    print("Replaced stock_sheet stubs")
else:
    print("ERROR: stock_sheet stubs not found")

# 3. CREDIT NOTE
old_cn = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="CreditNoteView",
    preview_fields=["note_number", "note_date", "supplier.name", "amount_details.total_amount"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],'''

new_cn = '''    validation_rules=[
        ValidationRule(
            name="cn_mandatory_fields",
            fn=lambda data: [f"Missing: {f}" for f in ["note_number", "note_type", "note_date"] if not data.get(f)],
            severity="error"
        ),
        ValidationRule(
            name="cn_reference",
            fn=lambda data: ["Reference invoice is missing"] if not data.get("reference_invoice") else [],
            severity="warning"
        ),
        ValidationRule(
            name="cn_amount",
            fn=lambda data: ["Amount details incomplete"] if not data.get("amount_details", {}).get("total_amount") else [],
            severity="error"
        ),
    ],

    ui_component="CreditNoteView",
    preview_fields=["note_number", "note_date", "supplier.name", "amount_details.total_amount"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_credit_note_pdf,
            filename_template="{note_number}.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_credit_note_excel,
            filename_template="{note_number}.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_credit_note_json,
            filename_template="{note_number}.json"
        ),
    ],'''

if old_cn in content:
    content = content.replace(old_cn, new_cn, 1)
    replaced += 1
    print("Replaced credit_note stubs")
else:
    print("ERROR: credit_note stubs not found")

# 4. HANDWRITTEN FORM
old_hf = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="HandwrittenFormView",
    preview_fields=["fields.0.label", "fields.0.value", "quality.readability"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],

    downstream_actions=[
        # Downstream actions would go here - simplified for now
    ],'''

new_hf = '''    validation_rules=[
        ValidationRule(
            name="hf_fields_present",
            fn=lambda data: ["No fields extracted"] if not data.get("fields") else [],
            severity="error"
        ),
        ValidationRule(
            name="hf_low_confidence",
            fn=lambda data: [
                f"Low confidence on '{f.get('label', '?')}'"
                for f in data.get("fields", [])
                if f.get("confidence", 1.0) < 0.4
            ],
            severity="warning"
        ),
        ValidationRule(
            name="hf_quality",
            fn=lambda data: ["Quality assessment missing"] if not data.get("quality", {}).get("readability") else [],
            severity="info"
        ),
    ],

    ui_component="HandwrittenFormView",
    preview_fields=["fields.0.label", "fields.0.value", "quality.readability"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_handwritten_form_pdf,
            filename_template="handwritten_form.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_handwritten_form_excel,
            filename_template="handwritten_form.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_handwritten_form_json,
            filename_template="handwritten_form.json"
        ),
    ],

    downstream_actions=[
        DownstreamAction(
            key="process_handwritten",
            label="Process Handwritten Form",
            description="Digitize and record handwritten form data",
            handler=process_handwritten_form,
            required_permissions=["ocr.handwritten"]
        ),
    ],'''

if old_hf in content:
    content = content.replace(old_hf, new_hf, 1)
    replaced += 1
    print("Replaced handwritten_form stubs")
else:
    print("ERROR: handwritten_form stubs not found")

# 5. CHAT TRANSCRIPT
old_ct = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="ChatTranscriptView",
    preview_fields=["platform", "participants.0", "messages.0.sender", "summary.total_messages"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],

    downstream_actions=[
        # Downstream actions would go here - simplified for now
    ],'''

new_ct = '''    validation_rules=[
        ValidationRule(
            name="ct_messages",
            fn=lambda data: ["No messages extracted"] if not data.get("messages") else [],
            severity="error"
        ),
        ValidationRule(
            name="ct_participants",
            fn=lambda data: ["No participants identified"] if not data.get("participants") else [],
            severity="warning"
        ),
        ValidationRule(
            name="ct_sender_content",
            fn=lambda data: [
                f"Message {i+1}: missing sender or content"
                for i, msg in enumerate(data.get("messages", []))
                if not msg.get("sender") or not msg.get("content")
            ],
            severity="warning"
        ),
    ],

    ui_component="ChatTranscriptView",
    preview_fields=["platform", "participants.0", "messages.0.sender", "summary.total_messages"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_chat_transcript_pdf,
            filename_template="chat_transcript.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_chat_transcript_excel,
            filename_template="chat_transcript.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_chat_transcript_json,
            filename_template="chat_transcript.json"
        ),
    ],

    downstream_actions=[
        DownstreamAction(
            key="process_chat",
            label="Process Chat Transcript",
            description="Analyze and archive chat communication",
            handler=process_chat_transcript,
            required_permissions=["ocr.chat"]
        ),
    ],'''

if old_ct in content:
    content = content.replace(old_ct, new_ct, 1)
    replaced += 1
    print("Replaced chat_transcript stubs")
else:
    print("ERROR: chat_transcript stubs not found")

# 6. LEDGER SHEET
old_ls = '''    validation_rules=[
        # Validation rules would go here - simplified for now
    ],

    ui_component="LedgerSheetView",
    preview_fields=["account_info.account_name", "account_info.opening_balance", "summary.closing_balance"],

    export_formats=[
        # Export formats would go here - simplified for now
    ],

    downstream_actions=[
        # Downstream actions would go here - simplified for now
    ],'''

new_ls = '''    validation_rules=[
        ValidationRule(
            name="ls_account_info",
            fn=lambda data: ["Account info missing"] if not data.get("account_info", {}).get("account_name") else [],
            severity="error"
        ),
        ValidationRule(
            name="ls_transactions",
            fn=lambda data: ["No transactions extracted"] if not data.get("transactions") else [],
            severity="error"
        ),
        ValidationRule(
            name="ls_balance_check",
            fn=lambda data: [
                e for s in ([data.get("summary", {})] if data.get("summary") else [])
                for e in ([f"opening+debits-credits != closing"] if abs(
                    float(s.get('opening_balance', 0) or 0) +
                    float(s.get('total_debit', 0) or 0) -
                    float(s.get('total_credit', 0) or 0) -
                    float(s.get('closing_balance', 0) or 0)
                ) > 1.0 else [])
            ],
            severity="error"
        ),
        ValidationRule(
            name="ls_running_balance",
            fn=lambda data: [
                f"Txn {i+1}: running balance issue"
                for i, txn in enumerate(data.get("transactions", []))
                if i > 0 and abs(float(txn.get("balance", 0) or 0) - (
                    float(data["transactions"][i-1].get("balance", 0) or 0) +
                    float(txn.get("debit", 0) or 0) -
                    float(txn.get("credit", 0) or 0)
                )) > 1.0
            ],
            severity="warning"
        ),
    ],

    ui_component="LedgerSheetView",
    preview_fields=["account_info.account_name", "account_info.opening_balance", "summary.closing_balance"],

    export_formats=[
        ExportFormat(
            name="pdf",
            mime_type="application/pdf",
            generator=generate_ledger_sheet_pdf,
            filename_template="ledger_{account_info.account_number}.pdf"
        ),
        ExportFormat(
            name="excel",
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            generator=generate_ledger_sheet_excel,
            filename_template="ledger_{account_info.account_number}.xlsx"
        ),
        ExportFormat(
            name="json",
            mime_type="application/json",
            generator=generate_ledger_sheet_json,
            filename_template="ledger_{account_info.account_number}.json"
        ),
    ],

    downstream_actions=[
        DownstreamAction(
            key="process_ledger",
            label="Process Ledger Sheet",
            description="Record financial transactions from ledger",
            handler=process_ledger_sheet,
            required_permissions=["accounts.ledger"]
        ),
    ],'''

if old_ls in content:
    content = content.replace(old_ls, new_ls, 1)
    replaced += 1
    print("Replaced ledger_sheet stubs")
else:
    print("ERROR: ledger_sheet stubs not found")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal replacements: {replaced}")

# Verify
remaining_v = content.count("# Validation rules would go here")
remaining_e = content.count("# Export formats would go here")
remaining_d = content.count("# Downstream actions would go here")
print(f"Remaining stubs: validation={remaining_v}, export={remaining_e}, downstream={remaining_d}")
