import type { EvidenceTables } from "./types";

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
