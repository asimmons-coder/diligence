"use client";

import Link from "next/link";
import { TEMPLATE_FIELD_STATUS_LABELS } from "@/lib/constants";
import { displayEvidencePath } from "@/lib/paths";
import { useStore } from "@/lib/store";

export function DealTemplatePanel({ dealId }: { dealId: string }) {
  const { db } = useStore();
  const deal = db.deals.find((d) => d.id === dealId);
  if (!deal) return null;
  const template =
    db.underwriting_templates.find((t) => t.id === deal.template_id) ??
    db.underwriting_templates.find((t) =>
      deal.vertical === "legal" ? t.key === "law_firm" : t.key === "generic"
    );
  if (!template) return null;
  const fields = db.template_fields
    .filter((f) => f.template_id === template.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const values = db.deal_template_field_values.filter((v) => v.deal_id === dealId);

  return (
    <section className="rounded-md border bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold">{template.name} profile</h2>
        <span className="text-[11px] text-zinc-500">Configurable template — legal is one profile</span>
      </div>
      <p className="mt-1 text-[12px] text-zinc-600">{template.description}</p>
      <div className="mt-3 overflow-auto">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="border-b text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="py-1.5 pr-2">Field</th>
              <th className="py-1.5 pr-2">Status</th>
              <th className="py-1.5 pr-2">Extracted</th>
              <th className="py-1.5">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const value = values.find((v) => v.field_id === field.id);
              const status = value?.status ?? "missing";
              const evidence = (value?.evidence_item_ids ?? [])
                .map((id) => db.evidence_items.find((e) => e.id === id))
                .filter(Boolean);
              return (
                <tr key={field.id} className="border-t align-top">
                  <td className="py-1.5 pr-2">
                    <div className="font-medium">{field.label}</div>
                    <div className="text-[11px] text-zinc-500">{field.description}</div>
                    {value?.notes && (
                      <div className="mt-0.5 text-[11px] text-zinc-600">{value.notes}</div>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">{TEMPLATE_FIELD_STATUS_LABELS[status]}</td>
                  <td className="py-1.5 pr-2">{value?.extracted_summary ?? "—"}</td>
                  <td className="py-1.5">
                    {evidence.length
                      ? evidence.map((e) => (
                          <div key={e!.id}>
                            <Link href={`/deals/${dealId}/evidence`} className="underline">
                              {displayEvidencePath(e!)}
                            </Link>
                          </div>
                        ))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
