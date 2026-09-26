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
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'experiences_embedding_hnsw_idx') then
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
  if not has_table_privilege('anon', 'public.experiences', 'SELECT') then
    raise exception 'anonymous role cannot read published experience table';
  end if;
end
$checks$;
