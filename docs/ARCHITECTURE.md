# Architecture — MVP v0.1

## Decision

Use one web application and one managed backend:

- **Next.js** — server-rendered public pages, mobile submission UI, HTTP API
- **Supabase Postgres** — canonical relational data
- **Supabase Auth** — email OTP/magic link
- **Supabase Storage** — private uploaded evidence
- **pgvector** — semantic embedding index
- **background worker/queue** — extraction + embedding jobs

Do not introduce separate search clusters, Kafka, Kubernetes, blockchain, or microservices in MVP.

## Request paths

### Public read

```text
AI / browser
  -> public HTML or GET /api/v1/*
  -> structured filters
  -> optional semantic ranking
  -> compact result set
  -> full detail URL
```

### Human submit

```text
signed-in user
  -> POST submission
  -> private asset upload
  -> durable submission row
  -> background extraction
  -> needs_confirmation
  -> user corrects/confirms
  -> moderation/publication
  -> public experience
```

### Future agent submit

```text
ChatGPT / WorkBuddy / other agent
  -> MCP/A2A/custom action adapter
  -> SAME authenticated submission API
  -> SAME confirmation/publish domain rules
```

Adapters do not own domain logic.

## Canonical entities

### contributors

Stable public actor identity. It is not an email address and is not proof of unique humanity.

### identity_links

Maps auth/provider identities to a contributor. Private.

### profile_declarations

User-authored current preference/constraint statements with visibility and date.

### submissions

Private durable workflow records. They survive browser closes and AI failures.

Statuses:

`received -> processing -> needs_confirmation -> confirmed -> pending_review -> published`

Failure path:

`processing -> failed`

A failed job is retryable.

### submission_assets

Pointers to private Storage objects.

### places

Stable place entity when resolved. MVP supports unresolved place text.

### experiences

Canonical published first-person records. Store raw first-person text.

### experience_revisions

Immutable snapshots for audit and feedback version binding.

### feedback

Another contributor’s feedback against a specific experience version.

### audit_events

Important system/user changes.

## Search design

Do not make AI read the full database.

### Phase 1: structured filtering

Filter on:
- locality/country
- contributor
- place
- date
- reported price/currency/basis
- item/dish text

### Phase 2: text/semantic retrieval

Within the narrowed set:
- trigram/text search for literal terms
- pgvector similarity for semantic needs

Use an HNSW vector index once vectors are present.

### Phase 3: caller reasoning

Return:
- compact metadata
- original-text excerpt
- contributor link
- experience link
- feedback summary

The caller AI interprets the records.

## Scaling rules

- API default `limit=10`
- hard max `limit=50`
- cursor pagination
- no unbounded list endpoint
- detail endpoint returns one full object
- indexes on major structured filters
- HNSW on embeddings
- background embedding generation
- public pages may cache published immutable/versioned content
- edits create revisions instead of silently rewriting history

## Embeddings

Embeddings are derived data, not truth.

The contract must not expose the vector itself as a product primitive.

Store:
- embedding vector
- embedding model identifier
- embedding generated_at

If embedding generation fails, publication/search by structured fields still works.

## Concurrency/idempotency

Every submission-create request accepts an idempotency key.

Every confirm/publish operation is idempotent.

A repeated request must not create duplicate public experiences.

Use database uniqueness/transactions, not AI judgment, to enforce this.

## Privacy

Raw screenshots are private by default.

Public experience pages should expose only approved extracted/public text.

Never use a receipt delivery address as a public restaurant address.

## Crawler/AI accessibility

Public HTML must contain useful text before client-side interaction.

Allow search/index crawlers needed for discovery. Training crawler policy is independent and can be configured separately.

Publish:
- robots.txt
- sitemap.xml
- llms.txt
- openapi.json

## Why GitHub still exists

GitHub remains useful for:
- code
- migration history
- API contracts
- tests
- documentation
- optional periodic public exports

It is not the live multi-user write path.
