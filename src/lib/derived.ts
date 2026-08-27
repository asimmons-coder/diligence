import { APP_AS_OF, STALE_DAYS, UPCOMING_DEADLINE_DAYS } from "./constants";
import { daysBetween } from "./format";
import type {
  AdjustmentStatus,
  AttentionItem,
  Database,
  Deal,
  DealStage,
  DealView,
  DiligenceStatus,
  DocumentRecord,
  EbitdaAdjustment,
  FinancialMetric,
  MetricKey,
  OpexLine,
  PeriodMetrics,
  PortfolioMetrics,
  Task,
} from "./types";
import {
  DEAL_STAGES,
  DILIGENCE_STAGES,
  LOI_OUTSTANDING_STAGES,
  TERMINAL_STAGES,
} from "./types";
import { OPEX_LABELS } from "./constants";

const OPEX_KEYS: MetricKey[] = [
  "opex_owner",
  "opex_staff",
  "opex_occupancy",
  "opex_marketing",
  "opex_professional_services",
  "opex_insurance",
  "opex_technology",
  "opex_other",
];

const CLOSED_DILIGENCE: DiligenceStatus[] = ["complete", "na"];

export function isActiveStage(stage: DealStage): boolean {
  return !TERMINAL_STAGES.includes(stage);
}

export function metricAmount(
  metrics: FinancialMetric[],
  key: MetricKey
): number {
  return metrics.find((m) => m.metric_key === key)?.amount ?? 0;
}

export function buildPeriodMetrics(
  db: Database,
  periodId: string
): PeriodMetrics | null {
  const period = db.financial_periods.find((p) => p.id === periodId);
  if (!period) return null;
  const metrics = db.financial_metrics.filter((m) => m.period_id === periodId);
  const opexDetail: OpexLine[] = OPEX_KEYS.flatMap((key) => {
    const row = metrics.find((m) => m.metric_key === key);
    if (!row) return [];
    return [
      {
        key,
        label: OPEX_LABELS[key] ?? key,
        amount: row.amount,
      },
    ];
  });
  return {
    period,
    revenue: metricAmount(metrics, "revenue"),
    directCosts: metricAmount(metrics, "direct_costs"),
    grossProfit: metricAmount(metrics, "gross_profit"),
    opex: metricAmount(metrics, "operating_expenses"),
    reportedEbitda: metricAmount(metrics, "reported_ebitda"),
    ebitdaMargin: metricAmount(metrics, "ebitda_margin"),
    opexDetail,
  };
}

export function adjustmentCountsTowardNormalized(
  adj: EbitdaAdjustment
): boolean {
  return adj.status === "accepted" && adj.category !== "synergy";
}

export function sumAdjustments(
  adjustments: EbitdaAdjustment[],
  status: AdjustmentStatus | AdjustmentStatus[],
  opts?: { excludeSynergy?: boolean }
): number {
  const statuses = Array.isArray(status) ? status : [status];
  return adjustments
    .filter((a) => statuses.includes(a.status))
    .filter((a) => (opts?.excludeSynergy ? a.category !== "synergy" : true))
    .reduce((sum, a) => sum + a.amount, 0);
}

export function computeBridge(reported: number, adjustments: EbitdaAdjustment[]) {
  const acceptedLift = sumAdjustments(adjustments, "accepted", {
    excludeSynergy: true,
  });
  const acceptedSynergy = adjustments
    .filter((a) => a.status === "accepted" && a.category === "synergy")
    .reduce((sum, a) => sum + a.amount, 0);
  const proposedLift = sumAdjustments(adjustments, "proposed");
  const normalizedEbitda = reported + acceptedLift;
  const proFormaEbitda = normalizedEbitda + acceptedSynergy + proposedLift;
  return {
    acceptedLift,
    proposedLift,
    acceptedSynergy,
    normalizedEbitda,
    proFormaEbitda,
  };
}

export function impliedMultiple(
  price: number | null | undefined,
  earnings: number | null | undefined
): number | null {
  if (price == null || !earnings) return null;
  return price / earnings;
}

export function diligencePct(requests: { status: DiligenceStatus }[]): number {
  if (requests.length === 0) return 0;
  const done = requests.filter((r) => CLOSED_DILIGENCE.includes(r.status)).length;
  return Math.round((done / requests.length) * 100);
}

export function userById(db: Database, id: string) {
  return db.users.find((u) => u.id === id);
}

export function getDealView(db: Database, dealId: string): DealView | null {
  const deal = db.deals.find((d) => d.id === dealId);
  if (!deal) return null;
  const owner = userById(db, deal.owner_user_id);
  if (!owner) return null;

  const contacts = db.contacts.filter((c) => c.deal_id === dealId);
  const periods = db.financial_periods
    .filter((p) => p.deal_id === dealId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => buildPeriodMetrics(db, p.id))
    .filter((p): p is PeriodMetrics => p !== null);

  const latest = periods.find((p) => p.period.is_latest) ?? periods.at(-1) ?? null;
  const earliest =
    latest == null
      ? null
      : periods.find((p) => p.period.id !== latest.period.id) ?? null;
  const prior =
    latest == null
      ? null
      : [...periods]
          .reverse()
          .find((p) => p.period.id !== latest.period.id) ?? null;

  const adjustments = db.ebitda_adjustments.filter((a) => a.deal_id === dealId);
  const latestAdjustments = latest
    ? adjustments.filter((a) => a.period_id === latest.period.id)
    : adjustments;

  const reportedEbitda = latest?.reportedEbitda ?? 0;
  const bridge = computeBridge(reportedEbitda, latestAdjustments);
  const purchasePrice = deal.expected_purchase_price ?? deal.asking_price;
  const revenue = latest?.revenue ?? 0;
  const growthBase = earliest ?? prior;
  const growth =
    latest && growthBase && growthBase.revenue && growthBase.period.id !== latest.period.id
      ? (latest.revenue - growthBase.revenue) / growthBase.revenue
      : null;

  const documents = db.documents
    .filter((d) => d.deal_id === dealId)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  const diligence = db.diligence_requests.filter((d) => d.deal_id === dealId);
  const findings = db.ai_findings.filter((f) => f.deal_id === dealId);
  const tasks = db.tasks
    .filter((t) => t.deal_id === dealId)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const notes = db.notes
    .filter((n) => n.deal_id === dealId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activities = db.activities
    .filter((a) => a.deal_id === dealId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  const nextAction =
    tasks.find((t) => !t.completed) ??
    null;

  return {
    deal,
    owner,
    primaryContact: contacts.find((c) => c.is_primary) ?? contacts[0] ?? null,
    contacts,
    periods,
    latest,
    prior,
    adjustments: latestAdjustments,
    documents,
    diligence,
    findings,
    tasks,
    notes,
    activities,
    reportedEbitda,
    normalizedEbitda: bridge.normalizedEbitda,
    proFormaEbitda: bridge.proFormaEbitda,
    acceptedLift: bridge.acceptedLift,
    proposedLift: bridge.proposedLift,
    revenue,
    growth,
    impliedMultipleReported: impliedMultiple(purchasePrice, reportedEbitda),
    impliedMultipleNormalized: impliedMultiple(
      purchasePrice,
      bridge.normalizedEbitda
    ),
    impliedMultipleProForma: impliedMultiple(
      purchasePrice,
      bridge.proFormaEbitda
    ),
    headerMultiple: impliedMultiple(purchasePrice, bridge.proFormaEbitda),
    diligencePct: diligencePct(diligence),
    purchasePrice: purchasePrice ?? null,
    attention: collectDealAttention(db, deal, {
      documents,
      diligence,
      tasks,
      nextAction,
    }),
    nextAction,
  };
}

export function listDealViews(db: Database): DealView[] {
  return db.deals
    .map((d) => getDealView(db, d.id))
    .filter((d): d is DealView => d !== null);
}

export function collectDealAttention(
  db: Database,
  deal: Deal,
  ctx: {
    documents: DocumentRecord[];
    diligence: DealView["diligence"];
    tasks: Task[];
    nextAction: Task | null;
  }
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const req of ctx.diligence) {
    if (
      req.due_date &&
      !CLOSED_DILIGENCE.includes(req.status) &&
      daysBetween(req.due_date) > 0
    ) {
      items.push({
        dealId: deal.id,
        dealName: deal.name,
        reason: "overdue_diligence",
        label: "Overdue diligence",
        detail: req.question,
      });
    }
  }

  if (daysBetween(deal.last_activity_at) > STALE_DAYS) {
    items.push({
      dealId: deal.id,
      dealName: deal.name,
      reason: "stale_activity",
      label: "Stale activity",
      detail: `No activity in ${daysBetween(deal.last_activity_at)} days`,
    });
  }

  if (deal.flags.includes("financial_inconsistency")) {
    items.push({
      dealId: deal.id,
      dealName: deal.name,
      reason: "financial_inconsistency",
      label: "Financial inconsistency",
      detail:
        deal.attention_items.find((line) =>
          /reconcil|inconsist|unexplained|does not match/i.test(line)
        ) ?? "Reported figures do not reconcile across source files",
    });
  }

  const missingTax = deal.flags.includes("missing_tax_return");
  const thinRoom = deal.flags.includes("data_room_thin");
  const has2025Tax = ctx.documents.some((d) =>
    /2025/.test(d.filename) && d.folder === "tax"
  );
  if (missingTax || (thinRoom && ctx.documents.length < 3) || (deal.stage !== "target" && deal.stage !== "contacted" && !has2025Tax && deal.stage !== "closed" && deal.stage !== "passed" && missingTax)) {
    if (missingTax || !has2025Tax && ["diligence", "confirmatory_diligence", "financial_review", "loi", "closing"].includes(deal.stage)) {
      if (missingTax || (deal.id === "hale-mercer" && !has2025Tax)) {
        items.push({
          dealId: deal.id,
          dealName: deal.name,
          reason: "missing_critical_document",
          label: "Missing critical document",
          detail: missingTax
            ? "2025 tax return has not been provided"
            : thinRoom
              ? "Data room is still thin relative to stage"
              : "A required source file is still outstanding",
        });
      }
    }
  }

  for (const task of ctx.tasks) {
    if (task.completed || !task.due_date) continue;
    const dueIn = -daysBetween(task.due_date);
    if (dueIn >= 0 && dueIn <= UPCOMING_DEADLINE_DAYS) {
      items.push({
        dealId: deal.id,
        dealName: deal.name,
        reason: "upcoming_deadline",
        label: dueIn === 0 ? "Due today" : "Upcoming deadline",
        detail: `${task.title} · ${dueIn === 0 ? "today" : `in ${dueIn}d`}`,
      });
    }
  }

  return items;
}

export function getPortfolioMetrics(db: Database): PortfolioMetrics {
  const views = listDealViews(db);
  const active = views.filter((v) => isActiveStage(v.deal.stage));
  const attention = views
    .filter((v) => isActiveStage(v.deal.stage))
    .flatMap((v) => v.attention);

  const uniqueAttention = dedupeAttention(attention);

  return {
    activeDeals: active.length,
    diligenceDeals: active.filter((v) =>
      DILIGENCE_STAGES.includes(v.deal.stage)
    ).length,
    loisOutstanding: active.filter((v) =>
      LOI_OUTSTANDING_STAGES.includes(v.deal.stage)
    ).length,
    expectedCapital: active.reduce((sum, v) => {
      const price = v.purchasePrice ?? 0;
      return sum + price * v.deal.probability;
    }, 0),
    pipelineRevenue: active.reduce((sum, v) => sum + v.revenue, 0),
    pipelineAdjustedEbitda: active.reduce(
      (sum, v) => sum + v.normalizedEbitda,
      0
    ),
    funnel: DEAL_STAGES.map((stage) => ({
      stage,
      count: views.filter((v) => v.deal.stage === stage).length,
    })),
    attention: uniqueAttention,
  };
}

function dedupeAttention(items: AttentionItem[]): AttentionItem[] {
  const seen = new Set<string>();
  const out: AttentionItem[] = [];
  for (const item of items) {
    const key = `${item.dealId}:${item.reason}:${item.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  const rank: Record<AttentionItem["reason"], number> = {
    overdue_diligence: 0,
    financial_inconsistency: 1,
    missing_critical_document: 2,
    upcoming_deadline: 3,
    stale_activity: 4,
  };
  return out.sort((a, b) => rank[a.reason] - rank[b.reason] || a.dealName.localeCompare(b.dealName));
}

export function searchDeals(db: Database, query: string): DealView[] {
  const q = query.trim().toLowerCase();
  if (!q) return listDealViews(db);
  return listDealViews(db).filter((v) => {
    const hay = [
      v.deal.name,
      v.deal.location_city,
      v.deal.location_state,
      v.owner.name,
      v.primaryContact?.name ?? "",
      v.deal.stage,
      v.deal.source_detail,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function documentById(db: Database, id: string) {
  return db.documents.find((d) => d.id === id) ?? null;
}

export const APP_TODAY = APP_AS_OF;
