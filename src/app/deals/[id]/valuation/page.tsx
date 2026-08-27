"use client";

import { use } from "react";
import { DealValuation } from "@/components/deals/deal-valuation";

export default function ValuationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealValuation dealId={id} />;
}
