"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHeaderMultiple, formatMargin, formatPercentPoints } from "@/lib/format";
import { isActiveStage } from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { DealView } from "@/lib/types";
import { Money } from "@/components/shared/money";
import { StagePill } from "@/components/shared/stage-pill";

type Col =
  | "name"
  | "revenue"
  | "growth"
  | "reported"
  | "normalized"
  | "margin"
  | "price"
  | "multiple"
  | "concentration"
  | "diligence"
  | "stage";

export function CompareView() {
  const { views } = useStore();
  const router = useRouter();
  const [sort, setSort] = useState<Col>("revenue");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const active = views.filter((v) => isActiveStage(v.deal.stage));
    return active.slice().sort((a, b) => {
      const mul = dir === "asc" ? 1 : -1;
      return (num(a, sort) - num(b, sort)) * mul || a.deal.name.localeCompare(b.deal.name);
    });
  }, [views, sort, dir]);

  function toggle(col: Col) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir(col === "name" || col === "stage" ? "asc" : "desc");
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3">
        <h1 className="text-[15px] font-semibold">Compare</h1>
        <p className="text-[13px] text-zinc-600">
          Active targets only. Growth is latest vs prior period when both exist. Multiple is on
          pro forma. Concentration is the vertical profile top-3.
        </p>
      </div>
      <div className="overflow-auto rounded-md border bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 border-b bg-zinc-50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <Head col="name" sort={sort} onClick={toggle}>
                Company
              </Head>
              <Head col="revenue" sort={sort} onClick={toggle} right>
                Revenue
              </Head>
              <Head col="growth" sort={sort} onClick={toggle} right>
                Growth
              </Head>
              <Head col="reported" sort={sort} onClick={toggle} right>
                Reported EBITDA
              </Head>
              <Head col="normalized" sort={sort} onClick={toggle} right>
                Normalized EBITDA
              </Head>
              <Head col="margin" sort={sort} onClick={toggle} right>
                EBITDA margin
              </Head>
              <Head col="price" sort={sort} onClick={toggle} right>
                Purchase price
              </Head>
              <Head col="multiple" sort={sort} onClick={toggle} right>
                Multiple
              </Head>
              <Head col="concentration" sort={sort} onClick={toggle} right>
                Rev. concentration
              </Head>
              <Head col="diligence" sort={sort} onClick={toggle} right>
                Diligence
              </Head>
              <Head col="stage" sort={sort} onClick={toggle}>
                Stage
              </Head>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const top3 = Number(v.deal.vertical_metrics.revenue_concentration_top3 ?? 0);
              return (
                <tr
                  key={v.deal.id}
                  tabIndex={0}
                  className="cursor-pointer border-b last:border-0 hover:bg-zinc-50"
                  onClick={() => router.push(`/deals/${v.deal.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/deals/${v.deal.id}`);
                  }}
                >
                  <td className="px-3 py-2 font-medium">{v.deal.name}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={v.revenue} />
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {v.growth == null ? "—" : formatPercentPoints(v.growth, 1)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={v.reportedEbitda} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={v.normalizedEbitda} />
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {formatMargin(v.latest?.ebitdaMargin ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={v.purchasePrice} />
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {formatHeaderMultiple(v.headerMultiple)}
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {top3 ? formatPercentPoints(top3, 0) : "—"}
                  </td>
                  <td className="tabular px-3 py-2 text-right">{v.diligencePct}%</td>
                  <td className="px-3 py-2">
                    <StagePill stage={v.deal.stage} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function num(v: DealView, col: Col): number {
  switch (col) {
    case "name":
      return 0;
    case "revenue":
      return v.revenue;
    case "growth":
      return v.growth ?? -99;
    case "reported":
      return v.reportedEbitda;
    case "normalized":
      return v.normalizedEbitda;
    case "margin":
      return v.latest?.ebitdaMargin ?? 0;
    case "price":
      return v.purchasePrice ?? 0;
    case "multiple":
      return v.headerMultiple ?? 0;
    case "concentration":
      return Number(v.deal.vertical_metrics.revenue_concentration_top3 ?? 0);
    case "diligence":
      return v.diligencePct;
    case "stage":
      return 0;
  }
}

function Head({
  col,
  sort,
  onClick,
  children,
  right,
}: {
  col: Col;
  sort: Col;
  onClick: (c: Col) => void;
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={right ? "px-3 py-2 text-right" : "px-3 py-2"}>
      <button type="button" onClick={() => onClick(col)}>
        {children}
        {sort === col ? " ▾" : ""}
      </button>
    </th>
  );
}
