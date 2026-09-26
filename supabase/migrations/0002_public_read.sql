-- S01: explicit synthetic provenance, indexed literal retrieval, and a provider-neutral vector slot.
alter table public.experiences add column is_synthetic boolean not null default false;

create or replace function public.refresh_experience_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := concat_ws(' ', new.raw_text, new.place_name_text,
    (select string_agg(value, ' ') from jsonb_array_elements_text(new.items) as item(value)));
  return new;
end
$$;

create trigger experiences_search_text_refresh
before insert or update of raw_text, place_name_text, items on public.experiences
for each row execute function public.refresh_experience_search_text();

update public.experiences set raw_text = raw_text;

create index experiences_public_page_idx
  on public.experiences (occurred_on desc nulls last, id desc)
  where moderation_status = 'published';

-- A registered contributor or unresolved place is not public merely because its row exists.
drop policy "public contributors readable" on public.contributors;
create policy "contributors with published experiences readable"
on public.contributors for select to anon, authenticated
using (exists (
  select 1 from public.experiences e
  where e.contributor_id = contributors.id and e.moderation_status = 'published'
));

drop policy "public places readable" on public.places;
create policy "places with published experiences readable"
on public.places for select to anon, authenticated
using (exists (
  select 1 from public.experiences e
  where e.place_id = places.id and e.moderation_status = 'published'
));

-- Derived embeddings may have different model dimensions. Keep a 1536-dimension HNSW
-- expression index for the existing path; other dimensions remain storable/queryable.
drop index public.experiences_embedding_hnsw_idx;
alter table public.experiences alter column embedding type extensions.vector
  using embedding::extensions.vector;
create index experiences_embedding_1536_hnsw_idx
  on public.experiences using hnsw
  ((embedding::extensions.vector(1536)) extensions.vector_cosine_ops)
  where embedding is not null and moderation_status = 'published'
    and extensions.vector_dims(embedding) = 1536;

-- This is an internal database boundary. Public q remains literal until S03 supplies
-- real embeddings. The function exposes only published IDs/distances.
create function public.search_public_embeddings(
  query_embedding extensions.vector,
  query_model text,
  result_limit integer default 10,
  filter_country text default null,
  filter_locality text default null,
  filter_contributor uuid default null,
  filter_place uuid default null,
  filter_from date default null,
  filter_to date default null,
  filter_dish text default null,
  filter_max_amount numeric default null,
  filter_currency text default null,
  filter_cost_basis text default null
)
returns table (experience_id uuid, distance double precision)
language plpgsql stable security definer
set search_path = pg_catalog, extensions
as $$
begin
  if query_embedding is null or query_model is null then
    return;
  end if;
  if extensions.vector_dims(query_embedding) = 1536 then
    return query
      select e.id, (e.embedding::extensions.vector(1536) <=> query_embedding::extensions.vector(1536))::double precision
      from public.experiences e
      where e.moderation_status = 'published' and e.embedding is not null
        and e.embedding_model = query_model and extensions.vector_dims(e.embedding) = 1536
        and (filter_country is null or e.country_code = filter_country)
        and (filter_locality is null or e.locality = filter_locality)
        and (filter_contributor is null or e.contributor_id = filter_contributor)
        and (filter_place is null or e.place_id = filter_place)
        and (filter_from is null or e.occurred_on >= filter_from)
        and (filter_to is null or e.occurred_on <= filter_to)
        and (filter_dish is null or e.items @> jsonb_build_array(filter_dish))
        and (filter_max_amount is null or e.total_amount <= filter_max_amount)
        and (filter_currency is null or e.currency = filter_currency)
        and (filter_cost_basis is null or e.cost_basis = filter_cost_basis)
      order by e.embedding::extensions.vector(1536) <=> query_embedding::extensions.vector(1536), e.id
      limit least(greatest(coalesce(result_limit, 10), 1), 50);
  else
    return query
      select e.id, (e.embedding <=> query_embedding)::double precision
      from public.experiences e
      where e.moderation_status = 'published' and e.embedding is not null
        and e.embedding_model = query_model
        and extensions.vector_dims(e.embedding) = extensions.vector_dims(query_embedding)
        and (filter_country is null or e.country_code = filter_country)
        and (filter_locality is null or e.locality = filter_locality)
        and (filter_contributor is null or e.contributor_id = filter_contributor)
        and (filter_place is null or e.place_id = filter_place)
        and (filter_from is null or e.occurred_on >= filter_from)
        and (filter_to is null or e.occurred_on <= filter_to)
        and (filter_dish is null or e.items @> jsonb_build_array(filter_dish))
        and (filter_max_amount is null or e.total_amount <= filter_max_amount)
        and (filter_currency is null or e.currency = filter_currency)
        and (filter_cost_basis is null or e.cost_basis = filter_cost_basis)
      order by e.embedding <=> query_embedding, e.id
      limit least(greatest(coalesce(result_limit, 10), 1), 50);
  end if;
end
$$;

-- The RPC returns only published IDs/distances. Its fixed SQL predicates are needed
-- because anonymous table reads below must not include the embedding column.
-- Never return a vector or use caller-controlled dynamic SQL here.
revoke all on function public.refresh_experience_search_text() from public, anon, authenticated;
revoke all on function public.search_public_embeddings(extensions.vector, text, integer, text, text, uuid, uuid, date, date, text, numeric, text, text) from public;
grant execute on function public.search_public_embeddings(extensions.vector, text, integer, text, text, uuid, uuid, date, date, text, numeric, text, text) to anon, authenticated;

-- Supabase exposes the public schema through PostgREST. Table-wide SELECT would
-- expose submission_id, internal search/embedding fields, and external place IDs
-- through select=*, even if the Next.js API returns a safe whitelist.
revoke all on public.experiences from anon, authenticated;
grant select (
  id, contributor_id, place_id, occurred_on, occurred_precision, place_name_text,
  country_code, locality, region, branch_hint, items, total_amount, currency,
  cost_basis, raw_text, search_text, version, moderation_status, published_at,
  is_synthetic
) on public.experiences to anon, authenticated;

revoke all on public.contributors from anon, authenticated;
grant select (id, handle, display_name, bio) on public.contributors to anon, authenticated;

revoke all on public.places from anon, authenticated;
grant select (id, name, country_code, locality, region, branch_hint)
  on public.places to anon, authenticated;

revoke all on public.profile_declarations from anon, authenticated;
grant select (id, contributor_id, raw_text, visibility, as_of, created_at)
  on public.profile_declarations to anon, authenticated;
grant insert, update on public.profile_declarations to authenticated;

-- Revision snapshots are not yet curated for publication; S04 will define a
-- safe read surface when revision and feedback product flows are implemented.
revoke all on public.experience_revisions from anon, authenticated;
