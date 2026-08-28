import { VISUAL_CLAIM_LABELS } from "@/lib/constants";
import type { VisualClaimKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<VisualClaimKind, string> = {
  fact: "border-zinc-300 bg-zinc-50 text-zinc-700",
  assumption: "border-emerald-200 bg-emerald-50 text-emerald-800",
  proposed: "border-amber-300 bg-amber-50 text-amber-900",
  inference: "border-amber-200 bg-amber-50/70 text-amber-800",
  conflict: "border-rose-200 bg-rose-50 text-rose-800",
  scenario: "border-zinc-400 bg-white text-zinc-700",
  recommendation: "border-zinc-400 bg-zinc-100 text-zinc-800",
};

export function ClaimChip({ kind }: { kind: VisualClaimKind }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        STYLES[kind]
      )}
    >
      {VISUAL_CLAIM_LABELS[kind]}
    </span>
  );
}
