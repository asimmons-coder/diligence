"use client";

import { use } from "react";
import { DealEvidence } from "@/components/deals/deal-evidence";

export default function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealEvidence dealId={id} />;
}
