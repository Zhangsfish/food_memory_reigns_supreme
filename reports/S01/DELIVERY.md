# S01 delivery — public AI-readable pages and bounded search

## Tested implementation

Implementation commit: `2c3f8d4cf23e5ae7793ae9a6194c69f74b76a41f` (based on merged S00 `main` commit `9f4fa489c34c472eb9da45de56d5bba9ba8b5fff`). This report is a documentation-only follow-up. No S02 work was included.

S01 implements real PostgreSQL-backed public SSR pages, JSON GET endpoints, structured and literal filters, bounded cursor pagination, deterministic synthetic fixtures, an internal provider-neutral pgvector adapter, and public discovery files. All app reads use the PostgreSQL `anon` role with RLS. The vector RPC returns only published IDs/distances through fixed SQL; direct anonymous table access cannot read embeddings.

## Runtime and commands

Local environment: Windows, Node.js 24.15.0, npm 11.12.1, Next.js 16.3.6, Supabase CLI 2.118.0, Docker Engine 28.1.1, Supabase PostgreSQL 17.6 (`public.ecr.aws/supabase/postgres:17.6.1.171`). No real credentials were written to files or this report.

The following commands were actually run in the repository root after implementation changes:

| Command | Observed result |
| --- | --- |
| `npm ci` | PASS; 408 packages installed, zero audited vulnerabilities. |
| `npm run db:start` | PASS; full local Supabase stack started. |
| `npm run db:stop` | PASS; used between stack configurations. |
| `npx supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` | PASS; CI-equivalent local database/Auth/Kong/PostgREST stack started. |
| `npm run db:reset` | PASS; recreated PostgreSQL, applied `0001_core.sql` and `0002_public_read.sql`, then loaded deterministic `supabase/seed.sql`. Repeated after the final migration and seed changes. |
| `npm run db:check` | PASS; RLS, grants, HNSW extension/index, private bucket, unpublished row/contributor/place visibility, and internal column denial. |
| `npm run test:db` | PASS; 6 real database tests covering all structured filters, cursor ordering, 50-result cap, literal/adversarial retrieval, unpublished/private data, 1536-dimensional indexed and 3-dimensional pgvector paths, and filtered vector ranking. |
| `npm run test:rest` | PASS; local anonymous Supabase REST returned 15 published records, 3 public contributors, 5 public places, one public profile and one published feedback; internal columns and private tables were denied. |
| `npm run lint` | PASS. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS; 3 S00 contract tests. Six database tests are intentionally skipped without `DATABASE_URL` and run by `test:db`. |
| `npm run build` | PASS; production Next.js build includes all S01 public routes. |
| `npm run test:http` | PASS; started a real production Next.js server and checked routes, initial SSR source text, canonical URLs, privacy canaries, HTML escaping, pagination, 400/404 responses, and discovery files. |
| `npm run db:migrate` | PASS; no migrations pending after reset. |
| `npm audit --audit-level=moderate` | PASS; zero vulnerabilities. |

The GitHub Actions workflow runs the same app checks and a database job with reset, RLS checks, anonymous REST test, database tests, build, and live HTTP test. Hosted CI status: pending the PR run at report creation.

## Routes and examples

All examples refer to the local synthetic dataset. No login or plugin is required for the public routes.

| Route | Example and behavior |
| --- | --- |
| `/` | Explains the product and marks current records as synthetic. |
| `/search` | SSR search page; `/search?q=完全不油` includes original text in initial HTML. |
| `/e/[id]` | `/e/10000000-0000-4000-8000-000000000001` shows the full account, cost basis, contributor/source link, canonical URL, and synthetic warning. |
| `/u/[handle]` | `/u/demo_alice` shows public declaration and bounded linked source excerpts. |
| `/api/v1/search` | Bounded JSON list, default 10 and maximum 50. |
| `/api/v1/experiences/[id]` | One published full record; unpublished ID `...000016` returns 404. |
| `/api/v1/contributors/[idOrHandle]` | Public contributor by handle or UUID; `demo_private` returns 404. |
| `/llms.txt`, `/openapi.json` | AI discovery directs readers to bounded search and detail URLs; JSON is derived from `contracts/openapi.yaml`. |
| `/robots.txt`, `/sitemap.xml` | Permit public discovery. Sitemap lists entry points and omits synthetic detail URLs; synthetic detail/contributor pages carry `noindex`. |

### Filter examples

These are real supported requests; query values should be URL encoded by clients:

```text
/api/v1/search?contributor=demo_alice
/api/v1/search?country=US&locality=New%20York
/api/v1/search?place_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5
/api/v1/search?dish=%E9%94%85%E5%8C%85%E8%82%89
/api/v1/search?from=2026-09-20&to=2026-09-22
/api/v1/search?max_amount=30&currency=CNY&cost_basis=per_person
/api/v1/search?q=%E5%AE%8C%E5%85%A8%E4%B8%8D%E6%B2%B9
```

The final query returns the source phrase “完全不油”; a separate `q=太油了` returns its opposite. “我不喜欢甜，但这家很甜” retains both clauses. The “素粉” record says its ingredients/broth are unknown. The four-person 120 CNY bill remains `bill_total`, never a per-person cost.

### Pagination and measured response sizes

Ordering is `occurred_on DESC NULLS LAST, id DESC`. A cursor contains the last sort position and a fingerprint of the normalized filters; using it with different filters returns 400. Each request fetches at most `limit + 1` rows internally to determine `has_more` and returns no more than the requested limit. An empty search is bounded. `limit=51` returns 400.

Example: `GET /api/v1/search?limit=2` returns two records, `has_more: true`, and an opaque `next_cursor`. Request `GET /api/v1/search?limit=2&cursor=<next_cursor>` to receive the next two records. Database tests traversed all 15 published fixtures without a duplicate ID.

Measured UTF-8 body sizes from the live production server (`npm run test:http`), without HTTP headers or compression:

| JSON request | Records | Body bytes |
| --- | ---: | ---: |
| `/api/v1/search` | 10 | 6,922 |
| `/api/v1/search?limit=2` | 2 | 1,507 |
| Second page with `limit=2&cursor=...` | 2 | 1,578 |
| `/api/v1/search?limit=50` | 15 (all published seed records) | 10,166 |
| `/api/v1/experiences/10000000-0000-4000-8000-000000000001` | 1 | 1,024 |
| `/api/v1/contributors/demo_alice` | 1 | 375 |

These are 15-row fixture measurements, not 10k/100k performance evidence.

## Migration and security findings

`0002_public_read.sql` adds `is_synthetic`, a search-text refresh trigger, a stable page index, and visibility policies so a contributor or place with only unpublished records is not public. It changes the derived embedding column to variable-dimension `vector`, preserves a 1536-dimension HNSW expression index, and adds an internal bounded pgvector RPC with optional structured filters. A 1536-dimensional fixture uses the real index path under `EXPLAIN` with sequential scans disabled; a separate 3-dimensional fixture proves storage/query flexibility. At 15 rows, PostgreSQL may choose a different plan without the test setting. No live embedding model or semantic quality claim is made.

A direct anonymous Supabase REST check initially exposed `embedding`, `embedding_model`, and `submission_id` because S00 granted whole-table `SELECT`. This was a real privacy defect. S01 replaces broad grants with explicit public columns, removes anonymous access to uncurated revision snapshots, and retests via the real REST endpoint. The Next.js API additionally selects a strict response whitelist. The synthetic seed includes private draft/profile/evidence/auth/hidden-feedback canaries; none appeared in public HTTP payloads.

Public `q` performs literal, case-insensitive substring retrieval over indexed source text. It does **not** convert a natural-language preference into an embedding, infer dietary facts, or treat review text as instructions. The internal `SemanticEmbedder` interface and SQL RPC accept deterministic vectors and structured filters; S03 owns the real provider and its evaluation.

## Limitations and later stages

- There is no deployed public origin in S01. Local no-login HTTP and REST access passed; the Gate A check involving two external networked AI clients cannot be run until deployment/pilot work in S05. Do not infer compatibility with those clients from these tests.
- No 10k/100k latency, concurrency, or semantic recall benchmark was claimed from the 15-record fixture. HNSW coverage for non-1536 dimensions would require a suitable future index and measured workload.
- A configured server must provide server-only `DATABASE_URL` and canonical `SITE_URL`. S01 local scripts obtain the database URL from Supabase CLI without storing it. Production secret management/deployment belongs to S05.
- S02+ authentication UI, screenshot upload, submission, correction/confirmation, AI extraction, real embeddings, contributor feedback product flow, MCP/A2A, email ingestion, payments, Web3, production deployment, and legacy import were not implemented.

## Reproduce from a fresh clone

Install Node.js 24/npm 11 and Docker Desktop/Engine. Start Docker. Then:

```sh
git clone https://github.com/Zhangsfish/food_memory_reigns_supreme.git
cd food_memory_reigns_supreme
git switch codex/s01-public-read-search
npm ci
npm run db:start
npm run db:reset
npm run db:check
npm run test:db
npm run test:rest
npm run lint
npm run typecheck
npm test
npm run build
npm run test:http
npm run dev:local
```

Open `http://localhost:3000/search`. After checking, stop the local stack with `npm run db:stop`. Do not replace the synthetic seed with real personal data in a public test environment.
