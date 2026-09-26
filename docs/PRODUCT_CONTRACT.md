# Product Contract — MVP v0.1

This file defines what must exist before the MVP is considered real.

## 1. Public read: zero-install AI access

A published experience must be readable through a normal public URL.

A networked AI should be able to:
- open a contributor page
- open an experience page
- open a place/search page
- retrieve compact JSON search results
- follow a result to its full source

No login is required for published data.

The system must not depend on:
- cloning GitHub
- installing MCP
- a browser extension
- a native app
- downloading the full dataset

### Required public surfaces

- `/u/{handle}`
- `/e/{experience_id}`
- `/search?...filters...`
- `/api/v1/search`
- `/api/v1/experiences/{id}`
- `/api/v1/contributors/{id-or-handle}`
- `/llms.txt`
- `/openapi.json`

## 2. Human write: simple, free submission

Minimum mobile flow:

1. sign in with email OTP/magic link
2. upload optional screenshot/photo
3. type natural-language experience
4. submit
5. system creates a private structured draft
6. user reviews extracted fields and raw text
7. user confirms
8. moderation/publication completes
9. stable public URL exists

No GitHub knowledge is required.

Unknown values remain unknown. The system must not invent branch, date, price, dish, or commercial relationship.

## 3. Agent write: stable contract

The backend exposes authenticated endpoints for:
- create submission
- read submission status
- update/correct draft
- confirm draft
- search public experiences
- get contributor
- submit feedback

This makes future MCP/A2A adapters possible without changing domain rules.

A specific AI product may or may not support arbitrary authenticated POST requests today. Therefore the web UI is the universal fallback.

## 4. Retrieval

First-class retrieval dimensions:

- contributor
- place/locality
- place identity
- dish/item text
- time
- reported price/cost basis
- free-text semantic need

Examples:

- “Larry previously ate what?”
- “What is in Shijiazhuang?”
- “Who ate 锅包肉?”
- “Recent records from this place?”
- “Under 30 CNY, not oily, vegetarian-ish experiences?”

Important:
- “vegetarian-ish” or “not oily” are not hard facts unless explicitly stated.
- semantic results must include original text so the caller can interpret context.
- structured filters and semantic similarity are distinct operations.

## 5. Contributor identity and audit

Every contributor receives a stable immutable internal ID.

Authentication identities map to that ID.

Public contributor page shows only public data:
- handle/display name
- public profile declarations
- published experience history
- public revisions/corrections
- feedback summaries and feedback records allowed for publication

It must not expose:
- email
- auth provider subject
- private evidence
- precise private address
- private profile fields

## 6. Feedback semantics

Feedback targets an exact experience version.

Minimum feedback fields:
- description_match: `agree | partial | disagree | unknown`
- taste_outcome: `liked | neutral | disliked | not_consumed | unknown`
- comment
- feedback contributor
- created/updated time

Examples:

Original:
> “Very spicy. I loved it.”

Feedback:
> “It was definitely spicy, but I hated it.”

Interpretation:
- description may be corroborated
- taste differs
- author is not penalized for disagreement

MVP must not turn this into a single universal “truth” or “KOL” score.

## 7. Free product principle

Reading and contribution are free to users in MVP.

Project operating costs may exist. “Free to users” does not mean infrastructure has zero cost.

## 8. Explicitly out of MVP

- payment
- creator revenue sharing
- restaurant ads
- global contributor ranking
- one-person-one-human proof
- blockchain
- full A2A implementation
- native mobile app
- fully automatic publication without confirmation
