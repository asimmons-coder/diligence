import { FLAG_LABELS } from "@/lib/constants";
import type { DealFlagCode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function FlagPills({ flags }: { flags: DealFlagCode[] }) {
  if (flags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((flag) => (
        <Badge
          key={flag}
          variant="outline"
          className="h-5 rounded-sm border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-900"
        >
          {FLAG_LABELS[flag] ?? flag}
        </Badge>
      ))}
    </span>
  );
}
