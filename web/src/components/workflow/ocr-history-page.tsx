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
    return <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading OCR history...</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
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
            className="mt-0 h-12 rounded-[18px] border-[#d4d9df] bg-white text-[#111827] placeholder:text-[#98a2b3] focus:border-[#111827] focus:bg-white focus:ring-[#111827]/10"
          />
          <Link href="/ocr/scan">
            <Button className="h-12 w-full rounded-[18px] bg-[#111827] text-white shadow-none hover:bg-[#1f2937]">
              Scan another image
            </Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#e7eaee] bg-white">
          <div className="grid gap-3 border-b border-[#eff2f5] px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0] md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_10rem]">
            <div>Document</div>
            <div>Type</div>
            <div>Status</div>
            <div>Updated</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-[#eff2f5]">
            {filteredRecords.length ? (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_10rem] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[#111827]">
                      {record.source_filename || `Document #${record.id}`}
                    </div>
                    <div className="mt-1 text-xs text-[#8a93a0]">
                      {Math.round(record.avg_confidence || 0)}% confidence
                    </div>
                  </div>
                  <div className="text-sm text-[#66707c]">{record.doc_type_hint || "table"}</div>
                  <div>
                    <span className="rounded-full border border-[#e5e7eb] bg-[#fbfbfa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#66707c]">
                      {record.status}
                    </span>
                  </div>
                  <div className="text-sm text-[#66707c]">{formatTimestamp(record.updated_at)}</div>
                  <div className="flex justify-end gap-2">
                    <Link href={`/ocr/verify?verification_id=${record.id}`}>
                      <Button variant="outline" className="h-10 rounded-[16px] border-[#d4d9df] bg-[#f8fafc] px-4 text-[#111827] hover:bg-white">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="h-10 rounded-[16px] border-[#d4d9df] bg-[#f8fafc] px-4 text-[#111827] hover:bg-white"
                      disabled={busyId === record.id}
                      onClick={() => void handleDownload(record.id)}
                    >
                      {busyId === record.id ? "..." : "Excel"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-[#8a93a0]">No OCR documents match this search.</div>
            )}
          </div>
        </div>
      </div>
    </OcrShell>
  );
}
