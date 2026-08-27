"use client";

import { formatDate, formatMoneyExact } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";

export function DealOverview({ dealId }: { dealId: string }) {
  const { dealView, db, setTaskComplete } = useStore();
  const view = dealView(dealId);
  if (!view) return null;

  return (
    <div className="grid grid-cols-1 gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section>
          <h2 className="mb-1.5 text-[13px] font-semibold">Deal summary</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-zinc-700">{view.deal.summary}</p>
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
