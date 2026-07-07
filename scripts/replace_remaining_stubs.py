"""Replace remaining validation/export/downstream stubs for Production Report, Packing List, and Vendor Quotation."""
import sys

with open('backend/services/ocr_document_types/__init__.py', 'r', encoding='utf-8') as f:
    content = f.read()

replaced = 0

# ============================================================
# 1. PRODUCTION REPORT
# ============================================================
old_pr = (
    "    validation_rules=[\n"
    "        # Validation rules would go here - simplified for now\n"
    "    ],\n"
    "\n"
    "    ui_component=\"ProductionReportView\",\n"
    "    preview_fields=[\"report_date\", \"shift\", \"production_line.name\", \"production_output.0.actual_quantity\"],\n"
    "\n"
    "    export_formats=[\n"
    "        # Export formats would go here - simplified for now\n"
    "    ],\n"
    "\n"
    "    downstream_actions=[\n"
    "        # Downstream actions would go here - simplified for now\n"
    "    ],"
)

new_pr = (
    "    validation_rules=[\n"
    "        ValidationRule(\n"
    "            name=\"pr_mandatory_fields\",\n"
    "            fn=lambda data: [f\"Missing: {f}\" for f in [\"report_date\", \"shift\"] if not data.get(f)],\n"
    "            severity=\"error\"\n"
    "        ),\n"
    "        ValidationRule(\n"
    "            name=\"pr_production_line\",\n"
    "            fn=lambda data: [\"Production line name missing\"] if not data.get(\"production_line\", {}).get(\"name\") else [],\n"
    "            severity=\"error\"\n"
    "        ),\n"
    "        ValidationRule(\n"
    "            name=\"pr_output_items\",\n"
    "            fn=lambda data: [\"No production output entries\"] if not data.get(\"production_output\") else [],\n"
    "            severity=\"error\"\n"
    "        ),\n"
    "        ValidationRule(\n"
    "            name=\"pr_quantity_positive\",\n"
    "            fn=lambda data: [\n"
    "                f\"Output {i+1}: actual quantity must be positive\"\n"
    "                for i, item in enumerate(data.get(\"production_output\", []))\n"
    "                if float(item.get(\"actual_quantity\", 0)) <= 0\n"
    "            ],\n"
    "            severity=\"error\"\n"
    "        ),\n"
    "        ValidationRule(\n"
    "            name=\"pr_efficiency_range\",\n"
    "            fn=lambda data: [\n"
    "                f\"Output {i+1}: efficiency {item.get('efficiency_percent')}% out of range\"\n"
    "                for i, item in enumerate(data.get(\"production_output\", []))\n"
    "                if item.get(\"efficiency_percent\") is not None\n"
    "                and (float(item[\"efficiency_percent\"]) < 0 or float(item[\"efficiency_percent\"]) > 150)\n"
    "            ],\n"
    "            severity=\"warning\"\n"
    "        ),\n"
    "    ],\n"
    "\n"
    '    ui_component="ProductionReportView",\n'
    '    preview_fields=["report_date", "shift", "production_line.name", "production_output.0.actual_quantity"],\n'
    "\n"
    "    export_formats=[\n"
    "        ExportFormat(\n"
    '            name="pdf",\n'
    '            mime_type="application/pdf",\n'
    "            generator=generate_production_report_pdf,\n"
    '            filename_template="production_report_{report_date}.pdf"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="excel",\n'
    '            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",\n'
    "            generator=generate_production_report_excel,\n"
    '            filename_template="production_report_{report_date}.xlsx"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="json",\n'
    '            mime_type="application/json",\n'
    "            generator=generate_production_report_json,\n"
    '            filename_template="production_report_{report_date}.json"\n'
    "        ),\n"
    "    ],\n"
    "\n"
    "    downstream_actions=[\n"
    "        DownstreamAction(\n"
    '            key="process_production_report",\n'
    '            label="Process Production Report",\n'
    "            description=\"Record production output and update inventory\",\n"
    "            handler=process_production_report,\n"
    '            required_permissions=["production.report"]\n'
    "        ),\n"
    "    ],"
)

if old_pr in content:
    content = content.replace(old_pr, new_pr, 1)
    replaced += 1
    print("OK: Production Report stubs replaced")
else:
    print("FAIL: Production Report stubs NOT FOUND")
    idx = content.find('PRODUCTION REPORT')
    if idx >= 0:
        print(f"  Found section at offset {idx}")
        snippet = content[idx:idx+800]
        vr = snippet.find('validation_rules')
        if vr >= 0:
            print(f"  validation_rules text: {repr(snippet[vr:vr+150])}")

# ============================================================
# 2. PACKING LIST
# ============================================================
old_pl = (
    "    validation_rules=[\n"
    "        # Validation rules would go here - simplified for now\n"
    "    ],\n"
    "\n"
    '    ui_component="PackingListView",\n'
    '    preview_fields=["pl_number", "pl_date", "exporter.name", "importer.name"],\n'
    "\n"
    "    export_formats=[\n"
    "        # Export formats would go here - simplified for now\n"
    "    ],\n"
    "\n"
    "    downstream_actions=[\n"
    "        # Downstream actions would go here - simplified for now\n"
    "    ],"
)

new_pl = (
    "    validation_rules=[\n"
    "        ValidationRule(\n"
    '            name="pl_mandatory_fields",\n'
    '            fn=lambda data: [f"Missing: {f}" for f in ["pl_number", "pl_date"] if not data.get(f)],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="pl_parties",\n'
    '            fn=lambda data: [e for e, f in [("Exporter", "exporter"), ("Importer", "importer")] if not data.get(f, {}).get("name")],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="pl_packages",\n'
    '            fn=lambda data: ["No packages listed"] if not data.get("packages") else [],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="pl_weight_positive",\n'
    "            fn=lambda data: [\n"
    '                f"Package {i+1}: gross weight must be positive"\n'
    '                for i, pkg in enumerate(data.get("packages", []))\n'
    '                if float(pkg.get("gross_weight", 0)) <= 0\n'
    "            ],\n"
    '            severity="warning"\n'
    "        ),\n"
    "    ],\n"
    "\n"
    '    ui_component="PackingListView",\n'
    '    preview_fields=["pl_number", "pl_date", "exporter.name", "importer.name"],\n'
    "\n"
    "    export_formats=[\n"
    "        ExportFormat(\n"
    '            name="pdf",\n'
    '            mime_type="application/pdf",\n'
    "            generator=generate_packing_list_pdf,\n"
    '            filename_template="{pl_number}.pdf"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="excel",\n'
    '            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",\n'
    "            generator=generate_packing_list_excel,\n"
    '            filename_template="{pl_number}.xlsx"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="json",\n'
    '            mime_type="application/json",\n'
    "            generator=generate_packing_list_json,\n"
    '            filename_template="{pl_number}.json"\n'
    "        ),\n"
    "    ],\n"
    "\n"
    "    downstream_actions=[\n"
    "        DownstreamAction(\n"
    '            key="process_packing_list",\n'
    '            label="Process Packing List",\n'
    "            description=\"Record packing list for shipping documentation\",\n"
    "            handler=process_packing_list,\n"
    '            required_permissions=["logistics.packing"]\n'
    "        ),\n"
    "    ],"
)

if old_pl in content:
    content = content.replace(old_pl, new_pl, 1)
    replaced += 1
    print("OK: Packing List stubs replaced")
else:
    print("FAIL: Packing List stubs NOT FOUND")
    idx = content.find('PACKING LIST')
    if idx >= 0:
        print(f"  Found section at offset {idx}")
        snippet = content[idx:idx+800]
        vr = snippet.find('validation_rules')
        if vr >= 0:
            print(f"  validation_rules text: {repr(snippet[vr:vr+150])}")

# ============================================================
# 3. VENDOR QUOTATION (validation + exports, downstream already exists)
# ============================================================
old_vq = (
    "    validation_rules=[\n"
    "        # Validation rules would go here - simplified for now\n"
    "    ],\n"
    "\n"
    '    ui_component="QuotationView",\n'
    '    preview_fields=["quotation_number", "quotation_date", "vendor.name", "pricing_summary.total_amount"],\n'
    "\n"
    "    export_formats=[\n"
    "        # Export formats would go here - simplified for now\n"
    "    ],\n"
    "\n"
    "    downstream_actions=["
)

new_vq = (
    "    validation_rules=[\n"
    "        ValidationRule(\n"
    '            name="vq_mandatory_fields",\n'
    '            fn=lambda data: [f"Missing: {f}" for f in ["quotation_number", "quotation_date", "validity_date"] if not data.get(f)],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="vq_vendor_name",\n'
    '            fn=lambda data: ["Vendor name is missing"] if not data.get("vendor", {}).get("name") else [],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="vq_items",\n'
    '            fn=lambda data: ["No items in quotation"] if not data.get("items") else [],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="vq_total_amount",\n'
    '            fn=lambda data: ["Total amount is missing"] if not data.get("pricing_summary", {}).get("total_amount") else [],\n'
    '            severity="error"\n'
    "        ),\n"
    "        ValidationRule(\n"
    '            name="vq_validity_date_after_quote",\n'
    '            fn=lambda data: (\n'
    '                ["Validity date is before quotation date"]\n'
    '                if data.get("validity_date") and data.get("quotation_date")\n'
    '                and data["validity_date"] < data["quotation_date"]\n'
    '                else []\n'
    "            ),\n"
    '            severity="warning"\n'
    "        ),\n"
    "    ],\n"
    "\n"
    '    ui_component="QuotationView",\n'
    '    preview_fields=["quotation_number", "quotation_date", "vendor.name", "pricing_summary.total_amount"],\n'
    "\n"
    "    export_formats=[\n"
    "        ExportFormat(\n"
    '            name="pdf",\n'
    '            mime_type="application/pdf",\n'
    "            generator=generate_vendor_quotation_pdf,\n"
    '            filename_template="{quotation_number}.pdf"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="excel",\n'
    '            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",\n'
    "            generator=generate_vendor_quotation_excel,\n"
    '            filename_template="{quotation_number}.xlsx"\n'
    "        ),\n"
    "        ExportFormat(\n"
    '            name="json",\n'
    '            mime_type="application/json",\n'
    "            generator=generate_vendor_quotation_json,\n"
    '            filename_template="{quotation_number}.json"\n'
    "        ),\n"
    "    ],\n"
    "\n"
    "    downstream_actions=["
)

if old_vq in content:
    content = content.replace(old_vq, new_vq, 1)
    replaced += 1
    print("OK: Vendor Quotation stubs replaced")
else:
    print("FAIL: Vendor Quotation stubs NOT FOUND")
    idx = content.find('VENDOR QUOTATION')
    if idx >= 0:
        print(f"  Found section at offset {idx}")
        snippet = content[idx:idx+800]
        vr = snippet.find('validation_rules')
        if vr >= 0:
            print(f"  validation_rules text: {repr(snippet[vr:vr+150])}")

if replaced > 0:
    with open('backend/services/ocr_document_types/__init__.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\nSaved: {replaced} type(s) updated")
else:
    print("\nNo replacements made")
