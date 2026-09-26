-- S00 smoke checks against the actual local Supabase PostgreSQL instance.
do $checks$
declare missing_rls text;
begin
  select string_agg(c.relname, ', ') into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing_rls is not null then
    raise exception 'RLS missing on: %', missing_rls;
  end if;

  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'pgvector extension missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'experiences_embedding_1536_hnsw_idx') then
    raise exception 'HNSW index missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'private-evidence' and public = false) then
    raise exception 'private evidence bucket missing or public';
  end if;
  if has_table_privilege('anon', 'public.submissions', 'SELECT')
    or has_table_privilege('anon', 'public.identity_links', 'SELECT')
    or has_table_privilege('anon', 'public.submission_assets', 'SELECT') then
    raise exception 'anonymous role has private-table read grant';
  end if;
  if has_function_privilege('anon', 'public.current_contributor_id()', 'EXECUTE') then
    raise exception 'anonymous role can execute identity helper';
  end if;
  if not has_column_privilege('anon', 'public.experiences', 'raw_text', 'SELECT') then
    raise exception 'anonymous role cannot read published source text';
  end if;
  if has_column_privilege('anon', 'public.experiences', 'embedding', 'SELECT')
    or has_column_privilege('anon', 'public.experiences', 'submission_id', 'SELECT')
    or has_column_privilege('anon', 'public.places', 'external_place_id', 'SELECT') then
    raise exception 'anonymous role can read internal columns';
  end if;
end
$checks$;

set role anon;
do $anon_checks$
begin
  if exists (select 1 from public.contributors where handle = 'demo_private') then
    raise exception 'private-only contributor visible to anon';
  end if;
  if exists (select 1 from public.places where name = 'Demo Unpublished Place') then
    raise exception 'unpublished place visible to anon';
  end if;
  if exists (select 1 from public.experiences where raw_text = 'PRIVATE_DRAFT_NEVER_PUBLIC') then
    raise exception 'unpublished experience visible to anon';
  end if;
end
$anon_checks$;
reset role;
