"use client";

import { use } from "react";
import { DealOverview } from "@/components/deals/deal-overview";

export default function DealOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealOverview dealId={id} />;
}
