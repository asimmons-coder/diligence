"use client";

import Link from "next/link";
import { OVERALL_READINESS_LABELS } from "@/lib/constants";
import { formatDate, formatMoneyExact } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ClaimChip } from "@/components/shared/claim-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function DealOverview({ dealId }: { dealId: string }) {
  const { dealView, db, setTaskComplete, markDealReviewed } = useStore();
  const view = dealView(dealId);
  if (!view) return null;

  return (
    <div className="grid grid-cols-1 gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section>
          <h2 className="mb-1.5 text-[13px] font-semibold">Deal summary</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-zinc-700">{view.deal.summary}</p>
          {(view.deal.external_system || db.import_events.some((e) => e.deal_id === dealId)) && (
            <div className="mt-3 rounded-md border bg-white px-3 py-2 text-[12px] text-zinc-600">
              <div className="font-medium text-zinc-800">Source-system boundary</div>
              <div>
                {view.deal.external_system ?? "local"} · {view.deal.external_deal_id ?? "—"}
                {view.deal.external_deal_url && (
                  <>
                    {" · "}
                    <a href={view.deal.external_deal_url} className="underline">
                      External record
                    </a>
                  </>
                )}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Imported {view.deal.external_imported_at?.slice(0, 10) ?? "—"} · updated{" "}
                {view.deal.external_updated_at?.slice(0, 10) ?? "—"}. Diligence remains
                authoritative for underwriting. Change events are stored, not sent.
              </div>
              <ul className="mt-1 text-[11px]">
                {db.import_events
                  .filter((e) => e.deal_id === dealId)
                  .map((e) => (
                    <li key={e.id}>
                      {e.source_system} · {e.event_type}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
        <section className="rounded-md border bg-white p-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">AI deal assessment</h2>
            <span className="text-[11px] text-amber-800">Inference + approved assumptions</span>
          </div>
          <p className="text-[13px] leading-relaxed text-zinc-700">{view.deal.ai_assessment}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div className="rounded-sm bg-zinc-50 px-2 py-1.5">
              <div className="text-muted-foreground">Reported</div>
              <div className="tabular font-medium">{formatMoneyExact(view.reportedEbitda)}</div>
            </div>
            <div className="rounded-sm bg-zinc-50 px-2 py-1.5">
              <div className="text-muted-foreground">Normalized (accepted)</div>
              <div className="tabular font-medium">{formatMoneyExact(view.normalizedEbitda)}</div>
            </div>
            <div className="rounded-sm border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5">
              <div className="text-amber-900">Pro forma (incl. proposed)</div>
              <div className="tabular font-medium">{formatMoneyExact(view.proFormaEbitda)}</div>
            </div>
          </div>
        </section>
        <section className="rounded-md border bg-white p-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Since your last review</h2>
            <Button size="xs" variant="outline" onClick={() => markDealReviewed(dealId)}>
              Mark reviewed
            </Button>
          </div>
          <p className="mb-2 text-[11px] text-zinc-500">
            Last review {view.deal.last_reviewed_at ? formatDate(view.deal.last_reviewed_at) : "never"}.
            Accepted financials change only when a human accepts an adjustment.
          </p>
          <ul className="space-y-2">
            {view.digest.slice(0, 8).map((item) => (
              <li key={item.id} className="border-l-2 border-zinc-200 pl-2">
                <div className="flex items-center gap-1.5">
                  <ClaimChip kind={item.kind} />
                  {item.requiresAction && (
                    <span className="text-[10px] font-medium text-amber-800">Needs action</span>
                  )}
                </div>
                <div className="text-[13px]">{item.whatChanged}</div>
                <div className="text-[12px] text-zinc-600">{item.whyItMatters}</div>
                <div className="text-[11px] text-muted-foreground">
                  {item.evidenceLabel}
                  {item.acceptedFinancialsChanged ? " · accepted financials changed" : " · accepted financials unchanged"}
                  {item.href && (
                    <>
                      {" · "}
                      <Link href={item.href} className="underline">
                        Open
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
            {view.digest.length === 0 && (
              <li className="text-[12px] text-muted-foreground">Nothing new since last review.</li>
            )}
          </ul>
        </section>
        <section className="rounded-md border bg-white p-3">
          <h2 className="mb-1 text-[13px] font-semibold">
            Readiness · {OVERALL_READINESS_LABELS[view.readiness.overall]}
          </h2>
          <p className="mb-2 text-[12px] text-zinc-600">{view.readiness.summary}</p>
          <ul className="space-y-1.5 text-[12px]">
            {view.readiness.dimensions.map((d) => (
              <li key={d.key}>
                <span className="font-medium">{d.label}</span>
                <span className="text-zinc-500"> · {d.status.replaceAll("_", " ")}</span>
                {d.blockingItems[0] && (
                  <div className="text-amber-800">{d.blockingItems[0]}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-1.5 text-[13px] font-semibold">Attention required</h2>
          <ul className="space-y-1.5">
            {view.deal.attention_items.map((item) => (
              <li key={item} className="flex gap-2 text-[13px]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-1.5 text-[13px] font-semibold">Recent activity</h2>
          <ol className="space-y-2">
            {view.activities.slice(0, 8).map((a) => {
              const actor = a.actor_user_id
                ? db.users.find((u) => u.id === a.actor_user_id)
                : null;
              return (
                <li key={a.id} className="border-l-2 border-zinc-200 pl-3">
                  <div className="text-[13px] font-medium">{a.title}</div>
                  <div className="text-[12px] text-zinc-600">{a.body}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {actor?.name ?? "System"} · {formatDate(a.occurred_at)}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <aside className="space-y-4">
        <section className="rounded-md border bg-white p-3">
          <h2 className="mb-2 text-[13px] font-semibold">Next actions</h2>
          <ul className="space-y-2">
            {view.tasks.length === 0 && (
              <li className="text-[12px] text-muted-foreground">No open tasks.</li>
            )}
            {view.tasks.map((task) => {
              const owner = db.users.find((u) => u.id === task.owner_user_id);
              return (
                <li key={task.id} className="flex items-start gap-2 text-[13px]">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={(v) => setTaskComplete(task.id, Boolean(v))}
                    className="mt-0.5"
                  />
                  <div className={task.completed ? "text-zinc-400 line-through" : ""}>
                    <div>{task.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {owner?.name} · {formatDate(task.due_date)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        {view.deal.vertical === "legal" && (
          <section className="rounded-md border bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">Vertical profile</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[12px]">
              <dt className="text-muted-foreground">Attorneys</dt>
              <dd className="tabular">{String(view.deal.vertical_metrics.attorney_count ?? "—")}</dd>
              <dt className="text-muted-foreground">Partners</dt>
              <dd className="tabular">{String(view.deal.vertical_metrics.partner_count ?? "—")}</dd>
              <dt className="text-muted-foreground">Rev / attorney</dt>
              <dd className="tabular">
                {view.deal.vertical_metrics.revenue_per_attorney
                  ? formatMoneyExact(Number(view.deal.vertical_metrics.revenue_per_attorney))
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Top-3 concentration</dt>
              <dd className="tabular">
                {view.deal.vertical_metrics.revenue_concentration_top3
                  ? `${Math.round(Number(view.deal.vertical_metrics.revenue_concentration_top3) * 100)}%`
                  : "—"}
              </dd>
            </dl>
            {Array.isArray(view.deal.vertical_metrics.practice_area_mix) && (
              <div className="mt-2 text-[12px] text-zinc-600">
                {view.deal.vertical_metrics.practice_area_mix
                  .map((p) => `${p.name} ${Math.round(p.share * 100)}%`)
                  .join(" · ")}
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
