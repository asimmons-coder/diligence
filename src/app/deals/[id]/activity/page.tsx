"use client";

import { use } from "react";
import { DealActivity } from "@/components/deals/deal-activity";

export default function DealActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealActivity dealId={id} />;
}
