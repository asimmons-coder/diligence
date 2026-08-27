import { APP_AS_OF } from "./constants";

export function formatMoneyCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}$${trimDecimals(abs / 1_000_000_000)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${trimDecimals(abs / 1_000_000)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${trimDecimals(abs / 1_000)}k`;
  }
  return formatMoneyExact(value);
}

function trimDecimals(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatMoneyExact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

export function formatMoneySigned(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const body = formatMoneyExact(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body.replace("$-", "$")}`;
  return body;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}x`;
}

export function formatHeaderMultiple(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}x`;
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * (value > 1 ? 1 : 100) === value && value <= 1
    ? value * 100
    : value
  ).toFixed(digits)}%`;
}

export function formatPercentPoints(
  value: number | null | undefined,
  digits = 1
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(digits)}%`;
}

export function formatShare(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

export function formatMargin(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseIsoDate(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseIsoDate(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelative(iso: string | null | undefined, asOf = APP_AS_OF): string {
  if (!iso) return "—";
  const days = daysBetween(iso, asOf);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  if (days > 1 && days < 14) return `${days}d ago`;
  if (days < 0 && days > -14) return `in ${Math.abs(days)}d`;
  return formatDateShort(iso);
}

export function parseIsoDate(iso: string): Date {
  const day = iso.slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`);
}

export function daysBetween(fromIso: string, toIso = APP_AS_OF): number {
  const from = parseIsoDate(fromIso).getTime();
  const to = parseIsoDate(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOnOrBefore(iso = APP_AS_OF): string {
  const date = parseIsoDate(iso);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addDays(iso, -offset);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function locationLine(city: string, state: string): string {
  return `${city}, ${state}`;
}

export function assertReconcile(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.51) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
