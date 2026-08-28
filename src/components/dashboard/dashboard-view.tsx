"use client";

import Link from "next/link";
import { STAGE_LABELS } from "@/lib/constants";
import { formatDate, formatMoneyCompact, formatRelative } from "@/lib/format";
import { isActiveStage } from "@/lib/derived";
import { useStore } from "@/lib/store";
import { DEAL_STAGES } from "@/lib/types";
import { Money } from "@/components/shared/money";
import { StagePill } from "@/components/shared/stage-pill";

export function DashboardView() {
  const { portfolio, views, currentUser } = useStore();
  const active = views.filter((v) => isActiveStage(v.deal.stage));
  const maxFunnel = Math.max(...portfolio.funnel.map((f) => f.count), 1);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-5">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Morning command
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {currentUser.name.split(" ")[0]}, the book as of 27 Aug
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-zinc-600">
            Active capital is probability-weighted. Adjusted EBITDA is accepted/normalized only —
            proposed add-backs and synergies stay out until someone accepts them.
          </p>
        </div>
        <div className="text-right">
          <Link
            href="/deals/new"
            className="inline-flex rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-zinc-800"
          >
            New deal
          </Link>
          <div className="mt-2 text-[12px] text-muted-foreground">Northline Legal · seed book</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-6">
        <Stat
          label="Active deals"
          value={String(portfolio.activeDeals)}
          hint="Excludes Closed / Passed"
        />
        <Stat
          label="In diligence"
          value={String(portfolio.diligenceDeals)}
          hint="Diligence + Confirmatory"
        />
        <Stat
          label="LOIs outstanding"
          value={String(portfolio.loisOutstanding)}
          hint="LOI through Closing"
        />
        <Stat
          label="Expected capital"
          value={formatMoneyCompact(portfolio.expectedCapital)}
          hint="Price × probability"
        />
        <Stat
          label="Pipeline revenue"
          value={formatMoneyCompact(portfolio.pipelineRevenue)}
          hint="Latest period, active"
        />
        <Stat
          label="Pipeline adj. EBITDA"
          value={formatMoneyCompact(portfolio.pipelineAdjustedEbitda)}
          hint="Accepted / normalized"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">Needs attention</h2>
          <div className="overflow-hidden rounded-md border bg-white">
            {portfolio.attention.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                Nothing flagged. The book is quiet.
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="border-b bg-zinc-50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2">Deal</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.attention.slice(0, 14).map((item) => (
                    <tr key={`${item.dealId}-${item.reason}-${item.detail}`} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/deals/${item.dealId}`} className="hover:underline">
                          {item.dealName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-amber-800">{item.label}</td>
                      <td className="px-3 py-2 text-zinc-600">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-semibold">Stage funnel</h2>
          <div className="space-y-1.5 rounded-md border bg-white p-3">
            {portfolio.funnel.map((row) => (
              <div key={row.stage} className="flex items-center gap-2 text-[12px]">
                <div className="w-[148px] shrink-0 text-zinc-600">{STAGE_LABELS[row.stage]}</div>
                <div className="h-2 min-w-0 flex-1 bg-zinc-100">
                  <div
                    className="h-2 bg-zinc-800"
                    style={{ width: `${(row.count / maxFunnel) * 100}%` }}
                  />
                </div>
                <div className="tabular w-4 text-right font-medium">{row.count}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold">Active book</h2>
        <div className="overflow-hidden rounded-md border bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b bg-zinc-50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">Firm</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Norm. EBITDA</th>
                <th className="px-3 py-2">Next action</th>
                <th className="px-3 py-2">Readiness</th>
                <th className="px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {active
                .slice()
                .sort((a, b) => DEAL_STAGES.indexOf(b.deal.stage) - DEAL_STAGES.indexOf(a.deal.stage))
                .map((v) => (
                  <tr key={v.deal.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/deals/${v.deal.id}`} className="font-medium hover:underline">
                        {v.deal.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {v.deal.location_city}, {v.deal.location_state}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StagePill stage={v.deal.stage} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={v.revenue} compact />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money value={v.normalizedEbitda} compact />
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {v.nextAction
                        ? `${v.nextAction.title} · ${formatDate(v.nextAction.due_date)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-zinc-600">
                      {v.readiness.overall.replaceAll("_", " ")}
                      {v.openConflictCount > 0 && (
                        <div className="text-[11px] text-amber-800">
                          {v.openConflictCount} conflicts
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatRelative(v.deal.last_activity_at)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white px-3 py-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[20px] leading-none font-medium tracking-tight">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-zinc-500">{hint}</div>
    </div>
  );
}
