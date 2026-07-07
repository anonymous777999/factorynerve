// web/src/components/ocr/InvoiceReviewView.tsx
"use client";

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger,
  Separator,
  Button,
  Badge,
  Input,
  Textarea
} from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";

export function InvoiceReviewView({ 
  data, 
  onSave, 
  onSubmit,
  onApprove,
  onReject 
}: { 
  data: OcrPreviewResult;
  onSave: (payload: any) => void;
  onSubmit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
}) {
  const [editedData, setEditedData] = useState(data.extraction || {});
  const [activeTab, setActiveTab] = useState("header");

  // In a real app, we would have validation and calculation logic here
  const validationErrors = []; // Placeholder

  const handleChange = (fieldPath: string, value: any) => {
    setEditedData((prev: Record<string, any>) => {
      const keys = fieldPath.split(".");
      if (keys.length === 1) {
        return { ...prev, [keys[0]]: value };
      }
      const obj = {...prev};
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return obj;
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="header">Header</TabsTrigger>
          <TabsTrigger value="items">Line Items</TabsTrigger>
          <TabsTrigger value="tax">Tax Summary</TabsTrigger>
          <TabsTrigger value="totals">Totals</TabsTrigger>
        </TabsList>
        
        <TabsContent value="header">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Invoice Number</label>
              <Input 
                value={editedData.invoice_number || ""}
                onChange={(e) => handleChange("invoice_number", e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Invoice Date</label>
              <Input 
                type="date"
                value={editedData.invoice_date || ""}
                onChange={(e) => handleChange("invoice_date", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier Name</label>
                <Input 
                  value={editedData.supplier?.name || ""}
                  onChange={(e) => handleChange("supplier.name", e.target.value)}
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier GSTIN</label>
                <Input 
                  value={editedData.supplier?.gstin || ""}
                  onChange={(e) => handleChange("supplier.gstin", e.target.value)}
                  placeholder="GSTIN"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Recipient Name</label>
                <Input 
                  value={editedData.recipient?.name || ""}
                  onChange={(e) => handleChange("recipient.name", e.target.value)}
                  placeholder="Recipient name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Recipient GSTIN</label>
                <Input 
                  value={editedData.recipient?.gstin || ""}
                  onChange={(e) => handleChange("recipient.gstin", e.target.value)}
                  placeholder="GSTIN"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="items">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sr. No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">HSN Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Taxable Value</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(editedData.line_items || []).map((item: any, index: number) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-3">
                        <Input 
                          value={item.sr_no || index + 1}
                          onChange={(e) => handleChange(`line_items.${index}.sr_no`, parseInt(e.target.value) || 0)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          value={item.description || ""}
                          onChange={(e) => handleChange(`line_items.${index}.description`, e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          value={item.hsn_code || ""}
                          onChange={(e) => handleChange(`line_items.${index}.hsn_code`, e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          type="number"
                          value={item.qty || ""}
                          onChange={(e) => handleChange(`line_items.${index}.qty`, parseFloat(e.target.value) || 0)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          value={item.unit || ""}
                          onChange={(e) => handleChange(`line_items.${index}.unit`, e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          type="number"
                          value={item.rate || ""}
                          onChange={(e) => handleChange(`line_items.${index}.rate`, parseFloat(e.target.value) || 0)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          type="number"
                          value={item.taxable_value || ""}
                          onChange={(e) => handleChange(`line_items.${index}.taxable_value`, parseFloat(e.target.value) || 0)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            // Add row logic would go here
                          }}
                        >
                          Add Above
                        </Button>
                        <Button 
                          variant="outline"
                          className="border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100"
                          onClick={() => {
                            // Remove row logic would go here
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {/* Add new row button */}
                  <tr>
                    <td colSpan={8} className="px-4 py-3 text-center">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          // Add new row logic would go here
                        }}
                      >
                        Add Line Item
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="tax">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Tax Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">CGST Amount</label>
                <Input 
                  type="number"
                  value={editedData.tax_summary?.cgst || ""}
                  onChange={(e) => handleChange("tax_summary.cgst", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">SGST Amount</label>
                <Input 
                  type="number"
                  value={editedData.tax_summary?.sgst || ""}
                  onChange={(e) => handleChange("tax_summary.sgst", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">IGST Amount</label>
                <Input 
                  type="number"
                  value={editedData.tax_summary?.igst || ""}
                  onChange={(e) => handleChange("tax_summary.igst", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">CESS Amount</label>
                <Input 
                  type="number"
                  value={editedData.tax_summary?.cess || ""}
                  onChange={(e) => handleChange("tax_summary.cess", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="totals">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Totals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Total Taxable Value</label>
                <Input 
                  type="number"
                  value={editedData.totals?.total_taxable || ""}
                  onChange={(e) => handleChange("totals.total_taxable", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Total Tax Amount</label>
                <Input 
                  type="number"
                  value={editedData.totals?.total_tax || ""}
                  onChange={(e) => handleChange("totals.total_tax", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Invoice Total</label>
                <Input 
                  type="number"
                  value={editedData.totals?.invoice_total || ""}
                  onChange={(e) => handleChange("totals.invoice_total", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Round Off</label>
                <Input 
                  type="number"
                  value={editedData.totals?.round_off || ""}
                  onChange={(e) => handleChange("totals.round_off", parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <Button 
          variant="outline"
          onClick={() => onSave(editedData)}
        >
          Save Changes
        </Button>
        <Button 
          onClick={() => onSubmit(0)} // In real app, we'd pass the actual ID
          className="bg-primary text-primary-foreground"                        >
                          Submit for Approval
                        </Button>
      </div>
    </div>
  );
}