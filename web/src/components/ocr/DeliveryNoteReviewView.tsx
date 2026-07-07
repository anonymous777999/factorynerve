// web/src/components/ocr/DeliveryNoteReviewView.tsx
"use client";

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Separator,
  Button,
  Badge,
  Input,
} from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";

export function DeliveryNoteReviewView({ 
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

  const handleChange = (fieldPath: string, value: any) => {
    setEditedData(prev => {
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="header">Header</TabsTrigger>
          <TabsTrigger value="items">Line Items</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle Info</TabsTrigger>
        </TabsList>
        
        <TabsContent value="header">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Challan Number</label>
              <Input 
                value={editedData.challan_number || ""}
                onChange={(e) => handleChange("challan_number", e.target.value)}
                placeholder="Enter challan number"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <Input 
                type="date"
                value={editedData.date || ""}
                onChange={(e) => handleChange("date", e.target.value)}
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delivered Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch No.</th>
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
                          value={item.ordered_qty || ""}
                          onChange={(e) => handleChange(`line_items.${index}.ordered_qty`, parseFloat(e.target.value) || 0)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          type="number"
                          value={item.delivered_qty || ""}
                          onChange={(e) => handleChange(`line_items.${index}.delivered_qty`, parseFloat(e.target.value) || 0)}
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
                          value={item.batch_number || ""}
                          onChange={(e) => handleChange(`line_items.${index}.batch_number`, e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Add row logic would go here
                          }}
                        >
                          Add Above
                        </Button>
                        <Button 
                          variant="destructive"
                          outline
                          size="sm"
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
                    <td colSpan="8" className="px-4 py-3 text-center">
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
        
        <TabsContent value="vehicle">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Vehicle Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Vehicle Number</label>
                <Input 
                  value={editedData.vehicle?.number || ""}
                  onChange={(e) => handleChange("vehicle.number", e.target.value)}
                  placeholder="Vehicle number"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Driver Name</label>
                <Input 
                  value={editedData.vehicle?.driver_name || ""}
                  onChange={(e) => handleChange("vehicle.driver_name", e.target.value)}
                  placeholder="Driver name"
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm font-medium mb-1 block">Transporter</label>
              <Input 
                value={editedData.vehicle?.transporter || ""}
                onChange={(e) => handleChange("vehicle.transporter", e.target.value)}
                placeholder="Transporter name"
                className="w-full"
              />
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
          className="bg-primary text-primary-foreground"
          isLoading={false}
        >
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}