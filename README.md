# Food Memory Reigns Supreme

> MVP foundation for a free, AI-readable, human-contributed food experience network.

## 核心体验

**读：**
> “Hi GPT，去 Food Memory 看看，根据我的口味和位置帮我推荐点菜。”

**写：**
> “Hi GPT，这个豆花真难吃。这里是订单截图，帮我记到 Food Memory，别让别人踩坑。”

MVP does **not** build another restaurant-ranking app. It builds a public, structured layer of first-person eating experiences that humans and AI can retrieve efficiently.

## Non-negotiable MVP requirements

1. **Public AI-readable data** — published records are readable without login or installing anything. Public HTML is server-rendered; a compact JSON API is also available.
2. **Free human contribution** — anyone can register, upload an order screenshot (optional) + write a natural-language comment, review the AI-created draft, and publish.
3. **Fast retrieval at scale** — search is bounded and paginated. Structured filters happen first; semantic search is available for natural-language needs. AI never has to download the whole database.
4. **Stable extension boundary** — web UI and future MCP/A2A/email adapters all call the same application/service contracts.
5. **Auditable contributors** — each contributor has one stable internal ID, a public history, revision trail, and feedback linked to specific experience versions. Feedback never becomes a fake “truth score”.

## Technical direction

- **Next.js**: public SSR pages, submission UI, public/authenticated API.
- **Supabase**: PostgreSQL, Auth, private Storage, RLS.
- **Postgres + pgvector**: structured filters + semantic retrieval.
- **Background processing**: screenshot/text extraction and embeddings must be retryable and idempotent.
- **GitHub**: code, schema, architecture, tests, and public export tooling — **not** the production write database.

See:
- [AGENTS.md](AGENTS.md)
- [docs/PRODUCT_CONTRACT.md](docs/PRODUCT_CONTRACT.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/AI_READABILITY.md](docs/AI_READABILITY.md)
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [contracts/openapi.yaml](contracts/openapi.yaml)
- [supabase/migrations/0001_core.sql](supabase/migrations/0001_core.sql)

## Important product boundary

“Any AI can read” means any networked AI/client that can open public web URLs or make HTTP GET requests can consume the public layer. We do not depend on users installing MCP.

“Any AI can submit” is implemented at the **service contract** level via authenticated HTTP endpoints. Whether a specific ChatGPT/WorkBuddy client can directly call those endpoints depends on that client’s action/tool support. The web submission flow remains the universal fallback.

## Development process

Development is staged. Each stage has an issue and explicit acceptance criteria. Do not jump ahead and build A2A, Web3, payments, native apps, or a global KOL score before the MVP gates pass.

Current status: **foundation / architecture bootstrap**.
