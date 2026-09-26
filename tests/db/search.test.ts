import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { closePublicDb, withPublicDb } from "../../src/lib/public-db";
import { getPublicContributor, getPublicExperience, searchPublic } from "../../src/lib/public-search";
import { findByEmbedding, searchSemantically, type SemanticEmbedder } from "../../src/lib/semantic";

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const search = (query = "") => searchPublic(new URLSearchParams(query));

describe.skipIf(!process.env.DATABASE_URL)("S01 real PostgreSQL/RLS read path", () => {
  afterAll(closePublicDb);

  it("uses the anon role and only sees published data", async () => {
    const role = await withPublicDb(async (db) => db.query<{ current_user: string; visible: string }>(
      "select current_user, (select count(*)::text from public.experiences) as visible"));
    expect(role.rows[0]).toEqual({ current_user: "anon", visible: "15" });
    expect(await getPublicExperience(id(16))).toBeNull();
    expect(await getPublicExperience("not-a-uuid")).toBeNull();
    expect(await getPublicContributor("demo_private")).toBeNull();
  });

  it("applies every structured filter and preserves cost basis", async () => {
    expect((await search("contributor=demo_alice")).results.every((r) => r.contributor.handle === "demo_alice")).toBe(true);
    expect((await search("contributor=11111111-1111-4111-8111-111111111111")).results.every((r) => r.contributor.handle === "demo_alice")).toBe(true);
    expect((await search("country=US")).results.map((r) => r.id)).toEqual([id(6), id(11)]);
    expect((await search(`locality=${encodeURIComponent("石家庄")}`)).results.every((r) => r.place.locality === "石家庄")).toBe(true);
    expect((await search("place_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5")).results.map((r) => r.id)).toEqual([id(7), id(13)]);
    expect((await search(`dish=${encodeURIComponent("锅包肉")}`)).results.map((r) => r.id)).toEqual([id(5)]);
    expect((await search("from=2026-09-20&to=2026-09-22")).results.map((r) => r.id)).toEqual([id(4), id(5), id(6)]);
    expect((await search("max_amount=30&currency=CNY&cost_basis=per_person")).results.map((r) => r.id)).toEqual([id(9), id(15)]);
    expect((await search("cost_basis=bill_total")).results.map((r) => r.id)).toEqual([id(2), id(5), id(12)]);
    expect((await search("max_amount=30.123&cost_basis=per_person")).results.map((r) => r.id)).toEqual([id(9), id(15)]);
  });

  it("bounds empty searches and maintains stable cursor ordering", async () => {
    const first = await search();
    expect(first.results).toHaveLength(10);
    expect(first.has_more).toBe(true);
    expect(first.next_cursor).toBeTruthy();
    const second = await search(`cursor=${first.next_cursor}`);
    expect(second.results).toHaveLength(5);
    expect(second.has_more).toBe(false);
    expect(new Set([...first.results, ...second.results].map((r) => r.id)).size).toBe(15);
    expect((await search("limit=50")).results).toHaveLength(15);
    await expect(search("limit=51")).rejects.toThrow("limit must be between 1 and 50");
    await expect(search(`country=US&cursor=${first.next_cursor}`)).rejects.toThrow("cursor");
  });

  it("uses literal retrieval and preserves all adversarial source meanings", async () => {
    expect((await search(`q=${encodeURIComponent("完全不油")}`)).results.map((r) => r.id)).toEqual([id(1)]);
    expect((await search(`q=${encodeURIComponent("太油了")}`)).results.map((r) => r.id)).toEqual([id(2)]);
    expect((await search("q=%25")).results).toHaveLength(0);
    const sweet = (await search(`q=${encodeURIComponent("我不喜欢甜")}`)).results[0];
    expect(sweet.excerpt).toContain("但这家很甜");
    const noodle = (await search(`dish=${encodeURIComponent("素粉")}`)).results[0];
    expect(noodle.excerpt).toContain("不能确定是否全素");
    expect(JSON.stringify(noodle)).not.toContain("vegetarian");
    const bill = (await search(`dish=${encodeURIComponent("锅包肉")}`)).results[0];
    expect(bill.reported_cost).toEqual({ amount: 120, currency: "CNY", basis: "bill_total" });
    expect(bill.excerpt).toContain("四个人");
  });

  it("returns only whitelisted public fields and 404-equivalent misses", async () => {
    const detail = await getPublicExperience(id(1));
    const contributor = await getPublicContributor("demo_alice");
    expect(detail?.raw_text).toContain("完全不油");
    expect(contributor?.profile_declarations).toHaveLength(1);
    expect(await getPublicContributor("unknown_handle")).toBeNull();
    const payload = JSON.stringify({ search: await search("limit=50"), detail, contributor });
    for (const secret of ["PRIVATE_DRAFT_NEVER_PUBLIC", "PRIVATE_PROFILE_NEVER_PUBLIC", "PRIVATE_EVIDENCE_PATH_NEVER_PUBLIC", "SECRET_AUTH_SUBJECT_NEVER_PUBLIC", "PRIVATE_FEEDBACK_NEVER_PUBLIC", "embedding", "storage_path", "auth_user_id"]) {
      expect(payload).not.toContain(secret);
    }
  });

  it("queries real pgvector data and the indexed 1536-dimension path", async () => {
    const vector = Array(1536).fill(0);
    vector[0] = 1;
    const fixtureEmbedder: SemanticEmbedder = { embed: async () => ({ model: "fixture-1536", vector }) };
    const results = await searchSemantically(fixtureEmbedder, "deterministic test query");
    expect(results.map((r) => r.experience_id)).toEqual([id(1), id(2)]);
    expect(results[0].distance).toBe(0);
    expect((await findByEmbedding({ model: "fixture-3", vector: [1, 0, 0] })).map((r) => r.experience_id)).toEqual([id(3)]);
    expect((await searchSemantically(fixtureEmbedder, "fixture", 10, {
      country: "CN", locality: "石家庄", contributorId: "11111111-1111-4111-8111-111111111111",
      placeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", from: "2026-09-25", to: "2026-09-25",
      dish: "豆花", maxAmount: 20, currency: "CNY", costBasis: "my_share",
    })).map((r) => r.experience_id)).toEqual([id(1)]);
    // The application/anon role cannot select the raw embedding column. Check
    // the physical index plan through the trusted test connection only.
    const ownerPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const owner = await ownerPool.connect();
    let plan;
    try {
      await owner.query("begin");
      await owner.query("set local enable_seqscan = off");
      plan = await owner.query<{ "QUERY PLAN": string }>(
        `explain select id from public.experiences
         where moderation_status='published' and embedding is not null and extensions.vector_dims(embedding)=1536
         order by embedding::extensions.vector(1536) <=> $1::extensions.vector(1536) limit 2`,
        [`[${vector.join(",")}]`]);
    } finally {
      await owner.query("rollback");
      owner.release();
      await ownerPool.end();
    }
    expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain("experiences_embedding_1536_hnsw_idx");
    const literalIndex = await withPublicDb((db) => db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname='public' and indexname='experiences_search_trgm_idx'"));
    expect(literalIndex.rows[0].indexdef).toContain("USING gin");
    expect(literalIndex.rows[0].indexdef).toContain("search_text gin_trgm_ops");
  });
});
