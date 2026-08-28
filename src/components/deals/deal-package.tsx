"use client";

import { useMemo } from "react";
import { formatMoneyExact, formatMultiple } from "@/lib/format";
import { downloadPackageExcel, downloadPackageJson, downloadPackagePdf } from "@/lib/package-export";
import { buildPackageModel } from "@/lib/package-model";
import { useStore } from "@/lib/store";
import { ClaimChip } from "@/components/shared/claim-chip";
import { Button } from "@/components/ui/button";

export function DealPackage({ dealId }: { dealId: string }) {
  const { db, recordPackageExport } = useStore();
  const model = useMemo(() => buildPackageModel(db, dealId), [db, dealId]);
  if (!model) return null;

  async function exportXlsx() {
    await downloadPackageExcel(model!);
    recordPackageExport(dealId, "xlsx");
  }
  async function exportPdf() {
    await downloadPackagePdf(model!);
    recordPackageExport(dealId, "pdf");
  }
  function exportJson() {
    downloadPackageJson(model!);
    recordPackageExport(dealId, "json");
  }

  return (
    <div className="space-y-6 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Underwriting package</h2>
          <p className="mt-1 max-w-2xl text-[12px] text-zinc-600">
            Reviewable output for a decision meeting. Excel and PDF contain the live Hale (or
            deal) numbers — not placeholders. Valuation sheets are labeled scenario analysis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportXlsx}>
            Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            Export PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={exportJson}>
            Export JSON
          </Button>
        </div>
      </div>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Executive deal brief</h3>
        <p className="mt-2 text-[13px] text-zinc-700">{model.executiveBrief.summary}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Metric label="Reported EBITDA" value={formatMoneyExact(model.executiveBrief.reportedEbitda)} />
          <Metric label="Normalized" value={formatMoneyExact(model.executiveBrief.normalizedEbitda)} />
          <Metric label="Pro forma (proposed)" value={formatMoneyExact(model.executiveBrief.proFormaEbitda)} />
          <Metric
            label="Ask / implied PF"
            value={`${formatMoneyExact(model.executiveBrief.asking)} · ${formatMultiple(model.executiveBrief.headerMultiple)}`}
          />
        </div>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Reconstructed historical financials</h3>
        <table className="mt-2 w-full text-left text-[12px]">
          <thead className="text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="py-1">Period</th>
              <th className="py-1">Revenue</th>
              <th className="py-1">Reported EBITDA</th>
            </tr>
          </thead>
          <tbody>
            {model.historicalFinancials.map((p) => (
              <tr key={p.period} className="border-t">
                <td className="py-1.5">{p.period}</td>
                <td className="tabular py-1.5">{formatMoneyExact(p.revenue)}</td>
                <td className="tabular py-1.5">{formatMoneyExact(p.ebitda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">EBITDA bridge</h3>
        <p className="mt-1 text-[12px] text-zinc-600">{model.ebitdaBridge.note}</p>
        <ul className="mt-2 space-y-1 text-[12px]">
          <li>Reported {formatMoneyExact(model.ebitdaBridge.reported)}</li>
          {model.ebitdaBridge.accepted.map((a) => (
            <li key={a.description}>
              + {a.description} {formatMoneyExact(a.amount)} ({a.status})
            </li>
          ))}
          <li className="font-medium">
            Normalized {formatMoneyExact(model.ebitdaBridge.normalized)}
          </li>
          {model.ebitdaBridge.proposed.map((a) => (
            <li key={a.description} className="text-amber-900">
              + {a.description} {formatMoneyExact(a.amount)} ({a.status})
            </li>
          ))}
          <li>Pro forma {formatMoneyExact(model.ebitdaBridge.proForma)}</li>
        </ul>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Adjustment support schedule</h3>
        <table className="mt-2 w-full text-left text-[12px]">
          <thead className="text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="py-1">Item</th>
              <th className="py-1">Amount</th>
              <th className="py-1">Status</th>
              <th className="py-1">Source</th>
            </tr>
          </thead>
          <tbody>
            {model.adjustmentSupport.map((a) => (
              <tr key={a.description} className="border-t">
                <td className="py-1.5">{a.description}</td>
                <td className="tabular py-1.5">{formatMoneyExact(a.amount)}</td>
                <td className="py-1.5">{a.status}</td>
                <td className="py-1.5">{a.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Reconciliation report</h3>
        <ul className="mt-2 space-y-2 text-[12px]">
          {model.reconciliation.map((r) => (
            <li key={r.description}>
              <span className="font-medium">{r.description}</span>{" "}
              <span className="text-zinc-500">({r.status})</span>
              <div className="text-zinc-600">{r.interpretation}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border bg-white p-4">
        <div className="flex items-center gap-2">
          <ClaimChip kind="scenario" />
          <h3 className="text-[13px] font-semibold">Valuation — scenario analysis</h3>
        </div>
        <table className="mt-2 w-full text-left text-[12px]">
          <thead className="text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="py-1">Scenario</th>
              <th className="py-1">EBITDA</th>
              <th className="py-1">Multiple</th>
              <th className="py-1">EV</th>
              <th className="py-1">Gap vs seller</th>
            </tr>
          </thead>
          <tbody>
            {model.valuationScenarios.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="py-1.5">{s.name}</td>
                <td className="tabular py-1.5">{formatMoneyExact(s.ebitda)}</td>
                <td className="tabular py-1.5">{formatMultiple(s.multiple)}</td>
                <td className="tabular py-1.5">{formatMoneyExact(s.ev)}</td>
                <td className="tabular py-1.5">{formatMoneyExact(s.gapToSeller)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Key risks · open diligence</h3>
        <ul className="mt-2 space-y-1 text-[12px]">
          {model.keyRisks.map((r) => (
            <li key={r.title}>
              <span className="font-medium">{r.title}.</span> {r.detail}
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-[12px] text-zinc-600">
          {model.openDiligence.slice(0, 8).map((d) => (
            <li key={d.question}>
              {d.question} · {d.status}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border bg-white p-4">
        <h3 className="text-[13px] font-semibold">Evidence appendix · decision history</h3>
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          <ul className="space-y-1 text-[12px]">
            {model.evidenceAppendix.slice(0, 16).map((e) => (
              <li key={e.path}>
                {e.path} · {e.type}
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-[12px] text-zinc-600">
            {model.decisionHistory.slice(0, 10).map((d) => (
              <li key={`${d.occurredAt}-${d.action}`}>
                <span className="font-medium">{d.actor}</span> {d.action} — {d.resolution}
              </li>
            ))}
          </ul>
        </div>
        {model.external.system && (
          <p className="mt-3 text-[11px] text-zinc-500">
            External {model.external.system} · {model.external.dealId} · Diligence remains
            authoritative for underwriting decisions.
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-zinc-50 px-2 py-1.5">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="tabular text-[13px] font-medium">{value}</div>
    </div>
  );
}
