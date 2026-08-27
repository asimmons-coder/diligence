"use client";

import { ADJUSTMENT_CATEGORY_LABELS } from "@/lib/constants";
import {
  formatHeaderMultiple,
  formatMargin,
  formatMoneyExact,
  formatMultiple,
} from "@/lib/format";
import { useStore } from "@/lib/store";
import type { EbitdaAdjustment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";
import { ClaimLabel, ProvenanceInspect } from "@/components/shared/provenance";
import { Button } from "@/components/ui/button";

export function DealFinancials({ dealId }: { dealId: string }) {
  const { dealView, setAdjustmentStatus } = useStore();
  const view = dealView(dealId);
  if (!view || !view.latest) {
    return (
      <div className="p-8 text-sm text-muted-foreground">No financial periods on this deal.</div>
    );
  }

  return (
    <div className="space-y-6 px-5 py-4">
      <section>
        <h2 className="mb-1 text-[13px] font-semibold">Historical performance</h2>
        <p className="mb-2 text-[12px] text-muted-foreground">
          Gross profit = revenue − direct costs. Reported EBITDA = gross profit − operating
          expenses. TTM 2025 is labeled as trailing twelve months, not a fiscal year.
        </p>
        <div className="overflow-auto rounded-md border bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b bg-zinc-50 text-[11px] font-medium text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">Line</th>
                {view.periods.map((p) => (
                  <th key={p.period.id} className="px-3 py-2 text-right">
                    {p.period.label}
                    {p.period.is_latest ? (
                      <span className="ml-1 font-normal normal-case">(latest)</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Revenue" values={view.periods.map((p) => p.revenue)} />
              <MetricRow label="Direct costs" values={view.periods.map((p) => p.directCosts)} />
              <MetricRow label="Gross profit" values={view.periods.map((p) => p.grossProfit)} />
              <MetricRow label="Operating expenses" values={view.periods.map((p) => p.opex)} />
              {hasOpex(view.periods) &&
                uniqueOpex(view.periods).map((line) => (
                  <MetricRow
                    key={line}
                    label={line}
                    values={view.periods.map(
                      (p) => p.opexDetail.find((o) => o.label === line)?.amount ?? null
                    )}
                    indent
                  />
                ))}
              <MetricRow
                label="Reported EBITDA"
                values={view.periods.map((p) => p.reportedEbitda)}
                strong
              />
              <tr className="border-t">
                <td className="px-3 py-1.5 text-zinc-600">EBITDA margin</td>
                {view.periods.map((p) => (
                  <td key={p.period.id} className="tabular px-3 py-1.5 text-right">
                    {formatMargin(p.ebitdaMargin)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-[13px] font-semibold">
              EBITDA normalization — {view.latest.period.label}
            </h2>
            <p className="text-[12px] text-zinc-600">
              Normalized = reported + accepted, excluding synergies. Pro forma = normalized +
              remaining proposed (including synergy). AI proposes; nothing enters accepted
              totals until you approve.
            </p>
          </div>
          <div className="text-right text-[12px] text-zinc-600">
            {formatMoneyExact(view.purchasePrice)} price ·{" "}
            {formatMultiple(view.impliedMultipleReported)} reported /{" "}
            {formatMultiple(view.impliedMultipleNormalized)} normalized /{" "}
            {formatMultiple(view.impliedMultipleProForma)} pro forma
            <div className="text-[11px] text-muted-foreground">
              Header shows {formatHeaderMultiple(view.headerMultiple)} on pro forma
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-white">
          <BridgeLine
            label="Reported EBITDA"
            amount={view.reportedEbitda}
            note="Source fact from the latest P&L"
          />
          {view.adjustments.map((adj) => (
            <AdjustmentRow
              key={adj.id}
              adj={adj}
              onAccept={() => setAdjustmentStatus(adj.id, "accepted")}
              onReject={() => setAdjustmentStatus(adj.id, "rejected")}
              onPropose={() => setAdjustmentStatus(adj.id, "proposed")}
            />
          ))}
          <BridgeLine
            label="Normalized EBITDA"
            amount={view.normalizedEbitda}
            note="Accepted only · synergies excluded"
            strong
          />
          <BridgeLine
            label="Pro forma EBITDA"
            amount={view.proFormaEbitda}
            note="Accepted + proposed, including synergy"
            dashed
          />
        </div>
      </section>
    </div>
  );
}

function MetricRow({
  label,
  values,
  indent,
  strong,
}: {
  label: string;
  values: (number | null)[];
  indent?: boolean;
  strong?: boolean;
}) {
  return (
    <tr className="border-t">
      <td className={cn("px-3 py-1.5", indent && "pl-8 text-zinc-500", strong && "font-medium")}>
        {label}
      </td>
      {values.map((value, i) => (
        <td key={i} className={cn("px-3 py-1.5 text-right", strong && "font-medium")}>
          <Money value={value} />
        </td>
      ))}
    </tr>
  );
}

function hasOpex(periods: { opexDetail: { label: string }[] }[]) {
  return periods.some((p) => p.opexDetail.length > 0);
}

function uniqueOpex(periods: { opexDetail: { label: string }[] }[]) {
  return [...new Set(periods.flatMap((p) => p.opexDetail.map((o) => o.label)))];
}

function BridgeLine({
  label,
  amount,
  note,
  strong,
  dashed,
}: {
  label: string;
  amount: number;
  note: string;
  strong?: boolean;
  dashed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t px-3 py-2 first:border-t-0",
        strong && "bg-zinc-50",
        dashed && "ai-proposed"
      )}
    >
      <div>
        <div className={cn("text-[13px]", strong && "font-semibold")}>{label}</div>
        <div className="text-[11px] text-muted-foreground">{note}</div>
      </div>
      <div className={cn("tabular text-[14px]", strong && "font-semibold")}>
        {formatMoneyExact(amount)}
      </div>
    </div>
  );
}

function AdjustmentRow({
  adj,
  onAccept,
  onReject,
  onPropose,
}: {
  adj: EbitdaAdjustment;
  onAccept: () => void;
  onReject: () => void;
  onPropose: () => void;
}) {
  const proposed = adj.status === "proposed" || adj.status === "needs_review";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-t px-3 py-2.5",
        proposed && "ai-proposed"
      )}
    >
      <div className="min-w-[260px] flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-medium">
          <span>
            {adj.amount >= 0 ? "+" : "−"} {adj.description}
          </span>
          <ProvenanceInspect provenance={adj.provenance} />
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-600">
          <span>{ADJUSTMENT_CATEGORY_LABELS[adj.category]}</span>
          <span>·</span>
          <span>{adj.origin === "ai" ? "AI-generated" : "Manual"}</span>
          <span>·</span>
          <ClaimLabel kind={adj.provenance.approval_status} />
          {adj.confidence != null && (
            <>
              <span>·</span>
              <span className="tabular">{Math.round(adj.confidence * 100)}% conf.</span>
            </>
          )}
        </div>
        <div className="text-[12px] text-zinc-500">{adj.source}</div>
        {adj.user_notes && <div className="text-[12px] text-zinc-700">{adj.user_notes}</div>}
        {adj.category === "synergy" && (
          <div className="mt-1 text-[11px] text-amber-800">
            Synergy never enters Normalized, even if accepted.
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="tabular text-[13px] font-medium">
          <Money value={adj.amount} signed />
        </div>
        <span className="w-20 text-right text-[11px] font-medium capitalize">
          {adj.status.replaceAll("_", " ")}
        </span>
        {adj.status !== "accepted" && (
          <Button size="xs" onClick={onAccept}>
            Approve
          </Button>
        )}
        {adj.status !== "rejected" && (
          <Button size="xs" variant="outline" onClick={onReject}>
            Reject
          </Button>
        )}
        {adj.status !== "proposed" && (
          <Button size="xs" variant="ghost" onClick={onPropose}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
