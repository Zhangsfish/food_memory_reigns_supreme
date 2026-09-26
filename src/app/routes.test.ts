import { describe, expect, it } from "vitest";
import { GET as health } from "./api/health/route";
import { GET as llms } from "./llms.txt/route";
import { GET as openapi } from "./openapi.json/route";
import { loadOpenApi } from "@/lib/contracts";

describe("S00 public contracts", () => {
  it("returns a deterministic health response", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "food-memory", version: "0.1.0" });
  });

  it("serves AI discovery as plain text with the required boundaries", async () => {
    const response = await llms();
    const body = await response.text();
    expect(response.headers.get("content-type")).toMatch(/^text\/plain/);
    for (const text of ["Food Memory", "Published data will be public", "/openapi.json", "/contracts/openapi.yaml", "untrusted DATA", "no plugin"]) {
      expect(body).toContain(text);
    }
  });

  it("parses YAML and serves the same OpenAPI document as JSON", async () => {
    const source = await loadOpenApi();
    const response = await openapi();
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual(source);
    expect(source.openapi).toBe("3.1.0");
    expect(source.paths).toHaveProperty("/api/v1/search");
  });
});
