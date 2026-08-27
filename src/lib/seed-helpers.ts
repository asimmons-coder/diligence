import { CURRENT_ORG_ID } from "./constants";
import { assertReconcile } from "./format";
import type {
  Activity,
  AdjustmentCategory,
  AdjustmentOrigin,
  AdjustmentStatus,
  AiFinding,
  ClaimKind,
  Contact,
  DiligenceCategory,
  DiligencePriority,
  DiligenceRequest,
  DiligenceStatus,
  DocumentFolder,
  DocumentRecord,
  DocumentStatus,
  EbitdaAdjustment,
  FinancialMetric,
  FinancialPeriod,
  FindingStatus,
  MetricKey,
  Note,
  PeriodType,
  Provenance,
  Task,
} from "./types";

export const ORG = CURRENT_ORG_ID;

let seq = 0;
export function nid(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq.toString().padStart(3, "0")}`;
}

export function fact(
  documentId: string | null,
  documentName: string | null,
  section: string | null,
  extracted: string | null,
  confidence = 0.97,
  kind: ClaimKind = "source_fact"
): Provenance {
  return {
    source_document_id: documentId,
    source_document_name: documentName,
    section,
    page: section ? 1 : null,
    extracted_value: extracted,
    confidence,
    approval_status: kind,
  };
}

export function inference(
  documentId: string | null,
  documentName: string | null,
  section: string | null,
  extracted: string | null,
  confidence: number
): Provenance {
  return fact(documentId, documentName, section, extracted, confidence, "ai_inference");
}

export interface PeriodInput {
  id: string;
  dealId: string;
  label: string;
  type: PeriodType;
  start: string;
  end: string;
  latest: boolean;
  order: number;
  revenue: number;
  direct: number;
  opex: number;
  ebitda: number;
  opexDetail?: Partial<Record<MetricKey, number>>;
  documentId?: string;
  documentName?: string;
}

export function buildPeriod(input: PeriodInput): {
  period: FinancialPeriod;
  metrics: FinancialMetric[];
} {
  const gp = input.revenue - input.direct;
  const computed = gp - input.opex;
  assertReconcile(computed, input.ebitda, `${input.dealId} ${input.label} EBITDA`);
  assertReconcile(gp, input.revenue - input.direct, `${input.dealId} ${input.label} GP`);

  if (input.opexDetail) {
    const sum = Object.values(input.opexDetail).reduce((a, b) => a + (b ?? 0), 0);
    assertReconcile(sum, input.opex, `${input.dealId} ${input.label} OpEx detail`);
  }

  const period: FinancialPeriod = {
    id: input.id,
    organization_id: ORG,
    deal_id: input.dealId,
    label: input.label,
    period_type: input.type,
    start_date: input.start,
    end_date: input.end,
    is_latest: input.latest,
    sort_order: input.order,
  };

  const provenance = fact(
    input.documentId ?? null,
    input.documentName ?? null,
    input.label,
    null
  );

  const rows: { key: MetricKey; amount: number }[] = [
    { key: "revenue", amount: input.revenue },
    { key: "direct_costs", amount: input.direct },
    { key: "gross_profit", amount: gp },
    { key: "operating_expenses", amount: input.opex },
    { key: "reported_ebitda", amount: input.ebitda },
    { key: "ebitda_margin", amount: input.ebitda / input.revenue },
  ];

  if (input.opexDetail) {
    for (const [key, amount] of Object.entries(input.opexDetail)) {
      if (amount == null) continue;
      rows.push({ key: key as MetricKey, amount });
    }
  }

  const metrics: FinancialMetric[] = rows.map((row) => ({
    id: `${input.id}_${row.key}`,
    organization_id: ORG,
    deal_id: input.dealId,
    period_id: input.id,
    metric_key: row.key,
    amount: row.amount,
    provenance: {
      ...provenance,
      extracted_value:
        row.key === "ebitda_margin"
          ? `${((row.amount) * 100).toFixed(1)}%`
          : String(row.amount),
    },
  }));

  return { period, metrics };
}

export function contact(partial: Omit<Contact, "organization_id">): Contact {
  return { organization_id: ORG, ...partial };
}

export function adj(partial: {
  id: string;
  dealId: string;
  periodId: string;
  category: AdjustmentCategory;
  description: string;
  amount: number;
  source: string;
  origin: AdjustmentOrigin;
  status: AdjustmentStatus;
  confidence?: number | null;
  notes?: string;
  provenance: Provenance;
}): EbitdaAdjustment {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    period_id: partial.periodId,
    category: partial.category,
    description: partial.description,
    amount: partial.amount,
    source: partial.source,
    origin: partial.origin,
    confidence: partial.confidence ?? null,
    status: partial.status,
    user_notes: partial.notes ?? "",
    provenance: partial.provenance,
  };
}

export function doc(partial: {
  id: string;
  dealId: string;
  filename: string;
  folder: DocumentFolder;
  uploadedAt: string;
  uploadedBy: string;
  status?: DocumentStatus;
  classification?: string | null;
  payload?: Record<string, unknown> | null;
  confidence?: number | null;
  linked?: string[];
  pages?: number | null;
}): DocumentRecord {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    filename: partial.filename,
    folder: partial.folder,
    uploaded_at: partial.uploadedAt,
    uploaded_by: partial.uploadedBy,
    processing_status: partial.status ?? "analyzed",
    classification: partial.classification ?? partial.folder,
    extracted_payload: partial.payload ?? null,
    confidence: partial.confidence ?? 0.93,
    linked_request_ids: partial.linked ?? [],
    page_count: partial.pages ?? 12,
    mime_type: partial.filename.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf",
    size_bytes: 240_000,
  };
}

export function req(partial: {
  id: string;
  dealId: string;
  category: DiligenceCategory;
  question: string;
  status: DiligenceStatus;
  owner?: string | null;
  counterparty?: string | null;
  due?: string | null;
  docs?: string[];
  notes?: string;
  ai?: boolean;
  priority?: DiligencePriority;
}): DiligenceRequest {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    category: partial.category,
    question: partial.question,
    status: partial.status,
    owner_user_id: partial.owner ?? null,
    counterparty_owner: partial.counterparty ?? null,
    due_date: partial.due ?? null,
    supporting_document_ids: partial.docs ?? [],
    notes: partial.notes ?? "",
    ai_generated: partial.ai ?? false,
    priority: partial.priority ?? "medium",
  };
}

export function finding(partial: {
  id: string;
  dealId: string;
  title: string;
  question: string;
  status?: FindingStatus;
  docs?: string[];
  linked?: string | null;
  assignee?: string | null;
  provenance: Provenance;
}): AiFinding {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    title: partial.title,
    question: partial.question,
    status: partial.status ?? "open",
    source_document_ids: partial.docs ?? [],
    linked_request_id: partial.linked ?? null,
    assigned_user_id: partial.assignee ?? null,
    edited_question: null,
    provenance: partial.provenance,
  };
}

export function task(partial: {
  id: string;
  dealId: string;
  title: string;
  owner: string;
  due?: string | null;
  done?: boolean;
  created?: string;
}): Task {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    title: partial.title,
    owner_user_id: partial.owner,
    due_date: partial.due ?? null,
    completed: partial.done ?? false,
    completed_at: partial.done ? (partial.due ?? partial.created ?? null) : null,
    created_at: partial.created ?? "2026-08-10T14:00:00.000Z",
  };
}

export function note(partial: {
  id: string;
  dealId: string;
  author: string;
  body: string;
  at: string;
}): Note {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    author_user_id: partial.author,
    body: partial.body,
    created_at: partial.at,
  };
}

export function activity(partial: {
  id: string;
  dealId: string;
  actor?: string | null;
  kind: Activity["kind"];
  title: string;
  body: string;
  at: string;
  meta?: Record<string, unknown>;
}): Activity {
  return {
    id: partial.id,
    organization_id: ORG,
    deal_id: partial.dealId,
    actor_user_id: partial.actor ?? null,
    kind: partial.kind,
    title: partial.title,
    body: partial.body,
    occurred_at: partial.at,
    metadata: partial.meta ?? {},
  };
}
