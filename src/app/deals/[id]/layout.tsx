"use client";

import { use } from "react";
import { DealWorkspace } from "@/components/deals/deal-workspace";

export default function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DealWorkspace dealId={id}>{children}</DealWorkspace>;
}
