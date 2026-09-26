import { spawn, spawnSync } from "node:child_process";

const status = spawnSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "--output", "json"],
  { encoding: "utf8" });
if (status.status !== 0) {
  console.error("Local Supabase is not running. Start it with npm run db:start.");
  process.exit(1);
}
let dbUrl;
try { dbUrl = JSON.parse(status.stdout).DB_URL; }
catch { /* handled below */ }
if (typeof dbUrl !== "string" || !dbUrl.startsWith("postgresql://")) {
  console.error("Supabase status did not provide a local DB_URL.");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (command !== "node") {
  console.error("Expected a node command after with-local-db.mjs.");
  process.exit(1);
}
const child = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, DATABASE_URL: dbUrl } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
