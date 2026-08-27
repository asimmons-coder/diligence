"use client";

import { buildScenarioView } from "@/lib/derived-evidence";
import { formatMoneyExact, formatMultiple } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ClaimChip } from "@/components/shared/claim-chip";
import { Input } from "@/components/ui/input";
import type { ValuationScenario } from "@/lib/types";

export function DealValuation({ dealId }: { dealId: string }) {
  const { dealView, updateValuationScenario } = useStore();
  const view = dealView(dealId);
  if (!view) return null;

  const scenarios = view.valuationScenarios
    .slice()
    .sort((a, b) => ["conservative", "base", "upside"].indexOf(a.key) - ["conservative", "base", "upside"].indexOf(b.key));
  const views = scenarios.map((s) =>
    buildScenarioView(view.reportedEbitda, view.normalizedEbitda, view.adjustments, s)
  );

  return (
    <div className="space-y-8 px-5 py-4">
      <section>
        <div className="flex items-center gap-2">
          <ClaimChip kind="scenario" />
          <h2 className="text-[13px] font-semibold">Scenario analysis — not a price recommendation</h2>
        </div>
        <p className="mt-1 max-w-3xl text-[12px] text-zinc-600">
          Conservative, Base, and Upside are editable cases. Changing selected EBITDA, multiple,
          or adjustment treatment recalculates this page only. Accepted financial facts do not
          change.
        </p>
        {views.length === 0 && (
          <div className="mt-4 rounded-md border px-3 py-6 text-center text-[13px] text-muted-foreground">
            No scenarios on this deal yet. Load the Hale pack or add cases after intake.
          </div>
        )}
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {views.map((sv) => (
            <ScenarioCard
              key={sv.scenario.id}
              sv={sv}
              onPatch={(patch) => updateValuationScenario(sv.scenario.id, patch)}
            />
          ))}
        </div>
        {views.length > 0 && (
          <div className="mt-3 overflow-auto rounded-md border bg-white">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b bg-zinc-50 text-[10px] font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5">Case</th>
                  <th className="px-3 py-1.5 text-right">Selected EBITDA</th>
                  <th className="px-3 py-1.5 text-right">Multiple</th>
                  <th className="px-3 py-1.5 text-right">EV</th>
                  <th className="px-3 py-1.5 text-right">Equity</th>
                  <th className="px-3 py-1.5 text-right">Gap vs seller</th>
                </tr>
              </thead>
              <tbody>
                {views.map((sv) => (
                  <tr key={sv.scenario.id} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{sv.scenario.name}</td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {formatMoneyExact(sv.selectedEbitda)}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {formatMultiple(sv.selectedMultiple)}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">{formatMoneyExact(sv.ev)}</td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {formatMoneyExact(sv.indicatedEquity)}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {formatMoneyExact(sv.gapToSeller)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">Rationale — linked to evidence</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-white p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Supporting
            </div>
            <ul className="mt-2 space-y-2 text-[13px]">
              {view.valuationFactors
                .filter((f) => f.direction === "supporting")
                .map((f) => (
                  <li key={f.id}>{f.statement}</li>
                ))}
            </ul>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Pressuring
            </div>
            <ul className="mt-2 space-y-2 text-[13px]">
              {view.valuationFactors
                .filter((f) => f.direction === "pressuring")
                .map((f) => (
                  <li key={f.id}>{f.statement}</li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <ClaimChip kind="recommendation" />
          <h2 className="text-[13px] font-semibold">Negotiation</h2>
        </div>
        <p className="mt-1 text-[12px] text-zinc-600">
          Reviewable considerations — not legal advice. Structures exist to bridge a gap without
          paying unsupported EBITDA at close.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {view.negotiationPositions.map((p) => (
            <article key={p.id} className="rounded-md border bg-white p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
                <span>{p.side}</span>
                <span>·</span>
                <span>{p.strength}</span>
              </div>
              <h3 className="mt-1 text-[13px] font-medium">{p.title}</h3>
              <p className="mt-1 text-[13px] text-zinc-700">{p.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-3 rounded-md border bg-white p-3 text-[13px]">
          <div className="font-medium">Structures to bridge</div>
          <p className="mt-1 text-zinc-700">
            Lower cash at close, seller note, earnout, retention-contingent payment,
            client-retention holdback, NWC peg, escrow, contingent payment for disputed add-backs.
          </p>
          {view.recommendations.map((r) => (
            <div key={r.id} className="mt-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <ClaimChip kind="recommendation" />
                <span className="font-medium">{r.title}</span>
                <span className="text-[11px] text-zinc-500">
                  {r.review_status.replaceAll("_", " ")} · {Math.round(r.confidence * 100)}% conf.
                </span>
              </div>
              <p className="mt-1 text-zinc-700">{r.body}</p>
              <p className="mt-1 text-[12px] text-zinc-600">
                <span className="font-medium">Alternatives · </span>
                {r.alternatives}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScenarioCard({
  sv,
  onPatch,
}: {
  sv: ReturnType<typeof buildScenarioView>;
  onPatch: (patch: Partial<ValuationScenario>) => void;
}) {
  const s = sv.scenario;
  return (
    <article className="rounded-md border bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">{s.name}</h3>
        <ClaimChip kind="scenario" />
      </div>
      <p className="mt-1 text-[12px] text-zinc-600">{s.notes}</p>
      <div className="mt-2 space-y-1 text-[12px]">
        {sv.includedTreatments.map((t) => (
          <div key={t}>· {t}</div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <Toggle
          label="Owner add-back"
          checked={s.include_owner}
          onChange={(v) => onPatch({ include_owner: v, ebitda_overridden: false })}
        />
        <Toggle
          label="One-time legal"
          checked={s.include_legal}
          onChange={(v) => onPatch({ include_legal: v, ebitda_overridden: false })}
        />
        <Toggle
          label="Occupancy"
          checked={s.include_occupancy}
          onChange={(v) => onPatch({ include_occupancy: v, ebitda_overridden: false })}
        />
        <Toggle
          label="Synergy"
          checked={s.include_synergy}
          onChange={(v) => onPatch({ include_synergy: v, ebitda_overridden: false })}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[12px]">
        <dt className="text-zinc-500">Reported</dt>
        <dd className="tabular text-right">{formatMoneyExact(sv.reportedEbitda)}</dd>
        <dt className="text-zinc-500">Accepted normalized</dt>
        <dd className="tabular text-right">{formatMoneyExact(sv.acceptedNormalized)}</dd>
        <dt className="text-zinc-500">Formula EBITDA</dt>
        <dd className="tabular text-right">{formatMoneyExact(sv.formulaEbitda)}</dd>
        <Field
          label="Selected EBITDA"
          value={s.selected_ebitda}
          onChange={(n) => onPatch({ selected_ebitda: n, ebitda_overridden: true })}
        />
        <Field
          label="Selected multiple"
          value={s.selected_multiple}
          step={0.1}
          onChange={(n) => onPatch({ selected_multiple: n })}
        />
        <dt className="text-zinc-500">Multiple range</dt>
        <dd className="tabular text-right">
          {formatMultiple(s.multiple_low)}–{formatMultiple(s.multiple_high)}
        </dd>
        <dt className="text-zinc-500">EV</dt>
        <dd className="tabular text-right font-medium">{formatMoneyExact(sv.ev)}</dd>
        <dt className="text-zinc-500">EV range</dt>
        <dd className="tabular text-right">
          {formatMoneyExact(sv.evLow)}–{formatMoneyExact(sv.evHigh)}
        </dd>
        <Field
          label="Debt / liabilities"
          value={s.expected_debt}
          onChange={(n) => onPatch({ expected_debt: n })}
        />
        <Field
          label="NWC assumption"
          value={s.nwc_assumption}
          onChange={(n) => onPatch({ nwc_assumption: n })}
        />
        <Field
          label="Other PPA"
          value={s.other_ppa}
          onChange={(n) => onPatch({ other_ppa: n })}
        />
        <dt className="text-zinc-500">Indicated equity</dt>
        <dd className="tabular text-right">{formatMoneyExact(sv.indicatedEquity)}</dd>
        <dt className="text-zinc-500">Seller expectation</dt>
        <dd className="tabular text-right">{formatMoneyExact(s.seller_expectation)}</dd>
        <dt className="text-zinc-500">Buyer indication</dt>
        <dd className="tabular text-right">
          {s.current_buyer_indication != null
            ? formatMoneyExact(s.current_buyer_indication)
            : "—"}
        </dd>
        <dt className="font-medium">Gap vs seller (EV)</dt>
        <dd className="tabular text-right font-medium">{formatMoneyExact(sv.gapToSeller)}</dd>
      </dl>
    </article>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd>
        <Input
          className="h-7 text-right"
          type="number"
          step={step ?? 1}
          defaultValue={value}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
      </dd>
    </>
  );
}
