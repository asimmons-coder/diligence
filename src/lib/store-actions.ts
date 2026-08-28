import { classifyFilename, haleMessyMatchCount, isHaleMessyFilename } from "./classifier";
import {
  APP_AS_OF,
  CURRENT_ORG_ID,
  GENERIC_TEMPLATE_ID,
  LAW_FIRM_TEMPLATE_ID,
} from "./constants";
import { ensureDatabase } from "./empty-evidence";
import { detectDuplicatesAndRevisions, fileBasename, folderPathOf, stubContentHash } from "./paths";
import { actorId, appendPhase3Events, makeChangeEvent, makeEvaluation } from "./phase3-write";
import { haleSlice } from "./seed-hale";
import { cloneHaleEvidenceOntoDeal, haleMessyDocuments } from "./seed-hale-evidence";
import { cloneHalePhase3OntoDeal } from "./seed-phase3";
import type {
  AdjustmentStatus,
  ConflictStatus,
  Database,
  Deal,
  DetectedDocumentType,
  DiligenceStatus,
  EvidenceHumanReview,
  EvidenceTables,
  EvaluationAction,
  FactReviewStatus,
  IngestFile,
  Phase3Tables,
  PostCloseBaseline,
  RecommendationReview,
  ValuationScenario,
  Vertical,
} from "./types";

export type EvaluationInput = {
  why_original_was_wrong?: string | null;
  controlling_source?: string | null;
  time_saved_minutes?: number | null;
  corrected_answer?: string | null;
};

export function nowIso() {
  return `${APP_AS_OF}T${new Date().toISOString().slice(11)}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeEvidence(prev: Database, add: EvidenceTables, phase3?: Phase3Tables): Database {
  const base = ensureDatabase(prev);
  return {
    ...base,
    evidence_items: [...add.evidence_items, ...base.evidence_items],
    document_versions: [...add.document_versions, ...base.document_versions],
    extractions: [...add.extractions, ...base.extractions],
    extracted_facts: [...add.extracted_facts, ...base.extracted_facts],
    conflicts: [...add.conflicts, ...base.conflicts],
    reconciliation_checks: [...add.reconciliation_checks, ...base.reconciliation_checks],
    assumptions: [...add.assumptions, ...base.assumptions],
    underwriting_risks: [...add.underwriting_risks, ...base.underwriting_risks],
    valuation_scenarios: [...add.valuation_scenarios, ...base.valuation_scenarios],
    valuation_factors: [...add.valuation_factors, ...base.valuation_factors],
    negotiation_positions: [...add.negotiation_positions, ...base.negotiation_positions],
    recommendations: [...add.recommendations, ...base.recommendations],
    review_decisions: [...add.review_decisions, ...base.review_decisions],
    missing_items: [...add.missing_items, ...base.missing_items],
    communication_interpretations: [
      ...add.communication_interpretations,
      ...base.communication_interpretations,
    ],
    deal_template_field_values: phase3
      ? [...phase3.deal_template_field_values, ...base.deal_template_field_values]
      : base.deal_template_field_values,
    evaluation_events: phase3
      ? [...phase3.evaluation_events, ...base.evaluation_events]
      : base.evaluation_events,
    change_events: phase3 ? [...phase3.change_events, ...base.change_events] : base.change_events,
    import_events: phase3 ? [...phase3.import_events, ...base.import_events] : base.import_events,
    post_close_baselines: phase3
      ? [...phase3.post_close_baselines, ...base.post_close_baselines]
      : base.post_close_baselines,
    underwriting_templates: base.underwriting_templates.length
      ? base.underwriting_templates
      : (phase3?.underwriting_templates ?? base.underwriting_templates),
    template_fields: base.template_fields.length
      ? base.template_fields
      : (phase3?.template_fields ?? base.template_fields),
  };
}

function touchDeal(
  prev: Database,
  dealId: string,
  at: string,
  activity: Database["activities"][number],
  audit?: Database["audit_events"][number]
): Database {
  return {
    ...prev,
    deals: prev.deals.map((d) => (d.id === dealId ? { ...d, last_activity_at: at } : d)),
    activities: [activity, ...prev.activities],
    audit_events: audit ? [audit, ...prev.audit_events] : prev.audit_events,
  };
}

export function createDealRecord(input: {
  name: string;
  vertical: Vertical;
  ownerId: string;
  city?: string;
  state?: string;
  sourceDetail?: string;
  askingPrice?: number | null;
}): Deal {
  const at = nowIso();
  return {
    id: newId("deal"),
    organization_id: CURRENT_ORG_ID,
    name: input.name.trim() || "Untitled target",
    location_city: input.city?.trim() || "—",
    location_state: input.state?.trim() || "—",
    owner_user_id: input.ownerId,
    source: "proprietary",
    source_detail: input.sourceDetail ?? "Document intake",
    stage: "initial_data",
    stage_entered_at: APP_AS_OF,
    asking_price: input.askingPrice ?? null,
    expected_purchase_price: input.askingPrice ?? null,
    probability: 0.2,
    vertical: input.vertical,
    vertical_metrics: {},
    flags: ["data_room_thin"],
    created_at: at,
    last_activity_at: at,
    last_reviewed_at: null,
    summary: "Created from intake. Financials stay empty until extracted facts are accepted.",
    ai_assessment:
      "No accepted reconstruction yet. Upload the folder and review extractions — nothing is accepted silently.",
    attention_items: ["Intake in progress"],
    template_id: input.vertical === "legal" ? LAW_FIRM_TEMPLATE_ID : GENERIC_TEMPLATE_ID,
    external_system: null,
    external_deal_id: null,
    external_deal_url: null,
    external_imported_at: null,
    external_updated_at: null,
  };
}

export function applyCreateDeal(prev: Database, deal: Deal): Database {
  const at = deal.created_at;
  const base = ensureDatabase(prev);
  return {
    ...base,
    deals: [deal, ...base.deals],
    activities: [
      {
        id: newId("act"),
        organization_id: deal.organization_id,
        deal_id: deal.id,
        actor_user_id: actorId(),
        kind: "deal_created",
        title: `Created ${deal.name}`,
        body: "Deal opened. Accepted financials are empty until a human accepts facts or adjustments.",
        occurred_at: at,
        metadata: { deal_id: deal.id },
      },
      ...prev.activities,
    ],
    audit_events: [
      {
        id: newId("aud"),
        organization_id: deal.organization_id,
        deal_id: deal.id,
        actor_user_id: actorId(),
        entity_type: "deal",
        entity_id: deal.id,
        action: "create",
        before: null,
        after: { name: deal.name, stage: deal.stage },
        occurred_at: at,
      },
      ...prev.audit_events,
    ],
  };
}

function remapHaleId(id: string, dealId: string) {
  return `${dealId}__${id}`;
}

export function applyHaleMessyHydrate(prev: Database, dealId: string): Database {
  const deal = prev.deals.find((d) => d.id === dealId);
  if (!deal) return prev;
  const at = nowIso();
  const evidence = cloneHaleEvidenceOntoDeal(dealId, deal.organization_id);
  const hale = haleSlice();
  const messyDocs = haleMessyDocuments().map((doc) => ({
    ...doc,
    id: remapHaleId(doc.id, dealId),
    deal_id: dealId,
    organization_id: deal.organization_id,
    uploaded_at: at,
  }));
  const extraDocs = hale.documents
    .filter((d) =>
      ["doc_hale_ttm_pl", "doc_hale_fy23_pl", "doc_hale_fy24_pl", "doc_hale_tax_2024", "doc_hale_payroll", "doc_hale_lease"].includes(
        d.id
      )
    )
    .map((doc) => ({
      ...doc,
      id: remapHaleId(doc.id, dealId),
      deal_id: dealId,
      organization_id: deal.organization_id,
    }));

  const periods = hale.financial_periods.map((p) => ({
    ...p,
    id: remapHaleId(p.id, dealId),
    deal_id: dealId,
    organization_id: deal.organization_id,
  }));
  const metrics = hale.financial_metrics.map((m) => ({
    ...m,
    id: remapHaleId(m.id, dealId),
    deal_id: dealId,
    period_id: remapHaleId(m.period_id, dealId),
    organization_id: deal.organization_id,
  }));
  const adjustments = hale.ebitda_adjustments.map((a) => ({
    ...a,
    id: remapHaleId(a.id, dealId),
    deal_id: dealId,
    period_id: remapHaleId(a.period_id, dealId),
    organization_id: deal.organization_id,
  }));
  const diligence = hale.diligence_requests.map((r) => ({
    ...r,
    id: remapHaleId(r.id, dealId),
    deal_id: dealId,
    organization_id: deal.organization_id,
    supporting_document_ids: r.supporting_document_ids.map((id) => remapHaleId(id, dealId)),
  }));

  const remappedEvidence: EvidenceTables = {
    ...evidence,
    extracted_facts: evidence.extracted_facts.map((f) => ({
      ...f,
      linked_period_id: f.linked_period_id ? remapHaleId(f.linked_period_id, dealId) : null,
    })),
    conflicts: evidence.conflicts.map((c) => ({
      ...c,
      linked_request_id: c.linked_request_id ? remapHaleId(c.linked_request_id, dealId) : null,
      linked_adjustment_id: c.linked_adjustment_id
        ? remapHaleId(c.linked_adjustment_id, dealId)
        : null,
    })),
    assumptions: evidence.assumptions.map((a) => ({
      ...a,
      linked_adjustment_id: a.linked_adjustment_id
        ? remapHaleId(a.linked_adjustment_id, dealId)
        : null,
    })),
    missing_items: evidence.missing_items.map((m) => ({
      ...m,
      linked_request_id: m.linked_request_id ? remapHaleId(m.linked_request_id, dealId) : null,
    })),
    communication_interpretations: evidence.communication_interpretations.map((i) => ({
      ...i,
      suggested_entity_id: i.suggested_entity_id
        ? remapHaleId(i.suggested_entity_id, dealId)
        : null,
    })),
  };

  const next = mergeEvidence(
    {
      ...prev,
      documents: [...messyDocs, ...extraDocs, ...prev.documents],
      financial_periods: [...periods, ...prev.financial_periods],
      financial_metrics: [...metrics, ...prev.financial_metrics],
      ebitda_adjustments: [...adjustments, ...prev.ebitda_adjustments],
      diligence_requests: [...diligence, ...prev.diligence_requests],
      deals: prev.deals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              name: d.name === "Untitled target" ? "Hale & Mercer LLP" : d.name,
              location_city: d.location_city === "—" ? "Chicago" : d.location_city,
              location_state: d.location_state === "—" ? "IL" : d.location_state,
              asking_price: d.asking_price ?? 16_800_000,
              expected_purchase_price: d.expected_purchase_price ?? 16_800_000,
              vertical: "legal",
              flags: ["concentration", "lease_expiry", "missing_tax_return", "financial_inconsistency"],
              template_id: LAW_FIRM_TEMPLATE_ID,
              external_system: d.external_system ?? "mymavacy",
              external_deal_id: d.external_deal_id ?? "mm_hale_mercer",
              external_deal_url: d.external_deal_url ?? "https://app.mymavacy.example/deals/hale-mercer",
              last_activity_at: at,
              last_reviewed_at: d.last_reviewed_at ?? "2026-08-24T12:00:00.000Z",
              summary:
                "Messy Hale folder loaded. Accepted reconstructed history matches the flagship book; intake shows the conflicts that produced it. AI has not silently accepted anything new.",
              ai_assessment:
                "Historical revenue is supported. Owner compensation, attorney retention, and lease treatment remain unresolved.",
              attention_items: [
                "Review superseded P&L 2024 FINAL",
                "Tax 2024 cash vs P&L accrual",
                "Occupancy add-back challenged in meeting note",
              ],
            }
          : d
      ),
    },
    remappedEvidence,
    cloneHalePhase3OntoDeal(dealId, deal.organization_id)
  );

  return {
    ...next,
    activities: [
      {
        id: newId("act"),
        organization_id: deal.organization_id,
        deal_id: dealId,
        actor_user_id: actorId(),
        kind: "evidence_ingest",
        title: "Loaded Hale messy folder",
        body: "Classified 20+ items, marked superseded files, extracted facts, and opened conflicts. Accepted financials were copied as the reviewed position — new interpretations still need approval.",
        occurred_at: at,
        metadata: { pack: "hale_messy" },
      },
      ...next.activities,
    ],
  };
}

export function applyIngestFilenames(
  prev: Database,
  dealId: string,
  files: Array<string | IngestFile>
): { next: Database; hydrated: boolean } {
  const deal = prev.deals.find((d) => d.id === dealId);
  if (!deal) return { next: prev, hydrated: false };
  const ingested: IngestFile[] = files.map((f) =>
    typeof f === "string"
      ? { path: f, basename: fileBasename(f), sizeBytes: null, lastModified: null }
      : f
  );
  const names = ingested.map((f) => f.basename);
  if (haleMessyMatchCount(names) >= 8 || names.some((f) => isHaleMessyFilename(f))) {
    if (haleMessyMatchCount(names) >= 6) {
      return { next: applyHaleMessyHydrate(prev, dealId), hydrated: true };
    }
  }

  const at = nowIso();
  let next = ensureDatabase(prev);
  for (const file of ingested) {
    const classified = classifyFilename(file.basename, deal.name);
    const docId = newId("doc");
    const evId = newId("ev");
    const folder = folderPathOf(file.path);
    next = {
      ...next,
      documents: [
        {
          id: docId,
          organization_id: deal.organization_id,
          deal_id: dealId,
          filename: file.basename,
          folder: classified.folder,
          uploaded_at: at,
          uploaded_by: actorId(),
          processing_status: "uploading",
          classification: classified.type,
          extracted_payload: { staged: true, filename: file.basename, path: file.path },
          confidence: classified.confidence,
          linked_request_ids: [],
          page_count: null,
          mime_type: null,
          size_bytes: file.sizeBytes ?? null,
        },
        ...next.documents,
      ],
      evidence_items: [
        {
          id: evId,
          organization_id: deal.organization_id,
          deal_id: dealId,
          kind: classified.type === "email" ? "email" : classified.type === "meeting_note_transcript" ? "meeting_note" : "document",
          document_id: docId,
          filename: file.basename,
          title: file.basename,
          detected_type: classified.type,
          detected_period: classified.period,
          detected_entity: classified.entity,
          file_format: classified.format,
          processing_status: "uploading",
          confidence: classified.confidence,
          potential_duplicate_of: null,
          superseded_by_id: null,
          supersedes_id: null,
          human_review_status: "unreviewed",
          source_system: "upload",
          external_item_id: null,
          external_thread_id: null,
          external_meeting_id: null,
          author: null,
          sender: null,
          participants: [],
          occurred_at: null,
          ingested_at: at,
          last_synchronized_at: null,
          subject: null,
          body: null,
          snippet: null,
          page_count: null,
          mime_type: null,
          size_bytes: file.sizeBytes ?? null,
          folder_path: folder,
          basename: file.basename,
          content_hash: stubContentHash({
            path: file.path,
            basename: file.basename,
            sizeBytes: file.sizeBytes,
            lastModified: file.lastModified,
          }),
        },
        ...next.evidence_items,
      ],
    };
  }
  next = {
    ...next,
    evidence_items: detectDuplicatesAndRevisions(next.evidence_items),
    import_events: [
      {
        id: newId("imp"),
        organization_id: deal.organization_id,
        deal_id: dealId,
        source_system: "upload",
        event_type: "documents.folder_imported",
        external_id: null,
        payload: { files: ingested.length, paths: ingested.map((f) => f.path) },
        occurred_at: at,
      },
      ...next.import_events,
    ],
  };
  next = touchDeal(next, dealId, at, {
    id: newId("act"),
    organization_id: deal.organization_id,
    deal_id: dealId,
    actor_user_id: actorId(),
    kind: "evidence_ingest",
    title: `Uploaded ${ingested.length} file${ingested.length === 1 ? "" : "s"}`,
    body: "Folder structure and original filenames preserved. Classification is deterministic. No accepted financials were changed.",
    occurred_at: at,
    metadata: { paths: ingested.map((f) => f.path) },
  });
  return { next, hydrated: false };
}

export function applyAdvanceProcessing(prev: Database, dealId: string, status: "processing" | "analyzed"): Database {
  return {
    ...prev,
    documents: prev.documents.map((d) =>
      d.deal_id === dealId && (d.processing_status === "uploading" || d.processing_status === "processing")
        ? { ...d, processing_status: status }
        : d
    ),
    evidence_items: prev.evidence_items.map((e) =>
      e.deal_id === dealId && (e.processing_status === "uploading" || e.processing_status === "processing")
        ? { ...e, processing_status: status }
        : e
    ),
  };
}

export function applyEvidenceCorrection(
  prev: Database,
  id: string,
  patch: {
    detected_type?: DetectedDocumentType;
    detected_period?: string | null;
    detected_entity?: string | null;
    human_review_status?: EvidenceHumanReview;
  }
): Database {
  const existing = prev.evidence_items.find((e) => e.id === id);
  if (!existing) return prev;
  const at = nowIso();
  return touchDeal(
    {
      ...prev,
      evidence_items: prev.evidence_items.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              human_review_status: patch.human_review_status ?? "corrected",
            }
          : e
      ),
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "evidence_ingest",
      title: `Corrected classification: ${existing.filename ?? existing.title}`,
      body: "Human correction. Extraction review is unchanged.",
      occurred_at: at,
      metadata: { evidence_id: id, ...patch },
    },
    {
      id: newId("aud"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      entity_type: "evidence_item",
      entity_id: id,
      action: "classification_correct",
      before: {
        detected_type: existing.detected_type,
        detected_period: existing.detected_period,
      },
      after: { ...patch },
      occurred_at: at,
    }
  );
}

export function applyFactReview(
  prev: Database,
  id: string,
  status: FactReviewStatus,
  edits?: {
    numeric_value?: number;
    text_value?: string;
    extracted_value?: string;
    assigned_user_id?: string | null;
    assigned_by_user_id?: string | null;
  },
  evaluation?: EvaluationInput
): Database {
  const existing = prev.extracted_facts.find((f) => f.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const actor = actorId();
  const wroteReview = status !== existing.review_status;
  const evalEvent =
    wroteReview && (status === "accepted" || status === "edited" || status === "rejected")
      ? makeEvaluation({
          organization_id: existing.organization_id,
          deal_id: existing.deal_id,
          entity_type: "extracted_fact",
          entity_id: id,
          document_type: prev.evidence_items.find((e) => e.id === existing.evidence_item_id)?.detected_type,
          financial_context: existing.label,
          initial_system_output: existing.extracted_value,
          analyst_action: status as EvaluationAction,
          corrected_answer: evaluation?.corrected_answer ?? edits?.extracted_value ?? null,
          why_original_was_wrong: evaluation?.why_original_was_wrong ?? null,
          controlling_source: evaluation?.controlling_source ?? null,
          time_saved_minutes: evaluation?.time_saved_minutes ?? null,
          final_resolution:
            status === "accepted"
              ? "Accepted. Accepted financial statements were not silently rewritten."
              : status === "rejected"
                ? "Rejected. Source remains visible; reported/normalized unchanged."
                : "Edited. Corrected value stored; accepted financials not auto-updated.",
          preparer_user_id: actor,
        })
      : null;
  const change = wroteReview
    ? makeChangeEvent(existing.organization_id, existing.deal_id, `fact.${status}`, {
        entity_id: id,
        from: existing.review_status,
        to: status,
      })
    : null;
  return touchDeal(
    {
      ...prev,
      ...appendPhase3Events(prev, evalEvent, change),
      extracted_facts: prev.extracted_facts.map((f) =>
        f.id === id
          ? {
              ...f,
              review_status: status,
              numeric_value: edits?.numeric_value ?? f.numeric_value,
              text_value: edits?.text_value ?? f.text_value,
              extracted_value: edits?.extracted_value ?? f.extracted_value,
              assigned_user_id: edits?.assigned_user_id ?? f.assigned_user_id,
              assigned_by_user_id: edits?.assigned_by_user_id ?? f.assigned_by_user_id,
              prepared_by_user_id: wroteReview ? actor : f.prepared_by_user_id,
              claim_kind:
                status === "accepted"
                  ? "source_fact"
                  : status === "rejected"
                    ? f.claim_kind
                    : f.claim_kind,
            }
          : f
      ),
      review_decisions: [
        {
          id: newId("rd"),
          organization_id: existing.organization_id,
          deal_id: existing.deal_id,
          entity_type: "extracted_fact",
          entity_id: id,
          decision: status,
          rationale: "Human review of extracted fact. Accepted reconstructed financials were not auto-updated.",
          actor_user_id: actor,
          occurred_at: at,
          accepted_financials_changed: false,
        },
        ...prev.review_decisions,
      ],
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "fact_review",
      title: `${status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : "Edited"} extraction: ${existing.label}`,
      body: "Accepted financial statements were not silently rewritten. Promote a fact to a correction or adjustment if the reconstructed history should change.",
      occurred_at: at,
      metadata: { fact_id: id, status },
    },
    {
      id: newId("aud"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      entity_type: "extracted_fact",
      entity_id: id,
      action: "review",
      before: { review_status: existing.review_status },
      after: { review_status: status },
      occurred_at: at,
    }
  );
}

export function applyConflictStatus(
  prev: Database,
  id: string,
  status: ConflictStatus,
  notes?: string,
  evaluation?: EvaluationInput
): Database {
  const existing = prev.conflicts.find((c) => c.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const action: EvaluationAction =
    status === "resolved" || status === "accepted_difference" || status === "not_material"
      ? "accepted"
      : "edited";
  const evalEvent = makeEvaluation({
    organization_id: existing.organization_id,
    deal_id: existing.deal_id,
    entity_type: "conflict",
    entity_id: id,
    financial_context: existing.description,
    initial_system_output: existing.ai_interpretation,
    analyst_action: action,
    corrected_answer: evaluation?.corrected_answer ?? notes ?? null,
    why_original_was_wrong: evaluation?.why_original_was_wrong ?? null,
    controlling_source: evaluation?.controlling_source ?? existing.source_b_label,
    final_resolution: notes || `Conflict status → ${status}`,
    preparer_user_id: actorId(),
  });
  const change = makeChangeEvent(existing.organization_id, existing.deal_id, "conflict.status_changed", {
    entity_id: id,
    from: existing.status,
    to: status,
  });
  return touchDeal(
    {
      ...prev,
      ...appendPhase3Events(prev, evalEvent, change),
      conflicts: prev.conflicts.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              resolution_notes: notes ?? c.resolution_notes,
              prepared_by_user_id: actorId(),
            }
          : c
      ),
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "conflict_status",
      title: `Conflict → ${status.replaceAll("_", " ")}`,
      body: existing.description,
      occurred_at: at,
      metadata: { conflict_id: id, status },
    }
  );
}

export function applyConvertConflict(
  prev: Database,
  id: string,
  kind: "diligence" | "adjustment" | "task"
): Database {
  const existing = prev.conflicts.find((c) => c.id === id);
  if (!existing) return prev;
  const at = nowIso();
  if (kind === "diligence") {
    const requestId = newId("dil");
    return touchDeal(
      {
        ...prev,
        conflicts: prev.conflicts.map((c) =>
          c.id === id ? { ...c, linked_request_id: requestId, status: "follow_up_required" } : c
        ),
        diligence_requests: [
          {
            id: requestId,
            organization_id: existing.organization_id,
            deal_id: existing.deal_id,
            category: "financial",
            question: existing.recommended_action || existing.description,
            status: "requested",
            owner_user_id: existing.owner_user_id ?? actorId(),
            counterparty_owner: "Seller",
            due_date: null,
            supporting_document_ids: [],
            notes: `Opened from conflict ${existing.id}. ${existing.ai_interpretation}`,
            ai_generated: true,
            priority: existing.materiality === "material" ? "critical" : "high",
          },
          ...prev.diligence_requests,
        ],
      },
      existing.deal_id,
      at,
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actorId(),
        kind: "diligence_status",
        title: "Opened seller request from conflict",
        body: existing.description,
        occurred_at: at,
        metadata: { conflict_id: id, request_id: requestId },
      }
    );
  }
  if (kind === "task") {
    const taskId = newId("task");
    return touchDeal(
      {
        ...prev,
        conflicts: prev.conflicts.map((c) =>
          c.id === id ? { ...c, linked_task_id: taskId, status: "investigating" } : c
        ),
        tasks: [
          {
            id: taskId,
            organization_id: existing.organization_id,
            deal_id: existing.deal_id,
            title: existing.recommended_action || existing.description,
            owner_user_id: existing.owner_user_id ?? actorId(),
            due_date: null,
            completed: false,
            completed_at: null,
            created_at: at,
          },
          ...prev.tasks,
        ],
      },
      existing.deal_id,
      at,
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actorId(),
        kind: "task_created",
        title: "Opened task from conflict",
        body: existing.description,
        occurred_at: at,
        metadata: { conflict_id: id, task_id: taskId },
      }
    );
  }
  const adjId = newId("adj");
  const period = prev.financial_periods.find((p) => p.deal_id === existing.deal_id && p.is_latest);
  return touchDeal(
    {
      ...prev,
      conflicts: prev.conflicts.map((c) =>
        c.id === id ? { ...c, linked_adjustment_id: adjId, status: "investigating" } : c
      ),
      ebitda_adjustments: period
        ? [
            {
              id: adjId,
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              period_id: period.id,
              category: "other",
              description: existing.description.slice(0, 80),
              amount: Math.abs(existing.difference ?? 0),
              source: existing.source_a_label,
              origin: "ai",
              confidence: 0.6,
              status: "proposed",
              user_notes: "Proposed from conflict. Not in Normalized until accepted.",
              provenance: {
                source_document_id: null,
                source_document_name: existing.source_a_label,
                section: existing.description,
                page: null,
                extracted_value: String(existing.difference ?? ""),
                confidence: 0.6,
                approval_status: "ai_inference",
              },
            },
            ...prev.ebitda_adjustments,
          ]
        : prev.ebitda_adjustments,
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "adjustment_status",
      title: "Proposed adjustment from conflict",
      body: "Stays proposed. Normalized is unchanged.",
      occurred_at: at,
      metadata: { conflict_id: id, adjustment_id: adjId },
    }
  );
}

export function applySendMissing(prev: Database, id: string): Database {
  const existing = prev.missing_items.find((m) => m.id === id);
  if (!existing) return prev;
  if (existing.linked_request_id) {
    return {
      ...prev,
      missing_items: prev.missing_items.map((m) =>
        m.id === id ? { ...m, status: "sent" } : m
      ),
    };
  }
  const requestId = newId("dil");
  const at = nowIso();
  return touchDeal(
    {
      ...prev,
      missing_items: prev.missing_items.map((m) =>
        m.id === id ? { ...m, status: "sent", linked_request_id: requestId } : m
      ),
      diligence_requests: [
        {
          id: requestId,
          organization_id: existing.organization_id,
          deal_id: existing.deal_id,
          category: "financial",
          question: existing.suggested_seller_request,
          status: "requested",
          owner_user_id: actorId(),
          counterparty_owner: "Seller",
          due_date: null,
          supporting_document_ids: [],
          notes: existing.why_it_matters,
          ai_generated: true,
          priority: existing.blocking ? "critical" : "high",
        },
        ...prev.diligence_requests,
      ],
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "diligence_status",
      title: "Sent missing item to diligence list",
      body: existing.title,
      occurred_at: at,
      metadata: { missing_id: id, request_id: requestId },
    }
  );
}

export function applyInterpretation(
  prev: Database,
  id: string,
  decision: "approved" | "dismissed"
): Database {
  const existing = prev.communication_interpretations.find((i) => i.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const evalEvent = makeEvaluation({
    organization_id: existing.organization_id,
    deal_id: existing.deal_id,
    entity_type: "communication_interpretation",
    entity_id: id,
    financial_context: existing.title,
    initial_system_output: existing.summary,
    analyst_action: decision === "approved" ? "accepted" : "rejected",
    final_resolution: existing.impact_summary,
    preparer_user_id: actorId(),
  });
  const change = makeChangeEvent(
    existing.organization_id,
    existing.deal_id,
    `interpretation.${decision}`,
    { entity_id: id }
  );
  let next: Database = {
    ...prev,
    ...appendPhase3Events(prev, evalEvent, change),
    communication_interpretations: prev.communication_interpretations.map((i) =>
      i.id === id ? { ...i, review_status: decision } : i
    ),
    review_decisions: [
      {
        id: newId("rd"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        entity_type: "communication_interpretation",
        entity_id: id,
        decision,
        rationale: existing.impact_summary,
        actor_user_id: actorId(),
        occurred_at: at,
        accepted_financials_changed: false,
      },
      ...prev.review_decisions,
    ],
  };

  if (decision === "approved" && existing.suggested_entity_type === "diligence_request" && existing.suggested_entity_id) {
    const req = next.diligence_requests.find((r) => r.id === existing.suggested_entity_id);
    if (req) {
      next = {
        ...next,
        diligence_requests: next.diligence_requests.map((r) =>
          r.id === req.id
            ? {
                ...r,
                status: (existing.suggested_status as DiligenceStatus) ?? "received",
                notes: existing.suggested_notes || r.notes,
              }
            : r
        ),
      };
    }
  }

  if (decision === "approved" && existing.suggested_entity_type === "ebitda_adjustment" && existing.suggested_entity_id) {
    const adj = next.ebitda_adjustments.find((a) => a.id === existing.suggested_entity_id);
    if (adj) {
      const status = (existing.suggested_status as AdjustmentStatus) ?? "needs_review";
      next = {
        ...next,
        ebitda_adjustments: next.ebitda_adjustments.map((a) =>
          a.id === adj.id
            ? {
                ...a,
                status,
                user_notes: existing.suggested_notes || a.user_notes,
              }
            : a
        ),
      };
    }
  }

  return touchDeal(
    next,
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "interpretation_review",
      title:
        decision === "approved"
          ? `Approved interpretation: ${existing.title}`
          : `Dismissed interpretation: ${existing.title}`,
      body: existing.impact_summary,
      occurred_at: at,
      metadata: { interpretation_id: id, decision },
    },
    {
      id: newId("aud"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      entity_type: "communication_interpretation",
      entity_id: id,
      action: decision,
      before: { review_status: existing.review_status },
      after: { review_status: decision },
      occurred_at: at,
    }
  );
}

export function applyValuationPatch(
  prev: Database,
  id: string,
  patch: Partial<ValuationScenario>
): Database {
  const existing = prev.valuation_scenarios.find((s) => s.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const nextScenario: ValuationScenario = {
    ...existing,
    ...patch,
    ebitda_overridden:
      patch.selected_ebitda != null && patch.selected_ebitda !== existing.selected_ebitda
        ? true
        : patch.ebitda_overridden ?? existing.ebitda_overridden,
  };
  return touchDeal(
    {
      ...prev,
      valuation_scenarios: prev.valuation_scenarios.map((s) => (s.id === id ? nextScenario : s)),
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actorId(),
      kind: "valuation_edit",
      title: `Edited ${existing.name} scenario`,
      body: "Scenario analysis only. Accepted financial facts were not mutated.",
      occurred_at: at,
      metadata: { scenario_id: id, patch },
    }
  );
}

export function applyMarkReviewed(prev: Database, dealId: string): Database {
  const at = nowIso();
  return {
    ...prev,
    deals: prev.deals.map((d) =>
      d.id === dealId ? { ...d, last_reviewed_at: at, last_activity_at: at } : d
    ),
  };
}

export function applyAssign(
  prev: Database,
  entityType: string,
  entityId: string,
  userId: string
): Database {
  const at = nowIso();
  const actor = actorId();
  if (entityType === "extracted_fact") {
    const existing = prev.extracted_facts.find((f) => f.id === entityId);
    if (!existing) return prev;
    return touchDeal(
      {
        ...prev,
        extracted_facts: prev.extracted_facts.map((f) =>
          f.id === entityId
            ? { ...f, assigned_user_id: userId, assigned_by_user_id: actor }
            : f
        ),
      },
      existing.deal_id,
      at,
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actor,
        kind: "assignment",
        title: `Assigned extraction: ${existing.label}`,
        body: `Assigned to ${userId}.`,
        occurred_at: at,
        metadata: { entity_type: entityType, entity_id: entityId, user_id: userId },
      }
    );
  }
  if (entityType === "conflict") {
    const existing = prev.conflicts.find((c) => c.id === entityId);
    if (!existing) return prev;
    return touchDeal(
      {
        ...prev,
        conflicts: prev.conflicts.map((c) =>
          c.id === entityId ? { ...c, owner_user_id: userId, assigned_by_user_id: actor } : c
        ),
      },
      existing.deal_id,
      at,
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actor,
        kind: "assignment",
        title: "Assigned conflict",
        body: existing.description,
        occurred_at: at,
        metadata: { entity_type: entityType, entity_id: entityId, user_id: userId },
      }
    );
  }
  if (entityType === "missing_item") {
    const existing = prev.missing_items.find((m) => m.id === entityId);
    if (!existing) return prev;
    return touchDeal(
      {
        ...prev,
        missing_items: prev.missing_items.map((m) =>
          m.id === entityId ? { ...m, assigned_user_id: userId, assigned_by_user_id: actor } : m
        ),
      },
      existing.deal_id,
      at,
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actor,
        kind: "assignment",
        title: `Assigned missing item: ${existing.title}`,
        body: existing.why_it_matters,
        occurred_at: at,
        metadata: { entity_type: entityType, entity_id: entityId, user_id: userId },
      }
    );
  }
  return prev;
}

export function applySupervisorApprove(prev: Database, evaluationId: string): Database {
  const existing = prev.evaluation_events.find((e) => e.id === evaluationId);
  if (!existing) return prev;
  const at = nowIso();
  const actor = actorId();
  const change = makeChangeEvent(existing.organization_id, existing.deal_id, "evaluation.approved", {
    evaluation_id: evaluationId,
    entity_type: existing.entity_type,
    entity_id: existing.entity_id,
    reviewer_user_id: actor,
    preparer_user_id: existing.preparer_user_id,
  });
  let next: Database = {
    ...prev,
    ...appendPhase3Events(prev, null, change),
    evaluation_events: prev.evaluation_events.map((e) =>
      e.id === evaluationId ? { ...e, reviewer_user_id: actor } : e
    ),
  };
  if (existing.entity_type === "extracted_fact") {
    next = {
      ...next,
      extracted_facts: next.extracted_facts.map((f) =>
        f.id === existing.entity_id ? { ...f, reviewer_user_id: actor } : f
      ),
    };
  }
  if (existing.entity_type === "conflict") {
    next = {
      ...next,
      conflicts: next.conflicts.map((c) =>
        c.id === existing.entity_id ? { ...c, reviewer_user_id: actor } : c
      ),
    };
  }
  if (existing.entity_type === "recommendation") {
    next = {
      ...next,
      recommendations: next.recommendations.map((r) =>
        r.id === existing.entity_id ? { ...r, reviewer_user_id: actor } : r
      ),
    };
  }
  return touchDeal(
    next,
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actor,
      kind: "evaluation_logged",
      title: "Supervisor approved without redoing the work",
      body: `${existing.financial_context ?? existing.entity_type}: ${existing.final_resolution}`,
      occurred_at: at,
      metadata: { evaluation_id: evaluationId },
    }
  );
}

export function applyRecommendationReview(
  prev: Database,
  id: string,
  status: RecommendationReview,
  evaluation?: EvaluationInput
): Database {
  const existing = prev.recommendations.find((r) => r.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const actor = actorId();
  const action: EvaluationAction = status === "rejected" ? "rejected" : status === "accepted" ? "accepted" : "edited";
  const evalEvent = makeEvaluation({
    organization_id: existing.organization_id,
    deal_id: existing.deal_id,
    entity_type: "recommendation",
    entity_id: id,
    financial_context: existing.title,
    initial_system_output: existing.body,
    analyst_action: action,
    corrected_answer: evaluation?.corrected_answer ?? null,
    why_original_was_wrong: evaluation?.why_original_was_wrong ?? null,
    controlling_source: evaluation?.controlling_source ?? null,
    final_resolution: `Recommendation ${status}.`,
    preparer_user_id: actor,
  });
  const change = makeChangeEvent(existing.organization_id, existing.deal_id, `recommendation.${status}`, {
    entity_id: id,
  });
  return touchDeal(
    {
      ...prev,
      ...appendPhase3Events(prev, evalEvent, change),
      recommendations: prev.recommendations.map((r) =>
        r.id === id
          ? { ...r, review_status: status, prepared_by_user_id: actor }
          : r
      ),
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: actor,
      kind: "evaluation_logged",
      title: `${status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : "Edited"} recommendation`,
      body: existing.title,
      occurred_at: at,
      metadata: { recommendation_id: id, status },
    }
  );
}

export function applyBaselinePatch(
  prev: Database,
  dealId: string,
  patch: Partial<PostCloseBaseline>
): Database {
  const deal = prev.deals.find((d) => d.id === dealId);
  if (!deal) return prev;
  const at = nowIso();
  const actor = actorId();
  const existing = prev.post_close_baselines.find((b) => b.deal_id === dealId);
  const nextRow: PostCloseBaseline = {
    id: existing?.id ?? newId("base"),
    organization_id: deal.organization_id,
    deal_id: dealId,
    underwritten_revenue: patch.underwritten_revenue ?? existing?.underwritten_revenue ?? null,
    underwritten_ebitda: patch.underwritten_ebitda ?? existing?.underwritten_ebitda ?? null,
    accepted_adjustments_total:
      patch.accepted_adjustments_total ?? existing?.accepted_adjustments_total ?? null,
    expected_synergies: patch.expected_synergies ?? existing?.expected_synergies ?? null,
    retention_assumptions: patch.retention_assumptions ?? existing?.retention_assumptions ?? "",
    nwc_assumption: patch.nwc_assumption ?? existing?.nwc_assumption ?? null,
    purchase_price: patch.purchase_price ?? existing?.purchase_price ?? null,
    structure: patch.structure ?? existing?.structure ?? "",
    expected_first_year_performance:
      patch.expected_first_year_performance ?? existing?.expected_first_year_performance ?? "",
    set_by_user_id: actor,
    set_at: at,
    notes: patch.notes ?? existing?.notes ?? "",
  };
  const change = makeChangeEvent(deal.organization_id, dealId, "baseline.updated", {
    baseline_id: nextRow.id,
  });
  return touchDeal(
    {
      ...prev,
      ...appendPhase3Events(prev, null, change),
      post_close_baselines: existing
        ? prev.post_close_baselines.map((b) => (b.deal_id === dealId ? nextRow : b))
        : [nextRow, ...prev.post_close_baselines],
    },
    dealId,
    at,
    {
      id: newId("act"),
      organization_id: deal.organization_id,
      deal_id: dealId,
      actor_user_id: actor,
      kind: "baseline_edit",
      title: "Updated post-close baseline",
      body: "Human-edited underwriting assumptions. Actuals will be compared later.",
      occurred_at: at,
      metadata: { baseline_id: nextRow.id },
    }
  );
}

export function applyAdjustmentStatus(
  prev: Database,
  id: string,
  status: AdjustmentStatus,
  notes?: string,
  evaluation?: EvaluationInput
): Database {
  const existing = prev.ebitda_adjustments.find((a) => a.id === id);
  if (!existing) return prev;
  const at = nowIso();
  const actor = actorId();
  const evalEvent =
    status === "accepted" || status === "rejected"
      ? makeEvaluation({
          organization_id: existing.organization_id,
          deal_id: existing.deal_id,
          entity_type: "ebitda_adjustment",
          entity_id: id,
          financial_context: existing.description,
          initial_system_output: `${existing.description} ${existing.amount} (${existing.status})`,
          analyst_action: status === "accepted" ? "accepted" : "rejected",
          why_original_was_wrong: evaluation?.why_original_was_wrong ?? null,
          controlling_source: evaluation?.controlling_source ?? existing.source,
          final_resolution: `${status}. Normalized only includes accepted non-synergy items.`,
          preparer_user_id: actor,
        })
      : null;
  const change = makeChangeEvent(existing.organization_id, existing.deal_id, `adjustment.${status}`, {
    entity_id: id,
    from: existing.status,
    to: status,
  });
  return {
    ...prev,
    ...appendPhase3Events(prev, evalEvent, change),
    ebitda_adjustments: prev.ebitda_adjustments.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            user_notes: notes ?? a.user_notes,
            provenance: {
              ...a.provenance,
              approval_status:
                status === "accepted"
                  ? "approved_assumption"
                  : a.origin === "ai"
                    ? "ai_inference"
                    : a.provenance.approval_status,
            },
          }
        : a
    ),
    deals: prev.deals.map((d) =>
      d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
    ),
    activities: [
      {
        id: newId("act"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actor,
        kind: "adjustment_status",
        title: `${status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : status === "needs_review" ? "Flagged for review" : "Reopened"} ${existing.description}`,
        body: `${existing.description} is now ${status}. Amount ${existing.amount}.`,
        occurred_at: at,
        metadata: { adjustment_id: id, status },
      },
      ...prev.activities,
    ],
    audit_events: [
      {
        id: newId("aud"),
        organization_id: existing.organization_id,
        deal_id: existing.deal_id,
        actor_user_id: actor,
        entity_type: "ebitda_adjustment",
        entity_id: id,
        action: "status_change",
        before: { status: existing.status },
        after: { status },
        occurred_at: at,
      },
      ...prev.audit_events,
    ],
  };
}

export function applySwitchUser(prev: Database, fromUserId: string, toUserId: string): Database {
  const at = nowIso();
  return {
    ...prev,
    users: prev.users.map((u) => ({
      ...u,
      is_current: u.id === toUserId,
      last_seen_at: u.id === fromUserId ? at : u.last_seen_at,
    })),
  };
}

export function applyPackageExport(prev: Database, dealId: string, kind: "xlsx" | "pdf" | "json"): Database {
  const deal = prev.deals.find((d) => d.id === dealId);
  if (!deal) return prev;
  const at = nowIso();
  return touchDeal(
    {
      ...prev,
      ...appendPhase3Events(
        prev,
        null,
        makeChangeEvent(deal.organization_id, dealId, "package.exported", { kind })
      ),
    },
    dealId,
    at,
    {
      id: newId("act"),
      organization_id: deal.organization_id,
      deal_id: dealId,
      actor_user_id: actorId(),
      kind: "package_export",
      title: `Exported underwriting package (${kind})`,
      body: "Generated from the live store. Scenario output is labeled scenario analysis.",
      occurred_at: at,
      metadata: { kind },
    }
  );
}
