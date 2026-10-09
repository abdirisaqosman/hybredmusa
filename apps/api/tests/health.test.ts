import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/v1/health", () => {
  it("reports ok", async () => {
    const res = await SELF.fetch("https://example.com/api/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("serves an OpenAPI spec", async () => {
    const res = await SELF.fetch("https://example.com/api/v1/openapi.json");
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths)).toContain("/health");
  });

  it("uses the shared error shape for unknown routes", async () => {
    const res = await SELF.fetch("https://example.com/api/v1/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "No such route" },
    });
  });

  it("has the schema applied", async () => {
    const row = await env.DB.prepare("select count(*) as n from users").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});
