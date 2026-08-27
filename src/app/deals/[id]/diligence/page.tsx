"use client";

import { use } from "react";
import { DealDiligence } from "@/components/deals/deal-diligence";

export default function DealDiligencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealDiligence dealId={id} />;
}
