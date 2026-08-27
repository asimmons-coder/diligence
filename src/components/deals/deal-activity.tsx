"use client";

import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";

export function DealActivity({ dealId }: { dealId: string }) {
  const { dealView, db } = useStore();
  const view = dealView(dealId);
  if (!view) return null;

  return (
    <div className="px-5 py-4">
      <h2 className="mb-3 text-[13px] font-semibold">Activity and audit</h2>
      <ol className="space-y-3">
        {view.activities.map((a) => {
          const actor = a.actor_user_id
            ? db.users.find((u) => u.id === a.actor_user_id)
            : null;
          return (
            <li key={a.id} className="grid grid-cols-[88px_1fr] gap-3 border-b pb-3 last:border-0">
              <div className="text-[11px] text-muted-foreground">{formatDate(a.occurred_at)}</div>
              <div>
                <div className="text-[13px] font-medium">{a.title}</div>
                <div className="text-[12px] text-zinc-600">{a.body}</div>
                <div className="text-[11px] text-muted-foreground">
                  {actor?.name ?? "System"} · {a.kind.replaceAll("_", " ")}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {view.notes.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold">Notes</h3>
          <div className="space-y-2">
            {view.notes.map((n) => {
              const author = db.users.find((u) => u.id === n.author_user_id);
              return (
                <blockquote key={n.id} className="rounded-md border bg-white px-3 py-2">
                  <p className="text-[13px] leading-relaxed">{n.body}</p>
                  <footer className="mt-1 text-[11px] text-muted-foreground">
                    {author?.name} · {formatDate(n.created_at)}
                  </footer>
                </blockquote>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
