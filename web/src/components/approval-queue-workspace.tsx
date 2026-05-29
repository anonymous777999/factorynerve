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

// Mock data types for the approval queue
type ApprovalItem = {
    id: string;
    type: "attendance" | "dpr" | "ocr" | "reconciliation";
    status: "pending" | "approved" | "rejected";
    severity: "critical" | "high" | "warning" | "info";
    title: string;
    submitter: string;
    department: string;
    age: string;
    slaStatus: "breach" | "warning" | "normal";
    lastActivity: string;
};

// Mock data
const mockApprovalItems: ApprovalItem[] = [
    {
        id: "ATT-001",
        type: "attendance",
        status: "pending",
        severity: "critical",
        title: "Missed punch - John Doe",
        submitter: "John Doe",
        department: "Production",
        age: "8h 24m",
        slaStatus: "breach",
        lastActivity: "2024-05-30T08:30:00Z",
    },
    {
        id: "DPR-002",
        type: "dpr",
        status: "pending",
        severity: "high",
        title: "Quality issue - Line A",
        submitter: "Supervisor A",
        department: "Quality",
        age: "4h 15m",
        slaStatus: "warning",
        lastActivity: "2024-05-30T12:45:00Z",
    },
    {
        id: "OCR-003",
        type: "ocr",
        status: "pending",
        severity: "warning",
        title: "Invoice verification - INV-2024-001",
        submitter: "OCR System",
        department: "Finance",
        age: "2h 30m",
        slaStatus: "normal",
        lastActivity: "2024-05-30T14:30:00Z",
    },
    {
        id: "REC-004",
        type: "reconciliation",
        status: "pending",
        severity: "critical",
        title: "Steel batch variance - B240530001",
        submitter: "Operator B",
        department: "Steel Production",
        age: "12h 45m",
        slaStatus: "breach",
        lastActivity: "2024-05-30T04:15:00Z",
    },
    {
        id: "ATT-005",
        type: "attendance",
        status: "pending",
        severity: "high",
        title: "Late entry - Sarah Wilson",
        submitter: "Sarah Wilson",
        department: "Assembly",
        age: "6h 10m",
        slaStatus: "warning",
        lastActivity: "2024-05-30T10:50:00Z",
    },
    {
        id: "DPR-006",
        type: "dpr",
        status: "pending",
        severity: "warning",
        title: "Downtime report - Line C",
        submitter: "Supervisor C",
        department: "Production",
        age: "3h 20m",
        slaStatus: "normal",
        lastActivity: "2024-05-30T13:40:00Z",
    },
    {
        id: "OCR-007",
        type: "ocr",
        status: "pending",
        severity: "high",
        title: "Purchase order - PO-2024-0892",
        submitter: "OCR System",
        department: "Procurement",
        age: "5h 55m",
        slaStatus: "warning",
        lastActivity: "2024-05-30T11:05:00Z",
    },
    {
        id: "ATT-008",
        type: "attendance",
        status: "pending",
        severity: "info",
        title: "Overtime request - Mike Chen",
        submitter: "Mike Chen",
        department: "Maintenance",
        age: "1h 15m",
        slaStatus: "normal",
        lastActivity: "2024-05-30T15:45:00Z",
    },
];

const columnHelper = createDataTableColumnHelper<ApprovalItem>();

function getStatusBadgeStatus(status: ApprovalItem["status"]) {
    switch (status) {
        case "approved":
            return "synced" as const;
        case "pending":
            return "processing" as const;
        case "rejected":
            return "error" as const;
        default:
            return "draft" as const;
    }
}

function getSeverityBadgeStatus(severity: ApprovalItem["severity"]) {
    switch (severity) {
        case "critical":
            return "error" as const;
        case "high":
            return "warning" as const;
        case "warning":
            return "paused" as const;
        default:
            return "draft" as const;
    }
}

function getTypeBadgeStatus(type: ApprovalItem["type"]) {
    switch (type) {
        case "attendance":
            return "processing" as const;
        case "dpr":
            return "synced" as const;
        case "ocr":
            return "draft" as const;
        case "reconciliation":
            return "paused" as const;
        default:
            return "draft" as const;
    }
}

function formatDateTime(value: string) {
    const date = new Date(value);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function ApprovalQueueWorkspace() {
    const { user, loading } = useSession();
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "attendance" | "dpr" | "ocr" | "reconciliation">("all");
    const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "warning" | "info">("all");

    // Filter data based on current filters
    const filteredItems = useMemo(() => {
        return mockApprovalItems.filter((item) => {
            if (statusFilter !== "all" && item.status !== statusFilter) return false;
            if (typeFilter !== "all" && item.type !== typeFilter) return false;
            if (severityFilter !== "all" && item.severity !== severityFilter) return false;
            if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [search, statusFilter, typeFilter, severityFilter]);

    const selectedItem = useMemo(
        () => filteredItems.find((item) => item.id === selectedItemId) || filteredItems[0] || null,
        [filteredItems, selectedItemId]
    );

    // KPI calculations
    const kpis = useMemo(() => {
        const total = mockApprovalItems.length;
        const pending = mockApprovalItems.filter(item => item.status === "pending").length;
        const slaBreaches = mockApprovalItems.filter(item => item.slaStatus === "breach").length;
        const critical = mockApprovalItems.filter(item => item.severity === "critical").length;
        const high = mockApprovalItems.filter(item => item.severity === "high").length;
        const avgAge = "4h 32m"; // Mock average

        return { total, pending, slaBreaches, critical, high, avgAge };
    }, []);

    const columns = useMemo(
        () => [
            columnHelper.accessor("id", {
                header: "ID",
                cell: (info) => (
                    <div className="font-mono text-xs text-text-primary">
                        {info.getValue()}
                    </div>
                ),
                meta: {
                    isRowHeader: true,
                    sticky: "left",
                },
            }),
            columnHelper.accessor("type", {
                header: "Type",
                cell: (info) => (
                    <Badge status={getTypeBadgeStatus(info.getValue())}>
                        {info.getValue().toUpperCase()}
                    </Badge>
                ),
            }),
            columnHelper.accessor("severity", {
                header: "Severity",
                cell: (info) => (
                    <Badge status={getSeverityBadgeStatus(info.getValue())}>
                        {info.getValue().toUpperCase()}
                    </Badge>
                ),
            }),
            columnHelper.accessor("title", {
                header: "Item",
                cell: (info) => (
                    <div className="min-w-0">
                        <div className="truncate text-body font-medium text-text-primary">
                            {info.getValue()}
                        </div>
                        <div className="mt-xs text-label-dense text-text-secondary">
                            {info.row.original.submitter} • {info.row.original.department}
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor("status", {
                header: "Status",
                cell: (info) => (
                    <Badge status={getStatusBadgeStatus(info.getValue())}>
                        {info.getValue()}
                    </Badge>
                ),
            }),
            columnHelper.accessor("age", {
                header: "Age",
                cell: (info) => (
                    <div className={cn(
                        "text-xs font-medium",
                        info.row.original.slaStatus === "breach" ? "text-error" :
                            info.row.original.slaStatus === "warning" ? "text-warning" :
                                "text-text-secondary"
                    )}>
                        {info.getValue()}
                    </div>
                ),
            }),
            columnHelper.display({
                id: "actions",
                header: "Actions",
                cell: (info) => (
                    <div className="flex gap-xs">
                        <Button size="compact" variant="outline">
                            Approve
                        </Button>
                        <Button size="compact" variant="ghost">
                            Reject
                        </Button>
                    </div>
                ),
                meta: {
                    align: "right",
                },
            }),
        ] as DataTableColumnDef<ApprovalItem>[],
        []
    );

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-surface-app text-label-dense text-text-secondary">
                Loading approval queue...
            </main>
        );
    }

    if (!user) {
        return (
            <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-md">
                <EmptyState
                    className="w-full"
                    title="Approval queue requires sign-in"
                    description="Access required to continue into the approval workflow."
                    status="error"
                    statusLabel="Access required"
                    action={
                        <Link href="/access">
                            <Button>Open Access</Button>
                        </Link>
                    }
                />
            </main>
        );
    }

    return (
        <main className="approval-queue-scope flex min-h-screen flex-col bg-surface-app">
            {/* ZONE 1: PRIMARY REVIEW WORKSPACE */}
            <div className="approval-queue-workspace flex min-h-0 flex-1">
                <div className="approval-queue-main min-h-0 flex-1 flex flex-col">

                    {/* Queue Header */}
                    <section className="approval-queue-header flex-shrink-0 border-b border-border-subtle bg-surface-shell px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        DPR.ai Approval Queue
                                    </span>
                                    <Badge status="processing">Active</Badge>
                                </div>
                                <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                                    Operational Review Workspace
                                </h1>
                                <p className="mt-1 text-sm text-text-secondary">
                                    Enterprise approval queue for attendance, DPR, OCR, and reconciliation workflows
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button size="compact" variant="outline">
                                    Refresh Queue
                                </Button>
                                <Button size="compact">
                                    Review Next
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Operational Alert Banner */}
                    <section className="approval-queue-alerts flex-shrink-0 border-b border-border-subtle bg-status-warning-bg px-6 py-3">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-warning"></div>
                            <span className="text-sm font-medium text-warning">
                                {kpis.slaBreaches} items breaching SLA • {kpis.critical} critical reviews pending
                            </span>
                        </div>
                    </section>

                    {/* KPI Cards */}
                    <section className="approval-queue-kpis flex-shrink-0 border-b border-border-subtle bg-surface-shell px-6 py-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="operational-kpi-card rounded-lg border border-border-subtle bg-surface-card p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Total Items
                                </div>
                                <div className="mt-1 text-2xl font-bold text-text-primary">{kpis.total}</div>
                            </div>
                            <div className="operational-kpi-card rounded-lg border border-border-subtle bg-surface-card p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Pending Review
                                </div>
                                <div className="mt-1 text-2xl font-bold text-warning">{kpis.pending}</div>
                            </div>
                            <div className="operational-kpi-card rounded-lg border border-border-subtle bg-surface-card p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    SLA Breaches
                                </div>
                                <div className="mt-1 text-2xl font-bold text-error">{kpis.slaBreaches}</div>
                            </div>
                            <div className="operational-kpi-card rounded-lg border border-border-subtle bg-surface-card p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Critical Items
                                </div>
                                <div className="mt-1 text-2xl font-bold text-error">{kpis.critical}</div>
                            </div>
                        </div>
                    </section>

                    {/* Priority Focus Cards */}
                    <section className="approval-queue-focus flex-shrink-0 border-b border-border-subtle bg-surface-shell px-6 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="operational-focus-card rounded-lg border border-border-default bg-surface-elevated p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Attendance Review
                                </div>
                                <div className="mt-2 text-sm text-text-primary">
                                    2 missed punches requiring immediate attention
                                </div>
                            </div>
                            <div className="operational-focus-card rounded-lg border border-border-default bg-surface-elevated p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    OCR Validation
                                </div>
                                <div className="mt-2 text-sm text-text-primary">
                                    5 documents with confidence below 85%
                                </div>
                            </div>
                            <div className="operational-focus-card rounded-lg border border-border-default bg-surface-elevated p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Escalation Focus
                                </div>
                                <div className="mt-2 text-sm text-text-primary">
                                    3 items requiring manager approval
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Filter & Bulk Action Workspace */}
                    <section className="approval-queue-filters flex-shrink-0 border-b border-border-subtle bg-surface-shell px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <select
                                    className="input text-sm"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                                <select
                                    className="input text-sm"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value as any)}
                                >
                                    <option value="all">All Types</option>
                                    <option value="attendance">Attendance</option>
                                    <option value="dpr">DPR</option>
                                    <option value="ocr">OCR</option>
                                    <option value="reconciliation">Reconciliation</option>
                                </select>
                                <select
                                    className="input text-sm"
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value as any)}
                                >
                                    <option value="all">All Severity</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-text-secondary">
                                    {filteredItems.length} items • 2 selected
                                </span>
                                <Button size="compact" variant="outline">
                                    Bulk Approve
                                </Button>
                                <Button size="compact" variant="ghost">
                                    Bulk Reject
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Main Approval Table */}
                    <section className="approval-queue-table min-h-0 flex-1 bg-surface-app p-6">
                        <div className="min-h-0 flex-1 rounded-lg border border-border-subtle bg-surface-shell">
                            <DataTable<ApprovalItem>
                                ariaLabel="Approval queue"
                                columns={columns}
                                data={filteredItems}
                                getRowId={(row) => row.id}
                                selectedRowId={selectedItemId}
                                onRowClick={(row) => setSelectedItemId(row.id)}
                                enableGlobalSearch
                                enableStickyFirstColumn
                                enableVirtualization={filteredItems.length > 20}
                                overscan={5}
                                className="h-full w-full"
                                viewportClassName="h-full w-full overflow-y-auto"
                                viewportSize="lg"
                                emptyTitle="No approval items match the current filters"
                                emptyMessage="Adjust the filters or check back later for new items."
                                renderToolbar={
                                    <DataTableToolbar
                                        searchPlaceholder="Search by ID, title, submitter, or department"
                                        searchValue={search}
                                        onSearchChange={setSearch}
                                        onClear={() => setSearch("")}
                                    />
                                }
                                searchValue={search}
                                onSearchChange={setSearch}
                            />
                        </div>
                    </section>
                </div>

                {/* ZONE 2: REVIEW INTELLIGENCE SIDEBAR */}
                <aside className="approval-queue-intelligence w-80 flex-shrink-0 border-l border-border-subtle bg-surface-shell">
                    <div className="flex h-full flex-col">
                        <div className="border-b border-border-subtle px-6 py-4">
                            <h2 className="text-lg font-semibold text-text-primary">Review Intelligence</h2>
                            <p className="mt-1 text-sm text-text-secondary">
                                Active review summary and extracted data
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            {selectedItem ? (
                                <div className="space-y-6">
                                    {/* Active Review Summary */}
                                    <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
                                        <h3 className="text-sm font-semibold text-text-primary">Active Review</h3>
                                        <div className="mt-3 space-y-2">
                                            <div className="text-xs text-text-secondary">ID</div>
                                            <div className="font-mono text-sm text-text-primary">{selectedItem.id}</div>

                                            <div className="text-xs text-text-secondary">Title</div>
                                            <div className="text-sm text-text-primary">{selectedItem.title}</div>

                                            <div className="text-xs text-text-secondary">Submitter</div>
                                            <div className="text-sm text-text-primary">{selectedItem.submitter}</div>

                                            <div className="text-xs text-text-secondary">Department</div>
                                            <div className="text-sm text-text-primary">{selectedItem.department}</div>
                                        </div>
                                    </div>

                                    {/* OCR Preview (if OCR type) */}
                                    {selectedItem.type === "ocr" && (
                                        <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
                                            <h3 className="text-sm font-semibold text-text-primary">OCR Preview</h3>
                                            <div className="mt-3 rounded border border-border-subtle bg-surface-shell p-3">
                                                <div className="text-xs text-text-secondary">Document preview would appear here</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Extracted Metadata */}
                                    <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
                                        <h3 className="text-sm font-semibold text-text-primary">Extracted Data</h3>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-text-secondary">Severity</span>
                                                <Badge status={getSeverityBadgeStatus(selectedItem.severity)}>
                                                    {selectedItem.severity}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-text-secondary">Age</span>
                                                <span className="text-xs text-text-primary">{selectedItem.age}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-text-secondary">SLA Status</span>
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    selectedItem.slaStatus === "breach" ? "text-error" :
                                                        selectedItem.slaStatus === "warning" ? "text-warning" :
                                                            "text-success"
                                                )}>
                                                    {selectedItem.slaStatus}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DPR.ai Interpretation */}
                                    <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
                                        <h3 className="text-sm font-semibold text-text-primary">DPR.ai Interpretation</h3>
                                        <div className="mt-3 text-sm text-text-secondary">
                                            This {selectedItem.type} review requires {selectedItem.severity} priority attention.
                                            The item has been pending for {selectedItem.age} and
                                            {selectedItem.slaStatus === "breach" ? " is breaching SLA requirements." :
                                                selectedItem.slaStatus === "warning" ? " is approaching SLA limits." :
                                                    " is within normal SLA parameters."}
                                        </div>
                                    </div>

                                    {/* Approval Actions */}
                                    <div className="rounded-lg border border-border-subtle bg-surface-card p-4">
                                        <h3 className="text-sm font-semibold text-text-primary">Approval Actions</h3>
                                        <div className="mt-3 space-y-2">
                                            <Button className="w-full" size="compact">
                                                Approve Item
                                            </Button>
                                            <Button className="w-full" variant="ghost" size="compact">
                                                Reject Item
                                            </Button>
                                            <Button className="w-full" variant="outline" size="compact">
                                                Escalate to Manager
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-sm text-text-secondary">
                                            Select an item from the table to view review intelligence
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {/* ZONE 3: FIXED ACTION FOOTER */}
            <footer className="approval-queue-footer flex-shrink-0 border-t border-border-subtle bg-surface-shell px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-text-secondary">
                            Queue Status: {filteredItems.length} items visible
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-success"></div>
                            <span className="text-xs text-text-secondary">System operational</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="compact">
                            Export Queue
                        </Button>
                        <Button variant="outline" size="compact">
                            Queue Settings
                        </Button>
                        <Button size="compact">
                            Process Next Batch
                        </Button>
                    </div>
                </div>
            </footer>
        </main>
    );
}