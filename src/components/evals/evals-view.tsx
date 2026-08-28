"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EVAL_ACTION_LABELS } from "@/lib/constants";
import { evaluationsForDeal } from "@/lib/derived-queue";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function EvalsView({ dealId }: { dealId?: string }) {
  const { db, approvePrepared, currentUser } = useStore();
  const [onlyMine, setOnlyMine] = useState(false);
  const rows = useMemo(() => {
    const all = evaluationsForDeal(db, dealId);
    if (!onlyMine) return all;
    return all.filter(
      (e) => e.preparer_user_id === currentUser.id || e.reviewer_user_id === currentUser.id
    );
  }, [db, dealId, onlyMine, currentUser.id]);

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Product evaluations
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {dealId ? "Corrections" : "Corrections across the book"}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-zinc-600">
            Every accept / edit / reject of an extraction, conflict interpretation, or
            recommendation is logged. Alex can see what Giovanni changed without redoing it.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-600">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Mine only
        </label>
      </div>

      <div className="mt-4 overflow-auto rounded-md border bg-white">
        <table className="w-full min-w-[1080px] text-left text-[12px]">
          <thead className="border-b bg-zinc-50 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-1.5">When</th>
              <th className="px-3 py-1.5">Deal</th>
              <th className="px-3 py-1.5">Context</th>
              <th className="px-3 py-1.5">System output</th>
              <th className="px-3 py-1.5">Action</th>
              <th className="px-3 py-1.5">Why / correction</th>
              <th className="px-3 py-1.5">Prepared / reviewed</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deal = db.deals.find((d) => d.id === row.deal_id);
              const preparer = db.users.find((u) => u.id === row.preparer_user_id);
              const reviewer = db.users.find((u) => u.id === row.reviewer_user_id);
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2 tabular text-zinc-500">
                    {row.occurred_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/deals/${row.deal_id}/corrections`} className="hover:underline">
                      {deal?.name ?? row.deal_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.financial_context ?? row.entity_type}</div>
                    <div className="text-[11px] text-zinc-500">
                      {row.document_type ?? "—"} · {row.controlling_source ?? "source TBD"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{row.initial_system_output}</td>
                  <td className="px-3 py-2">{EVAL_ACTION_LABELS[row.analyst_action]}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {row.why_original_was_wrong && <div>{row.why_original_was_wrong}</div>}
                    {row.corrected_answer && (
                      <div className="mt-1 text-[11px]">Corrected: {row.corrected_answer}</div>
                    )}
                    <div className="mt-1 text-[11px] text-zinc-500">{row.final_resolution}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{preparer?.name ?? "—"}</div>
                    <div className="text-[11px] text-zinc-500">
                      {reviewer ? `Approved ${reviewer.name}` : "Awaiting supervisor"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {!row.reviewer_user_id && (
                      <Button size="xs" onClick={() => approvePrepared(row.id)}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No evaluation events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
