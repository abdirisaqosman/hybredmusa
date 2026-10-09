import { SELF } from "cloudflare:test";
import { expect } from "vitest";

export const BASE = "https://example.com/api/v1";

export async function post(path: string, body: unknown, headers: HeadersInit = {}) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function get(path: string, headers: HeadersInit = {}) {
  return SELF.fetch(`${BASE}${path}`, { headers });
}

export function sessionCookie(res: Response) {
  const raw = res.headers.get("set-cookie");
  expect(raw, "expected a session cookie").toBeTruthy();
  return raw!.split(";")[0]!;
}

let counter = 0;
export const uniqueEmail = (prefix: string) => `${prefix}-${counter++}-${Date.now()}@example.com`;

export async function signup(
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    role: "coach" | "client";
    client: "web" | "mobile";
    inviteCode: string;
  }> = {},
) {
  const body = {
    email: overrides.email ?? uniqueEmail("user"),
    password: overrides.password ?? "correct horse battery",
    name: overrides.name ?? "Test User",
    role: overrides.role ?? "client",
    client: overrides.client ?? "web",
    ...(overrides.inviteCode ? { inviteCode: overrides.inviteCode } : {}),
  };
  const res = await post("/auth/signup", body);
  return { res, body };
}
