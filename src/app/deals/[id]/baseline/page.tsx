"use client";

import { use } from "react";
import { DealBaseline } from "@/components/deals/deal-baseline";

export default function BaselinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealBaseline dealId={id} />;
}
