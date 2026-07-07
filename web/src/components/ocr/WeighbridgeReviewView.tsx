// web/src/components/ocr/WeighbridgeReviewView.tsx
"use client";

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Button,
  Input,
  Label
} from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";

export function WeighbridgeReviewView({ 
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
      <Card>
        <CardHeader>
          <CardTitle>Weighbridge Slip Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="slip_no">Slip No.</Label>
                <Input 
                  id="slip_no"
                  value={editedData.slip_no || ""}
                  onChange={(e) => handleChange("slip_no", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input 
                  id="date"
                  type="date"
                  value={editedData.date || ""}
                  onChange={(e) => handleChange("date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input 
                  id="time"
                  value={editedData.time || ""}
                  onChange={(e) => handleChange("time", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vehicle_no">Vehicle No.</Label>
                <Input 
                  id="vehicle_no"
                  value={editedData.vehicle_no || ""}
                  onChange={(e) => handleChange("vehicle_no", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="driver_name">Driver Name</Label>
                <Input 
                  id="driver_name"
                  value={editedData.driver_name || ""}
                  onChange={(e) => handleChange("driver_name", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Input 
                  id="material"
                  value={editedData.material || ""}
                  onChange={(e) => handleChange("material", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="party_name">Party Name</Label>
                <Input 
                  id="party_name"
                  value={editedData.party_name || ""}
                  onChange={(e) => handleChange("party_name", e.target.value)}
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gross_weight">Gross Weight (kg)</Label>
                    <Input 
                      id="gross_weight"
                      type="number"
                      value={editedData.gross_weight || ""}
                      onChange={(e) => handleChange("gross_weight", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tare_weight">Tare Weight (kg)</Label>
                    <Input 
                      id="tare_weight"
                      type="number"
                      value={editedData.tare_weight || ""}
                      onChange={(e) => handleChange("tare_weight", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="net_weight">Net Weight (kg)</Label>
                    <Input 
                      id="net_weight"
                      type="number"
                      value={editedData.net_weight || ""}
                      onChange={(e) => handleChange("net_weight", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rate">Rate (₹/kg)</Label>
                    <Input 
                      id="rate"
                      type="number"
                      value={editedData.rate || ""}
                      onChange={(e) => handleChange("rate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input 
                      id="amount"
                      type="number"
                      value={editedData.amount || ""}
                      onChange={(e) => handleChange("amount", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    {/* Calculated field - read-only */}
                    <label className="text-sm font-medium mb-1 block">Calculated Amount (₹)</label>
                    <div className="pl-2 pt-2">
                      {editedData.net_weight && editedData.rate 
                        ? (parseFloat(editedData.net_weight) * parseFloat(editedData.rate)).toFixed(2) 
                        : "0.00"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Validation warnings */}
          {(() => {
            const warnings = [];
            if (editedData.gross_weight && editedData.tare_weight && editedData.net_weight) {
              const gross = parseFloat(editedData.gross_weight);
              const tare = parseFloat(editedData.tare_weight);
              const net = parseFloat(editedData.net_weight);
              if (Math.abs((gross - tare) - net) > 0.1) {
                warnings.push("Net weight does not match gross weight minus tare weight");
              }
            }
            if (editedData.amount && editedData.net_weight && editedData.rate) {
              const amount = parseFloat(editedData.amount);
              const calculated = parseFloat(editedData.net_weight) * parseFloat(editedData.rate);
              if (Math.abs(amount - calculated) > 0.01) {
                warnings.push("Amount does not match net weight multiplied by rate");
              }
            }
            return warnings.length > 0 ? (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <h3 className="text-sm font-medium text-warning mb-2">Validation Warnings</h3>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
        </CardContent>
      </Card>
      
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