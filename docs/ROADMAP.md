# Development Roadmap

Work is sequential. Every stage is a PR and acceptance gate.

## S00 — Bootstrap executable app

Goal:
- initialize current stable Next.js + TypeScript app
- local Supabase workflow/config
- CI: lint, typecheck, unit tests
- health endpoint
- public placeholder page
- `llms.txt` and `openapi.json` served from contracts
- no product logic yet

Exit: local app and CI are reproducible.

## S01 — Core database + public read/search

Goal:
- apply core migration
- seed deterministic test data
- public SSR experience/contributor/search pages
- GET API endpoints
- structured filters
- bounded cursor pagination
- literal search
- vector retrieval adapter with deterministic test path

Exit: Gate A + most of Gate D on seed data.

## S02 — Auth + durable submission workflow

Goal:
- email auth
- contributor creation/identity mapping
- private Storage bucket
- submission draft states
- idempotency
- mobile upload/text UI
- user correction/confirmation

Exit: Gate B/C/F except real AI extraction.

## S03 — Real AI extraction + embedding

Goal:
- background extraction from authorized screenshot/text
- provider adapter
- retry/failure handling
- generated embedding
- no auto-invention
- confidence/unknown handling
- moderation queue

Exit: Gate B/C/D with real configured model.

## S04 — Feedback + audit

Goal:
- experience versions/revisions
- feedback form/API
- contributor audit page
- feedback summaries without universal score
- abuse constraints

Exit: Gate E.

## S05 — Migration + deploy + external acceptance

Goal:
- import existing real Food Memory records
- production Supabase + deploy
- email deliverability configured
- crawler/robots/sitemap
- 3 external users
- two target AI read tests
- concurrency/performance report
- security/permission checklist

Exit: Gates A–G demonstrated in production/pilot environment.

## Later, not MVP

- MCP adapter
- A2A adapter
- email ingestion
- creator economics
- payments
- advanced identity proof
- native mobile app
