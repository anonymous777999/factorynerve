"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
    createDataTableColumnHelper,
    type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";

// Mock data types matching the reference design
type ApprovalItem = {
    id: string;
    type: "OCR Validation" | "Attendance";
    severity: "Critical" | "High" | "Warning" | "Low";
    age: string;
    status: "pending" | "approved" | "rejected";
    itemId: string;
};

// Mock data matching the reference
const mockApprovalItems: ApprovalItem[] = [
    {
        id: "1",
        itemId: "#OCR-992",
        type: "OCR Validation",
        severity: "High",
        age: "4h 12m",
        status: "pending",
    },
    {
        id: "2",
        itemId: "#ATT-104",
        type: "Attendance",
        severity: "Low",
        age: "1h 05m",
        status: "approved",
    },
    {
        id: "3",
        itemId: "#ATT-105",
        type: "Attendance",
        severity: "Low",
        age: "1h 10m",
        status: "approved",
    },
    {
        id: "4",
        itemId: "#OCR-990",
        type: "OCR Validation",
        severity: "Critical",
        age: "93h 40m",
        status: "pending",
    },
];

const columnHelper = createDataTableColumnHelper<ApprovalItem>();

function getSeverityIcon(severity: ApprovalItem["severity"]) {
    switch (severity) {
        case "Critical":
            return "⚠️";
        case "High":
            return "🔴";
        case "Warning":
            return "⚠️";
        case "Low":
            return "✅";
        default:
            return "⚪";
    }
}

function getSeverityColor(severity: ApprovalItem["severity"]) {
    switch (severity) {
        case "Critical":
            return "text-red-400";
        case "High":
            return "text-orange-400";
        case "Warning":
            return "text-yellow-400";
        case "Low":
            return "text-green-400";
        default:
            return "text-gray-400";
    }
}

function getStatusIcon(status: ApprovalItem["status"]) {
    switch (status) {
        case "approved":
            return "✅";
        case "rejected":
            return "❌";
        case "pending":
            return "🔴";
        default:
            return "⚪";
    }
}

export default function ApprovalQueueWorkspace() {
    const { user, loading } = useSession();
    const [selectedItemId, setSelectedItemId] = useState<string>("1"); // Default to first item
    const [selectedItems, setSelectedItems] = useState<string[]>(["1"]);
    const [search, setSearch] = useState("");

    const selectedItem = useMemo(
        () => mockApprovalItems.find((item) => item.id === selectedItemId) || mockApprovalItems[0],
        [selectedItemId]
    );

    const handleItemSelect = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        if (!selectedItems.includes(itemId)) {
            setSelectedItems([...selectedItems, itemId]);
        }
    }, [selectedItems]);

    const handleClearSelection = useCallback(() => {
        setSelectedItems([]);
    }, []);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: "select",
                header: "",
                cell: (info) => (
                    <input
                        type="checkbox"
                        checked={selectedItems.includes(info.row.original.id)}
                        onChange={() => {
                            const id = info.row.original.id;
                            if (selectedItems.includes(id)) {
                                setSelectedItems(selectedItems.filter(i => i !== id));
                            } else {
                                setSelectedItems([...selectedItems, id]);
                            }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                    />
                ),
                meta: {
                    align: "center",
                },
            }),
            columnHelper.display({
                id: "status",
                header: "STS",
                cell: (info) => (
                    <span className="text-lg">
                        {getStatusIcon(info.row.original.status)}
                    </span>
                ),
                meta: {
                    align: "center",
                },
            }),
            columnHelper.accessor("itemId", {
                header: "Item ID",
                cell: (info) => (
                    <span className="font-mono text-blue-300 font-medium">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("type", {
                header: "Type",
                cell: (info) => (
                    <span className="text-gray-300">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("severity", {
                header: "Severity",
                cell: (info) => (
                    <span className={cn("font-medium", getSeverityColor(info.getValue()))}>
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("age", {
                header: "Age",
                cell: (info) => (
                    <span className="text-gray-400 font-mono text-sm">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.display({
                id: "actions",
                header: "Action",
                cell: (info) => {
                    const item = info.row.original;
                    return (
                        <div className="flex gap-2">
                            {item.severity === "High" || item.severity === "Critical" ? (
                                <Button
                                    size="compact"
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 text-xs"
                                    onClick={() => handleItemSelect(item.id)}
                                >
                                    Review →
                                </Button>
                            ) : (
                                <Button
                                    size="compact"
                                    variant="outline"
                                    className="border-gray-600 text-gray-300 hover:bg-gray-700 px-3 py-1 text-xs"
                                >
                                    Open
                                </Button>
                            )}
                        </div>
                    );
                },
                meta: {
                    align: "right",
                },
            }),
        ] as DataTableColumnDef<ApprovalItem>[],
        [selectedItems, handleItemSelect]
    );

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-300">
                Loading approval queue...
            </main>
        );
    }

    if (!user) {
        return (
            <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 bg-gray-900">
                <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg border border-gray-700">
                    <h1 className="text-xl font-semibold text-white mb-4">Approval Queue</h1>
                    <p className="text-gray-400 mb-4">Access required to continue into the approval workflow.</p>
                    <Link href="/access">
                        <Button className="w-full bg-orange-600 hover:bg-orange-700">Open Access</Button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-900 text-gray-100">
            {/* Main Layout */}
            <div className="flex min-h-screen">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-white">Approval Queue</h1>
                                <p className="text-gray-400 text-sm mt-1">
                                    Close the next review first, then work down the backlog.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="compact" className="border-gray-600 text-gray-300">
                                    🔄 Refresh
                                </Button>
                                <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                                    Review Next
                                </Button>
                            </div>
                        </div>
                    </header>

                    {/* Alert Banner */}
                    <div className="bg-red-900/20 border-b border-red-800/50 px-6 py-3">
                        <div className="flex items-center gap-3">
                            <span className="text-red-400">⚠️</span>
                            <span className="text-red-300 font-medium">Urgent Decision Required:</span>
                            <span className="text-gray-300">3 high-risk exceptions identified in morning shift.</span>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Open Items</div>
                                <div className="text-3xl font-bold text-blue-400">124</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Urgent</div>
                                <div className="text-3xl font-bold text-orange-400">3</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">SLA Breaches</div>
                                <div className="text-3xl font-bold text-red-400">1</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending Review</div>
                                <div className="text-3xl font-bold text-gray-300">45</div>
                            </div>
                        </div>
                    </div>

                    {/* Priority Focus Cards */}
                    <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-red-400 text-sm font-medium">93H Waiting • Critical</div>
                                        <div className="text-white font-semibold">Attendance Review</div>
                                    </div>
                                    <div className="text-xs text-red-300 bg-red-900/30 px-2 py-1 rounded">
                                        Focus 8h+
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-orange-400 text-sm font-medium">24H+ Breached • Warning</div>
                                        <div className="text-white font-semibold">OCR Validation</div>
                                    </div>
                                    <div className="text-xs text-orange-300 bg-orange-900/30 px-2 py-1 rounded">
                                        Focus 24h+
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters and Bulk Actions */}
                    <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-sm text-gray-400 mb-2">Presets & Filters</div>
                                <div className="flex gap-2">
                                    <Button className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1">All</Button>
                                    <Button variant="outline" className="border-gray-600 text-gray-300 text-xs px-3 py-1">Today</Button>
                                    <Button variant="outline" className="border-gray-600 text-gray-300 text-xs px-3 py-1">8h+</Button>
                                    <Button variant="outline" className="border-gray-600 text-gray-300 text-xs px-3 py-1">24h+</Button>
                                    <Button variant="outline" className="border-gray-600 text-gray-300 text-xs px-3 py-1">OCR only</Button>
                                    <Button variant="outline" className="border-gray-600 text-gray-300 text-xs px-3 py-1">Attendance</Button>
                                </div>
                            </div>
                            <div className="text-sm text-gray-400">
                                Selected {selectedItems.length}
                            </div>
                        </div>

                        {selectedItems.length > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                                <span className="text-sm text-gray-300">
                                    {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
                                </span>
                                <Button
                                    variant="outline"
                                    size="compact"
                                    onClick={handleClearSelection}
                                    className="border-gray-600 text-gray-300 text-xs"
                                >
                                    Clear selection
                                </Button>
                                <Button
                                    variant="outline"
                                    size="compact"
                                    className="border-red-600 text-red-300 hover:bg-red-900/20 text-xs"
                                >
                                    Reject Selected
                                </Button>
                                <Button
                                    size="compact"
                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                                >
                                    Approve Selected
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Data Table */}
                    <div className="flex-1 px-6 py-4 bg-gray-900">
                        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                            <DataTable<ApprovalItem>
                                ariaLabel="Approval queue"
                                columns={columns}
                                data={mockApprovalItems}
                                getRowId={(row) => row.id}
                                selectedRowId={selectedItemId}
                                onRowClick={(row) => setSelectedItemId(row.id)}
                                enableGlobalSearch={false}
                                enableStickyFirstColumn={false}
                                enableVirtualization={false}
                                className="h-full w-full bg-gray-800"
                                viewportClassName="bg-gray-800"
                                viewportSize="lg"
                                emptyTitle="No approval items"
                                emptyMessage="No items match the current filters."
                            />
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Active Review */}
                <aside className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-white">Active Review</h2>
                            <span className="text-orange-400 font-mono text-sm">{selectedItem?.itemId}</span>
                        </div>
                        <div className="inline-flex items-center px-2 py-1 bg-orange-900/30 border border-orange-800/50 rounded text-xs text-orange-300">
                            High Priority
                        </div>
                    </div>

                    <div className="flex-1 p-4 space-y-4">
                        {/* Source Document Crop */}
                        <div className="bg-gray-700 rounded-lg border border-gray-600 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-white">Source Document Crop</h3>
                                <button
                                    type="button"
                                    aria-label="Expand source document crop"
                                    className="text-gray-400 hover:text-white"
                                >
                                    <span aria-hidden="true">⛶</span>
                                </button>
                            </div>
                            <div className="bg-gray-900 rounded border border-gray-600 p-4 h-32 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="text-2xl mb-2">📄</div>
                                    <div className="text-xs text-gray-400">SHIPPING_MANIFEST_A42.pdf</div>
                                    <div className="text-xs text-red-400 mt-1">LOW CONFIDENCE: 42%</div>
                                </div>
                            </div>
                        </div>

                        {/* Extracted Data */}
                        <div className="bg-gray-700 rounded-lg border border-gray-600 p-4">
                            <h3 className="text-sm font-medium text-white mb-3">Extracted Data</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-gray-400">Vendor ID</div>
                                    <div className="text-sm text-white font-mono">VND-8834-X</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">Date</div>
                                    <div className="text-sm text-white">2023-10-27</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">Discrepancy Detected (Total Amount)</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-red-400 line-through">$14,500.00</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-sm text-orange-400 font-semibold">$1,450.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* DPR.ai Interpretation */}
                        <div className="bg-gray-700 rounded-lg border border-gray-600 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-blue-400">🤖</span>
                                <h3 className="text-sm font-medium text-white">DPR.ai Interpretation</h3>
                            </div>
                            <div className="space-y-2 text-xs text-gray-300">
                                <div>• <strong>Anomaly:</strong> Decimal point placement unclear due to document stain.</div>
                                <div>• <strong>Pattern:</strong> Matches known hardware latency issue with scanner bay 4.</div>
                                <div>• <strong>Recommendation:</strong> Manual verification of PO total required against ERP record.</div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-700 space-y-2">
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                            ✅ Regularize (Approve)
                        </Button>
                        <Button variant="outline" className="w-full border-red-600 text-red-300 hover:bg-red-900/20">
                            Reject (Mark Late)
                        </Button>
                        <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                            Escalate to HR
                        </Button>
                    </div>
                </aside>
            </div>
        </main>
    );
}