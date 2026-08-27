export const DEAL_STAGES = [
  "target",
  "contacted",
  "nda",
  "initial_data",
  "financial_review",
  "diligence",
  "loi",
  "confirmatory_diligence",
  "closing",
  "closed",
  "passed",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const TERMINAL_STAGES: DealStage[] = ["closed", "passed"];

export const DILIGENCE_STAGES: DealStage[] = [
  "diligence",
  "confirmatory_diligence",
];

export const LOI_OUTSTANDING_STAGES: DealStage[] = [
  "loi",
  "confirmatory_diligence",
  "closing",
];

export const VERTICALS = [
  "legal",
  "accounting",
  "wealth",
  "insurance",
  "hvac",
  "dental",
  "veterinary",
  "restoration",
  "other",
] as const;

export type Vertical = (typeof VERTICALS)[number];

export const ADJUSTMENT_CATEGORIES = [
  "compensation",
  "one_time",
  "occupancy",
  "revenue",
  "working_capital",
  "synergy",
  "other",
] as const;

export type AdjustmentCategory = (typeof ADJUSTMENT_CATEGORIES)[number];

export type AdjustmentStatus = "proposed" | "accepted" | "rejected";
export type AdjustmentOrigin = "ai" | "manual";

export type ClaimKind = "source_fact" | "approved_assumption" | "ai_inference";

export type DocumentFolder =
  | "financials"
  | "tax"
  | "payroll"
  | "attorney_production"
  | "client_matter"
  | "legal"
  | "real_estate"
  | "corporate"
  | "other";

export type DocumentStatus =
  | "uploading"
  | "processing"
  | "analyzed"
  | "needs_review"
  | "failed";

export const DILIGENCE_CATEGORIES = [
  "financial",
  "revenue_clients",
  "employees_attorneys",
  "compensation",
  "legal",
  "tax",
  "real_estate",
  "technology",
  "operations",
  "other",
] as const;

export type DiligenceCategory = (typeof DILIGENCE_CATEGORIES)[number];

export const DILIGENCE_STATUSES = [
  "not_requested",
  "requested",
  "received",
  "under_review",
  "follow_up_required",
  "complete",
  "na",
] as const;

export type DiligenceStatus = (typeof DILIGENCE_STATUSES)[number];

export type DiligencePriority = "critical" | "high" | "medium" | "low";

export type FindingStatus = "open" | "accepted" | "dismissed" | "resolved";

export type ActivityKind =
  | "note"
  | "document_upload"
  | "document_status"
  | "stage_change"
  | "adjustment_status"
  | "diligence_status"
  | "finding_action"
  | "task_complete"
  | "task_created"
  | "system";

export type DealFlagCode =
  | "concentration"
  | "lease_expiry"
  | "missing_tax_return"
  | "stale"
  | "financial_inconsistency"
  | "declining_book"
  | "key_person"
  | "working_capital"
  | "malpractice"
  | "data_room_thin";

export type DealSource =
  | "banker"
  | "proprietary"
  | "conference"
  | "counsel_intro";

export type UserRole =
  | "deal_lead"
  | "financial_diligence"
  | "vp_diligence"
  | "managing_partner"
  | "associate";

export type MetricKey =
  | "revenue"
  | "direct_costs"
  | "gross_profit"
  | "operating_expenses"
  | "reported_ebitda"
  | "ebitda_margin"
  | "opex_owner"
  | "opex_staff"
  | "opex_occupancy"
  | "opex_marketing"
  | "opex_professional_services"
  | "opex_insurance"
  | "opex_technology"
  | "opex_other";

export type PeriodType = "fiscal_year" | "ttm" | "stub";

export interface Provenance {
  source_document_id: string | null;
  source_document_name: string | null;
  section: string | null;
  page: number | null;
  extracted_value: string | null;
  confidence: number | null;
  approval_status: ClaimKind;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  vertical_focus: Vertical;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  initials: string;
  is_current: boolean;
}

export interface RevenueByAttorney {
  name: string;
  revenue: number;
  share: number;
}

export interface PracticeAreaMix {
  name: string;
  share: number;
}

export interface LegalVerticalMetrics {
  attorney_count?: number;
  partner_count?: number;
  revenue_per_attorney?: number;
  revenue_by_attorney?: RevenueByAttorney[];
  revenue_concentration_top3?: number;
  revenue_concentration_top2?: number;
  practice_area_mix?: PracticeAreaMix[];
  partner_compensation?: number;
  attorney_production?: { name: string; collections: number }[];
  matter_concentration?: number;
}

export type VerticalMetrics = LegalVerticalMetrics & Record<string, unknown>;

export interface Deal {
  id: string;
  organization_id: string;
  name: string;
  location_city: string;
  location_state: string;
  owner_user_id: string;
  source: DealSource;
  source_detail: string;
  stage: DealStage;
  stage_entered_at: string;
  asking_price: number | null;
  expected_purchase_price: number | null;
  probability: number;
  vertical: Vertical;
  vertical_metrics: VerticalMetrics;
  flags: DealFlagCode[];
  created_at: string;
  last_activity_at: string;
  summary: string;
  ai_assessment: string;
  attention_items: string[];
}

export interface Contact {
  id: string;
  organization_id: string;
  deal_id: string;
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export interface FinancialPeriod {
  id: string;
  organization_id: string;
  deal_id: string;
  label: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  is_latest: boolean;
  sort_order: number;
}

export interface FinancialMetric {
  id: string;
  organization_id: string;
  deal_id: string;
  period_id: string;
  metric_key: MetricKey;
  amount: number;
  provenance: Provenance;
}

export interface EbitdaAdjustment {
  id: string;
  organization_id: string;
  deal_id: string;
  period_id: string;
  category: AdjustmentCategory;
  description: string;
  amount: number;
  source: string;
  origin: AdjustmentOrigin;
  confidence: number | null;
  status: AdjustmentStatus;
  user_notes: string;
  provenance: Provenance;
}

export interface DocumentRecord {
  id: string;
  organization_id: string;
  deal_id: string;
  filename: string;
  folder: DocumentFolder;
  uploaded_at: string;
  uploaded_by: string;
  processing_status: DocumentStatus;
  classification: string | null;
  extracted_payload: Record<string, unknown> | null;
  confidence: number | null;
  linked_request_ids: string[];
  page_count: number | null;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface DiligenceRequest {
  id: string;
  organization_id: string;
  deal_id: string;
  category: DiligenceCategory;
  question: string;
  status: DiligenceStatus;
  owner_user_id: string | null;
  counterparty_owner: string | null;
  due_date: string | null;
  supporting_document_ids: string[];
  notes: string;
  ai_generated: boolean;
  priority: DiligencePriority;
}

export interface AiFinding {
  id: string;
  organization_id: string;
  deal_id: string;
  title: string;
  question: string;
  status: FindingStatus;
  source_document_ids: string[];
  linked_request_id: string | null;
  assigned_user_id: string | null;
  edited_question: string | null;
  provenance: Provenance;
}

export interface Task {
  id: string;
  organization_id: string;
  deal_id: string;
  title: string;
  owner_user_id: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  organization_id: string;
  deal_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

export interface Activity {
  id: string;
  organization_id: string;
  deal_id: string;
  actor_user_id: string | null;
  kind: ActivityKind;
  title: string;
  body: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  organization_id: string;
  deal_id: string | null;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  occurred_at: string;
}

export interface Database {
  organizations: Organization[];
  users: User[];
  deals: Deal[];
  contacts: Contact[];
  financial_periods: FinancialPeriod[];
  financial_metrics: FinancialMetric[];
  ebitda_adjustments: EbitdaAdjustment[];
  documents: DocumentRecord[];
  diligence_requests: DiligenceRequest[];
  ai_findings: AiFinding[];
  tasks: Task[];
  activities: Activity[];
  notes: Note[];
  audit_events: AuditEvent[];
}

export interface OpexLine {
  key: MetricKey;
  label: string;
  amount: number;
}

export interface PeriodMetrics {
  period: FinancialPeriod;
  revenue: number;
  directCosts: number;
  grossProfit: number;
  opex: number;
  reportedEbitda: number;
  ebitdaMargin: number;
  opexDetail: OpexLine[];
}

export type AttentionReason =
  | "overdue_diligence"
  | "stale_activity"
  | "financial_inconsistency"
  | "missing_critical_document"
  | "upcoming_deadline";

export interface AttentionItem {
  dealId: string;
  dealName: string;
  reason: AttentionReason;
  label: string;
  detail: string;
}

export interface DealView {
  deal: Deal;
  owner: User;
  primaryContact: Contact | null;
  contacts: Contact[];
  periods: PeriodMetrics[];
  latest: PeriodMetrics | null;
  prior: PeriodMetrics | null;
  adjustments: EbitdaAdjustment[];
  documents: DocumentRecord[];
  diligence: DiligenceRequest[];
  findings: AiFinding[];
  tasks: Task[];
  notes: Note[];
  activities: Activity[];
  reportedEbitda: number;
  normalizedEbitda: number;
  proFormaEbitda: number;
  acceptedLift: number;
  proposedLift: number;
  revenue: number;
  growth: number | null;
  impliedMultipleReported: number | null;
  impliedMultipleNormalized: number | null;
  impliedMultipleProForma: number | null;
  headerMultiple: number | null;
  diligencePct: number;
  purchasePrice: number | null;
  attention: AttentionItem[];
  nextAction: Task | null;
}

export interface PortfolioMetrics {
  activeDeals: number;
  diligenceDeals: number;
  loisOutstanding: number;
  expectedCapital: number;
  pipelineRevenue: number;
  pipelineAdjustedEbitda: number;
  funnel: { stage: DealStage; count: number }[];
  attention: AttentionItem[];
}
