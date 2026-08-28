-- Phase 3: analyst queue, underwriting templates, evaluations,
-- integration boundary, post-close baseline, folder-path evidence.
-- Types in src/lib/types.ts match this migration 1:1.

alter type public.activity_kind add value if not exists 'evaluation_logged';
alter type public.activity_kind add value if not exists 'assignment';
alter type public.activity_kind add value if not exists 'package_export';
alter type public.activity_kind add value if not exists 'baseline_edit';

alter table public.users
  add column if not exists last_seen_at timestamptz;

alter table public.deals
  add column if not exists template_id text,
  add column if not exists external_system text,
  add column if not exists external_deal_id text,
  add column if not exists external_deal_url text,
  add column if not exists external_imported_at timestamptz,
  add column if not exists external_updated_at timestamptz;

alter table public.evidence_items
  add column if not exists folder_path text not null default '',
  add column if not exists basename text not null default '',
  add column if not exists content_hash text;

alter table public.extracted_facts
  add column if not exists assigned_by_user_id text,
  add column if not exists prepared_by_user_id text,
  add column if not exists reviewer_user_id text;

alter table public.conflicts
  add column if not exists assigned_by_user_id text,
  add column if not exists prepared_by_user_id text,
  add column if not exists reviewer_user_id text;

alter table public.missing_items
  add column if not exists assigned_user_id text,
  add column if not exists assigned_by_user_id text;

alter table public.recommendations
  add column if not exists assigned_user_id text,
  add column if not exists assigned_by_user_id text,
  add column if not exists prepared_by_user_id text,
  add column if not exists reviewer_user_id text;

create type public.template_field_status as enum (
  'missing',
  'extracted',
  'reviewed',
  'accepted',
  'conflict'
);

create type public.evaluation_action as enum (
  'accepted',
  'edited',
  'rejected'
);

create table public.underwriting_templates (
  id text primary key,
  organization_id text not null references public.organizations (id),
  key text not null,
  name text not null,
  vertical text not null,
  description text not null default ''
);

create table public.template_fields (
  id text primary key,
  organization_id text not null references public.organizations (id),
  template_id text not null references public.underwriting_templates (id),
  field_key text not null,
  label text not null,
  description text not null default '',
  sort_order int not null default 0
);

create table public.deal_template_field_values (
  id text primary key,
  organization_id text not null references public.organizations (id),
  deal_id text not null references public.deals (id),
  template_id text not null references public.underwriting_templates (id),
  field_id text not null references public.template_fields (id),
  status public.template_field_status not null default 'missing',
  notes text not null default '',
  evidence_item_ids text[] not null default '{}',
  extracted_summary text
);

create table public.evaluation_events (
  id text primary key,
  organization_id text not null references public.organizations (id),
  deal_id text not null references public.deals (id),
  entity_type text not null,
  entity_id text not null,
  document_type text,
  financial_context text,
  initial_system_output text not null,
  analyst_action public.evaluation_action not null,
  corrected_answer text,
  why_original_was_wrong text,
  controlling_source text,
  time_saved_minutes int,
  final_resolution text not null default '',
  preparer_user_id text,
  reviewer_user_id text,
  occurred_at timestamptz not null
);

create table public.change_events (
  id text primary key,
  organization_id text not null references public.organizations (id),
  deal_id text not null references public.deals (id),
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null
);

create table public.import_events (
  id text primary key,
  organization_id text not null references public.organizations (id),
  deal_id text not null references public.deals (id),
  source_system text not null,
  event_type text not null,
  external_id text,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null
);

create table public.post_close_baselines (
  id text primary key,
  organization_id text not null references public.organizations (id),
  deal_id text not null references public.deals (id),
  underwritten_revenue numeric,
  underwritten_ebitda numeric,
  accepted_adjustments_total numeric,
  expected_synergies numeric,
  retention_assumptions text not null default '',
  nwc_assumption numeric,
  purchase_price numeric,
  structure text not null default '',
  expected_first_year_performance text not null default '',
  set_by_user_id text,
  set_at timestamptz,
  notes text not null default ''
);

create index if not exists evaluation_events_deal_idx on public.evaluation_events (organization_id, deal_id);
create index if not exists change_events_deal_idx on public.change_events (organization_id, deal_id);
create index if not exists import_events_deal_idx on public.import_events (organization_id, deal_id);
create index if not exists deal_template_values_deal_idx on public.deal_template_field_values (organization_id, deal_id);
create index if not exists post_close_baselines_deal_idx on public.post_close_baselines (organization_id, deal_id);

alter table public.underwriting_templates enable row level security;
alter table public.template_fields enable row level security;
alter table public.deal_template_field_values enable row level security;
alter table public.evaluation_events enable row level security;
alter table public.change_events enable row level security;
alter table public.import_events enable row level security;
alter table public.post_close_baselines enable row level security;
