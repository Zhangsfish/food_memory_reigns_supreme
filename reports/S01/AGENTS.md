# S01 Task Memory

## Purpose and sources

This folder contains the review evidence for Issue #2, public AI-readable pages and bounded PostgreSQL search. Source authority: repository `AGENTS.md`, product/architecture/AI-readability/acceptance docs, OpenAPI contract, migrations, Issue #2, and its latest “Codex kickoff — S01” comment.

## File map

- `DELIVERY.md`: canonical commands, tested SHA, route/filter examples, response sizes, limits, and S02+ boundary.

## Decisions and handoff

- Seed data is deterministic and explicitly synthetic.
- Public `q` is literal text retrieval in S01. Semantic pgvector search is an internal tested interface until a real embedder exists in S03.
- App public database reads run with PostgreSQL `anon` role and RLS. The internal pgvector RPC uses fixed published-only SQL as a security definer so direct Supabase REST cannot read the embedding column.
- Implementation commit `2c3f8d4cf23e5ae7793ae9a6194c69f74b76a41f` passed local application, database, REST, and HTTP checks. `DELIVERY.md` is the canonical report. External two-client AI access remains untested until a public deployment exists.
