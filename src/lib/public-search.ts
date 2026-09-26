import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { withPublicDb } from "./public-db";
import { siteUrl } from "./site-url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASIS = ["bill_total", "my_share", "per_person", "itemized", "unknown"] as const;
const FILTER_KEYS = ["q", "country", "locality", "contributor", "place_id", "dish", "from", "to", "max_amount", "currency", "cost_basis"] as const;
type FilterKey = typeof FILTER_KEYS[number];
type Filters = Partial<Record<FilterKey, string>>;

export class SearchInputError extends Error {}

export type SearchResult = {
  id: string;
  url: string;
  version: number;
  synthetic: boolean;
  occurred_on: string | null;
  contributor: { id: string; handle: string; display_name: string | null; url: string };
  place: { id: string | null; name: string; country: string | null; locality: string | null; region: string | null };
  items: string[];
  reported_cost: { amount: number; currency: string | null; basis: string | null } | null;
  excerpt: string;
  feedback_summary: { agree: number; partial: number; disagree: number };
};

type SearchRow = {
  id: string; occurred_on: string | null; contributor_id: string; handle: string;
  display_name: string | null; place_id: string | null; place_name: string;
  country: string | null; locality: string | null; region: string | null;
  items: string[]; total_amount: string | null; currency: string | null;
  cost_basis: string | null; excerpt: string; version: number; is_synthetic: boolean;
  agree: string; partial: string; disagree: string;
};

const PUBLIC_FIELDS = `
  e.id, e.occurred_on::text, e.contributor_id, c.handle, c.display_name,
  e.place_id, coalesce(p.name, e.place_name_text) as place_name,
  e.country_code as country, e.locality, e.region, e.items,
  e.total_amount::text, e.currency, e.cost_basis,
  left(e.raw_text, 1200) as excerpt, e.version, e.is_synthetic,
  (select count(*) filter (where f.description_match = 'agree')::text from public.feedback f
   where f.experience_id = e.id and f.status = 'published') as agree,
  (select count(*) filter (where f.description_match = 'partial')::text from public.feedback f
   where f.experience_id = e.id and f.status = 'published') as partial,
  (select count(*) filter (where f.description_match = 'disagree')::text from public.feedback f
   where f.experience_id = e.id and f.status = 'published') as disagree`;
const PUBLIC_FROM = `from public.experiences e
  join public.contributors c on c.id = e.contributor_id
  left join public.places p on p.id = e.place_id`;

function mapResult(row: SearchRow): SearchResult {
  return {
    id: row.id,
    url: siteUrl(`/e/${row.id}`),
    version: row.version,
    synthetic: row.is_synthetic,
    occurred_on: row.occurred_on,
    contributor: {
      id: row.contributor_id, handle: row.handle, display_name: row.display_name,
      url: siteUrl(`/u/${encodeURIComponent(row.handle)}`),
    },
    place: {
      id: row.place_id, name: row.place_name, country: row.country?.trim() ?? null,
      locality: row.locality, region: row.region,
    },
    items: row.items,
    reported_cost: row.total_amount === null ? null : {
      amount: Number(row.total_amount), currency: row.currency?.trim() ?? null, basis: row.cost_basis,
    },
    excerpt: row.excerpt,
    feedback_summary: { agree: Number(row.agree), partial: Number(row.partial), disagree: Number(row.disagree) },
  };
}

function isoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parseSearch(params: URLSearchParams): { filters: Filters; limit: number; cursor: string | null } {
  const allowed = new Set<string>([...FILTER_KEYS, "limit", "cursor"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new SearchInputError(`Invalid parameter: ${key}`);
  }
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  if (filters.q && filters.q.length > 500) throw new SearchInputError("q exceeds 500 characters");
  for (const key of ["locality", "contributor", "dish"] as const) {
    const max = key === "dish" ? 200 : key === "locality" ? 120 : 80;
    if (filters[key] && filters[key].length > max) throw new SearchInputError(`${key} is too long`);
  }
  if (filters.country && !/^[A-Za-z]{2}$/.test(filters.country)) throw new SearchInputError("country must be two letters");
  if (filters.currency && !/^[A-Za-z]{3}$/.test(filters.currency)) throw new SearchInputError("currency must be three letters");
  if (filters.place_id && !UUID.test(filters.place_id)) throw new SearchInputError("place_id must be a UUID");
  if (filters.cost_basis && !BASIS.includes(filters.cost_basis as typeof BASIS[number])) throw new SearchInputError("Invalid cost_basis");
  for (const key of ["from", "to"] as const) {
    if (filters[key] && !isoDate(filters[key])) throw new SearchInputError(`${key} must be a valid ISO date`);
  }
  if (filters.from && filters.to && filters.from > filters.to) throw new SearchInputError("from must not exceed to");
  if (filters.max_amount && (filters.max_amount.length > 64
    || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(filters.max_amount)
    || !Number.isFinite(Number(filters.max_amount)))) {
    throw new SearchInputError("max_amount must be a nonnegative amount");
  }
  if (filters.country) filters.country = filters.country.toUpperCase();
  if (filters.currency) filters.currency = filters.currency.toUpperCase();
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 10 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new SearchInputError("limit must be between 1 and 50");
  return { filters, limit, cursor: params.get("cursor") };
}

function fingerprint(filters: Filters): string {
  return createHash("sha256").update(JSON.stringify(filters)).digest("hex").slice(0, 24);
}

function decodeCursor(raw: string | null, filters: Filters): { date: string; id: string } | null {
  if (!raw) return null;
  if (raw.length > 500 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new SearchInputError("Invalid cursor");
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!value || typeof value !== "object") throw new Error();
    const cursor = value as Record<string, unknown>;
    if (cursor.v !== 1 || cursor.f !== fingerprint(filters) || typeof cursor.d !== "string" || !isoDate(cursor.d)
      || typeof cursor.i !== "string" || !UUID.test(cursor.i)) throw new Error();
    return { date: cursor.d, id: cursor.i };
  } catch {
    throw new SearchInputError("Invalid or mismatched cursor");
  }
}

function encodeCursor(row: SearchRow, filters: Filters): string {
  return Buffer.from(JSON.stringify({ v: 1, d: row.occurred_on ?? "0001-01-01", i: row.id, f: fingerprint(filters) })).toString("base64url");
}

function literalPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function searchPublic(params: URLSearchParams): Promise<{ results: SearchResult[]; next_cursor: string | null; has_more: boolean }> {
  const { filters, limit, cursor } = parseSearch(params);
  const position = decodeCursor(cursor, filters);
  return withPublicDb(async (client) => {
    const values: unknown[] = [];
    const where: string[] = ["e.moderation_status = 'published'"];
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (filters.q) where.push(`e.search_text ilike ${bind(literalPattern(filters.q))}`);
    if (filters.country) where.push(`e.country_code = ${bind(filters.country)}`);
    if (filters.locality) where.push(`e.locality = ${bind(filters.locality)}`);
    if (filters.contributor) where.push(UUID.test(filters.contributor)
      ? `c.id = ${bind(filters.contributor)}::uuid` : `c.handle = ${bind(filters.contributor)}`);
    if (filters.place_id) where.push(`e.place_id = ${bind(filters.place_id)}::uuid`);
    if (filters.dish) where.push(`e.items @> jsonb_build_array(${bind(filters.dish)}::text)`);
    if (filters.from) where.push(`e.occurred_on >= ${bind(filters.from)}::date`);
    if (filters.to) where.push(`e.occurred_on <= ${bind(filters.to)}::date`);
    if (filters.max_amount) where.push(`e.total_amount <= ${bind(filters.max_amount)}::numeric`);
    if (filters.currency) where.push(`e.currency = ${bind(filters.currency)}`);
    if (filters.cost_basis) where.push(`e.cost_basis = ${bind(filters.cost_basis)}`);
    if (position) where.push(`(coalesce(e.occurred_on, date '0001-01-01'), e.id) < (${bind(position.date)}::date, ${bind(position.id)}::uuid)`);
    const pageSize = bind(limit + 1);
    const sql = `select ${PUBLIC_FIELDS} ${PUBLIC_FROM} where ${where.join(" and ")}
      order by e.occurred_on desc nulls last, e.id desc limit ${pageSize}`;
    const { rows } = await client.query<SearchRow>(sql, values);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { results: page.map(mapResult), next_cursor: hasMore ? encodeCursor(page[page.length - 1], filters) : null, has_more: hasMore };
  });
}

export async function getPublicExperience(id: string) {
  if (!UUID.test(id)) return null;
  return withPublicDb(async (client) => {
    const { rows } = await client.query<SearchRow & { raw_text: string }>(
      `select ${PUBLIC_FIELDS}, e.raw_text ${PUBLIC_FROM}
       where e.id = $1::uuid and e.moderation_status = 'published'`, [id]);
    const row = rows[0];
    if (!row) return null;
    const profiles = await publicProfiles(client, row.contributor_id);
    return {
      ...mapResult(row), raw_text: row.raw_text, profile_declarations: profiles,
      revisions_url: siteUrl(`/e/${row.id}#revisions`), feedback_url: siteUrl(`/e/${row.id}#feedback`),
    };
  });
}

async function publicProfiles(client: PoolClient, contributorId: string) {
  const { rows } = await client.query<{ raw_text: string; as_of: string | null }>(
    `select raw_text, as_of::text from public.profile_declarations
     where contributor_id = $1::uuid and visibility = 'public' order by created_at desc, id desc limit 50`, [contributorId]);
  return rows;
}

export async function getPublicContributor(idOrHandle: string) {
  if (idOrHandle.length > 80) return null;
  return withPublicDb(async (client) => {
    const id = UUID.test(idOrHandle);
    const { rows } = await client.query<{ id: string; handle: string; display_name: string | null; bio: string | null }>(
      `select id, handle, display_name, bio from public.contributors
       where ${id ? "id = $1::uuid" : "handle = $1"} limit 1`, [idOrHandle]);
    const contributor = rows[0];
    if (!contributor) return null;
    const profiles = await publicProfiles(client, contributor.id);
    const feedback = await client.query<{ agree: string; partial: string; disagree: string }>(
      `select count(*) filter (where f.description_match='agree')::text as agree,
              count(*) filter (where f.description_match='partial')::text as partial,
              count(*) filter (where f.description_match='disagree')::text as disagree
       from public.feedback f join public.experiences e on e.id=f.experience_id
       where e.contributor_id=$1::uuid and e.moderation_status='published' and f.status='published'`, [contributor.id]);
    const counts = feedback.rows[0];
    return {
      ...contributor, profile_declarations: profiles,
      experiences_url: siteUrl(`/api/v1/search?contributor=${encodeURIComponent(contributor.handle)}`),
      feedback_summary: { agree: Number(counts.agree), partial: Number(counts.partial), disagree: Number(counts.disagree) },
    };
  });
}
