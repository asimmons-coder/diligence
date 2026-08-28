"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CONFLICT_STATUS_LABELS,
  DETECTED_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  FACT_REVIEW_LABELS,
  OVERALL_READINESS_LABELS,
} from "@/lib/constants";
import { formatMoneyExact, formatPct } from "@/lib/format";
import { useStore } from "@/lib/store";
import { DETECTED_DOCUMENT_TYPES, type ConflictStatus } from "@/lib/types";
import { DealTemplatePanel } from "@/components/deals/deal-template";
import { ClaimChip } from "@/components/shared/claim-chip";
import { ReviewReasonDialog } from "@/components/shared/review-reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayEvidencePath } from "@/lib/paths";
import { GIOVANNI_USER_ID } from "@/lib/constants";

const CONFLICT_STATUSES: ConflictStatus[] = [
  "unreviewed",
  "investigating",
  "follow_up_required",
  "resolved",
  "accepted_difference",
  "not_material",
];

export function DealIntake({ dealId }: { dealId: string }) {
  const {
    dealView,
    correctEvidence,
    reviewFact,
    assignItem,
    setConflictStatus,
    convertConflict,
    sendMissingToDiligence,
    db,
  } = useStore();
  const view = dealView(dealId);
  const [editFact, setEditFact] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [reasonFor, setReasonFor] = useState<{
    factId: string;
    action: "edited" | "rejected";
  } | null>(null);
  if (!view) return null;

  const received = view.evidenceItems;
  const facts = view.extractedFacts;
  const conflicts = view.conflicts;
  const missing = view.missingItems;

  return (
    <div className="space-y-8 px-5 py-4">
      <DealTemplatePanel dealId={dealId} />
      {reasonFor && (
        <ReviewReasonDialog
          action={reasonFor.action}
          onCancel={() => setReasonFor(null)}
          onConfirm={({ why, corrected, source }) => {
            reviewFact(
              reasonFor.factId,
              reasonFor.action,
              reasonFor.action === "edited"
                ? {
                    extracted_value: corrected || editValue || undefined,
                    numeric_value: Number((corrected || editValue).replace(/[^0-9.-]/g, "")) || undefined,
                  }
                : undefined,
              {
                why_original_was_wrong: why,
                corrected_answer: corrected,
                controlling_source: source,
              }
            );
            setEditFact(null);
            setReasonFor(null);
          }}
        />
      )}
      <section>
        <h2 className="text-[13px] font-semibold">What we received</h2>
        <p className="mb-2 text-[12px] text-zinc-600">
          Original filenames, detected type, period, entity, format, status, confidence,
          duplicates, and supersession. Correct classification here — do not wait to classify
          before upload.
        </p>
        <div className="overflow-auto rounded-md border bg-white">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead className="border-b bg-zinc-50 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-1.5">Filename</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Period</th>
                <th className="px-2 py-1.5">Entity</th>
                <th className="px-2 py-1.5">Format</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Conf.</th>
                <th className="px-2 py-1.5">Duplicate / superseded</th>
                <th className="px-2 py-1.5">Review</th>
              </tr>
            </thead>
            <tbody>
              {received.map((item) => {
                const dup = received.find((e) => e.id === item.potential_duplicate_of);
                const sup = received.find((e) => e.id === item.superseded_by_id);
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-2 py-1.5 font-medium">{displayEvidencePath(item)}</td>
                    <td className="px-2 py-1.5">
                      <select
                        className="h-7 max-w-[140px] rounded border bg-white px-1"
                        value={item.detected_type}
                        onChange={(e) =>
                          correctEvidence(item.id, {
                            detected_type: e.target.value as (typeof DETECTED_DOCUMENT_TYPES)[number],
                          })
                        }
                      >
                        {DETECTED_DOCUMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {DETECTED_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 w-24"
                        defaultValue={item.detected_period ?? ""}
                        onBlur={(e) =>
                          correctEvidence(item.id, { detected_period: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-7 w-36"
                        defaultValue={item.detected_entity ?? ""}
                        onBlur={(e) =>
                          correctEvidence(item.id, { detected_entity: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">{item.file_format ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      {DOCUMENT_STATUS_LABELS[item.processing_status]}
                    </td>
                    <td className="tabular px-2 py-1.5">
                      {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-600">
                      {sup ? (
                        <span className="text-amber-800">Superseded by {sup.filename}</span>
                      ) : item.supersedes_id ? (
                        <span>Supersedes prior version</span>
                      ) : dup ? (
                        <span>Possible duplicate of {dup.filename}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 capitalize">{item.human_review_status}</td>
                  </tr>
                );
              })}
              {received.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    No files yet.{" "}
                    <Link href="/deals/new" className="underline">
                      Start from documents
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold">What we extracted</h2>
        <p className="mb-2 text-[12px] text-zinc-600">
          Structured facts with source, page/sheet/cell, confidence, and conflicts. Accept,
          reject, edit, or assign — nothing becomes an accepted financial fact silently.
        </p>
        <div className="overflow-auto rounded-md border bg-white">
          <table className="w-full min-w-[1080px] text-left text-[12px]">
            <thead className="border-b bg-zinc-50 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-1.5">Fact</th>
                <th className="px-2 py-1.5">Value</th>
                <th className="px-2 py-1.5">Source</th>
                <th className="px-2 py-1.5">Locator</th>
                <th className="px-2 py-1.5">Method</th>
                <th className="px-2 py-1.5">Conf.</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((fact) => {
                const src = received.find((e) => e.id === fact.evidence_item_id);
                const assignee = fact.assigned_user_id
                  ? db.users.find((u) => u.id === fact.assigned_user_id)
                  : null;
                return (
                  <tr key={fact.id} className="border-t align-top">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{fact.label}</div>
                      <div className="text-[11px] text-zinc-500">
                        {fact.period_label} · {fact.fact_kind.replaceAll("_", " ")}
                      </div>
                      {fact.conflicting_fact_ids.length > 0 && (
                        <div className="mt-0.5">
                          <ClaimChip kind="conflict" />
                        </div>
                      )}
                    </td>
                    <td className="tabular px-2 py-1.5">
                      {editFact === fact.id ? (
                        <Input
                          className="h-7 w-28"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                      ) : fact.numeric_value != null && fact.unit === "usd" ? (
                        formatMoneyExact(fact.numeric_value)
                      ) : fact.unit === "share" && fact.numeric_value != null ? (
                        formatPct(fact.numeric_value)
                      ) : (
                        fact.extracted_value
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {src?.filename ?? "—"}
                      <div className="text-[11px] text-zinc-500">{fact.section}</div>
                    </td>
                    <td className="px-2 py-1.5 text-zinc-600">
                      {[fact.page && `p.${fact.page}`, fact.sheet, fact.cell]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-1.5">{fact.extraction_method.replaceAll("_", " ")}</td>
                    <td className="tabular px-2 py-1.5">{Math.round(fact.confidence * 100)}%</td>
                    <td className="px-2 py-1.5">
                      {FACT_REVIEW_LABELS[fact.review_status]}
                      {assignee && (
                        <div className="text-[11px] text-zinc-500">{assignee.initials}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {fact.review_status !== "accepted" && (
                          <Button size="xs" onClick={() => reviewFact(fact.id, "accepted")}>
                            Accept
                          </Button>
                        )}
                        {fact.review_status !== "rejected" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setReasonFor({ factId: fact.id, action: "rejected" })}
                          >
                            Reject
                          </Button>
                        )}
                        {editFact === fact.id ? (
                          <Button
                            size="xs"
                            onClick={() => setReasonFor({ factId: fact.id, action: "edited" })}
                          >
                            Save
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setEditFact(fact.id);
                              setEditValue(fact.extracted_value);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => assignItem("extracted_fact", fact.id, GIOVANNI_USER_ID)}
                        >
                          Assign
                        </Button>
                        {src?.document_id && (
                          <Link
                            href={`/deals/${dealId}/documents`}
                            className="px-1 text-[11px] underline"
                          >
                            Source
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold">What conflicts</h2>
        <p className="mb-2 text-[12px] text-zinc-600">
          Reconciliation issues. A conflict can become a seller request, a proposed adjustment,
          or an internal task. Accepted financials do not change until a human accepts that next
          object.
        </p>
        <div className="space-y-3">
          {conflicts.map((c) => (
            <article key={c.id} className="rounded-md border bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ClaimChip kind="conflict" />
                    <h3 className="text-[13px] font-medium">{c.description}</h3>
                  </div>
                  <div className="mt-1 grid gap-1 text-[12px] text-zinc-600 sm:grid-cols-2">
                    <div>A · {c.source_a_label}</div>
                    <div>B · {c.source_b_label}</div>
                    <div>
                      Difference{" "}
                      <span className="tabular">
                        {c.difference != null ? formatMoneyExact(c.difference) : "—"}
                      </span>{" "}
                      · {c.materiality}
                    </div>
                  </div>
                </div>
                <select
                  className="h-7 rounded border bg-white px-1 text-[12px]"
                  value={c.status}
                  onChange={(e) => setConflictStatus(c.id, e.target.value as ConflictStatus)}
                >
                  {CONFLICT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONFLICT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[12px] text-zinc-700">
                <span className="font-medium">Interpretation · </span>
                {c.ai_interpretation}
              </p>
              <p className="mt-1 text-[12px] text-zinc-600">
                <span className="font-medium">Next · </span>
                {c.recommended_action}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="xs" onClick={() => convertConflict(c.id, "diligence")}>
                  Seller request
                </Button>
                <Button size="xs" variant="outline" onClick={() => convertConflict(c.id, "adjustment")}>
                  Propose adjustment
                </Button>
                <Button size="xs" variant="ghost" onClick={() => convertConflict(c.id, "task")}>
                  Internal task
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold">What is missing</h2>
        <div className="mt-2 overflow-hidden rounded-md border bg-white">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b bg-zinc-50 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-1.5">Item</th>
                <th className="px-3 py-1.5">Why it matters</th>
                <th className="px-3 py-1.5">Priority</th>
                <th className="px-3 py-1.5">Related line</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {missing.map((m) => (
                <tr key={m.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">
                    {m.title}
                    {m.blocking && (
                      <div className="text-[11px] text-rose-800">Blocking</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{m.why_it_matters}</td>
                  <td className="px-3 py-2 capitalize">{m.priority}</td>
                  <td className="px-3 py-2">{m.related_line ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.status === "open" ? (
                      <Button size="xs" onClick={() => sendMissingToDiligence(m.id)}>
                        Send to diligence
                      </Button>
                    ) : (
                      <span className="text-[11px] text-zinc-500">On diligence list</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3">
        <div className="flex items-center gap-2">
          <ClaimChip kind="inference" />
          <h2 className="text-[13px] font-semibold">Initial underwriting view — preliminary</h2>
        </div>
        <p className="mt-1 text-[12px] text-zinc-600">{view.readiness.summary}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {view.periods.map((p) => (
            <div key={p.period.id} className="rounded-sm bg-white/80 px-2 py-1.5 text-[12px]">
              <div className="text-[11px] text-zinc-500">{p.period.label} revenue</div>
              <div className="tabular font-medium">{formatMoneyExact(p.revenue)}</div>
              <div className="text-[11px] text-zinc-500">
                EBITDA {formatMoneyExact(p.reportedEbitda)}
              </div>
            </div>
          ))}
          <div className="rounded-sm bg-white/80 px-2 py-1.5 text-[12px]">
            <div className="text-[11px] text-zinc-500">Accepted normalized</div>
            <div className="tabular font-medium">{formatMoneyExact(view.normalizedEbitda)}</div>
          </div>
          <div className="rounded-sm bg-white/80 px-2 py-1.5 text-[12px]">
            <div className="text-[11px] text-amber-900">Potential PF (proposed)</div>
            <div className="tabular font-medium">{formatMoneyExact(view.proFormaEbitda)}</div>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-zinc-700">
          Readiness: {OVERALL_READINESS_LABELS[view.readiness.overall]} ·{" "}
          {view.openConflictCount} open conflicts · {view.pendingFactCount} pending facts ·{" "}
          {view.diligencePct}% diligence
        </div>
        <ul className="mt-2 space-y-1 text-[12px]">
          {view.risks.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.title}.</span> {r.detail}
            </li>
          ))}
        </ul>
        {view.valuationGap != null && (
          <div className="mt-2 text-[12px]">
            Preliminary gap vs seller (base EV): {formatMoneyExact(view.valuationGap)}.{" "}
            <Link href={`/deals/${dealId}/valuation`} className="underline">
              Open valuation scenarios
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
