"use client";

import { use } from "react";
import { DealFinancials } from "@/components/deals/deal-financials";

export default function DealFinancialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealFinancials dealId={id} />;
}
