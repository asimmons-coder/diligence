import { APP_AS_OF, CURRENT_ORG_ID, CURRENT_USER_ID } from "./constants";
import { classifyFilename, haleMessyMatchCount, isHaleMessyFilename } from "./classifier";
import { ensureEvidenceTables } from "./empty-evidence";
import { cloneHaleEvidenceOntoDeal, haleMessyDocuments } from "./seed-hale-evidence";
import { haleSlice } from "./seed-hale";
import type {
  AdjustmentStatus,
  ConflictStatus,
  Database,
  Deal,
  DetectedDocumentType,
  DiligenceStatus,
  EvidenceHumanReview,
  EvidenceTables,
  FactReviewStatus,
  ValuationScenario,
  Vertical,
} from "./types";

export function nowIso() {
  return `${APP_AS_OF}T${new Date().toISOString().slice(11)}`;
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeEvidence(prev: Database, add: EvidenceTables): Database {
  const base = ensureEvidenceTables(prev);
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
    asking_price: null,
    expected_purchase_price: null,
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
  };
}

export function applyCreateDeal(prev: Database, deal: Deal): Database {
  const at = deal.created_at;
  const base = ensureEvidenceTables(prev);
  return {
    ...base,
    deals: [deal, ...base.deals],
    activities: [
      {
        id: newId("act"),
        organization_id: deal.organization_id,
        deal_id: deal.id,
        actor_user_id: CURRENT_USER_ID,
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
        actor_user_id: CURRENT_USER_ID,
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
    remappedEvidence
  );

  return {
    ...next,
    activities: [
      {
        id: newId("act"),
        organization_id: deal.organization_id,
        deal_id: dealId,
        actor_user_id: CURRENT_USER_ID,
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
  filenames: string[]
): { next: Database; hydrated: boolean } {
  const deal = prev.deals.find((d) => d.id === dealId);
  if (!deal) return { next: prev, hydrated: false };
  if (haleMessyMatchCount(filenames) >= 8 || filenames.some((f) => isHaleMessyFilename(f))) {
    if (haleMessyMatchCount(filenames) >= 6) {
      return { next: applyHaleMessyHydrate(prev, dealId), hydrated: true };
    }
  }

  const at = nowIso();
  let next = ensureEvidenceTables(prev);
  for (const filename of filenames) {
    const classified = classifyFilename(filename, deal.name);
    const docId = newId("doc");
    const evId = newId("ev");
    next = {
      ...next,
      documents: [
        {
          id: docId,
          organization_id: deal.organization_id,
          deal_id: dealId,
          filename,
          folder: classified.folder,
          uploaded_at: at,
          uploaded_by: CURRENT_USER_ID,
          processing_status: "uploading",
          classification: classified.type,
          extracted_payload: { staged: true, filename },
          confidence: classified.confidence,
          linked_request_ids: [],
          page_count: null,
          mime_type: null,
          size_bytes: null,
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
          filename,
          title: filename,
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
          size_bytes: null,
        },
        ...next.evidence_items,
      ],
    };
  }
  next = touchDeal(next, dealId, at, {
    id: newId("act"),
    organization_id: deal.organization_id,
    deal_id: dealId,
    actor_user_id: CURRENT_USER_ID,
    kind: "evidence_ingest",
    title: `Uploaded ${filenames.length} file${filenames.length === 1 ? "" : "s"}`,
    body: "Classification is deterministic from filename. No accepted financials were changed.",
    occurred_at: at,
    metadata: { filenames },
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
      actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
  edits?: { numeric_value?: number; text_value?: string; extracted_value?: string; assigned_user_id?: string | null }
): Database {
  const existing = prev.extracted_facts.find((f) => f.id === id);
  if (!existing) return prev;
  const at = nowIso();
  return touchDeal(
    {
      ...prev,
      extracted_facts: prev.extracted_facts.map((f) =>
        f.id === id
          ? {
              ...f,
              review_status: status,
              numeric_value: edits?.numeric_value ?? f.numeric_value,
              text_value: edits?.text_value ?? f.text_value,
              extracted_value: edits?.extracted_value ?? f.extracted_value,
              assigned_user_id: edits?.assigned_user_id ?? f.assigned_user_id,
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
          actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
  notes?: string
): Database {
  const existing = prev.conflicts.find((c) => c.id === id);
  if (!existing) return prev;
  const at = nowIso();
  return touchDeal(
    {
      ...prev,
      conflicts: prev.conflicts.map((c) =>
        c.id === id ? { ...c, status, resolution_notes: notes ?? c.resolution_notes } : c
      ),
    },
    existing.deal_id,
    at,
    {
      id: newId("act"),
      organization_id: existing.organization_id,
      deal_id: existing.deal_id,
      actor_user_id: CURRENT_USER_ID,
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
            owner_user_id: existing.owner_user_id ?? CURRENT_USER_ID,
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
        actor_user_id: CURRENT_USER_ID,
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
            owner_user_id: existing.owner_user_id ?? CURRENT_USER_ID,
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
        actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
          owner_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
  let next: Database = {
    ...prev,
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
        actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
      actor_user_id: CURRENT_USER_ID,
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
