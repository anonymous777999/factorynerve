"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/ocr/error-banner";
import { OcrShell } from "@/components/ocr/ocr-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canUseOcrScan } from "@/lib/ocr-access";
import {
  downloadOcrVerificationExport,
  listOcrVerifications,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import { transferBlob } from "@/lib/blob-transfer";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OcrHistoryPage() {
  const { user, loading, error: sessionError } = useSession();
  const [records, setRecords] = useState<OcrVerificationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !canUseOcrScan(user.role)) return;
    listOcrVerifications()
      .then((items) =>
        setRecords(
          [...items].sort(
            (left, right) =>
              new Date(right.updated_at || 0).getTime() -
              new Date(left.updated_at || 0).getTime(),
          ),
        ),
      )
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Could not load OCR history."),
      );
  }, [user]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [
        record.source_filename,
        record.doc_type_hint,
        record.status,
        record.template_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);

  const handleDownload = async (recordId: number) => {
    setBusyId(recordId);
    setError("");
    setStatus("");
    try {
      const download = await downloadOcrVerificationExport(recordId);
      const result = await transferBlob(download.blob, download.filename);
      setStatus(result === "shared" ? `Shared export for document #${recordId}.` : `Downloaded export for document #${recordId}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not download OCR export.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canUseOcrScan(user.role)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">Your role does not have access to OCR history.</div>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OcrShell
      title="Recent OCR documents"
      subtitle="Reopen past runs, check their status, and download the latest export."
      step="result"
    >
      <div className="space-y-4">
        {status ? <ErrorBanner tone="success" message={status} /> : null}
        {error ? <ErrorBanner message={error} actionLabel="Scan again" onAction={() => window.location.assign("/ocr/scan")} /> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file, type, or status"
            className="mt-0"
          />
          <Link href="/ocr/scan">
            <Button className="h-12 w-full rounded-xl">
              Scan another image
            </Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-section border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
          <div className="grid gap-3 border-b border-[var(--border)] px-4 py-4 text-[11px] font-semibold uppercase tracking-label text-[var(--muted)] md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_10rem]">
            <div>Document</div>
            <div>Type</div>
            <div>Status</div>
            <div>Updated</div>
            <div className="text-right">Action</div>
          </div>
          <div className="max-h-[65vh] divide-y divide-[var(--border)] overflow-y-auto">
            {filteredRecords.length ? (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_10rem] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--text)]">
                      {record.source_filename || `Document #${record.id}`}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {Math.round(record.avg_confidence || 0)}% confidence
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">{record.doc_type_hint || "table"}</div>
                  <div>
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.72)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                      {record.status}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--muted)]">{formatTimestamp(record.updated_at)}</div>
                  <div className="flex justify-end gap-2">
                    <Link href={`/ocr/verify?verification_id=${record.id}`}>
                      <Button variant="outline" className="h-10 rounded-xl px-4">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl px-4"
                      disabled={busyId === record.id}
                      onClick={() => void handleDownload(record.id)}
                    >
                      {busyId === record.id ? "..." : "Excel"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">No OCR documents match this search.</div>
            )}
          </div>
        </div>
      </div>
    </OcrShell>
  );
}
