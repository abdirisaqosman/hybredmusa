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

export async function del(path: string, headers: HeadersInit = {}) {
  return SELF.fetch(`${BASE}${path}`, { method: "DELETE", headers });
}

/** A coach and a client that are actively linked, with their session cookies. */
export async function coachAndClient() {
  const coach = await signup({ role: "coach" });
  const coachCookie = sessionCookie(coach.res);
  const coachUser = (await coach.res.json()) as { user: { id: string } };

  const invite = (await (
    await post("/coach/invites", {}, { cookie: coachCookie })
  ).json()) as { inviteCode: string };

  const client = await signup({ role: "client", inviteCode: invite.inviteCode });
  const clientCookie = sessionCookie(client.res);
  const clientUser = (await client.res.json()) as { user: { id: string } };

  return {
    coachCookie,
    clientCookie,
    coachId: coachUser.user.id,
    clientId: clientUser.user.id,
  };
}

export async function put(path: string, body: unknown, headers: HeadersInit = {}) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
