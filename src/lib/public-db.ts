import { Pool, type PoolClient } from "pg";

let pool: Pool | undefined;

function databasePool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for public database reads");
  }
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });
  return pool;
}

/** Every public query runs as anon with RLS, even when the connection owner is postgres. */
export async function withPublicDb<T>(read: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL ROLE anon");
    await client.query("SET LOCAL statement_timeout = '5s'");
    return await read(client);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

export async function closePublicDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
