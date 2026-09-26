import { withPublicDb } from "./public-db";

/** S03 will supply an implementation; S01 fixtures use deterministic vectors only. */
export interface SemanticEmbedder {
  embed(text: string): Promise<{ model: string; vector: number[] }>;
}

export type SemanticFilters = {
  country?: string; locality?: string; contributorId?: string; placeId?: string;
  from?: string; to?: string; dish?: string; maxAmount?: number;
  currency?: string; costBasis?: string;
};

export async function searchSemantically(embedder: SemanticEmbedder, text: string, limit = 10, filters: SemanticFilters = {}) {
  return findByEmbedding(await embedder.embed(text), limit, filters);
}

export async function findByEmbedding(embedding: { model: string; vector: number[] }, limit = 10, filters: SemanticFilters = {}) {
  if (!embedding.model || embedding.vector.length < 1 || embedding.vector.length > 2000
    || embedding.vector.some((value) => !Number.isFinite(value)) || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("Invalid semantic query");
  }
  return withPublicDb(async (client) => {
    const { rows } = await client.query<{ experience_id: string; distance: number }>(
      `select experience_id, distance from public.search_public_embeddings(
         $1::extensions.vector, $2::text, $3::integer, $4::text, $5::text,
         $6::uuid, $7::uuid, $8::date, $9::date, $10::text, $11::numeric,
         $12::text, $13::text)`,
      [`[${embedding.vector.join(",")}]`, embedding.model, limit,
        filters.country ?? null, filters.locality ?? null, filters.contributorId ?? null,
        filters.placeId ?? null, filters.from ?? null, filters.to ?? null,
        filters.dish ?? null, filters.maxAmount ?? null, filters.currency ?? null,
        filters.costBasis ?? null]);
    return rows;
  });
}
