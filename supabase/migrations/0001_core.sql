-- Food Memory MVP core schema
-- Stage: foundation. Codex must run this against local Supabase and fix any incompatibility
-- before calling S01 complete.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector with schema extensions;

do $$ begin
  create type public.submission_status as enum (
    'received',
    'processing',
    'needs_confirmation',
    'confirmed',
    'pending_review',
    'published',
    'failed',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.profile_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.feedback_match as enum ('agree', 'partial', 'disagree', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.taste_outcome as enum ('liked', 'neutral', 'disliked', 'not_consumed', 'unknown');
exception when duplicate_object then null;
end $$;

create table if not exists public.contributors (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (handle ~ '^[A-Za-z0-9_-]{3,40}$'),
  display_name text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.identity_links (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  external_subject text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, external_subject),
  unique(auth_user_id)
);

create table if not exists public.profile_declarations (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  raw_text text not null check (char_length(raw_text) between 1 and 5000),
  visibility public.profile_visibility not null default 'private',
  as_of date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2),
  locality text,
  region text,
  branch_hint text,
  external_provider text,
  external_place_id text,
  created_at timestamptz not null default now(),
  unique(external_provider, external_place_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  idempotency_key text not null,
  status public.submission_status not null default 'received',
  raw_text text not null default '',
  draft jsonb not null default '{}'::jsonb,
  ai_metadata jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  revision integer not null default 1 check (revision > 0),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contributor_id, idempotency_key)
);

create table if not exists public.submission_assets (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  storage_bucket text not null default 'private-evidence',
  storage_path text not null,
  mime_type text,
  sha256 text,
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete restrict,
  submission_id uuid unique references public.submissions(id) on delete set null,
  place_id uuid references public.places(id) on delete set null,

  occurred_on date,
  occurred_precision text not null default 'unknown'
    check (occurred_precision in ('day', 'month', 'year', 'unknown')),

  place_name_text text not null,
  country_code char(2),
  locality text,
  region text,
  branch_hint text,

  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2),
  currency char(3),
  cost_basis text check (
    cost_basis is null or cost_basis in ('bill_total', 'my_share', 'per_person', 'itemized', 'unknown')
  ),

  raw_text text not null check (char_length(raw_text) between 1 and 20000),
  search_text text not null default '',
  version integer not null default 1 check (version > 0),
  moderation_status text not null default 'pending_review'
    check (moderation_status in ('pending_review', 'published', 'rejected', 'withdrawn')),

  embedding extensions.vector(1536),
  embedding_model text,
  embedding_generated_at timestamptz,

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experience_revisions (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  version integer not null check (version > 0),
  actor_contributor_id uuid references public.contributors(id) on delete set null,
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  primary key (experience_id, version)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  experience_version integer not null check (experience_version > 0),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  description_match public.feedback_match not null default 'unknown',
  taste_outcome public.taste_outcome not null default 'unknown',
  comment text not null default '' check (char_length(comment) <= 5000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(experience_id, contributor_id)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_contributor_id uuid references public.contributors(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Structured retrieval indexes.
create index if not exists experiences_public_locality_idx
  on public.experiences (country_code, locality, occurred_on desc)
  where moderation_status = 'published';

create index if not exists experiences_public_contributor_idx
  on public.experiences (contributor_id, occurred_on desc)
  where moderation_status = 'published';

create index if not exists experiences_public_place_idx
  on public.experiences (place_id, occurred_on desc)
  where moderation_status = 'published';

create index if not exists experiences_items_gin_idx
  on public.experiences using gin (items jsonb_path_ops);

create index if not exists experiences_search_trgm_idx
  on public.experiences using gin (search_text gin_trgm_ops);

-- Derived semantic retrieval index. Safe to rebuild because embeddings are derived.
create index if not exists experiences_embedding_hnsw_idx
  on public.experiences
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null and moderation_status = 'published';

create index if not exists feedback_experience_idx
  on public.feedback (experience_id, created_at desc)
  where status = 'published';

create index if not exists profile_public_contributor_idx
  on public.profile_declarations (contributor_id, created_at desc)
  where visibility = 'public';

-- RLS: all exposed tables must have policies.
alter table public.contributors enable row level security;
alter table public.identity_links enable row level security;
alter table public.profile_declarations enable row level security;
alter table public.places enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_assets enable row level security;
alter table public.experiences enable row level security;
alter table public.experience_revisions enable row level security;
alter table public.feedback enable row level security;
alter table public.audit_events enable row level security;

-- Remove broad default privileges; add only what MVP needs.
revoke all on public.identity_links from anon, authenticated;
revoke all on public.submissions from anon;
revoke all on public.submission_assets from anon;
revoke all on public.audit_events from anon, authenticated;

grant select on public.contributors to anon, authenticated;
grant select on public.places to anon, authenticated;
grant select on public.experiences to anon, authenticated;
grant select on public.experience_revisions to anon, authenticated;
grant select on public.feedback to anon, authenticated;
grant select on public.profile_declarations to anon, authenticated;

grant select, insert, update on public.submissions to authenticated;
grant select, insert, update, delete on public.submission_assets to authenticated;
grant select, insert, update on public.profile_declarations to authenticated;
grant select, insert, update on public.feedback to authenticated;

-- Helper: map current auth user -> contributor.
create or replace function public.current_contributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select contributor_id
  from public.identity_links
  where auth_user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_contributor_id() from public;
grant execute on function public.current_contributor_id() to authenticated;

-- Public read policies.
create policy "public contributors readable"
on public.contributors for select
to anon, authenticated
using (true);

create policy "public places readable"
on public.places for select
to anon, authenticated
using (true);

create policy "published experiences readable"
on public.experiences for select
to anon, authenticated
using (moderation_status = 'published');

create policy "published revisions readable"
on public.experience_revisions for select
to anon, authenticated
using (
  exists (
    select 1 from public.experiences e
    where e.id = experience_id and e.moderation_status = 'published'
  )
);

create policy "published feedback readable"
on public.feedback for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.experiences e
    where e.id = experience_id and e.moderation_status = 'published'
  )
);

create policy "public profile declarations readable"
on public.profile_declarations for select
to anon, authenticated
using (visibility = 'public');

-- Owner-scoped private/write policies.
create policy "own submissions readable"
on public.submissions for select
to authenticated
using (contributor_id = public.current_contributor_id());

create policy "own submissions insertable"
on public.submissions for insert
to authenticated
with check (contributor_id = public.current_contributor_id());

create policy "own submissions updateable"
on public.submissions for update
to authenticated
using (contributor_id = public.current_contributor_id())
with check (contributor_id = public.current_contributor_id());

create policy "own profile declarations manageable"
on public.profile_declarations for all
to authenticated
using (contributor_id = public.current_contributor_id())
with check (contributor_id = public.current_contributor_id());

create policy "own submission assets readable"
on public.submission_assets for select
to authenticated
using (contributor_id = public.current_contributor_id());

create policy "own submission assets insertable"
on public.submission_assets for insert
to authenticated
with check (contributor_id = public.current_contributor_id());

create policy "own submission assets updateable"
on public.submission_assets for update
to authenticated
using (contributor_id = public.current_contributor_id())
with check (contributor_id = public.current_contributor_id());

create policy "own submission assets deletable"
on public.submission_assets for delete
to authenticated
using (contributor_id = public.current_contributor_id());

create policy "feedback author can insert"
on public.feedback for insert
to authenticated
with check (
  contributor_id = public.current_contributor_id()
  and not exists (
    select 1 from public.experiences e
    where e.id = experience_id
      and e.contributor_id = public.current_contributor_id()
  )
);

create policy "feedback author can update"
on public.feedback for update
to authenticated
using (contributor_id = public.current_contributor_id())
with check (contributor_id = public.current_contributor_id());

-- Private Storage bucket. Object-level policies are finalized/tested in S02.
insert into storage.buckets (id, name, public)
values ('private-evidence', 'private-evidence', false)
on conflict (id) do nothing;

-- NOTE:
-- 1) Service/worker writes to experiences, revisions, audit_events are server-side.
-- 2) S01/S02 must run supabase db tests for grants and RLS before production.
-- 3) Search RPC is implemented/tested in S01 so filtering + vector semantics are validated
--    against the actual local pgvector version.
