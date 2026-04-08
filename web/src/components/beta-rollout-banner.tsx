"use client";

import { useDisplayMode } from "@/lib/use-display-mode";

const betaStage = (process.env.NEXT_PUBLIC_BETA_STAGE || "").trim();
const betaBannerText = (process.env.NEXT_PUBLIC_BETA_BANNER_TEXT || "").trim();
const betaFeedbackUrl = (process.env.NEXT_PUBLIC_BETA_FEEDBACK_URL || "").trim();
const releaseVersion = (process.env.NEXT_PUBLIC_RELEASE_VERSION || "").trim();

export function BetaRolloutBanner() {
  const { standalone } = useDisplayMode();

  if (!betaStage || standalone) return null;

  return (
    <div className="border-b border-amber-400/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(249,115,22,0.08))] px-4 py-3 text-sm text-amber-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
            Beta {betaStage}
          </span>
          <span className="leading-6">
            {betaBannerText || "This release is under monitored beta rollout. Please report anything that feels off before full cutover."}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em]">
          {releaseVersion ? <span>Release {releaseVersion}</span> : null}
          {betaFeedbackUrl ? (
            <a
              href={betaFeedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-amber-300/30 px-3 py-1 transition hover:bg-amber-300/10"
            >
              Send Feedback
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
