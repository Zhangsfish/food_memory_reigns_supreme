import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const sql = readFileSync(new URL("../supabase/tests/core.sql", import.meta.url), "utf8");
const result = spawnSync("docker", [
  "exec", "-i", "supabase_db_food_memory_reigns_supreme",
  "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
], { input: sql, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
