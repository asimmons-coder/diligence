-- Diligence multi-tenant schema
-- Organization-scoped from day one. RLS isolates every table by organization_id.
-- Industry-specific fields live on deals.vertical + deals.vertical_metrics (jsonb),
-- not as first-class columns.

create extension if not exists pgcrypto;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.deal_stage as enum (
  'target',
  'contacted',
  'nda',
  'initial_data',
  'financial_review',
  'diligence',
  'loi',
  'confirmatory_diligence',
  'closing',
  'closed',
  'passed'
);

create type public.deal_source as enum (
  'banker',
  'proprietary',
  'conference',
  'counsel_intro'
);

create type public.vertical as enum (
  'legal',
  'accounting',
  'wealth',
  'insurance',
  'hvac',
  'dental',
  'veterinary',
  'restoration',
  'other'
);

create type public.user_role as enum (
  'deal_lead',
  'financial_diligence',
  'vp_diligence',
  'managing_partner',
  'associate'
);

create type public.period_type as enum (
  'fiscal_year',
  'ttm',
  'stub'
);

create type public.adjustment_category as enum (
  'compensation',
  'one_time',
  'occupancy',
  'revenue',
  'working_capital',
  'synergy',
  'other'
);

create type public.adjustment_status as enum (
  'proposed',
  'accepted',
  'rejected'
);

create type public.adjustment_origin as enum (
  'ai',
  'manual'
);

create type public.claim_kind as enum (
  'source_fact',
  'approved_assumption',
  'ai_inference'
);

create type public.document_folder as enum (
  'financials',
  'tax',
  'payroll',
  'attorney_production',
  'client_matter',
  'legal',
  'real_estate',
  'corporate',
  'other'
);

create type public.document_status as enum (
  'uploading',
  'processing',
  'analyzed',
  'needs_review',
  'failed'
);

create type public.diligence_category as enum (
  'financial',
  'revenue_clients',
  'employees_attorneys',
  'compensation',
  'legal',
  'tax',
  'real_estate',
  'technology',
  'operations',
  'other'
);

create type public.diligence_status as enum (
  'not_requested',
  'requested',
  'received',
  'under_review',
  'follow_up_required',
  'complete',
  'na'
);

create type public.diligence_priority as enum (
  'critical',
  'high',
  'medium',
  'low'
);

create type public.finding_status as enum (
  'open',
  'accepted',
  'dismissed',
  'resolved'
);

create type public.activity_kind as enum (
  'note',
  'document_upload',
  'document_status',
  'stage_change',
  'adjustment_status',
  'diligence_status',
  'finding_action',
  'task_complete',
  'task_created',
  'system'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  vertical_focus public.vertical not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null,
  title text not null,
  initials text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  location_city text not null,
  location_state text not null,
  owner_user_id uuid not null references public.users(id),
  source public.deal_source not null,
  source_detail text,
  stage public.deal_stage not null default 'target',
  stage_entered_at date not null,
  asking_price numeric(14, 2),
  expected_purchase_price numeric(14, 2),
  probability numeric(5, 4) not null default 0,
  vertical public.vertical not null default 'other',
  vertical_metrics jsonb not null default '{}'::jsonb,
  flags text[] not null default '{}',
  summary text not null default '',
  ai_assessment text not null default '',
  attention_items text[] not null default '{}',
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  title text not null,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  label text not null,
  period_type public.period_type not null,
  start_date date not null,
  end_date date not null,
  is_latest boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  period_id uuid not null references public.financial_periods(id) on delete cascade,
  metric_key text not null,
  amount numeric(16, 4) not null,
  source_document_id uuid,
  section text,
  page integer,
  extracted_value text,
  confidence numeric(4, 3),
  approval_status public.claim_kind not null default 'source_fact',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, metric_key)
);

create table public.ebitda_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  period_id uuid not null references public.financial_periods(id) on delete cascade,
  category public.adjustment_category not null,
  description text not null,
  amount numeric(14, 2) not null,
  source text not null,
  origin public.adjustment_origin not null,
  confidence numeric(4, 3),
  status public.adjustment_status not null default 'proposed',
  user_notes text not null default '',
  source_document_id uuid,
  section text,
  page integer,
  extracted_value text,
  approval_status public.claim_kind not null default 'ai_inference',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  filename text not null,
  folder public.document_folder not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.users(id),
  processing_status public.document_status not null default 'uploading',
  classification text,
  extracted_payload jsonb,
  confidence numeric(4, 3),
  linked_request_ids uuid[] not null default '{}',
  page_count integer,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_metrics
  add constraint financial_metrics_source_document_fk
  foreign key (source_document_id) references public.documents(id) on delete set null;

alter table public.ebitda_adjustments
  add constraint ebitda_adjustments_source_document_fk
  foreign key (source_document_id) references public.documents(id) on delete set null;

create table public.diligence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  category public.diligence_category not null,
  question text not null,
  status public.diligence_status not null default 'not_requested',
  owner_user_id uuid references public.users(id),
  counterparty_owner text,
  due_date date,
  supporting_document_ids uuid[] not null default '{}',
  notes text not null default '',
  ai_generated boolean not null default false,
  priority public.diligence_priority not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  question text not null,
  status public.finding_status not null default 'open',
  source_document_ids uuid[] not null default '{}',
  linked_request_id uuid references public.diligence_requests(id) on delete set null,
  assigned_user_id uuid references public.users(id),
  edited_question text,
  source_document_id uuid references public.documents(id) on delete set null,
  section text,
  page integer,
  extracted_value text,
  confidence numeric(4, 3),
  approval_status public.claim_kind not null default 'ai_inference',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  owner_user_id uuid not null references public.users(id),
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  kind public.activity_kind not null,
  title text not null,
  body text not null default '',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before jsonb,
  after jsonb,
  occurred_at timestamptz not null default now()
);

create index deals_org_stage_idx on public.deals (organization_id, stage);
create index deals_org_owner_idx on public.deals (organization_id, owner_user_id);
create index contacts_deal_idx on public.contacts (deal_id);
create index financial_periods_deal_idx on public.financial_periods (deal_id, sort_order);
create index financial_metrics_period_idx on public.financial_metrics (period_id);
create index ebitda_adjustments_deal_idx on public.ebitda_adjustments (deal_id, status);
create index documents_deal_idx on public.documents (deal_id, folder);
create index diligence_requests_deal_idx on public.diligence_requests (deal_id, status);
create index ai_findings_deal_idx on public.ai_findings (deal_id, status);
create index tasks_deal_idx on public.tasks (deal_id, completed);
create index activities_deal_idx on public.activities (deal_id, occurred_at desc);
create index audit_events_org_idx on public.audit_events (organization_id, occurred_at desc);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organizations',
    'users',
    'deals',
    'contacts',
    'financial_periods',
    'financial_metrics',
    'ebitda_adjustments',
    'documents',
    'diligence_requests',
    'ai_findings',
    'tasks',
    'notes',
    'activities',
    'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    if tbl = 'organizations' then
      execute format(
        'create policy org_isolation on public.%I
           for all
           using (id = public.current_organization_id())
           with check (id = public.current_organization_id())',
        tbl
      );
    else
      execute format(
        'create policy org_isolation on public.%I
           for all
           using (organization_id = public.current_organization_id())
           with check (organization_id = public.current_organization_id())',
        tbl
      );
    end if;
  end loop;
end
$$;

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger financial_periods_updated_at
  before update on public.financial_periods
  for each row execute function public.set_updated_at();

create trigger financial_metrics_updated_at
  before update on public.financial_metrics
  for each row execute function public.set_updated_at();

create trigger ebitda_adjustments_updated_at
  before update on public.ebitda_adjustments
  for each row execute function public.set_updated_at();

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger diligence_requests_updated_at
  before update on public.diligence_requests
  for each row execute function public.set_updated_at();

create trigger ai_findings_updated_at
  before update on public.ai_findings
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();
