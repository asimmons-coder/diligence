"use client";

import { use } from "react";
import { EvalsView } from "@/components/evals/evals-view";

export default function CorrectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EvalsView dealId={id} />;
}
