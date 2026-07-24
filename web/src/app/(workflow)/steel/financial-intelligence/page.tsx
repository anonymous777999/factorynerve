import type { Metadata } from "next";

import { SteelFinancialIntelligencePage } from "@/components/workflow";

export const metadata: Metadata = {
  title: "Financial Intelligence — DPR.ai",
  description:
    "Revenue, margin, receivables, and cash flow insights for your steel factory.",
};

export default function Page() {
  return <SteelFinancialIntelligencePage />;
}
