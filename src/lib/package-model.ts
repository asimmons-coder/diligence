import { getDealView } from "./derived";
import { buildScenarioView } from "./derived-evidence";
import { formatMoneyExact, formatMultiple } from "./format";
import type { Database } from "./types";

export interface PackageModel {
  generatedAt: string;
  dealId: string;
  dealName: string;
  vertical: string;
  owner: string;
  stage: string;
  external: {
    system: string | null;
    dealId: string | null;
    url: string | null;
    importedAt: string | null;
    updatedAt: string | null;
  };
  executiveBrief: {
    summary: string;
    assessment: string;
    reportedEbitda: number;
    normalizedEbitda: number;
    proFormaEbitda: number;
    asking: number | null;
    headerMultiple: number | null;
    diligencePct: number;
    readiness: string;
  };
  historicalFinancials: Array<{
    period: string;
    revenue: number;
    ebitda: number;
    margin: number;
  }>;
  ebitdaBridge: {
    reported: number;
    accepted: Array<{ description: string; amount: number; status: string }>;
    normalized: number;
    proposed: Array<{ description: string; amount: number; status: string }>;
    proForma: number;
    note: string;
  };
  adjustmentSupport: Array<{
    description: string;
    amount: number;
    category: string;
    status: string;
    source: string;
    evidence: string | null;
    approval: string;
  }>;
  reconciliation: Array<{
    description: string;
    sourceA: string;
    sourceB: string;
    difference: number | null;
    status: string;
    interpretation: string;
  }>;
  keyRisks: Array<{ title: string; detail: string; severity: string }>;
  openDiligence: Array<{ question: string; status: string; priority: string }>;
  valuationScenarios: Array<{
    name: string;
    ebitda: number;
    multiple: number;
    ev: number;
    gapToSeller: number;
    label: string;
  }>;
  evidenceAppendix: Array<{ path: string; type: string; period: string | null; status: string }>;
  decisionHistory: Array<{
    occurredAt: string;
    actor: string;
    entity: string;
    action: string;
    resolution: string;
  }>;
  baseline: {
    underwrittenRevenue: number | null;
    underwrittenEbitda: number | null;
    acceptedAdjustments: number | null;
    expectedSynergies: number | null;
    nwc: number | null;
    purchasePrice: number | null;
    structure: string;
    retention: string;
    firstYear: string;
  } | null;
}

export function buildPackageModel(db: Database, dealId: string): PackageModel | null {
  const view = getDealView(db, dealId);
  if (!view) return null;
  const deal = view.deal;
  const users = Object.fromEntries(db.users.map((u) => [u.id, u.name]));
  const baseline = db.post_close_baselines.find((b) => b.deal_id === dealId) ?? null;
  const accepted = view.adjustments.filter((a) => a.status === "accepted");
  const proposed = view.adjustments.filter((a) => a.status === "proposed" || a.status === "needs_review");

  return {
    generatedAt: new Date().toISOString(),
    dealId: deal.id,
    dealName: deal.name,
    vertical: deal.vertical,
    owner: view.owner.name,
    stage: deal.stage,
    external: {
      system: deal.external_system ?? null,
      dealId: deal.external_deal_id ?? null,
      url: deal.external_deal_url ?? null,
      importedAt: deal.external_imported_at ?? null,
      updatedAt: deal.external_updated_at ?? null,
    },
    executiveBrief: {
      summary: deal.summary,
      assessment: deal.ai_assessment,
      reportedEbitda: view.reportedEbitda,
      normalizedEbitda: view.normalizedEbitda,
      proFormaEbitda: view.proFormaEbitda,
      asking: deal.asking_price,
      headerMultiple: view.headerMultiple,
      diligencePct: view.diligencePct,
      readiness: view.readiness.summary,
    },
    historicalFinancials: view.periods.map((p) => ({
      period: p.period.label,
      revenue: p.revenue,
      ebitda: p.reportedEbitda,
      margin: p.ebitdaMargin,
    })),
    ebitdaBridge: {
      reported: view.reportedEbitda,
      accepted: accepted.map((a) => ({
        description: a.description,
        amount: a.amount,
        status: a.status,
      })),
      normalized: view.normalizedEbitda,
      proposed: proposed.map((a) => ({
        description: a.description,
        amount: a.amount,
        status: a.status,
      })),
      proForma: view.proFormaEbitda,
      note: "Normalized = Reported + Accepted excluding synergy. Pro forma includes remaining Proposed. Occupancy/synergy stay proposed unless a human accepts them.",
    },
    adjustmentSupport: view.adjustments.map((a) => ({
      description: a.description,
      amount: a.amount,
      category: a.category,
      status: a.status,
      source: a.source,
      evidence: a.provenance.source_document_name,
      approval: a.status === "accepted" ? "Accepted by human" : a.status,
    })),
    reconciliation: view.conflicts.map((c) => ({
      description: c.description,
      sourceA: c.source_a_label,
      sourceB: c.source_b_label,
      difference: c.difference,
      status: c.status,
      interpretation: c.ai_interpretation,
    })),
    keyRisks: view.risks.map((r) => ({ title: r.title, detail: r.detail, severity: r.severity })),
    openDiligence: view.diligence
      .filter((d) => !["complete", "na"].includes(d.status))
      .map((d) => ({ question: d.question, status: d.status, priority: d.priority })),
    valuationScenarios: view.valuationScenarios.map((s) => {
      const built = buildScenarioView(view.reportedEbitda, view.normalizedEbitda, view.adjustments, s);
      return {
        name: s.name,
        ebitda: built.selectedEbitda,
        multiple: built.selectedMultiple,
        ev: built.ev,
        gapToSeller: built.gapToSeller,
        label: "Scenario analysis — not a committed price",
      };
    }),
    evidenceAppendix: view.evidenceItems.map((e) => ({
      path: e.folder_path && e.basename ? `${e.folder_path}/${e.basename}` : (e.filename ?? e.title),
      type: e.detected_type,
      period: e.detected_period,
      status: e.human_review_status,
    })),
    decisionHistory: [
      ...db.evaluation_events
        .filter((e) => e.deal_id === dealId)
        .map((e) => ({
          occurredAt: e.occurred_at,
          actor: users[e.preparer_user_id ?? ""] ?? "System",
          entity: `${e.entity_type} · ${e.financial_context ?? e.entity_id}`,
          action: e.analyst_action,
          resolution: e.final_resolution,
        })),
      ...view.activities.slice(0, 20).map((a) => ({
        occurredAt: a.occurred_at,
        actor: users[a.actor_user_id ?? ""] ?? "System",
        entity: a.kind,
        action: a.title,
        resolution: a.body,
      })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    baseline: baseline
      ? {
          underwrittenRevenue: baseline.underwritten_revenue,
          underwrittenEbitda: baseline.underwritten_ebitda,
          acceptedAdjustments: baseline.accepted_adjustments_total,
          expectedSynergies: baseline.expected_synergies,
          nwc: baseline.nwc_assumption,
          purchasePrice: baseline.purchase_price,
          structure: baseline.structure,
          retention: baseline.retention_assumptions,
          firstYear: baseline.expected_first_year_performance,
        }
      : null,
  };
}

export function packageHeadline(model: PackageModel) {
  return `${model.dealName} · Reported ${formatMoneyExact(model.executiveBrief.reportedEbitda)} · Normalized ${formatMoneyExact(model.executiveBrief.normalizedEbitda)} · Ask ${formatMoneyExact(model.executiveBrief.asking)} (${formatMultiple(model.executiveBrief.headerMultiple)})`;
}
