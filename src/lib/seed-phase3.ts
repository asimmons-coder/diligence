import {
  ALEX_USER_ID,
  CURRENT_ORG_ID,
  ELENA_USER_ID,
  GENERIC_TEMPLATE_ID,
  GIOVANNI_USER_ID,
  HALE_DEAL_ID,
  LAW_FIRM_TEMPLATE_ID,
} from "./constants";
import type {
  ChangeEvent,
  DealTemplateFieldValue,
  EvaluationEvent,
  ImportEvent,
  Phase3Tables,
  PostCloseBaseline,
  TemplateField,
  TemplateFieldStatus,
  UnderwritingTemplate,
} from "./types";

const ORG = CURRENT_ORG_ID;
const DEAL = HALE_DEAL_ID;
const GIO = GIOVANNI_USER_ID;
const ALEX = ALEX_USER_ID;
const ELENA = ELENA_USER_ID;

const LAW_FIELDS: Array<{
  key: string;
  label: string;
  description: string;
  status: TemplateFieldStatus;
  notes: string;
  evidence: string[];
  summary: string | null;
}> = [
  {
    key: "revenue_by_attorney",
    label: "Revenue by attorney",
    description: "Collections / originations attributed to each attorney.",
    status: "extracted",
    notes: "Production NEW is the later file. Top book is Daniel Mercer.",
    evidence: ["ev_hale_prod_new"],
    summary: "Daniel Mercer $1.428M (17%); Hale $672k; Cho $504k.",
  },
  {
    key: "originations_collections",
    label: "Originations and collections",
    description: "Originations vs collected revenue for the underwriting period.",
    status: "conflict",
    notes: "Production NEW $8.15M collections vs TTM P&L revenue $8.40M.",
    evidence: ["ev_hale_prod_new", "ev_hale_ttm_pl"],
    summary: "$250k gap vs reported revenue — do not overwrite P&L.",
  },
  {
    key: "attorney_concentration",
    label: "Attorney concentration",
    description: "Share of revenue in the largest attorneys.",
    status: "accepted",
    notes: "Top-3 attorneys ≈ 31%. Mercer 17% is a key-person issue.",
    evidence: ["ev_hale_prod_new"],
    summary: "Top attorney 17%; top-3 31%.",
  },
  {
    key: "client_matter_concentration",
    label: "Client / matter concentration",
    description: "Largest clients and matters as a share of collections.",
    status: "extracted",
    notes: "Client Matter Revenue file is present; largest-matter share ~19%.",
    evidence: ["ev_hale_client_rev"],
    summary: "Largest matter ~19% of collections.",
  },
  {
    key: "partner_compensation",
    label: "Partner compensation",
    description: "Partner draws vs P&L owner compensation.",
    status: "conflict",
    notes: "Payroll register partner draws $980k vs P&L owner compensation $1.42M.",
    evidence: ["ev_hale_payroll_v2", "ev_hale_ttm_pl"],
    summary: "$440k unexplained vs P&L. Owner not separately coded.",
  },
  {
    key: "owner_compensation_normalization",
    label: "Owner compensation normalization",
    description: "Add-back of above-market owner pay.",
    status: "accepted",
    notes: "Accepted $310k owner add-back. Prepared by Giovanni; approved by Alex.",
    evidence: ["ev_hale_ttm_pl"],
    summary: "Accepted add-back $310,000. In Normalized EBITDA.",
  },
  {
    key: "employee_attorney_roster",
    label: "Employee / attorney roster reconciliation",
    description: "Headcount vs org chart vs payroll register.",
    status: "reviewed",
    notes: "Org chart received. Payroll does not cleanly separate owners.",
    evidence: ["ev_hale_org_messy", "ev_hale_payroll_v2"],
    summary: "18 attorneys / 4 partners on org chart.",
  },
  {
    key: "ar_aging_collectability",
    label: "AR aging and collectability",
    description: "Aged receivables and reserve quality.",
    status: "extracted",
    notes: "AR Aging shows $1.12M. Collectability not independently tested.",
    evidence: ["ev_hale_ar_aging"],
    summary: "AR $1,120,000. Reserve / >90 not accepted.",
  },
  {
    key: "contingent_fee_inventory",
    label: "Contingent-fee inventory",
    description: "Unbilled contingency matters and expected recoveries.",
    status: "missing",
    notes: "No contingent-fee inventory in the drop. Litigation mix is 42%.",
    evidence: [],
    summary: null,
  },
  {
    key: "referral_source_concentration",
    label: "Referral-source concentration",
    description: "Who originates the book and how portable it is.",
    status: "missing",
    notes: "Not in the messy folder. Needed for retention underwriting.",
    evidence: [],
    summary: null,
  },
  {
    key: "lease_obligations",
    label: "Lease obligations",
    description: "Office lease term, rent, and post-close occupancy treatment.",
    status: "conflict",
    notes: "Lease expires Apr 2028. Occupancy add-back challenged in meeting.",
    evidence: ["ev_hale_lease", "ev_hale_note_occupancy"],
    summary: "333 W Wacker · $540k rent · expiry 2028-04-30.",
  },
  {
    key: "partner_retention",
    label: "Partner-retention requirements",
    description: "Employment / non-solicit status for key partners.",
    status: "extracted",
    notes: "Retention discussion note exists. Agreements unsigned.",
    evidence: ["ev_hale_note_retention"],
    summary: "Unsigned employment agreements. Mercer book is the gating item.",
  },
  {
    key: "trust_account",
    label: "Trust-account issues",
    description: "IOLTA / trust reconciliation and any shortages.",
    status: "missing",
    notes: "No trust-account package in the drop.",
    evidence: [],
    summary: null,
  },
  {
    key: "practice_area_mix",
    label: "Practice-area mix",
    description: "Share of revenue by practice.",
    status: "accepted",
    notes: "Litigation 42% / Corporate 28% / Real Estate 18% / Other 12%.",
    evidence: ["ev_hale_prod_new", "ev_hale_ttm_pl"],
    summary: "Litigation-heavy book.",
  },
  {
    key: "state_ownership",
    label: "State ownership considerations",
    description: "Who may own a law firm in the relevant states.",
    status: "missing",
    notes: "Illinois ownership / fee-split questions are not in the pack.",
    evidence: [],
    summary: null,
  },
  {
    key: "standard_diligence_pack",
    label: "Standard law-firm diligence request pack",
    description: "Whether the usual legal-services request list has been sent.",
    status: "reviewed",
    notes: "Core financials, tax, payroll, production, lease, and NDA are in. Tax 2025, trust, contingent inventory, and referral sources are not.",
    evidence: ["ev_hale_ttm_pl", "ev_hale_tax_2024"],
    summary: "Pack is partial. Blocking: 2025 tax return.",
  },
];

const GENERIC_FIELDS: Array<{ key: string; label: string; description: string }> = [
  { key: "historical_financials", label: "Historical financials", description: "P&L, tax, and bank/GL coverage." },
  { key: "quality_of_earnings", label: "Quality of earnings", description: "Adjustments and one-time items." },
  { key: "customer_concentration", label: "Customer concentration", description: "Largest customers / book." },
  { key: "key_person", label: "Key-person risk", description: "Owner / producer dependence." },
  { key: "lease_and_facilities", label: "Lease and facilities", description: "Occupancy commitments." },
  { key: "working_capital", label: "Working capital", description: "AR, AP, and NWC peg." },
  { key: "legal_and_compliance", label: "Legal and compliance", description: "Material contracts and claims." },
  { key: "standard_request_pack", label: "Standard diligence request pack", description: "Whether the vertical-agnostic list has been sent." },
];

export function underwritingTemplates(): UnderwritingTemplate[] {
  return [
    {
      id: LAW_FIRM_TEMPLATE_ID,
      organization_id: ORG,
      key: "law_firm",
      name: "Law-firm acquisition",
      vertical: "legal",
      description:
        "Configurable underwriting profile for legal-services acquisitions. Other verticals use the generic template.",
    },
    {
      id: GENERIC_TEMPLATE_ID,
      organization_id: ORG,
      key: "generic",
      name: "Generic professional services",
      vertical: "generic",
      description: "Horizontal fallback when no vertical-specific template applies.",
    },
  ];
}

export function templateFields(): TemplateField[] {
  return [
    ...LAW_FIELDS.map((field, index) => ({
      id: `tf_law_${field.key}`,
      organization_id: ORG,
      template_id: LAW_FIRM_TEMPLATE_ID,
      field_key: field.key,
      label: field.label,
      description: field.description,
      sort_order: index,
    })),
    ...GENERIC_FIELDS.map((field, index) => ({
      id: `tf_gen_${field.key}`,
      organization_id: ORG,
      template_id: GENERIC_TEMPLATE_ID,
      field_key: field.key,
      label: field.label,
      description: field.description,
      sort_order: index,
    })),
  ];
}

export function haleTemplateFieldValues(): DealTemplateFieldValue[] {
  return LAW_FIELDS.map((field) => ({
    id: `dtv_hale_${field.key}`,
    organization_id: ORG,
    deal_id: DEAL,
    template_id: LAW_FIRM_TEMPLATE_ID,
    field_id: `tf_law_${field.key}`,
    status: field.status,
    notes: field.notes,
    evidence_item_ids: field.evidence,
    extracted_summary: field.summary,
  }));
}

function evl(partial: EvaluationEvent): EvaluationEvent {
  return partial;
}

export function haleEvaluationEvents(): EvaluationEvent[] {
  return [
    evl({
      id: "eval_hale_ttm_rev",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_ttm_rev",
      document_type: "pnl",
      financial_context: "TTM 2025 revenue",
      initial_system_output: "TTM 2025 revenue $8,400,000 from Hale_Mercer_TTM_2025_PL.pdf",
      analyst_action: "accepted",
      corrected_answer: null,
      why_original_was_wrong: null,
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 12,
      final_resolution: "Accepted as reported revenue. Production and QB remain reconciling items.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-22T14:10:00.000Z",
    }),
    evl({
      id: "eval_hale_ttm_ebitda",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_ttm_ebitda",
      document_type: "pnl",
      financial_context: "TTM 2025 reported EBITDA",
      initial_system_output: "TTM 2025 reported EBITDA $2,100,000",
      analyst_action: "accepted",
      corrected_answer: null,
      why_original_was_wrong: null,
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 8,
      final_resolution: "Accepted as reported EBITDA. Add-backs stay proposed until separately accepted.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-22T14:16:00.000Z",
    }),
    evl({
      id: "eval_hale_pl24_superseded",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_fy24_final_rev",
      document_type: "pnl",
      financial_context: "FY2024 revenue — superseded file",
      initial_system_output: "Treat P&L 2024 FINAL.xlsx as current FY2024 ($7,695,000).",
      analyst_action: "rejected",
      corrected_answer: "Use P&L 2024 FINAL UPDATED.xlsx ($7,720,000). FINAL is superseded.",
      why_original_was_wrong:
        "Classifier ranked both FINAL files as current. The later FINAL UPDATED file is the revised version; treating FINAL as a second year would double-count.",
      controlling_source: "Financials/P&L 2024 FINAL UPDATED.xlsx",
      time_saved_minutes: 18,
      final_resolution: "Rejected FINAL as current. UPDATED controls FY2024 P&L.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-23T10:05:00.000Z",
    }),
    evl({
      id: "eval_hale_tax_vs_pl",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "conflict",
      entity_id: "cf_hale_tax_vs_pl",
      document_type: "tax_return",
      financial_context: "FY2024 cash vs accrual revenue",
      initial_system_output: "Overwrite P&L revenue with tax-return cash receipts ($7,480,000).",
      analyst_action: "edited",
      corrected_answer:
        "Keep P&L accrual $7,720,000 as reported. Tax cash $7,480,000 stays a reconciling item ($240k).",
      why_original_was_wrong:
        "The extractor treated the Form 1065 cash figure as the books number. Cash vs accrual plus owner personal items explain the gap; tax does not control reported revenue.",
      controlling_source: "Financials/P&L 2024 FINAL UPDATED.xlsx",
      time_saved_minutes: 25,
      final_resolution: "Accepted difference pending book-to-tax bridge. Reported financials unchanged.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-23T11:40:00.000Z",
    }),
    evl({
      id: "eval_hale_payroll_vs_pl",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_payroll_partners",
      document_type: "payroll_register",
      financial_context: "Owner / partner compensation",
      initial_system_output: "Partner draws $980,000 are owner compensation.",
      analyst_action: "edited",
      corrected_answer:
        "Payroll $980k is partner draws only. P&L owner compensation $1,420,000 remains the books number until a coded register arrives.",
      why_original_was_wrong:
        "The register does not separately code owner compensation. Treating $980k as the owner line would understate P&L owner pay by $440k and break the accepted add-back.",
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 22,
      final_resolution: "P&L owner $1.42M controls. Payroll is a reconciling source, not a silent overwrite.",
      preparer_user_id: GIO,
      reviewer_user_id: null,
      occurred_at: "2026-08-25T15:20:00.000Z",
    }),
    evl({
      id: "eval_hale_owner_adj",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "ebitda_adjustment",
      entity_id: "adj_hale_owner",
      document_type: "pnl",
      financial_context: "Owner compensation add-back",
      initial_system_output: "Propose $310,000 owner-compensation add-back.",
      analyst_action: "accepted",
      corrected_answer: null,
      why_original_was_wrong: null,
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 10,
      final_resolution: "Accepted. In Normalized EBITDA. Alex approved without re-extracting.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-24T13:00:00.000Z",
    }),
    evl({
      id: "eval_hale_legal_adj",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "ebitda_adjustment",
      entity_id: "adj_hale_legal",
      document_type: "pnl",
      financial_context: "One-time legal add-back",
      initial_system_output: "Propose $85,000 one-time legal add-back.",
      analyst_action: "accepted",
      corrected_answer: null,
      why_original_was_wrong: null,
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 6,
      final_resolution: "Accepted. In Normalized EBITDA.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-24T13:08:00.000Z",
    }),
    evl({
      id: "eval_hale_prod_old",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_prod_old",
      document_type: "production_report",
      financial_context: "Attorney collections",
      initial_system_output: "Attorney Production.xlsx collections $7,980,000 as current production.",
      analyst_action: "rejected",
      corrected_answer: "Use Attorney Production NEW.xlsx ($8,150,000). v1 is superseded.",
      why_original_was_wrong:
        "The older production file was classified as current. NEW is the revised export; using v1 would understate collections and invent a second production year.",
      controlling_source: "Production/Attorney Production NEW.xlsx",
      time_saved_minutes: 9,
      final_resolution: "Rejected v1 as current. NEW is the working production file.",
      preparer_user_id: GIO,
      reviewer_user_id: ALEX,
      occurred_at: "2026-08-24T16:45:00.000Z",
    }),
    evl({
      id: "eval_hale_occupancy",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "communication_interpretation",
      entity_id: "interp_hale_occ",
      document_type: "meeting_note_transcript",
      financial_context: "Occupancy add-back",
      initial_system_output: "Accept $120k occupancy add-back into Normalized EBITDA.",
      analyst_action: "rejected",
      corrected_answer:
        "Keep occupancy proposed. Meeting note challenges the add-back; approval may move it to needs_review, never silently into Normalized.",
      why_original_was_wrong:
        "The interpreter treated a seller challenge as confirmation. Occupancy is not an accepted cash item and must not land in Normalized until a human accepts it.",
      controlling_source: "Meetings/Occupancy and expenses post-close.md",
      time_saved_minutes: 14,
      final_resolution: "Occupancy remains proposed. Normalized stays $2.495M.",
      preparer_user_id: GIO,
      reviewer_user_id: null,
      occurred_at: "2026-08-26T18:40:00.000Z",
    }),
    evl({
      id: "eval_hale_qb_h1",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "extracted_fact",
      entity_id: "fact_hale_qb_h1",
      document_type: "pnl",
      financial_context: "H1 2025 vs half of TTM",
      initial_system_output: "Annualize QB H1 $4.05M to $8.10M and replace TTM $8.40M.",
      analyst_action: "edited",
      corrected_answer: "Leave TTM $8.40M as reported. QB H1 $4.05M vs half-TTM $4.20M is a $150k reconciling item.",
      why_original_was_wrong:
        "Annualizing a cash-basis QuickBooks export would silently rewrite accepted TTM revenue. H1 is a check, not a replacement.",
      controlling_source: "Financials/Hale_Mercer_TTM_2025_PL.pdf",
      time_saved_minutes: 11,
      final_resolution: "Pending human close. TTM P&L still controls reported revenue.",
      preparer_user_id: GIO,
      reviewer_user_id: null,
      occurred_at: "2026-08-26T19:05:00.000Z",
    }),
    evl({
      id: "eval_hale_structure_rec",
      organization_id: ORG,
      deal_id: DEAL,
      entity_type: "recommendation",
      entity_id: "rec_hale_structure",
      document_type: "purchase_agreement_loi",
      financial_context: "Structure recommendation",
      initial_system_output: "Pay close on pro forma $2.705M including occupancy and synergy.",
      analyst_action: "edited",
      corrected_answer:
        "Cash at close on accepted normalized $2.495M. Occupancy and synergy stay contingent / scenario analysis.",
      why_original_was_wrong:
        "The draft recommendation treated proposed add-backs as cash earnings. That would pay unsupported EBITDA at close.",
      controlling_source: "Accepted Normalized EBITDA + Indication_or_LOI.pdf",
      time_saved_minutes: 16,
      final_resolution: "Pending Alex review. Scenario output is labeled scenario analysis.",
      preparer_user_id: GIO,
      reviewer_user_id: null,
      occurred_at: "2026-08-27T09:30:00.000Z",
    }),
  ];
}

export function haleChangeEvents(): ChangeEvent[] {
  return [
    {
      id: "chg_hale_owner_accepted",
      organization_id: ORG,
      deal_id: DEAL,
      event_type: "adjustment.accepted",
      payload: {
        entity_type: "ebitda_adjustment",
        entity_id: "adj_hale_owner",
        amount: 310_000,
        actor_user_id: GIO,
        reviewer_user_id: ALEX,
      },
      created_at: "2026-08-24T13:00:00.000Z",
    },
    {
      id: "chg_hale_legal_accepted",
      organization_id: ORG,
      deal_id: DEAL,
      event_type: "adjustment.accepted",
      payload: {
        entity_type: "ebitda_adjustment",
        entity_id: "adj_hale_legal",
        amount: 85_000,
        actor_user_id: GIO,
        reviewer_user_id: ALEX,
      },
      created_at: "2026-08-24T13:08:00.000Z",
    },
    {
      id: "chg_hale_tax_conflict",
      organization_id: ORG,
      deal_id: DEAL,
      event_type: "conflict.status_changed",
      payload: {
        entity_id: "cf_hale_tax_vs_pl",
        from: "unreviewed",
        to: "follow_up_required",
        actor_user_id: GIO,
      },
      created_at: "2026-08-23T11:40:00.000Z",
    },
  ];
}

export function haleImportEvents(): ImportEvent[] {
  return [
    {
      id: "imp_hale_identity",
      organization_id: ORG,
      deal_id: DEAL,
      source_system: "mymavacy",
      event_type: "deal.identity_imported",
      external_id: "mm_hale_mercer",
      payload: {
        name: "Hale & Mercer LLP",
        city: "Chicago",
        state: "IL",
        note: "Connector field only. Diligence remains authoritative for underwriting.",
      },
      occurred_at: "2026-07-18T10:00:00.000Z",
    },
    {
      id: "imp_hale_docs",
      organization_id: ORG,
      deal_id: DEAL,
      source_system: "data_room",
      event_type: "documents.folder_imported",
      external_id: "hale-messy-pack",
      payload: { files: 22, nested: true },
      occurred_at: "2026-07-22T11:00:00.000Z",
    },
  ];
}

export function haleBaseline(): PostCloseBaseline {
  return {
    id: "base_hale",
    organization_id: ORG,
    deal_id: DEAL,
    underwritten_revenue: 8_400_000,
    underwritten_ebitda: 2_495_000,
    accepted_adjustments_total: 395_000,
    expected_synergies: 90_000,
    retention_assumptions:
      "Unsigned employment agreements. Daniel Mercer 17% of collections is the gating retention item.",
    nwc_assumption: 250_000,
    purchase_price: 16_800_000,
    structure: "Asking $16.8M. Cash at close on accepted normalized; contingent on retention and disputed add-backs.",
    expected_first_year_performance:
      "Hold TTM $8.4M revenue / $2.495M accepted normalized. Occupancy $120k and synergy $90k are not in cash earnings.",
    set_by_user_id: ELENA,
    set_at: "2026-08-26T12:00:00.000Z",
    notes: "Seeded from accepted underwriting. Actuals will be compared later.",
  };
}

export function phase3Tables(): Phase3Tables {
  return {
    underwriting_templates: underwritingTemplates(),
    template_fields: templateFields(),
    deal_template_field_values: haleTemplateFieldValues(),
    evaluation_events: haleEvaluationEvents(),
    change_events: haleChangeEvents(),
    import_events: haleImportEvents(),
    post_close_baselines: [haleBaseline()],
  };
}

export function cloneHalePhase3OntoDeal(dealId: string, orgId = ORG): Phase3Tables {
  const src = phase3Tables();
  const remap = (id: string) => `${dealId}__${id}`;
  const mapList = (ids: string[]) => ids.map((id) => remap(id));
  return {
    underwriting_templates: src.underwriting_templates,
    template_fields: src.template_fields,
    deal_template_field_values: src.deal_template_field_values.map((row) => ({
      ...row,
      id: remap(row.id),
      organization_id: orgId,
      deal_id: dealId,
      evidence_item_ids: mapList(row.evidence_item_ids),
    })),
    evaluation_events: src.evaluation_events.map((row) => ({
      ...row,
      id: remap(row.id),
      organization_id: orgId,
      deal_id: dealId,
      entity_id: remap(row.entity_id),
    })),
    change_events: src.change_events.map((row) => ({
      ...row,
      id: remap(row.id),
      organization_id: orgId,
      deal_id: dealId,
    })),
    import_events: src.import_events.map((row) => ({
      ...row,
      id: remap(row.id),
      organization_id: orgId,
      deal_id: dealId,
    })),
    post_close_baselines: src.post_close_baselines.map((row) => ({
      ...row,
      id: remap(row.id),
      organization_id: orgId,
      deal_id: dealId,
    })),
  };
}
