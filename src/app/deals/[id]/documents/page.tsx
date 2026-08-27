"use client";

import { use } from "react";
import { DealDocuments } from "@/components/deals/deal-documents";

export default function DealDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealDocuments dealId={id} />;
}
