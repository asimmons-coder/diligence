"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SOURCE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { formatHeaderMultiple, formatMoneyCompact } from "@/lib/format";
import { useStore } from "@/lib/store";
import { DEAL_STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FlagPills } from "@/components/shared/flags";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/financials", label: "Financials" },
  { href: "/diligence", label: "Diligence" },
  { href: "/documents", label: "Documents" },
  { href: "/activity", label: "Activity" },
];

export function DealWorkspace({
  dealId,
  children,
}: {
  dealId: string;
  children: React.ReactNode;
}) {
  const { dealView } = useStore();
  const pathname = usePathname();
  const view = dealView(dealId);

  if (!view) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Deal not in this organization store.
      </div>
    );
  }

  const { deal } = view;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-white px-5 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">{deal.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-zinc-600">
              <span className="tabular font-medium text-zinc-900">
                {formatMoneyCompact(view.revenue)} Revenue
              </span>
              <span className="text-zinc-300">|</span>
              <span className="tabular">
                {formatMoneyCompact(view.reportedEbitda)} Reported EBITDA
              </span>
              <span className="text-zinc-300">|</span>
              <span className="tabular">
                {formatMoneyCompact(view.proFormaEbitda)} Pro Forma EBITDA
              </span>
              <span className="text-zinc-300">|</span>
              <span className="tabular">
                {formatHeaderMultiple(view.headerMultiple)} Implied Multiple
              </span>
              <span className="text-zinc-300">|</span>
              <span className="tabular">{view.diligencePct}% Diligence Complete</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
              <span>{view.owner.name}</span>
              <span>·</span>
              <span>
                {deal.location_city}, {deal.location_state}
              </span>
              <span>·</span>
              <span>
                {SOURCE_LABELS[deal.source]} · {deal.source_detail}
              </span>
              <FlagPills flags={deal.flags} />
            </div>
          </div>
        </div>
        <ol className="mt-3 flex flex-wrap gap-1 pb-1">
          {DEAL_STAGES.map((stage) => {
            const current = deal.stage === stage;
            const passedIdx = DEAL_STAGES.indexOf(deal.stage);
            const idx = DEAL_STAGES.indexOf(stage);
            const done = idx < passedIdx && deal.stage !== "passed";
            return (
              <li
                key={stage}
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                  current
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : done
                      ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                      : "border-transparent text-zinc-400"
                )}
              >
                {STAGE_LABELS[stage]}
              </li>
            );
          })}
        </ol>
        <nav className="mt-2 flex gap-4 text-[13px]">
          {TABS.map((tab) => {
            const href = `/deals/${deal.id}${tab.href}`;
            const active =
              tab.href === ""
                ? pathname === `/deals/${deal.id}`
                : pathname === href;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "-mb-px border-b-2 py-2",
                  active
                    ? "border-zinc-900 font-medium text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
