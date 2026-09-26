# Architecture decisions

## ADR-001 — PostgreSQL, not Git, is the production database

Status: accepted for MVP.

Reason: multi-user concurrent writes, access control, search, feedback, revisions, and idempotency are database concerns. GitHub remains code/contracts/audit/export infrastructure.

## ADR-002 — public web/API is the universal AI read layer

Status: accepted.

Reason: requiring MCP installation violates zero-install read. Public SSR + bounded JSON GET endpoints are the compatibility baseline.

## ADR-003 — authenticated HTTP is the write contract

Status: accepted.

Reason: web UI and future MCP/A2A adapters can share one domain contract. A specific AI product's ability to call authenticated POST endpoints is a client capability, not a database architecture assumption.

## ADR-004 — structured filters + semantic retrieval

Status: accepted.

Reason: place/author/time/cost are structured facts; natural-language needs require semantic retrieval. The caller AI receives bounded original-text evidence and performs final reasoning.

## ADR-005 — feedback is evidence, not truth score

Status: accepted.

Reason: taste disagreement is not dishonesty. Bind feedback to exact record versions and expose transparent audit signals instead of a universal KOL score.

## ADR-006 — private evidence by default

Status: accepted.

Reason: order screenshots may contain phone/address/order identifiers. AI may extract from authorized evidence; public users should see only approved public fields.

## ADR-007 — MVP remains free to users

Status: accepted.

No payments or paywalls in MVP. Infrastructure may still have operating cost.
