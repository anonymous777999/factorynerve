"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import OcrPage from "@/components/ocr-page";
import { getOcrJob } from "@/lib/ocr";
import { queryKeys } from "@/lib/query-keys";

type OcrJobRoutePageProps = {
  params: {
    jobId: string;
  };
};

export default function OcrJobRoutePage({
  params,
}: OcrJobRoutePageProps) {
  const jobId = params.jobId;

  const { data: job, isLoading, isError } = useQuery({
    queryKey: queryKeys.ocr.job(jobId),
    queryFn: () => getOcrJob(jobId),
    staleTime: 10_000,
    enabled: Boolean(jobId),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading job...
      </main>
    );
  }

  if (isError || !job) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-lg font-semibold text-[var(--text)]">Job not found</div>
        <Link href="/ocr/jobs" className="text-sm text-[var(--accent)] underline-offset-4 hover:underline">
          Back to /ocr/jobs
        </Link>
      </main>
    );
  }

  return <OcrPage initialJob={job} />;
}
