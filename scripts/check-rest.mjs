import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const result = spawnSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "--output", "json"], { encoding: "utf8" });
if (result.status !== 0) throw new Error("Start the full local Supabase stack first.");
const status = JSON.parse(result.stdout);
if (!status.REST_URL || !status.ANON_KEY) throw new Error("Full local Supabase REST/anon configuration is unavailable.");
const headers = { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` };

async function get(table, select) {
  const response = await fetch(`${status.REST_URL}/${table}?select=${encodeURIComponent(select)}&limit=50`, { headers });
  return { status: response.status, body: await response.json() };
}

const experiences = await get("experiences", "id,raw_text,is_synthetic");
assert.equal(experiences.status, 200);
assert.equal(experiences.body.length, 15);
assert.equal(JSON.stringify(experiences.body).includes("PRIVATE_DRAFT_NEVER_PUBLIC"), false);
const contributors = await get("contributors", "id,handle");
assert.equal(contributors.status, 200);
assert.equal(contributors.body.length, 3);
assert.equal(JSON.stringify(contributors.body).includes("demo_private"), false);
const places = await get("places", "id,name");
assert.equal(places.status, 200);
assert.equal(places.body.length, 5);
const profiles = await get("profile_declarations", "raw_text,visibility");
assert.equal(profiles.status, 200);
assert.equal(profiles.body.length, 1);
assert.equal(JSON.stringify(profiles.body).includes("PRIVATE_PROFILE_NEVER_PUBLIC"), false);
const feedback = await get("feedback", "comment,status");
assert.equal(feedback.status, 200);
assert.equal(feedback.body.length, 1);
for (const [table, column] of [["experiences", "embedding"], ["experiences", "submission_id"],
  ["places", "external_place_id"], ["experiences", "*"]]) {
  const forbidden = await get(table, column);
  assert.ok(forbidden.status === 401 || forbidden.status === 403, `${table}.${column} unexpectedly readable`);
}
for (const table of ["submissions", "identity_links", "submission_assets", "experience_revisions"]) {
  const forbidden = await get(table, "*");
  assert.ok(forbidden.status === 401 || forbidden.status === 403, `${table} unexpectedly readable`);
}
console.log("Anon REST: 15 published experiences, 3 contributors, 5 places, 1 public profile and 1 feedback; internal columns and private tables denied.");
