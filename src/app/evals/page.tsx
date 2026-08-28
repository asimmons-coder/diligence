"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EvalsView } from "@/components/evals/evals-view";

function EvalsInner() {
  const params = useSearchParams();
  return <EvalsView dealId={params.get("deal") ?? undefined} />;
}

export default function EvalsPage() {
  return (
    <Suspense>
      <EvalsInner />
    </Suspense>
  );
}
