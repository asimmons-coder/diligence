"use client";

import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ClaimChip } from "@/components/shared/claim-chip";
import { Button } from "@/components/ui/button";
import type { VisualClaimKind } from "@/lib/types";

export function DealEvidence({ dealId }: { dealId: string }) {
  const { dealView, reviewInterpretation } = useStore();
  const view = dealView(dealId);
  if (!view) return null;

  const emails = view.evidenceItems.filter((e) => e.kind === "email");
  const notes = view.evidenceItems.filter(
    (e) => e.kind === "meeting_note" || e.kind === "transcript"
  );

  return (
    <div className="space-y-6 px-5 py-4">
      <p className="text-[12px] text-zinc-600">
        Connector fields are on every item (Gmail thread id, Granola meeting id). Live auth is
        not wired. Ingest proposes interpretations — you approve before diligence status or
        adjustment posture changes. Accepted financials never move silently.
      </p>

      <section className="grid gap-4 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Seller threads</h2>
          <div className="space-y-3">
            {emails.map((email) => (
              <article key={email.id} className="rounded-md border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-medium">{email.subject ?? email.title}</div>
                  <ClaimChip kind="fact" />
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {email.sender} · {email.occurred_at ? formatDate(email.occurred_at) : ""} ·{" "}
                  {email.source_system} {email.external_thread_id}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">
                  {email.body}
                </p>
                <div className="mt-2 text-[11px] text-zinc-500">
                  Participants: {email.participants.join(", ") || "—"}
                </div>
              </article>
            ))}
            {emails.length === 0 && (
              <div className="rounded-md border px-3 py-6 text-center text-[13px] text-muted-foreground">
                No emails ingested yet.
              </div>
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Meeting notes</h2>
          <div className="space-y-3">
            {notes.map((note) => (
              <article key={note.id} className="rounded-md border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-medium">{note.title}</div>
                  <ClaimChip kind="inference" />
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {note.author} · {note.occurred_at ? formatDate(note.occurred_at) : ""} ·{" "}
                  {note.source_system} {note.external_meeting_id}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">
                  {note.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">Proposed interpretations</h2>
        <div className="space-y-3">
          {view.interpretations.map((interp) => (
            <article key={interp.id} className="rounded-md border bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ClaimChip kind={kindForInterp(interp.kind)} />
                <h3 className="text-[13px] font-medium">{interp.title}</h3>
                <span className="text-[11px] capitalize text-zinc-500">
                  {interp.review_status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-zinc-700">{interp.summary}</p>
              <p className="mt-1 text-[12px] text-zinc-600">
                <span className="font-medium">If approved · </span>
                {interp.impact_summary}
              </p>
              {interp.accepted_financials_would_change && (
                <p className="mt-1 text-[12px] text-rose-800">
                  This would change accepted financials — still requires your click.
                </p>
              )}
              {interp.review_status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => reviewInterpretation(interp.id, "approved")}>
                    Approve interpretation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewInterpretation(interp.id, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              {interp.review_status === "approved" && (
                <div className="mt-2 text-[12px] text-emerald-800">
                  Approved. Suggested status applied. Normalized EBITDA only moves if you later
                  accept or reopen an adjustment.
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function kindForInterp(kind: string): VisualClaimKind {
  if (kind === "adjustment_challenge") return "proposed";
  if (kind === "diligence_answer") return "inference";
  if (kind === "contradiction") return "conflict";
  return "inference";
}
