# S00 delivery — executable Food Memory foundation

## Scope completed

- Added a Next.js 16 App Router application with strict TypeScript, npm lockfile, ESLint, Vitest, and a minimal public page.
- Added `/api/health`, `/llms.txt`, and `/openapi.json`. The latter parses `contracts/openapi.yaml` on request; the YAML remains the only API contract source. The AI discovery text checks its source README/product contract before serving.
- Initialized the standard Supabase local configuration and added start, reset, migration, status, and database-check scripts.
- Added GitHub Actions jobs for app checks and local database migration validation.

## Exact tested implementation commit

`e19f6fc9ce32c32d758f1895aa78f4117ce2ac50`

This report is a documentation-only follow-up to that tested code commit. GitHub Actions results for the PR are recorded below after the push.

## Tool/runtime versions

| Tool | Tested version |
| --- | --- |
| Node.js | 24.15.0 |
| npm | 11.12.1 |
| Next.js | 16.3.6 |
| Supabase CLI | 2.118.0 |
| PostgreSQL | 17.6, local Supabase image `public.ecr.aws/supabase/postgres:17.6.1.171` |
| Docker Engine | 28.1.1 |

Environment: Windows with Docker Desktop Linux engine. The CI workflow targets GitHub `ubuntu-latest` and Node 24.

## Exact commands and observed results

The following commands ran in the repository root. `npm ci` was run after dependency versions and lockfile were finalized.

| Command | Result |
| --- | --- |
| `npm install --save-exact next@16.3.6 react@19.2.4 react-dom@19.2.4 yaml@2.8.2` | PASS; initial application dependencies installed. |
| `npm install --save-dev --save-exact typescript@6.0.3 @types/node@24.13.6 @types/react@19 @types/react-dom@19 eslint@9 eslint-config-next@16.3.6 vitest@4.0.16 supabase@2.118.0` | PASS; initial development dependencies installed. |
| `npx supabase init --force` | PASS; generated `supabase/config.toml` and Supabase ignore rules. Seed loading was disabled because S00 contains no seed file. |
| `npm install --save-exact yaml@2.9.1` and `npm install --save-dev --save-exact vitest@4.1.11` | PASS; removed three reported dependency vulnerabilities. |
| `npm ci` | PASS after stopping the running Next.js server; first attempt failed with Windows `EPERM` because the server held the SWC binary open. Final install added 393 packages, audit found zero vulnerabilities. |
| `npm run lint` | PASS. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS; 3 tests: deterministic health response, plain-text AI discovery boundaries, and YAML/OpenAPI JSON equivalence. |
| `npm run build` | PASS; Next.js compiled and generated `/`, `/api/health`, `/llms.txt`, `/openapi.json`. |
| `npm audit --audit-level=moderate` | PASS; zero vulnerabilities. |
| `npm run db:start` | PASS after initial image pulls and transient public registry rate limiting; applied `0001_core.sql` to local Supabase. |
| `npm run db:reset` | PASS; clean database recreation and migration apply. Repeated after the permission fix. |
| `npm run db:check` | PASS; checks RLS on every public table, vector extension/HNSW index, private evidence bucket, and key grants. |
| `npm run db:migrate` | PASS; reported no pending migrations after reset. |
| `npm run db:stop` | PASS. |
| `npx supabase start -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` | PASS; database-only mode matching CI. |
| `npm run db:reset` followed by `npm run db:check` in database-only mode | PASS; proves the CI database job's command sequence locally. |
| `docker exec supabase_db_food_memory_reigns_supreme psql -U postgres -d postgres -Atc 'show server_version;'` | PASS; returned `17.6`. |

## Real HTTP route verification

After `npm run build`, ran `npm run start -- -p 3100`, then used `Invoke-WebRequest` against the live production server:

| Route | HTTP | Evidence |
| --- | --- | --- |
| `/` | 200 | HTML contained `Food Memory`. |
| `/api/health` | 200 | `{"ok":true,"service":"food-memory","version":"0.1.0"}`. |
| `/llms.txt` | 200 | `text/plain; charset=utf-8`; contained project name and AI-read boundary text. |
| `/openapi.json` | 200 | `application/json`; parsed OpenAPI `3.1.0`. Unit test also compared its JSON to parsed source YAML. |

## Migration change and reason

The initial migration applied successfully, but the database smoke test found that `anon` could execute `public.current_contributor_id()`. The migration revoked `PUBLIC` execution, yet Supabase's default function privileges also granted `anon` directly. The smallest correction adds `anon` to that `REVOKE`. After the change, a clean reset and the privilege check passed in full and database-only local Supabase. No domain table or vector schema redesign was needed.

## Known limitations and S01+ boundary

- CI status: pending until the PR workflow completes; local equivalents passed. The database CI job uses Docker on the hosted runner, so registry availability remains an external dependency.
- Docker image downloads initially hit a public registry rate limit, then succeeded automatically. A fresh machine may need to retry after such throttling.
- These checks establish a schema and representative permissions; they are not the full S01/S02 RLS, policy, or product acceptance tests.
- No authentication UI, screenshot upload, submission flow, AI extraction, embeddings generation, semantic search, contributor/feedback product UI, MCP, A2A, email ingestion, payments, Web3, production deployment, or legacy migration was implemented. Those belong to S01+ or later stages.

## Reproduce from a fresh clone

Install Node.js 24/npm 11 and Docker Desktop/Engine, and start Docker. Then run:

```sh
git clone https://github.com/Zhangsfish/food_memory_reigns_supreme.git
cd food_memory_reigns_supreme
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Open `http://localhost:3000/`, `/api/health`, `/llms.txt`, and `/openapi.json`. In another terminal, validate the local database:

```sh
npm run db:start
npm run db:reset
npm run db:check
npm run db:migrate
npm run db:stop
```

No `.env.local` or cloud credentials are required for S00. The CLI prints local development credentials; keep them out of commits and reports.
