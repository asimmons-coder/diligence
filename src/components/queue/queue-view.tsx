"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ALEX_USER_ID, GIOVANNI_USER_ID, QUEUE_KIND_LABELS } from "@/lib/constants";
import { buildQueue, filterQueue, queueCounts, type QueueFilter } from "@/lib/derived-queue";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ReviewReasonDialog } from "@/components/shared/review-reason-dialog";

const FILTERS: Array<{ id: QueueFilter; label: string }> = [
  { id: "all", label: "All work" },
  { id: "classification", label: "Classification" },
  { id: "extraction", label: "Extractions" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "adjustment", label: "Proposed adjustments" },
  { id: "missing", label: "Missing information" },
  { id: "seller_question", label: "Seller questions" },
  { id: "assigned_to_me", label: "Assigned to me" },
  { id: "assigned_to_giovanni", label: "Assigned to Giovanni" },
  { id: "assigned_by_alex", label: "Assigned by Alex" },
  { id: "since_last_login", label: "Since last login" },
  { id: "awaiting_supervisor", label: "Alex review" },
];

export function QueueView() {
  const {
    db,
    currentUser,
    assignItem,
    approvePrepared,
    reviewFact,
    setAdjustmentStatus,
    sendMissingToDiligence,
    reviewRecommendation,
  } = useStore();
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [reasonFor, setReasonFor] = useState<{
    entityType: string;
    entityId: string;
    action: "edited" | "rejected";
  } | null>(null);

  const all = useMemo(() => buildQueue(db, currentUser.id), [db, currentUser.id]);
  const rows = useMemo(() => filterQueue(all, filter, currentUser.id), [all, filter, currentUser.id]);
  const counts = useMemo(() => queueCounts(all, currentUser.id), [all, currentUser.id]);
  const isAlex = currentUser.id === ALEX_USER_ID;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Analyst operating queue
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isAlex ? "Review Giovanni’s work" : "Today’s queue"}
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-zinc-600">
            {isAlex
              ? "Approve completed items without redoing the extraction. Preparer and reviewer stay on the record."
              : "Giovanni’s daily home. Work classification, extractions, conflicts, and missing items. Corrections are logged."}
          </p>
        </div>
        <div className="text-[12px] text-zinc-500">
          Signed in as {currentUser.name} · last seen{" "}
          {currentUser.last_seen_at ? currentUser.last_seen_at.slice(0, 16).replace("T", " ") : "—"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-md border px-2 py-1 text-[12px] ${
              filter === f.id
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            }`}
          >
            {f.label}
            <span className="ml-1 tabular text-zinc-400">{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-auto rounded-md border bg-white">
        <table className="w-full min-w-[1100px] text-left text-[12px]">
          <thead className="border-b bg-zinc-50 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-1.5">Deal</th>
              <th className="px-3 py-1.5">Item</th>
              <th className="px-3 py-1.5">Why it matters</th>
              <th className="px-3 py-1.5">Priority</th>
              <th className="px-3 py-1.5">Queue</th>
              <th className="px-3 py-1.5">Assigned</th>
              <th className="px-3 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const assignee = row.assignedUserId
                ? db.users.find((u) => u.id === row.assignedUserId)
                : null;
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/deals/${row.dealId}`} className="hover:underline">
                      {row.dealName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-[11px] text-zinc-500">{row.statusLabel}</div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{row.whyItMatters}</td>
                  <td className="px-3 py-2 capitalize">{row.priority}</td>
                  <td className="px-3 py-2">{QUEUE_KIND_LABELS[row.kind] ?? row.kind}</td>
                  <td className="px-3 py-2">{assignee?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="xs" variant="outline" asChild>
                        <Link href={row.href}>Open</Link>
                      </Button>
                      {row.actions.includes("assign") && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            assignItem(
                              row.entityType,
                              row.entityId,
                              row.assignedUserId === GIOVANNI_USER_ID
                                ? currentUser.id
                                : GIOVANNI_USER_ID
                            )
                          }
                        >
                          Assign
                        </Button>
                      )}
                      {row.actions.includes("approve") && row.entityType === "evaluation_event" && (
                        <Button size="xs" onClick={() => approvePrepared(row.entityId)}>
                          Approve
                        </Button>
                      )}
                      {row.actions.includes("approve") && row.entityType === "extracted_fact" && (
                        <Button size="xs" onClick={() => reviewFact(row.entityId, "accepted")}>
                          Accept
                        </Button>
                      )}
                      {row.actions.includes("approve") && row.entityType === "ebitda_adjustment" && (
                        <Button
                          size="xs"
                          onClick={() => setAdjustmentStatus(row.entityId, "accepted")}
                        >
                          Accept
                        </Button>
                      )}
                      {row.actions.includes("approve") && row.entityType === "recommendation" && (
                        <Button
                          size="xs"
                          onClick={() => reviewRecommendation(row.entityId, "accepted")}
                        >
                          Accept
                        </Button>
                      )}
                      {row.actions.includes("reject") &&
                        (row.entityType === "extracted_fact" ||
                          row.entityType === "recommendation" ||
                          row.entityType === "ebitda_adjustment") && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              setReasonFor({
                                entityType: row.entityType,
                                entityId: row.entityId,
                                action: "rejected",
                              })
                            }
                          >
                            Reject
                          </Button>
                        )}
                      {row.actions.includes("edit") && row.entityType === "extracted_fact" && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            setReasonFor({
                              entityType: row.entityType,
                              entityId: row.entityId,
                              action: "edited",
                            })
                          }
                        >
                          Edit
                        </Button>
                      )}
                      {row.actions.includes("send_to_diligence") &&
                        row.entityType === "missing_item" && (
                          <Button size="xs" onClick={() => sendMissingToDiligence(row.entityId)}>
                            Send to diligence
                          </Button>
                        )}
                      {row.evidenceHref && (
                        <Link href={row.evidenceHref} className="px-1 text-[11px] underline">
                          Evidence
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing in this queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reasonFor && (
        <ReviewReasonDialog
          action={reasonFor.action}
          onCancel={() => setReasonFor(null)}
          onConfirm={({ why, corrected, source }) => {
            if (reasonFor.entityType === "extracted_fact") {
              reviewFact(
                reasonFor.entityId,
                reasonFor.action,
                corrected ? { extracted_value: corrected } : undefined,
                {
                  why_original_was_wrong: why,
                  corrected_answer: corrected,
                  controlling_source: source,
                }
              );
            } else if (reasonFor.entityType === "recommendation") {
              reviewRecommendation(reasonFor.entityId, reasonFor.action === "edited" ? "accepted" : "rejected", {
                why_original_was_wrong: why,
                corrected_answer: corrected,
                controlling_source: source,
              });
            } else if (reasonFor.entityType === "ebitda_adjustment") {
              setAdjustmentStatus(reasonFor.entityId, "rejected");
            }
            setReasonFor(null);
          }}
        />
      )}
    </div>
  );
}
