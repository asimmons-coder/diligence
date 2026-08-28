"use client";

import { use } from "react";
import { DealIntake } from "@/components/deals/deal-intake";

export default function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealIntake dealId={id} />;
}
