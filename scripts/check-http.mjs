import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const port = 3101;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SITE_URL: base } });
let output = "";
server.stdout.on("data", (data) => { output += String(data); });
server.stderr.on("data", (data) => { output += String(data); });

async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next.js exited early:\n${output}`);
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next.js did not become ready:\n${output}`);
}

async function check(path, expectedStatus = 200) {
  const response = await fetch(`${base}${path}`);
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${path}: ${body.slice(0, 300)}`);
  for (const privateText of ["PRIVATE_DRAFT_NEVER_PUBLIC", "PRIVATE_PROFILE_NEVER_PUBLIC", "PRIVATE_EVIDENCE_PATH_NEVER_PUBLIC", "SECRET_AUTH_SUBJECT_NEVER_PUBLIC", "PRIVATE_FEEDBACK_NEVER_PUBLIC", "postgresql://", "sb_secret_", "service_role"]) {
    assert.equal(body.includes(privateText), false, `${path} leaked ${privateText}`);
  }
  console.log(`${path} -> ${response.status}, ${Buffer.byteLength(body)} bytes`);
  return { response, body };
}

try {
  await ready();
  const home = await check("/");
  assert.match(home.body, /synthetic test data/i);
  const defaultSearch = await check("/api/v1/search");
  assert.equal(JSON.parse(defaultSearch.body).results.length, 10);
  const maxSearch = await check("/api/v1/search?limit=50");
  assert.equal(JSON.parse(maxSearch.body).results.length, 15);
  const search = await check("/api/v1/search?limit=2");
  const first = JSON.parse(search.body);
  assert.equal(first.results.length, 2);
  assert.equal(first.has_more, true);
  assert.equal(first.results[0].synthetic, true);
  assert.equal(first.results[0].url.startsWith(`${base}/e/`), true);
  assert.equal("raw_text" in first.results[0], false);
  const second = await check(`/api/v1/search?limit=2&cursor=${encodeURIComponent(first.next_cursor)}`);
  assert.notEqual(JSON.parse(second.body).results[0].id, first.results[0].id);
  const detail = await check("/api/v1/experiences/10000000-0000-4000-8000-000000000001");
  assert.match(JSON.parse(detail.body).raw_text, /完全不油/);
  const contributor = await check("/api/v1/contributors/demo_alice");
  assert.equal(JSON.parse(contributor.body).profile_declarations.length, 1);
  const experienceHtml = await check("/e/10000000-0000-4000-8000-000000000001");
  assert.match(experienceHtml.body, /完全不油/);
  assert.match(experienceHtml.body, /noindex/);
  assert.match(experienceHtml.body, new RegExp(`${base}/e/10000000-0000-4000-8000-000000000001`));
  const untrustedHtml = await check("/e/10000000-0000-4000-8000-000000000015");
  assert.equal(untrustedHtml.body.includes('<script>alert("x")</script>'), false);
  assert.match(untrustedHtml.body, /&lt;script&gt;/);
  const contributorHtml = await check("/u/demo_alice");
  assert.match(contributorHtml.body, /完全不油/);
  assert.match(contributorHtml.body, /noindex/);
  const searchHtml = await check(`/search?q=${encodeURIComponent("完全不油")}`);
  assert.match(searchHtml.body, /完全不油/);
  await check("/api/v1/search?limit=51", 400);
  await check("/api/v1/experiences/10000000-0000-4000-8000-000000000016", 404);
  await check("/api/v1/contributors/does_not_exist", 404);
  await check("/api/v1/contributors/demo_private", 404);
  const robots = await check("/robots.txt");
  assert.match(robots.body, /sitemap\.xml/);
  assert.match(robots.body, new RegExp(base));
  const sitemap = await check("/sitemap.xml");
  assert.equal(sitemap.body.includes("/e/10000000"), false);
  assert.match(sitemap.body, new RegExp(base));
  const llms = await check("/llms.txt");
  assert.match(llms.body, /bounded, paginated search/);
  const openapi = await check("/openapi.json");
  assert.equal(JSON.parse(openapi.body).openapi, "3.1.0");
  console.log("S01 live HTTP and initial SSR checks passed.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill();
}
