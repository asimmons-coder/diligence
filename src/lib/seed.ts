import { CURRENT_ORG_ID, CURRENT_USER_ID } from "./constants";
import { assertReconcile } from "./format";
import { computeBridge, diligencePct, getDealView } from "./derived";
import { haleDeal, haleSlice } from "./seed-hale";
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
    id: CURRENT_USER_ID,
    organization_id: CURRENT_ORG_ID,
    name: "Elena Vargas",
    email: "evargas@northline.legal",
    role: "deal_lead",
    title: "Deal Lead",
    initials: "EV",
    is_current: true,
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
  },
  {
    id: "user_alex",
    organization_id: CURRENT_ORG_ID,
    name: "Alex Chen",
    email: "achen@northline.legal",
    role: "managing_partner",
    title: "Managing Partner",
    initials: "AC",
    is_current: false,
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
  },
];

function assemble(): Database {
  const hale = haleSlice();
  const rest = portfolioSlice();
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
