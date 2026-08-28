"use client";

import { use } from "react";
import { DealPackage } from "@/components/deals/deal-package";

export default function PackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DealPackage dealId={id} />;
}
