"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { canApproveOcrVerification, canUseOcrVerification } from "@/lib/ocr-access";
import { type OcrVerificationRecord } from "@/lib/ocr";
import { useOcrVerifyRouteState } from "@/hooks/use-ocr-verify-route-state";
import {
  useApproveOcrVerificationMutation,
  useOcrVerifyDetailQuery,
  useOcrVerifyQueueQuery,
  useSubmitOcrVerificationMutation,
} from "@/hooks/use-ocr-verify-queries";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";
import { mapOcrQueueToWorkspace, mapOcrVerificationToWorkspace } from "@/v2/adapters";
import { OCRExecutionWorkspace } from "@/v2/_governed/src/workspaces/OCRExecutionWorkspace";

async function advanceRecord(
  record: OcrVerificationRecord,
  canApprove: boolean,
  submit: ReturnType<typeof useSubmitOcrVerificationMutation>,
  approve: ReturnType<typeof useApproveOcrVerificationMutation>,
) {
  if (record.status === "approved") {
    return record;
  }

  let current = record;
  if (record.status === "draft" || record.status === "rejected") {
    current = await submit.mutateAsync({
      id: record.id,
      reviewerNotes: record.reviewer_notes || undefined,
    });
  }

  if (canApprove) {
    current = await approve.mutateAsync({
      id: current.id,
      reviewerNotes: current.reviewer_notes || undefined,
    });
  }

  return current;
}

export function GovernedOcrVerificationPage() {
  const route = useOcrVerifyRouteState();
  const { user, loading, error: sessionError } = useSession();
  const canVerify = canUseOcrVerification(user?.role);
  const canApprove = canApproveOcrVerification(user?.role);
  const queueQuery = useOcrVerifyQueueQuery({ search: route.search, status: route.status }, canVerify);
  const detailQuery = useOcrVerifyDetailQuery(route.id, canVerify);
  const submitMutation = useSubmitOcrVerificationMutation();
  const approveMutation = useApproveOcrVerificationMutation();
  const [banner, setBanner] = useState<string>("");
  const [localError, setLocalError] = useState<string>("");

  const queueRecords = queueQuery.data ?? [];
  const activeDetail = detailQuery.data ?? null;

  const workspaceRecords = useMemo(() => {
    const mapped = mapOcrQueueToWorkspace(queueRecords);
    if (!activeDetail) {
      return mapped;
    }

    const detailed = mapOcrVerificationToWorkspace(activeDetail);
    return mapped.some((record) => record.verificationId === activeDetail.id)
      ? mapped.map((record) => (record.verificationId === activeDetail.id ? detailed : record))
      : [detailed, ...mapped];
  }, [activeDetail, queueRecords]);

  const activeRecordId = route.id != null ? String(route.id) : workspaceRecords[0]?.queue.id;
  const workspaceBusy =
    queueQuery.isFetching ||
    detailQuery.isFetching ||
    submitMutation.isPending ||
    approveMutation.isPending;

  const handleOpenDocument = (recordId: string) => {
    route.openVerification(Number(recordId), 3, "workspace");
  };

  const handleApproveDocuments = async (recordIds: Iterable<string>) => {
    setLocalError("");
    setBanner("");
    try {
      const ids = Array.from(recordIds).map((value) => Number(value));
      for (const record of queueRecords.filter((item) => ids.includes(item.id))) {
        await advanceRecord(record, canApprove, submitMutation, approveMutation);
      }
      await queueQuery.refetch();
      await detailQuery.refetch();
      signalWorkflowRefresh("ocr-governed-advanced");
      setBanner(
        canApprove
          ? `Governed OCR workspace approved ${ids.length} document${ids.length === 1 ? "" : "s"} through the real review queue.`
          : `Governed OCR workspace submitted ${ids.length} document${ids.length === 1 ? "" : "s"} into the real approval queue.`,
      );
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not advance the selected OCR document(s)."));
    }
  };

  const handleEscalateDocument = (recordId: string) => {
    route.openVerification(Number(recordId), 3, "workspace");
    setBanner("Manual correction and rejection capture stay in the legacy editor during phase 1. Use the legacy edit link for cell-level changes.");
  };

  const handleApplyFieldCorrection = (_recordId: string, _fieldId: string) => {
    setBanner("Cell-level correction remains in the legacy editor during phase 1. This governed workspace is currently read-through, queue-driven, and approval-capable.");
  };

  const handleCompleteReview = async () => {
    if (!route.id || !activeDetail) {
      return;
    }
    await handleApproveDocuments([String(activeDetail.id)]);
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-text-secondary">Loading OCR workspace…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-8">
          <h1 className="text-xl font-semibold">Document review requires sign-in</h1>
          <p className="text-sm text-text-secondary">{sessionError || "Open access to continue into the OCR workspace."}</p>
          <Link href="/access" className="inline-flex rounded-xl border px-4 py-2">
            Open Access
          </Link>
        </div>
      </main>
    );
  }

  if (!canVerify) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-8">
          <h1 className="text-xl font-semibold">Document review is not available for this role</h1>
          <p className="text-sm text-text-secondary">Review access is limited to supervisors, managers, admins, and owners.</p>
          <Link href="/dashboard" className="inline-flex rounded-xl border px-4 py-2">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="dpr-governed-ocr min-h-screen bg-[#0f141b]">
      {(localError || queueQuery.error || detailQuery.error) ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {localError ||
            formatApiErrorMessage(queueQuery.error || detailQuery.error, "Could not load the governed OCR workspace.")}
        </div>
      ) : null}
      {banner ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}
      <div className="border-b border-white/10 bg-black/20 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/60">
        Governed OCR workspace is feature-gated.{" "}
        <Link href={`/ocr/verify?id=${route.id ?? ""}&workspace=legacy`} className="text-amber-300 underline underline-offset-4">
          Open legacy edit lane
        </Link>
      </div>
      <OCRExecutionWorkspace
        records={workspaceRecords}
        selectedDocumentId={activeRecordId}
        loading={workspaceBusy}
        onApproveDocuments={handleApproveDocuments}
        onApplyFieldCorrection={handleApplyFieldCorrection}
        onCompleteActiveReview={handleCompleteReview}
        onEscalateDocument={handleEscalateDocument}
        onSelectDocument={handleOpenDocument}
      />
    </main>
  );
}
