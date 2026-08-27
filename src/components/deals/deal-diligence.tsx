"use client";

import { useState } from "react";
import {
  DILIGENCE_CATEGORY_LABELS,
  DILIGENCE_STATUS_LABELS,
} from "@/lib/constants";
import { DILIGENCE_CATEGORIES, DILIGENCE_STATUSES } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { DiligenceStatus } from "@/lib/types";
import { ClaimLabel, ProvenanceInspect } from "@/components/shared/provenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DealDiligence({ dealId }: { dealId: string }) {
  const { dealView, db, setDiligenceStatus, updateFinding, acceptFindingAsQuestion } =
    useStore();
  const view = dealView(dealId);
  const [editing, setEditing] = useState<Record<string, string>>({});
  if (!view) return null;

  return (
    <div className="grid grid-cols-1 gap-5 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">Request list</h2>
        <div className="space-y-4">
          {DILIGENCE_CATEGORIES.map((cat) => {
            const items = view.diligence.filter((d) => d.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="mb-1 text-[12px] font-semibold text-zinc-500">
                  {DILIGENCE_CATEGORY_LABELS[cat]}
                </h3>
                <div className="overflow-hidden rounded-md border bg-white">
                  {items.map((item) => {
                    const owner = item.owner_user_id
                      ? db.users.find((u) => u.id === item.owner_user_id)
                      : null;
                    const overdue =
                      item.due_date &&
                      item.due_date < "2026-08-27" &&
                      !["complete", "na"].includes(item.status);
                    return (
                      <div key={item.id} className="border-b px-3 py-2 last:border-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] leading-snug">{item.question}</div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                              <span>{owner?.name ?? "Unassigned"}</span>
                              {item.counterparty_owner && (
                                <span>cp: {item.counterparty_owner}</span>
                              )}
                              <span className={overdue ? "text-red-700" : ""}>
                                {item.due_date ? formatDate(item.due_date) : "No due date"}
                              </span>
                              {item.ai_generated && (
                                <span className="text-amber-800">AI-generated</span>
                              )}
                              <span className="capitalize">{item.priority}</span>
                              {item.supporting_document_ids.length > 0 && (
                                <span>{item.supporting_document_ids.length} docs</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-[12px] text-zinc-600">{item.notes}</div>
                            )}
                          </div>
                          <Select
                            value={item.status}
                            onValueChange={(v) =>
                              setDiligenceStatus(item.id, String(v) as DiligenceStatus)
                            }
                          >
                            <SelectTrigger className="h-7 w-[170px] text-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DILIGENCE_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {DILIGENCE_STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside>
        <h2 className="mb-2 text-[13px] font-semibold">AI findings</h2>
        <div className="space-y-2">
          {view.findings.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-[12px] text-muted-foreground">
              No findings on this deal.
            </div>
          )}
          {view.findings.map((f) => (
            <div key={f.id} className="ai-proposed rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-medium">{f.title}</div>
                <ProvenanceInspect provenance={f.provenance} />
              </div>
              <p className="mt-1 text-[12px] leading-snug text-zinc-700">
                {f.edited_question ?? f.question}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ClaimLabel kind={f.provenance.approval_status} />
                <span className="text-[11px] capitalize text-muted-foreground">{f.status}</span>
                {f.provenance.source_document_name && (
                  <span className="text-[11px] text-muted-foreground">
                    {f.provenance.source_document_name}
                  </span>
                )}
              </div>
              {editing[f.id] != null ? (
                <div className="mt-2 space-y-1.5">
                  <Input
                    value={editing[f.id]}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s, [f.id]: e.target.value }))
                    }
                    className="h-8 text-[12px]"
                  />
                  <Button
                    size="xs"
                    onClick={() => {
                      updateFinding(f.id, { question: editing[f.id], edited_question: editing[f.id] });
                      setEditing((s) => {
                        const next = { ...s };
                        delete next[f.id];
                        return next;
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="xs" onClick={() => acceptFindingAsQuestion(f.id)}>
                    Accept as question
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => updateFinding(f.id, { status: "dismissed" })}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setEditing((s) => ({ ...s, [f.id]: f.edited_question ?? f.question }))
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      updateFinding(f.id, {
                        assigned_user_id:
                          f.assigned_user_id === "user_marcus" ? "user_elena" : "user_marcus",
                      })
                    }
                  >
                    Assign
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => updateFinding(f.id, { status: "resolved" })}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
