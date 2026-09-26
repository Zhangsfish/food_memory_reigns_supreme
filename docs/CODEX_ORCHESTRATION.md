# Codex orchestration

Development is intentionally split into sequential GitHub issues.

## Queue

1. [S00 — bootstrap executable app](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/1)
2. [S01 — public AI-readable read/search](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/2)
3. [S02 — auth + durable submission](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/3)
4. [S03 — real AI extraction + embeddings](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/4)
5. [S04 — feedback + contributor audit](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/5)
6. [S05 — legacy import + deploy + external acceptance](https://github.com/Zhangsfish/food_memory_reigns_supreme/issues/6)

## Rules for Codex

- Work on one issue at a time.
- Read `AGENTS.md` before coding.
- Do not start a later issue because it looks easy.
- Open a PR; do not merge it.
- Include `reports/Sxx/DELIVERY.md`.
- Report exact tested SHA, commands, tests, and blockers.
- Never mark a requirement complete without evidence.
- Preserve architecture/product contracts unless a contradiction is proven and documented.
- If a contract must change, explain why in the PR rather than silently changing it.

## Review loop

```text
Codex works issue
  -> opens PR
  -> ChatGPT/user audits diff + tests + evidence
  -> changes requested if needed
  -> PR accepted/merged
  -> next issue starts
```

This is deliberate: the user should not need to evaluate implementation details. Acceptance is based on repository contracts and observable tests.
