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

export type AdjustmentStatus = "proposed" | "accepted" | "rejected" | "needs_review";
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
  | "system"
  | "fact_review"
  | "conflict_status"
  | "evidence_ingest"
  | "interpretation_review"
  | "valuation_edit"
  | "deal_created"
  | "evaluation_logged"
  | "assignment"
  | "package_export"
  | "baseline_edit";

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
  last_seen_at?: string | null;
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
  last_reviewed_at?: string | null;
  template_id?: string | null;
  external_system?: string | null;
  external_deal_id?: string | null;
  external_deal_url?: string | null;
  external_imported_at?: string | null;
  external_updated_at?: string | null;
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
  evidence_items: EvidenceItem[];
  document_versions: DocumentVersion[];
  extractions: Extraction[];
  extracted_facts: ExtractedFact[];
  conflicts: Conflict[];
  reconciliation_checks: ReconciliationCheck[];
  assumptions: Assumption[];
  underwriting_risks: UnderwritingRisk[];
  valuation_scenarios: ValuationScenario[];
  valuation_factors: ValuationFactor[];
  negotiation_positions: NegotiationPosition[];
  recommendations: Recommendation[];
  review_decisions: ReviewDecision[];
  missing_items: MissingItem[];
  communication_interpretations: CommunicationInterpretation[];
  underwriting_templates: UnderwritingTemplate[];
  template_fields: TemplateField[];
  deal_template_field_values: DealTemplateFieldValue[];
  evaluation_events: EvaluationEvent[];
  change_events: ChangeEvent[];
  import_events: ImportEvent[];
  post_close_baselines: PostCloseBaseline[];
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
  evidenceItems: EvidenceItem[];
  extractedFacts: ExtractedFact[];
  conflicts: Conflict[];
  missingItems: MissingItem[];
  interpretations: CommunicationInterpretation[];
  assumptions: Assumption[];
  risks: UnderwritingRisk[];
  valuationScenarios: ValuationScenario[];
  valuationFactors: ValuationFactor[];
  negotiationPositions: NegotiationPosition[];
  recommendations: Recommendation[];
  readiness: DealReadiness;
  digest: DigestItem[];
  openConflictCount: number;
  pendingFactCount: number;
  valuationGap: number | null;
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

export const EVIDENCE_KINDS = [
  "document",
  "email",
  "meeting_note",
  "transcript",
  "manual",
  "integration",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const DETECTED_DOCUMENT_TYPES = [
  "tax_return",
  "pnl",
  "balance_sheet",
  "gl",
  "trial_balance",
  "payroll_register",
  "employee_roster",
  "production_report",
  "customer_client_detail",
  "ar",
  "bank_statement",
  "lease",
  "legal",
  "purchase_agreement_loi",
  "email",
  "meeting_note_transcript",
  "other",
] as const;
export type DetectedDocumentType = (typeof DETECTED_DOCUMENT_TYPES)[number];

export type EvidenceHumanReview = "unreviewed" | "confirmed" | "corrected";
export type FactReviewStatus = "pending" | "accepted" | "rejected" | "edited";
export type FactKind =
  | "financial_period"
  | "statement_line"
  | "revenue_detail"
  | "expense_detail"
  | "payroll"
  | "owner_comp"
  | "headcount"
  | "concentration"
  | "lease_commitment"
  | "debt"
  | "contractual_date"
  | "vertical_metric";
export type ExtractionMethod =
  | "filename"
  | "seeded_metadata"
  | "ocr_stub"
  | "manual"
  | "classifier";
export type ConflictStatus =
  | "unreviewed"
  | "investigating"
  | "follow_up_required"
  | "resolved"
  | "accepted_difference"
  | "not_material";
export type ConflictMateriality =
  | "immaterial"
  | "notable"
  | "material"
  | "deal_breaking";
export type MissingPriority = "blocking" | "high" | "medium" | "low";
export type MissingItemStatus = "open" | "sent" | "resolved";
export type ReadinessDimensionKey =
  | "document_completeness"
  | "financial_extraction_review"
  | "financial_reconciliation"
  | "ebitda_adjustment_review"
  | "diligence_completion"
  | "key_person_commercial_risk"
  | "valuation_readiness";
export type ReadinessDimensionStatus =
  | "ready"
  | "in_progress"
  | "blocked"
  | "not_started";
export type OverallReadiness =
  | "intake_in_progress"
  | "initial_review_ready"
  | "underwriting_in_progress"
  | "ready_for_indication"
  | "ready_for_loi"
  | "confirmatory_diligence"
  | "ready_for_close";
export type ScenarioKey = "conservative" | "base" | "upside";
export type FactorDirection = "supporting" | "pressuring";
export type NegotiationStrength = "strong" | "weak" | "counter";
export type NegotiationSide = "seller" | "buyer";
export type RecommendationKind = "structure" | "price" | "process";
export type RecommendationReview = "pending_review" | "accepted" | "rejected";
export type TemplateFieldStatus =
  | "missing"
  | "extracted"
  | "reviewed"
  | "accepted"
  | "conflict";
export type EvaluationAction = "accepted" | "edited" | "rejected";
export type QueueKind =
  | "classification"
  | "extraction"
  | "reconciliation"
  | "adjustment"
  | "missing"
  | "seller_question"
  | "assigned"
  | "since_last_login"
  | "awaiting_supervisor";
export type QueuePriority = "critical" | "high" | "medium" | "low";
export type InterpretationKind =
  | "diligence_answer"
  | "adjustment_challenge"
  | "new_fact"
  | "assumption"
  | "contradiction"
  | "task"
  | "posture"
  | "valuation_impact";
export type InterpretationReviewStatus = "pending" | "approved" | "dismissed";
export type VisualClaimKind =
  | "fact"
  | "assumption"
  | "proposed"
  | "inference"
  | "conflict"
  | "scenario"
  | "recommendation";

export interface EvidenceItem {
  id: string;
  organization_id: string;
  deal_id: string;
  kind: EvidenceKind;
  document_id: string | null;
  filename: string | null;
  title: string;
  detected_type: DetectedDocumentType;
  detected_period: string | null;
  detected_entity: string | null;
  file_format: string | null;
  processing_status: DocumentStatus;
  confidence: number | null;
  potential_duplicate_of: string | null;
  superseded_by_id: string | null;
  supersedes_id: string | null;
  human_review_status: EvidenceHumanReview;
  source_system: string | null;
  external_item_id: string | null;
  external_thread_id: string | null;
  external_meeting_id: string | null;
  author: string | null;
  sender: string | null;
  participants: string[];
  occurred_at: string | null;
  ingested_at: string;
  last_synchronized_at: string | null;
  subject: string | null;
  body: string | null;
  snippet: string | null;
  page_count: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  folder_path: string;
  basename: string;
  content_hash: string | null;
}

export interface DocumentVersion {
  id: string;
  organization_id: string;
  deal_id: string;
  evidence_item_id: string;
  version_label: string;
  supersedes_id: string | null;
  is_current: boolean;
}

export interface Extraction {
  id: string;
  organization_id: string;
  deal_id: string;
  evidence_item_id: string;
  method: ExtractionMethod;
  status: DocumentStatus;
  started_at: string;
  completed_at: string | null;
  notes: string;
}

export interface ExtractedFact {
  id: string;
  organization_id: string;
  deal_id: string;
  evidence_item_id: string;
  extraction_id: string | null;
  fact_kind: FactKind;
  label: string;
  period_label: string | null;
  entity: string | null;
  numeric_value: number | null;
  text_value: string | null;
  unit: string | null;
  page: number | null;
  sheet: string | null;
  cell: string | null;
  section: string | null;
  extracted_value: string;
  confidence: number;
  extraction_method: ExtractionMethod;
  review_status: FactReviewStatus;
  assigned_user_id: string | null;
  assigned_by_user_id?: string | null;
  prepared_by_user_id?: string | null;
  reviewer_user_id?: string | null;
  conflicting_fact_ids: string[];
  claim_kind: ClaimKind;
  linked_metric_key: MetricKey | null;
  linked_period_id: string | null;
}

export interface Conflict {
  id: string;
  organization_id: string;
  deal_id: string;
  description: string;
  source_a_id: string;
  source_b_id: string;
  source_a_label: string;
  source_b_label: string;
  value_a: number | null;
  value_b: number | null;
  difference: number | null;
  materiality: ConflictMateriality;
  ai_interpretation: string;
  recommended_action: string;
  owner_user_id: string | null;
  assigned_by_user_id?: string | null;
  prepared_by_user_id?: string | null;
  reviewer_user_id?: string | null;
  status: ConflictStatus;
  resolution_notes: string;
  linked_request_id: string | null;
  linked_adjustment_id: string | null;
  linked_task_id: string | null;
  related_fact_ids: string[];
}

export interface ReconciliationCheck {
  id: string;
  organization_id: string;
  deal_id: string;
  name: string;
  status: ConflictStatus;
  difference: number | null;
  notes: string;
  conflict_id: string | null;
}

export interface Assumption {
  id: string;
  organization_id: string;
  deal_id: string;
  statement: string;
  claim_kind: ClaimKind;
  status: FactReviewStatus;
  amount: number | null;
  linked_adjustment_id: string | null;
  evidence_item_ids: string[];
}

export interface UnderwritingRisk {
  id: string;
  organization_id: string;
  deal_id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  status: "open" | "watching" | "resolved";
  evidence_item_ids: string[];
}

export interface ValuationScenario {
  id: string;
  organization_id: string;
  deal_id: string;
  key: ScenarioKey;
  name: string;
  include_owner: boolean;
  include_legal: boolean;
  include_occupancy: boolean;
  include_synergy: boolean;
  synergy_pct: number;
  concentration_haircut: number;
  selected_ebitda: number;
  ebitda_overridden: boolean;
  selected_multiple: number;
  multiple_low: number;
  multiple_high: number;
  expected_debt: number;
  nwc_assumption: number;
  other_ppa: number;
  seller_expectation: number;
  current_buyer_indication: number | null;
  notes: string;
}

export interface ValuationFactor {
  id: string;
  organization_id: string;
  deal_id: string;
  scenario_id: string | null;
  direction: FactorDirection;
  statement: string;
  evidence_item_ids: string[];
}

export interface NegotiationPosition {
  id: string;
  organization_id: string;
  deal_id: string;
  side: NegotiationSide;
  title: string;
  body: string;
  strength: NegotiationStrength;
  evidence_item_ids: string[];
  related_issue: string;
}

export interface Recommendation {
  id: string;
  organization_id: string;
  deal_id: string;
  kind: RecommendationKind;
  title: string;
  body: string;
  supporting_evidence_ids: string[];
  assumption_ids: string[];
  risk_ids: string[];
  alternatives: string;
  confidence: number;
  review_status: RecommendationReview;
  assigned_user_id?: string | null;
  assigned_by_user_id?: string | null;
  prepared_by_user_id?: string | null;
  reviewer_user_id?: string | null;
}

export interface ReviewDecision {
  id: string;
  organization_id: string;
  deal_id: string;
  entity_type: string;
  entity_id: string;
  decision: string;
  rationale: string;
  actor_user_id: string | null;
  occurred_at: string;
  accepted_financials_changed: boolean;
}

export interface MissingItem {
  id: string;
  organization_id: string;
  deal_id: string;
  title: string;
  why_it_matters: string;
  priority: MissingPriority;
  suggested_seller_request: string;
  related_line: string | null;
  blocking: boolean;
  linked_request_id: string | null;
  status: MissingItemStatus;
  assigned_user_id?: string | null;
  assigned_by_user_id?: string | null;
}

export interface CommunicationInterpretation {
  id: string;
  organization_id: string;
  deal_id: string;
  evidence_item_id: string;
  kind: InterpretationKind;
  title: string;
  summary: string;
  suggested_entity_type: string | null;
  suggested_entity_id: string | null;
  suggested_status: string | null;
  suggested_notes: string;
  impact_summary: string;
  review_status: InterpretationReviewStatus;
  requires_approval: boolean;
  accepted_financials_would_change: boolean;
}

export interface ReadinessDimension {
  key: ReadinessDimensionKey;
  label: string;
  status: ReadinessDimensionStatus;
  blockingItems: string[];
  unresolvedQuestions: string[];
  nextAction: string;
}

export interface DealReadiness {
  overall: OverallReadiness;
  summary: string;
  dimensions: ReadinessDimension[];
}

export interface DigestItem {
  id: string;
  whatChanged: string;
  whyItMatters: string;
  evidenceLabel: string;
  requiresAction: boolean;
  acceptedFinancialsChanged: boolean;
  kind: VisualClaimKind;
  href?: string;
}

export interface ScenarioView {
  scenario: ValuationScenario;
  reportedEbitda: number;
  acceptedNormalized: number;
  formulaEbitda: number;
  selectedEbitda: number;
  selectedMultiple: number;
  ev: number;
  evLow: number;
  evHigh: number;
  indicatedEquity: number;
  indicatedEquityLow: number;
  indicatedEquityHigh: number;
  sellerExpectation: number;
  buyerIndication: number | null;
  gapToSeller: number;
  includedTreatments: string[];
}

export type EvidenceTables = Pick<
  Database,
  | "evidence_items"
  | "document_versions"
  | "extractions"
  | "extracted_facts"
  | "conflicts"
  | "reconciliation_checks"
  | "assumptions"
  | "underwriting_risks"
  | "valuation_scenarios"
  | "valuation_factors"
  | "negotiation_positions"
  | "recommendations"
  | "review_decisions"
  | "missing_items"
  | "communication_interpretations"
>;

export type Phase3Tables = Pick<
  Database,
  | "underwriting_templates"
  | "template_fields"
  | "deal_template_field_values"
  | "evaluation_events"
  | "change_events"
  | "import_events"
  | "post_close_baselines"
>;

export interface UnderwritingTemplate {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  vertical: Vertical | "generic";
  description: string;
}

export interface TemplateField {
  id: string;
  organization_id: string;
  template_id: string;
  field_key: string;
  label: string;
  description: string;
  sort_order: number;
}

export interface DealTemplateFieldValue {
  id: string;
  organization_id: string;
  deal_id: string;
  template_id: string;
  field_id: string;
  status: TemplateFieldStatus;
  notes: string;
  evidence_item_ids: string[];
  extracted_summary: string | null;
}

export interface EvaluationEvent {
  id: string;
  organization_id: string;
  deal_id: string;
  entity_type: string;
  entity_id: string;
  document_type: string | null;
  financial_context: string | null;
  initial_system_output: string;
  analyst_action: EvaluationAction;
  corrected_answer: string | null;
  why_original_was_wrong: string | null;
  controlling_source: string | null;
  time_saved_minutes: number | null;
  final_resolution: string;
  preparer_user_id: string | null;
  reviewer_user_id: string | null;
  occurred_at: string;
}

export interface ChangeEvent {
  id: string;
  organization_id: string;
  deal_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ImportEvent {
  id: string;
  organization_id: string;
  deal_id: string;
  source_system: string;
  event_type: string;
  external_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface PostCloseBaseline {
  id: string;
  organization_id: string;
  deal_id: string;
  underwritten_revenue: number | null;
  underwritten_ebitda: number | null;
  accepted_adjustments_total: number | null;
  expected_synergies: number | null;
  retention_assumptions: string;
  nwc_assumption: number | null;
  purchase_price: number | null;
  structure: string;
  expected_first_year_performance: string;
  set_by_user_id: string | null;
  set_at: string | null;
  notes: string;
}

export interface IngestFile {
  path: string;
  basename: string;
  sizeBytes?: number | null;
  lastModified?: number | null;
}

export interface QueueItem {
  id: string;
  kind: QueueKind;
  dealId: string;
  dealName: string;
  title: string;
  whyItMatters: string;
  priority: QueuePriority;
  href: string;
  evidenceHref?: string;
  assignedUserId: string | null;
  assignedByUserId: string | null;
  preparedByUserId: string | null;
  reviewerUserId: string | null;
  statusLabel: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  actions: Array<
    "open" | "assign" | "approve" | "edit" | "reject" | "send_to_diligence"
  >;
}
