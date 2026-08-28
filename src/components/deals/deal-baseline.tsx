"use client";

import { useState } from "react";
import { formatMoneyExact } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DealBaseline({ dealId }: { dealId: string }) {
  const { db, updateBaseline } = useStore();
  const row = db.post_close_baselines.find((b) => b.deal_id === dealId);
  const [editing, setEditing] = useState(false);
  const [rev, setRev] = useState(String(row?.underwritten_revenue ?? ""));
  const [ebitda, setEbitda] = useState(String(row?.underwritten_ebitda ?? ""));
  const [adj, setAdj] = useState(String(row?.accepted_adjustments_total ?? ""));
  const [syn, setSyn] = useState(String(row?.expected_synergies ?? ""));
  const [nwc, setNwc] = useState(String(row?.nwc_assumption ?? ""));
  const [price, setPrice] = useState(String(row?.purchase_price ?? ""));
  const [structure, setStructure] = useState(row?.structure ?? "");
  const [retention, setRetention] = useState(row?.retention_assumptions ?? "");
  const [year1, setYear1] = useState(row?.expected_first_year_performance ?? "");

  function save() {
    updateBaseline(dealId, {
      underwritten_revenue: num(rev),
      underwritten_ebitda: num(ebitda),
      accepted_adjustments_total: num(adj),
      expected_synergies: num(syn),
      nwc_assumption: num(nwc),
      purchase_price: num(price),
      structure,
      retention_assumptions: retention,
      expected_first_year_performance: year1,
    });
    setEditing(false);
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold">Post-close baseline</h2>
        <p className="mt-1 max-w-2xl text-[12px] text-zinc-600">
          Assumptions a later actuals process can compare against. Read-only until a human
          edits them. This is not an integration product — actuals will be compared later.
        </p>
      </div>

      {!editing ? (
        <div className="rounded-md border bg-white p-4">
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <Item label="Underwritten revenue" value={formatMoneyExact(row?.underwritten_revenue)} />
            <Item label="Underwritten EBITDA" value={formatMoneyExact(row?.underwritten_ebitda)} />
            <Item label="Accepted adjustments" value={formatMoneyExact(row?.accepted_adjustments_total)} />
            <Item label="Expected synergies" value={formatMoneyExact(row?.expected_synergies)} />
            <Item label="NWC assumption" value={formatMoneyExact(row?.nwc_assumption)} />
            <Item label="Purchase price" value={formatMoneyExact(row?.purchase_price)} />
            <Item label="Structure" value={row?.structure ?? "—"} />
            <Item label="Retention" value={row?.retention_assumptions ?? "—"} />
            <Item label="Expected first-year" value={row?.expected_first_year_performance ?? "—"} />
          </dl>
          <p className="mt-4 rounded-sm bg-zinc-50 px-2 py-1.5 text-[12px] text-zinc-500">
            Actuals will be compared later.
          </p>
          <Button className="mt-3" size="sm" onClick={() => setEditing(true)}>
            Edit baseline
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-2">
          <Field label="Underwritten revenue">
            <Input value={rev} onChange={(e) => setRev(e.target.value)} />
          </Field>
          <Field label="Underwritten EBITDA">
            <Input value={ebitda} onChange={(e) => setEbitda(e.target.value)} />
          </Field>
          <Field label="Accepted adjustments">
            <Input value={adj} onChange={(e) => setAdj(e.target.value)} />
          </Field>
          <Field label="Expected synergies">
            <Input value={syn} onChange={(e) => setSyn(e.target.value)} />
          </Field>
          <Field label="NWC">
            <Input value={nwc} onChange={(e) => setNwc(e.target.value)} />
          </Field>
          <Field label="Purchase price">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[11px] text-zinc-500">Structure</Label>
            <Textarea value={structure} onChange={(e) => setStructure(e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[11px] text-zinc-500">Retention assumptions</Label>
            <Textarea value={retention} onChange={(e) => setRetention(e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[11px] text-zinc-500">Expected first-year performance</Label>
            <Textarea value={year1} onChange={(e) => setYear1(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={save}>
              Save baseline
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}

function num(v: string) {
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
