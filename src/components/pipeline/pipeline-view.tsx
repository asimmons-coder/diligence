"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PIPELINE_VIEW_KEY, SOURCE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { formatDate, formatHeaderMultiple, formatRelative } from "@/lib/format";
import { useStore } from "@/lib/store";
import { DEAL_STAGES, type DealStage, type DealView } from "@/lib/types";
import { FlagPills } from "@/components/shared/flags";
import { Money } from "@/components/shared/money";
import { StagePill } from "@/components/shared/stage-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "kanban" | "table";
type SortKey =
  | "name"
  | "stage"
  | "revenue"
  | "reported"
  | "normalized"
  | "price"
  | "multiple"
  | "probability"
  | "diligence"
  | "last";

function loadView(): ViewMode {
  if (typeof window === "undefined") return "kanban";
  return localStorage.getItem(PIPELINE_VIEW_KEY) === "table" ? "table" : "kanban";
}

export function PipelineView() {
  const { views, db } = useStore();
  const [mode, setMode] = useState<ViewMode>(loadView);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function changeMode(next: ViewMode) {
    setMode(next);
    localStorage.setItem(PIPELINE_VIEW_KEY, next);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = views.filter((v) => {
      if (stageFilter !== "all" && v.deal.stage !== stageFilter) return false;
      if (ownerFilter !== "all" && v.deal.owner_user_id !== ownerFilter) return false;
      if (!q) return true;
      return `${v.deal.name} ${v.deal.location_city} ${v.primaryContact?.name ?? ""} ${v.owner.name}`
        .toLowerCase()
        .includes(q);
    });
    rows = rows.slice().sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return rows;
  }, [views, query, stageFilter, ownerFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2.5">
        <h1 className="mr-2 text-[15px] font-semibold">Pipeline</h1>
        <Link href="/deals/new">
          <Button size="sm">New deal</Button>
        </Link>
        <div className="flex rounded-md border">
          <Button
            size="sm"
            variant={mode === "kanban" ? "secondary" : "ghost"}
            onClick={() => changeMode("kanban")}
          >
            Kanban
          </Button>
          <Button
            size="sm"
            variant={mode === "table" ? "secondary" : "ghost"}
            onClick={() => changeMode("table")}
          >
            Table
          </Button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter firms…"
          className="h-8 w-52"
        />
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(String(v ?? "all"))}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {DEAL_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(String(v ?? "all"))}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {db.users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-[12px] text-muted-foreground">{filtered.length} deals</div>
      </div>
      {mode === "kanban" ? (
        <Kanban rows={filtered} />
      ) : (
        <DealTable rows={filtered} sortKey={sortKey} onSort={toggleSort} />
      )}
    </div>
  );
}

function sortValue(v: DealView, key: SortKey): string | number {
  switch (key) {
    case "name":
      return v.deal.name;
    case "stage":
      return DEAL_STAGES.indexOf(v.deal.stage);
    case "revenue":
      return v.revenue;
    case "reported":
      return v.reportedEbitda;
    case "normalized":
      return v.normalizedEbitda;
    case "price":
      return v.purchasePrice ?? 0;
    case "multiple":
      return v.headerMultiple ?? 0;
    case "probability":
      return v.deal.probability;
    case "diligence":
      return v.diligencePct;
    case "last":
      return v.deal.last_activity_at;
  }
}

function Kanban({ rows }: { rows: DealView[] }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-auto px-4 py-3">
      {DEAL_STAGES.map((stage) => {
        const cards = rows.filter((r) => r.deal.stage === stage);
        return (
          <section key={stage} className="flex w-[280px] shrink-0 flex-col">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[12px] font-semibold">{STAGE_LABELS[stage]}</h2>
              <span className="tabular text-[11px] text-muted-foreground">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map((v) => (
                <KanbanCard key={v.deal.id} view={v} />
              ))}
              {cards.length === 0 && (
                <div className="rounded-md border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({ view }: { view: DealView }) {
  return (
    <Link
      href={`/deals/${view.deal.id}`}
      className="block rounded-md border bg-white p-2.5 hover:border-zinc-400"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-[13px] leading-snug">{view.deal.name}</div>
        <div className="tabular text-[11px] text-muted-foreground">{view.diligencePct}%</div>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {view.deal.location_city}, {view.deal.location_state}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <span className="text-muted-foreground">Revenue</span>
        <span className="text-right">
          <Money value={view.revenue} compact />
        </span>
        <span className="text-muted-foreground">Reported</span>
        <span className="text-right">
          <Money value={view.reportedEbitda} compact />
        </span>
        <span className="text-muted-foreground">Normalized</span>
        <span className="text-right">
          <Money value={view.normalizedEbitda} compact />
        </span>
        <span className="text-muted-foreground">Multiple</span>
        <span className="tabular text-right">{formatHeaderMultiple(view.headerMultiple)}</span>
      </div>
      {view.nextAction && (
        <div className="mt-2 border-t pt-1.5 text-[11px] text-zinc-600">
          {view.nextAction.title}
          <span className="text-muted-foreground">
            {" "}
            · {formatDate(view.nextAction.due_date)}
          </span>
        </div>
      )}
      <div className="mt-1.5">
        <FlagPills flags={view.deal.flags} />
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">
        {view.readiness.overall.replaceAll("_", " ")}
        {view.openConflictCount > 0 ? ` · ${view.openConflictCount} conflicts` : ""}
      </div>
    </Link>
  );
}

function DealTable({
  rows,
  sortKey,
  onSort,
}: {
  rows: DealView[];
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  const router = useRouter();
  const { db } = useStore();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-max min-w-full text-left text-[12px]">
        <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <Th k="name" current={sortKey} onSort={onSort}>
              Company
            </Th>
            <th className="px-2 py-2">Location</th>
            <th className="px-2 py-2">Primary contact</th>
            <th className="px-2 py-2">Deal owner</th>
            <th className="px-2 py-2">Source</th>
            <Th k="stage" current={sortKey} onSort={onSort}>
              Stage
            </Th>
            <th className="px-2 py-2">Entered</th>
            <Th k="revenue" current={sortKey} onSort={onSort} right>
              Revenue
            </Th>
            <Th k="reported" current={sortKey} onSort={onSort} right>
              Reported EBITDA
            </Th>
            <Th k="normalized" current={sortKey} onSort={onSort} right>
              Adjusted EBITDA
            </Th>
            <th className="px-2 py-2 text-right">Pro forma</th>
            <Th k="price" current={sortKey} onSort={onSort} right>
              Asking / expected
            </Th>
            <Th k="multiple" current={sortKey} onSort={onSort} right>
              Implied multiple
            </Th>
            <Th k="probability" current={sortKey} onSort={onSort} right>
              Prob.
            </Th>
            <th className="px-2 py-2">Next action</th>
            <th className="px-2 py-2">Action owner</th>
            <th className="px-2 py-2">Action date</th>
            <Th k="last" current={sortKey} onSort={onSort}>
              Last activity
            </Th>
            <th className="px-2 py-2">Flags</th>
            <Th k="diligence" current={sortKey} onSort={onSort} right>
              Diligence
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const actionOwner = v.nextAction
              ? db.users.find((u) => u.id === v.nextAction?.owner_user_id)
              : null;
            return (
              <tr
                key={v.deal.id}
                tabIndex={0}
                className="cursor-pointer border-b bg-white hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
                onClick={() => router.push(`/deals/${v.deal.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/deals/${v.deal.id}`);
                  }
                }}
              >
                <td className="px-2 py-2 font-medium whitespace-nowrap">{v.deal.name}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {v.deal.location_city}, {v.deal.location_state}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{v.primaryContact?.name ?? "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{v.owner.name}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {SOURCE_LABELS[v.deal.source]}
                  <span className="text-muted-foreground"> · {v.deal.source_detail}</span>
                </td>
                <td className="px-2 py-2">
                  <StagePill stage={v.deal.stage} />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{formatDate(v.deal.stage_entered_at)}</td>
                <td className="px-2 py-2 text-right">
                  <Money value={v.revenue} />
                </td>
                <td className="px-2 py-2 text-right">
                  <Money value={v.reportedEbitda} />
                </td>
                <td className="px-2 py-2 text-right">
                  <Money value={v.normalizedEbitda} />
                </td>
                <td className="px-2 py-2 text-right">
                  <Money value={v.proFormaEbitda} />
                </td>
                <td className="px-2 py-2 text-right">
                  <Money value={v.purchasePrice} />
                </td>
                <td className="tabular px-2 py-2 text-right">
                  {formatHeaderMultiple(v.headerMultiple)}
                </td>
                <td className="tabular px-2 py-2 text-right">
                  {Math.round(v.deal.probability * 100)}%
                </td>
                <td className="px-2 py-2">{v.nextAction?.title ?? "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{actionOwner?.name ?? "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {formatDate(v.nextAction?.due_date)}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {formatRelative(v.deal.last_activity_at)}
                </td>
                <td className="px-2 py-2">
                  <FlagPills flags={v.deal.flags} />
                </td>
                <td className="tabular px-2 py-2 text-right">{v.diligencePct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  k,
  current,
  onSort,
  children,
  right,
}: {
  k: SortKey;
  current: SortKey;
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={right ? "px-2 py-2 text-right" : "px-2 py-2"}>
      <button type="button" className="hover:text-foreground" onClick={() => onSort(k)}>
        {children}
        {current === k ? " ▾" : ""}
      </button>
    </th>
  );
}

export type { DealStage };
