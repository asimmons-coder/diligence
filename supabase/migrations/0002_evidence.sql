-- Phase 2 evidence / underwriting model.
-- Organization-scoped. Connector fields are architected now; no live Gmail/Granola.
-- Types in src/lib/types.ts match this migration 1:1.

alter type public.adjustment_status add value if not exists 'needs_review';

alter type public.activity_kind add value if not exists 'fact_review';
alter type public.activity_kind add value if not exists 'conflict_status';
alter type public.activity_kind add value if not exists 'evidence_ingest';
alter type public.activity_kind add value if not exists 'interpretation_review';
alter type public.activity_kind add value if not exists 'valuation_edit';
alter type public.activity_kind add value if not exists 'deal_created';

alter table public.deals
  add column if not exists last_reviewed_at timestamptz;

create type public.evidence_kind as enum (
  'document',
  'email',
  'meeting_note',
  'transcript',
  'manual',
  'integration'
);

create type public.detected_document_type as enum (
  'tax_return',
  'pnl',
  'balance_sheet',
  'gl',
  'trial_balance',
  'payroll_register',
  'employee_roster',
  'production_report',
  'customer_client_detail',
  'ar',
  'bank_statement',
  'lease',
  'legal',
  'purchase_agreement_loi',
  'email',
  'meeting_note_transcript',
  'other'
);

create type public.evidence_human_review as enum (
  'unreviewed',
  'confirmed',
  'corrected'
);

create type public.fact_review_status as enum (
  'pending',
  'accepted',
  'rejected',
  'edited'
);

create type public.fact_kind as enum (
  'financial_period',
  'statement_line',
  'revenue_detail',
  'expense_detail',
  'payroll',
  'owner_comp',
  'headcount',
  'concentration',
  'lease_commitment',
  'debt',
  'contractual_date',
  'vertical_metric'
);

create type public.extraction_method as enum (
  'filename',
  'seeded_metadata',
  'ocr_stub',
  'manual',
  'classifier'
);

create type public.conflict_status as enum (
  'unreviewed',
  'investigating',
  'follow_up_required',
  'resolved',
  'accepted_difference',
  'not_material'
);

create type public.conflict_materiality as enum (
  'immaterial',
  'notable',
  'material',
  'deal_breaking'
);

create type public.missing_priority as enum (
  'blocking',
  'high',
  'medium',
  'low'
);

create type public.missing_item_status as enum (
  'open',
  'sent',
  'resolved'
);

create type public.scenario_key as enum (
  'conservative',
  'base',
  'upside'
);

create type public.factor_direction as enum (
  'supporting',
  'pressuring'
);

create type public.negotiation_side as enum (
  'seller',
  'buyer'
);

create type public.negotiation_strength as enum (
  'strong',
  'weak',
  'counter'
);

create type public.recommendation_kind as enum (
  'structure',
  'price',
  'process'
);

create type public.recommendation_review as enum (
  'pending_review',
  'accepted',
  'rejected'
);

create type public.interpretation_kind as enum (
  'diligence_answer',
  'adjustment_challenge',
  'new_fact',
  'assumption',
  'contradiction',
  'task',
  'posture',
  'valuation_impact'
);

create type public.interpretation_review_status as enum (
  'pending',
  'approved',
  'dismissed'
);

create type public.risk_severity as enum (
  'high',
  'medium',
  'low'
);

create type public.risk_status as enum (
  'open',
  'watching',
  'resolved'
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind public.evidence_kind not null,
  document_id uuid references public.documents(id) on delete set null,
  filename text,
  title text not null,
  detected_type public.detected_document_type not null default 'other',
  detected_period text,
  detected_entity text,
  file_format text,
  processing_status public.document_status not null default 'uploading',
  confidence numeric(4, 3),
  potential_duplicate_of uuid references public.evidence_items(id) on delete set null,
  superseded_by_id uuid references public.evidence_items(id) on delete set null,
  supersedes_id uuid references public.evidence_items(id) on delete set null,
  human_review_status public.evidence_human_review not null default 'unreviewed',
  source_system text,
  external_item_id text,
  external_thread_id text,
  external_meeting_id text,
  author text,
  sender text,
  participants text[] not null default '{}',
  occurred_at timestamptz,
  ingested_at timestamptz not null default now(),
  last_synchronized_at timestamptz,
  subject text,
  body text,
  snippet text,
  page_count integer,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  version_label text not null,
  supersedes_id uuid references public.document_versions(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  method public.extraction_method not null,
  status public.document_status not null default 'processing',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  extraction_id uuid references public.extractions(id) on delete set null,
  fact_kind public.fact_kind not null,
  label text not null,
  period_label text,
  entity text,
  numeric_value numeric(16, 4),
  text_value text,
  unit text,
  page integer,
  sheet text,
  cell text,
  section text,
  extracted_value text not null,
  confidence numeric(4, 3) not null,
  extraction_method public.extraction_method not null,
  review_status public.fact_review_status not null default 'pending',
  assigned_user_id uuid references public.users(id),
  conflicting_fact_ids uuid[] not null default '{}',
  claim_kind public.claim_kind not null default 'ai_inference',
  linked_metric_key text,
  linked_period_id uuid references public.financial_periods(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  description text not null,
  source_a_id uuid not null,
  source_b_id uuid not null,
  source_a_label text not null,
  source_b_label text not null,
  value_a numeric(16, 4),
  value_b numeric(16, 4),
  difference numeric(16, 4),
  materiality public.conflict_materiality not null default 'notable',
  ai_interpretation text not null default '',
  recommended_action text not null default '',
  owner_user_id uuid references public.users(id),
  status public.conflict_status not null default 'unreviewed',
  resolution_notes text not null default '',
  linked_request_id uuid references public.diligence_requests(id) on delete set null,
  linked_adjustment_id uuid references public.ebitda_adjustments(id) on delete set null,
  linked_task_id uuid references public.tasks(id) on delete set null,
  related_fact_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  status public.conflict_status not null default 'unreviewed',
  difference numeric(16, 4),
  notes text not null default '',
  conflict_id uuid references public.conflicts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assumptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  statement text not null,
  claim_kind public.claim_kind not null default 'ai_inference',
  status public.fact_review_status not null default 'pending',
  amount numeric(14, 2),
  linked_adjustment_id uuid references public.ebitda_adjustments(id) on delete set null,
  evidence_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.underwriting_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  detail text not null,
  severity public.risk_severity not null default 'medium',
  status public.risk_status not null default 'open',
  evidence_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.valuation_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  key public.scenario_key not null,
  name text not null,
  include_owner boolean not null default true,
  include_legal boolean not null default true,
  include_occupancy boolean not null default false,
  include_synergy boolean not null default false,
  synergy_pct numeric(6, 4) not null default 1,
  concentration_haircut numeric(14, 2) not null default 0,
  selected_ebitda numeric(14, 2) not null,
  ebitda_overridden boolean not null default false,
  selected_multiple numeric(8, 4) not null,
  multiple_low numeric(8, 4) not null,
  multiple_high numeric(8, 4) not null,
  expected_debt numeric(14, 2) not null default 0,
  nwc_assumption numeric(14, 2) not null default 0,
  other_ppa numeric(14, 2) not null default 0,
  seller_expectation numeric(14, 2) not null default 0,
  current_buyer_indication numeric(14, 2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, key)
);

create table public.valuation_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  scenario_id uuid references public.valuation_scenarios(id) on delete set null,
  direction public.factor_direction not null,
  statement text not null,
  evidence_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.negotiation_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  side public.negotiation_side not null,
  title text not null,
  body text not null,
  strength public.negotiation_strength not null default 'strong',
  evidence_item_ids uuid[] not null default '{}',
  related_issue text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind public.recommendation_kind not null default 'structure',
  title text not null,
  body text not null,
  supporting_evidence_ids uuid[] not null default '{}',
  assumption_ids uuid[] not null default '{}',
  risk_ids uuid[] not null default '{}',
  alternatives text not null default '',
  confidence numeric(4, 3) not null default 0.7,
  review_status public.recommendation_review not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  decision text not null,
  rationale text not null default '',
  actor_user_id uuid references public.users(id),
  occurred_at timestamptz not null default now(),
  accepted_financials_changed boolean not null default false
);

create table public.missing_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  why_it_matters text not null,
  priority public.missing_priority not null default 'medium',
  suggested_seller_request text not null,
  related_line text,
  blocking boolean not null default false,
  linked_request_id uuid references public.diligence_requests(id) on delete set null,
  status public.missing_item_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communication_interpretations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  kind public.interpretation_kind not null,
  title text not null,
  summary text not null,
  suggested_entity_type text,
  suggested_entity_id text,
  suggested_status text,
  suggested_notes text not null default '',
  impact_summary text not null default '',
  review_status public.interpretation_review_status not null default 'pending',
  requires_approval boolean not null default true,
  accepted_financials_would_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evidence_items_deal_idx on public.evidence_items (deal_id, kind);
create index extracted_facts_deal_idx on public.extracted_facts (deal_id, review_status);
create index conflicts_deal_idx on public.conflicts (deal_id, status);
create index missing_items_deal_idx on public.missing_items (deal_id, status);
create index valuation_scenarios_deal_idx on public.valuation_scenarios (deal_id, key);
create index interpretations_deal_idx on public.communication_interpretations (deal_id, review_status);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'evidence_items',
    'document_versions',
    'extractions',
    'extracted_facts',
    'conflicts',
    'reconciliation_checks',
    'assumptions',
    'underwriting_risks',
    'valuation_scenarios',
    'valuation_factors',
    'negotiation_positions',
    'recommendations',
    'review_decisions',
    'missing_items',
    'communication_interpretations'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format(
      'create policy org_isolation on public.%I
         for all
         using (organization_id = public.current_organization_id())
         with check (organization_id = public.current_organization_id())',
      tbl
    );
  end loop;
end
$$;

create trigger evidence_items_updated_at
  before update on public.evidence_items
  for each row execute function public.set_updated_at();
create trigger document_versions_updated_at
  before update on public.document_versions
  for each row execute function public.set_updated_at();
create trigger extractions_updated_at
  before update on public.extractions
  for each row execute function public.set_updated_at();
create trigger extracted_facts_updated_at
  before update on public.extracted_facts
  for each row execute function public.set_updated_at();
create trigger conflicts_updated_at
  before update on public.conflicts
  for each row execute function public.set_updated_at();
create trigger reconciliation_checks_updated_at
  before update on public.reconciliation_checks
  for each row execute function public.set_updated_at();
create trigger assumptions_updated_at
  before update on public.assumptions
  for each row execute function public.set_updated_at();
create trigger underwriting_risks_updated_at
  before update on public.underwriting_risks
  for each row execute function public.set_updated_at();
create trigger valuation_scenarios_updated_at
  before update on public.valuation_scenarios
  for each row execute function public.set_updated_at();
create trigger valuation_factors_updated_at
  before update on public.valuation_factors
  for each row execute function public.set_updated_at();
create trigger negotiation_positions_updated_at
  before update on public.negotiation_positions
  for each row execute function public.set_updated_at();
create trigger recommendations_updated_at
  before update on public.recommendations
  for each row execute function public.set_updated_at();
create trigger missing_items_updated_at
  before update on public.missing_items
  for each row execute function public.set_updated_at();
create trigger communication_interpretations_updated_at
  before update on public.communication_interpretations
  for each row execute function public.set_updated_at();
