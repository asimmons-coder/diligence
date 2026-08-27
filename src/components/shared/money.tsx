import { cn } from "@/lib/utils";
import { formatMoneyCompact, formatMoneyExact, formatMoneySigned } from "@/lib/format";

export function Money({
  value,
  compact = false,
  signed = false,
  className,
}: {
  value: number | null | undefined;
  compact?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const text = signed
    ? formatMoneySigned(value)
    : compact
      ? formatMoneyCompact(value)
      : formatMoneyExact(value);
  const tone =
    signed && value != null
      ? value > 0
        ? "text-emerald-700"
        : value < 0
          ? "text-red-700"
          : ""
      : "";
  return (
    <span className={cn("tabular", tone, className)}>
      {text}
    </span>
  );
}
