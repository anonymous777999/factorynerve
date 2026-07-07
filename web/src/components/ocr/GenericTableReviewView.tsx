// web/src/components/ocr/GenericTableReviewView.tsx
"use client";

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";

export function GenericTableReviewView({ 
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
  const [editedData, setEditedData] = useState({
    headers: data.headers || [],
    rows: data.rows || []
  });

  const handleHeaderChange = (index: number, value: string) => {
    setEditedData(prev => {
      const newHeaders = [...prev.headers];
      newHeaders[index] = value;
      return { ...prev, headers: newHeaders };
    });
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData(prev => {
      const newRows = [...prev.rows];
      if (!newRows[rowIndex]) {
        newRows[rowIndex] = new Array(prev.headers.length).fill("");
      }
      newRows[rowIndex][colIndex] = value;
      return { ...prev, rows: newRows };
    });
  };

  const addRow = () => {
    setEditedData(prev => {
      const newRows = [...prev.rows];
      newRows.push(new Array(prev.headers.length).fill(""));
      return { ...prev, rows: newRows };
    });
  };

  const deleteRow = (rowIndex: number) => {
    setEditedData(prev => {
      const newRows = [...prev.rows];
      newRows.splice(rowIndex, 1);
      return { ...prev, rows: newRows };
    });
  };

  const addColumn = () => {
    setEditedData(prev => {
      const newHeaders = [...prev.headers, "New Column"];
      const newRows = prev.rows.map(row => [...row, ""]);
      return { 
        headers: newHeaders,
        rows: newRows
      };
    });
  };

  const deleteColumn = (colIndex: number) => {
    setEditedData(prev => {
      const newHeaders = [...prev.headers];
      newHeaders.splice(colIndex, 1);
      const newRows = prev.rows.map(row => {
        const newRow = [...row];
        newRow.splice(colIndex, 1);
        return newRow;
      });
      return { 
        headers: newHeaders,
        rows: newRows
      };
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Generic Table Review</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={addColumn}
              >
                Add Column
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={addRow}
              >
                Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column headers editing */}
          <div className="space-y-4">
            <label className="text-sm font-medium mb-1 block">Column Headers</label>
            <div className="overflow-x-auto">
              <div className="inline-flex min-w-full space-x-1">
                {editedData.headers.map((header, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input 
                      value={header || ""}
                      onChange={(e) => handleHeaderChange(index, e.target.value)}
                      className="flex-1 min-w-[100px]"
                    />
                    <Button 
                      variant="destructive"
                      outline
                      size="sm"
                      onClick={() => deleteColumn(index)}
                      disabled={editedData.headers.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {/* Add column button at the end */}
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={addColumn}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
          
          {/* Data table editing */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {editedData.headers.map((header, colIndex) => (
                    <TableHead key={colIndex} className="text-left font-semibold bg-gray-50">
                      {header || `Column ${colIndex + 1}`}
                    </TableHead>
                  ))}
                  <th className="text-left font-semibold bg-gray-50">Actions</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedData.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="border-t">
                    {row.map((cell, colIndex) => (
                      <TableCell key={colIndex} className="p-3">
                        <Input 
                          value={cell || ""}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="p-3 space-x-2">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Add row above/below logic would go here
                        }}
                      >
                        Add Row
                      </Button>
                      <Button 
                        variant="destructive"
                        outline
                        size="sm"
                        onClick={() => deleteRow(rowIndex)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Add row button at the end */}
                <TableRow className="border-t">
                  {editedData.headers.map((_, colIndex) => (
                    <TableCell key={colIndex} className="p-3 text-center">
                      -
                    </TableCell>
                  ))}
                  <td className="p-3 text-center">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={addRow}
                    >
                      Add Row
                    </Button>
                  </td>
                </TableRow>
              </TableBody>
            </Table>
          </div>
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