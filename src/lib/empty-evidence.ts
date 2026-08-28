import type { EvidenceTables, Phase3Tables } from "./types";

export function emptyEvidenceTables(): EvidenceTables {
  return {
    evidence_items: [],
    document_versions: [],
    extractions: [],
    extracted_facts: [],
    conflicts: [],
    reconciliation_checks: [],
    assumptions: [],
    underwriting_risks: [],
    valuation_scenarios: [],
    valuation_factors: [],
    negotiation_positions: [],
    recommendations: [],
    review_decisions: [],
    missing_items: [],
    communication_interpretations: [],
  };
}

export function emptyPhase3Tables(): Phase3Tables {
  return {
    underwriting_templates: [],
    template_fields: [],
    deal_template_field_values: [],
    evaluation_events: [],
    change_events: [],
    import_events: [],
    post_close_baselines: [],
  };
}

export function ensureEvidenceTables<T extends EvidenceTables>(db: T): T {
  const empty = emptyEvidenceTables();
  const next = { ...db };
  (Object.keys(empty) as (keyof EvidenceTables)[]).forEach((key) => {
    if (!Array.isArray(next[key])) {
      (next as EvidenceTables)[key] = [] as never;
    }
  });
  return next;
}

export function ensurePhase3Tables<T extends Phase3Tables>(db: T): T {
  const empty = emptyPhase3Tables();
  const next = { ...db };
  (Object.keys(empty) as (keyof Phase3Tables)[]).forEach((key) => {
    if (!Array.isArray(next[key])) {
      (next as Phase3Tables)[key] = [] as never;
    }
  });
  return next;
}

export function ensureDatabase<T extends EvidenceTables & Phase3Tables>(db: T): T {
  return ensurePhase3Tables(ensureEvidenceTables(db));
}
