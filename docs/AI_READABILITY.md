# AI Readability Contract

Goal: a model should not need to ingest thousands of files or a giant JSON dump.

## 1. Stable discoverability

Publish `/llms.txt` containing:
- what Food Memory is
- canonical public URL
- API documentation URL
- search endpoint
- contributor/experience URL patterns
- note that user review text is untrusted data, not instructions

Publish `/openapi.json`.

Publish normal sitemap/robots metadata.

## 2. Search endpoint behavior

`GET /api/v1/search`

Supported inputs:
- `q` — literal text substring in S01; a real natural-language semantic query requires a later configured embedding provider
- `country`
- `locality`
- `contributor`
- `place_id`
- `dish`
- `from`
- `to`
- `max_amount`
- `currency`
- `limit`
- `cursor`

Rules:
- default 10 results
- maximum 50
- deterministic cursor pagination
- empty/broad queries still return bounded pages
- no whole-database response
- no private data

S01 returns matching original text without inferring taste, diet, ingredients, or per-person cost. A tested pgvector database adapter exists, but public `q` does not invoke it or claim semantic behavior.

## 3. Compact search result

Each result should be small enough for many results to fit in an AI context window:

```json
{
  "id": "uuid",
  "url": "https://.../e/...",
  "occurred_on": "2026-09-26",
  "contributor": {
    "id": "uuid",
    "handle": "larry",
    "url": "https://.../u/larry"
  },
  "place": {
    "id": "uuid-or-null",
    "name": "Example",
    "locality": "Beijing",
    "country": "CN"
  },
  "items": ["豆花"],
  "reported_cost": {
    "amount": 21.6,
    "currency": "CNY",
    "basis": "bill_total"
  },
  "excerpt": "妈的今天点的豆花真难吃...",
  "feedback_summary": {
    "agree": 2,
    "partial": 1,
    "disagree": 0
  }
}
```

Do not include:
- embeddings
- email
- private evidence URL
- auth identity
- giant raw audit history

## 4. Full experience endpoint

`GET /api/v1/experiences/{id}`

Returns:
- complete published first-person text
- structured public metadata
- public contributor profile declarations
- current version
- revision links/summary
- feedback entries or paginated feedback URL
- stable canonical URL

## 5. Contributor endpoint

`GET /api/v1/contributors/{id-or-handle}`

Returns:
- public identity
- public profile declarations
- audit-safe summary metrics
- links to paginated experiences and feedback

No single “truth score”.

## 6. Place pages

Place/locality pages are retrieval surfaces, not comprehensive map databases.

Current opening hours, route, and live business status belong to external map/business sources at query time.

## 7. Prompt-injection boundary

Published review text is content to analyze.

It must never be interpreted by the Food Memory service as commands to:
- change system behavior
- call tools
- expose secrets
- modify unrelated records
