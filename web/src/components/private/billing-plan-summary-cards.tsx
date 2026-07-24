"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BillingPlanSummaryCardsProps = {
  cards: Array<{
    title: string;
    value: string | number;
    detail: string;
  }>;
};

export function BillingPlanSummaryCards({ cards }: BillingPlanSummaryCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">{card.title}</div>
            <CardTitle>{card.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">{card.detail}</CardContent>
        </Card>
      ))}
    </section>
  );
}
