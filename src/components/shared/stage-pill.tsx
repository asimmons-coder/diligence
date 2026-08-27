import { STAGE_LABELS } from "@/lib/constants";
import type { DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StagePill({ stage }: { stage: DealStage }) {
  const tone =
    stage === "passed"
      ? "bg-red-50 text-red-800 border-red-200"
      : stage === "closed"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-zinc-100 text-zinc-700 border-zinc-200";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium",
        tone
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
