"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canUseOcrScan } from "@/lib/ocr-access";
import {
  downloadOcrVerificationExport,
  listOcrVerifications,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import { triggerBlobDownload } from "@/lib/reports";
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
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !canUseOcrScan(user.role)) return;
    listOcrVerifications()
      .then(setRecords)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load OCR history."));
  }, [user]);

  const handleDownload = async (recordId: number) => {
    setBusyId(recordId);
    setError("");
    setStatus("");
    try {
      const download = await downloadOcrVerificationExport(recordId);
      triggerBlobDownload(download.blob, download.filename);
      setStatus(`Downloaded export for document #${recordId}.`);
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
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">OCR</div>
            <h1 className="mt-2 text-3xl font-semibold">Document history</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review prior OCR drafts, dedupe hits, and trusted exports from the current verification system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/ocr/scan">
              <Button>Scan a Document</Button>
            </Link>
            <Link href="/ocr/verify">
              <Button variant="outline">Open Review Queue</Button>
            </Link>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent OCR Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.length ? (
              records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-4 rounded-[1.4rem] border border-[var(--border)] bg-[var(--card-strong)] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-center">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Document</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{record.source_filename || `Document #${record.id}`}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Type</div>
                      <div className="mt-1 text-sm text-[var(--text)]">{record.doc_type_hint || "table"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Status</div>
                      <div className="mt-1 text-sm text-[var(--text)]">{record.status}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Confidence</div>
                      <div className="mt-1 text-sm text-[var(--text)]">{Math.round(record.avg_confidence || 0)}%</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Updated</div>
                      <div className="mt-1 text-sm text-[var(--text)]">{formatTimestamp(record.updated_at)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/ocr/verify?verification_id=${record.id}`}>
                      <Button variant="outline">Open</Button>
                    </Link>
                    <Button variant="outline" disabled={busyId === record.id} onClick={() => void handleDownload(record.id)}>
                      {busyId === record.id ? "Preparing..." : "Export Excel"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                No OCR documents yet.
              </div>
            )}
          </CardContent>
        </Card>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error ? <div className="text-sm text-red-400">{error}</div> : null}
      </div>
    </main>
  );
}
