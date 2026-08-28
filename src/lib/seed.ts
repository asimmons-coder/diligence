import {
  ALEX_USER_ID,
  CURRENT_ORG_ID,
  CURRENT_USER_ID,
  ELENA_USER_ID,
  GIOVANNI_USER_ID,
} from "./constants";
import { assertReconcile } from "./format";
import { computeBridge, diligencePct, getDealView } from "./derived";
import { haleDeal, haleSlice } from "./seed-hale";
import { haleEvidenceTables } from "./seed-hale-evidence";
import { phase3Tables } from "./seed-phase3";
import { portfolioDeals, portfolioSlice } from "./seed-portfolio";
import type { Database, Organization, User } from "./types";

export const organization: Organization = {
  id: CURRENT_ORG_ID,
  name: "Northline Legal",
  slug: "northline-legal",
  vertical_focus: "legal",
  created_at: "2024-02-01T12:00:00.000Z",
};

export const users: User[] = [
  {
    id: GIOVANNI_USER_ID,
    organization_id: CURRENT_ORG_ID,
    name: "Giovanni Ackerman",
    email: "gackerman@northline.legal",
    role: "financial_diligence",
    title: "Financial Diligence Associate",
    initials: "GA",
    is_current: true,
    last_seen_at: "2026-08-26T18:00:00.000Z",
  },
  {
    id: ELENA_USER_ID,
    organization_id: CURRENT_ORG_ID,
    name: "Elena Vargas",
    email: "evargas@northline.legal",
    role: "deal_lead",
    title: "Deal Lead",
    initials: "EV",
    is_current: false,
    last_seen_at: "2026-08-27T09:00:00.000Z",
  },
  {
    id: "user_marcus",
    organization_id: CURRENT_ORG_ID,
    name: "Marcus Webb",
    email: "mwebb@northline.legal",
    role: "financial_diligence",
    title: "Financial Diligence",
    initials: "MW",
    is_current: false,
    last_seen_at: "2026-08-25T12:00:00.000Z",
  },
  {
    id: "user_priya",
    organization_id: CURRENT_ORG_ID,
    name: "Priya Shah",
    email: "pshah@northline.legal",
    role: "vp_diligence",
    title: "VP Diligence",
    initials: "PS",
    is_current: false,
    last_seen_at: "2026-08-24T16:00:00.000Z",
  },
  {
    id: ALEX_USER_ID,
    organization_id: CURRENT_ORG_ID,
    name: "Alex Chen",
    email: "achen@northline.legal",
    role: "managing_partner",
    title: "Managing Partner",
    initials: "AC",
    is_current: false,
    last_seen_at: "2026-08-25T16:00:00.000Z",
  },
  {
    id: "user_tom",
    organization_id: CURRENT_ORG_ID,
    name: "Tom Brennan",
    email: "tbrennan@northline.legal",
    role: "associate",
    title: "Associate",
    initials: "TB",
    is_current: false,
    last_seen_at: "2026-08-21T11:00:00.000Z",
  },
];

function assemble(): Database {
  const hale = haleSlice();
  const rest = portfolioSlice();
  const evidence = haleEvidenceTables();
  const phase3 = phase3Tables();
  return {
    organizations: [organization],
    users,
    deals: [haleDeal, ...portfolioDeals],
    contacts: [...hale.contacts, ...rest.contacts],
    financial_periods: [...hale.financial_periods, ...rest.financial_periods],
    financial_metrics: [...hale.financial_metrics, ...rest.financial_metrics],
    ebitda_adjustments: [...hale.ebitda_adjustments, ...rest.ebitda_adjustments],
    documents: [...hale.documents, ...rest.documents],
    diligence_requests: [...hale.diligence_requests, ...rest.diligence_requests],
    ai_findings: [...hale.ai_findings, ...rest.ai_findings],
    tasks: [...hale.tasks, ...rest.tasks],
    notes: [...hale.notes, ...rest.notes],
    activities: [...hale.activities, ...rest.activities],
    audit_events: [...hale.audit_events, ...rest.audit_events],
    evidence_items: evidence.evidence_items,
    document_versions: evidence.document_versions,
    extractions: evidence.extractions,
    extracted_facts: evidence.extracted_facts,
    conflicts: evidence.conflicts,
    reconciliation_checks: evidence.reconciliation_checks,
    assumptions: evidence.assumptions,
    underwriting_risks: evidence.underwriting_risks,
    valuation_scenarios: evidence.valuation_scenarios,
    valuation_factors: evidence.valuation_factors,
    negotiation_positions: evidence.negotiation_positions,
    recommendations: evidence.recommendations,
    review_decisions: evidence.review_decisions,
    missing_items: evidence.missing_items,
    communication_interpretations: evidence.communication_interpretations,
    underwriting_templates: phase3.underwriting_templates,
    template_fields: phase3.template_fields,
    deal_template_field_values: phase3.deal_template_field_values,
    evaluation_events: phase3.evaluation_events,
    change_events: phase3.change_events,
    import_events: phase3.import_events,
    post_close_baselines: phase3.post_close_baselines,
  };
}

export const seedDatabase: Database = assemble();

export function cloneSeed(): Database {
  return structuredClone(seedDatabase);
}

export function validateSeed(db: Database = seedDatabase) {
  const hale = getDealView(db, "hale-mercer");
  if (!hale || !hale.latest) throw new Error("Hale & Mercer missing from seed");

  assertReconcile(hale.latest.revenue, 8_400_000, "Hale TTM revenue");
  assertReconcile(hale.latest.reportedEbitda, 2_100_000, "Hale TTM EBITDA");
  assertReconcile(hale.normalizedEbitda, 2_495_000, "Hale normalized");
  assertReconcile(hale.proFormaEbitda, 2_705_000, "Hale pro forma");
  assertReconcile(hale.diligencePct, 64, "Hale diligence %");
  if (!hale.growth || Math.abs(hale.growth - 0.14) > 0.002) {
    throw new Error(`Hale growth expected ~14%, got ${hale.growth}`);
  }
  if (!hale.headerMultiple || Math.abs(hale.headerMultiple - 6.21) > 0.02) {
    throw new Error(`Hale header multiple expected ~6.21x, got ${hale.headerMultiple}`);
  }
  if (hale.findings.length < 5) throw new Error("Hale needs 5+ AI findings");
  if (hale.documents.length < 10) throw new Error("Hale needs 10+ documents");
  if (hale.diligence.length < 20) throw new Error("Hale needs 20+ diligence items");
  if (hale.evidenceItems.length < 15) throw new Error("Hale needs 15+ evidence items");
  if (hale.conflicts.length < 8) throw new Error("Hale needs 8+ conflicts");
  if (hale.valuationScenarios.length !== 3) throw new Error("Hale needs 3 valuation scenarios");
  if (hale.readiness.overall === "ready_for_indication" || hale.readiness.overall === "ready_for_loi") {
    throw new Error("Hale should not be ready for a final indication");
  }
  const taxConflict = hale.conflicts.find((c) => c.id === "cf_hale_tax_vs_pl");
  if (!taxConflict || taxConflict.difference !== 240_000) {
    throw new Error("Hale tax vs P&L conflict missing or wrong");
  }

  const giovanni = db.users.find((u) => u.id === CURRENT_USER_ID);
  if (!giovanni || giovanni.name !== "Giovanni Ackerman") {
    throw new Error("Giovanni must be the seeded current operator");
  }
  const evals = db.evaluation_events.filter((e) => e.deal_id === "hale-mercer");
  if (evals.length < 8 || evals.length > 14) {
    throw new Error(`Hale should seed 8–12 evaluation events, got ${evals.length}`);
  }
  const baseline = db.post_close_baselines.find((b) => b.deal_id === "hale-mercer");
  if (!baseline || baseline.underwritten_ebitda !== 2_495_000) {
    throw new Error("Hale post-close baseline missing or wrong EBITDA");
  }
  const nested = hale.evidenceItems.filter((e) => e.folder_path && e.basename);
  if (nested.length < 15) throw new Error("Hale evidence must preserve nested folder paths");
  const lawValues = db.deal_template_field_values.filter((v) => v.deal_id === "hale-mercer");
  if (lawValues.length < 16) throw new Error("Hale needs the law-firm template fields");
  if (lawValues.filter((v) => v.status === "missing").length < 3) {
    throw new Error("Hale template should expose missing-field gaps");
  }
  if (db.deals.find((d) => d.id === "hale-mercer")?.template_id !== "tpl_law_firm") {
    throw new Error("Hale must use the law-firm underwriting template");
  }

  for (const view of db.deals.map((d) => getDealView(db, d.id))) {
    if (!view?.latest) continue;
    assertReconcile(
      view.latest.grossProfit,
      view.latest.revenue - view.latest.directCosts,
      `${view.deal.name} GP`
    );
    assertReconcile(
      view.latest.reportedEbitda,
      view.latest.grossProfit - view.latest.opex,
      `${view.deal.name} EBITDA`
    );
    const bridge = computeBridge(view.latest.reportedEbitda, view.adjustments);
    assertReconcile(view.normalizedEbitda, bridge.normalizedEbitda, `${view.deal.name} norm`);
    assertReconcile(view.proFormaEbitda, bridge.proFormaEbitda, `${view.deal.name} pf`);
    assertReconcile(view.diligencePct, diligencePct(view.diligence), `${view.deal.name} dil %`);
  }
}

validateSeed();
