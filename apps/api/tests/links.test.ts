import { describe, expect, it } from "vitest";
import type { Invite } from "@hybredmusa/shared";
import { get, post, sessionCookie, signup, uniqueEmail } from "./helpers.js";

async function coachWithInvite() {
  const { res } = await signup({ role: "coach" });
  const cookie = sessionCookie(res);
  const invite = (await (await post("/coach/invites", {}, { cookie })).json()) as Invite;
  return { cookie, invite };
}

describe("coach and client links", () => {
  it("links a client that signs up with an invite code", async () => {
    const { cookie: coachCookie, invite } = await coachWithInvite();

    const { res } = await signup({ role: "client", inviteCode: invite.inviteCode });
    expect(res.status).toBe(201);

    const me = await (await get("/auth/me", { cookie: sessionCookie(res) })).json();
    expect(me).toMatchObject({ coach: { role: "coach" } });

    const coachMe = await (await get("/auth/me", { cookie: coachCookie })).json();
    expect(coachMe).toMatchObject({ clientCount: 1 });
  });

  it("links an existing client with POST /client/link", async () => {
    const { invite } = await coachWithInvite();
    const { res } = await signup({ role: "client" });
    const cookie = sessionCookie(res);

    const linked = await post("/client/link", { inviteCode: invite.inviteCode }, { cookie });
    expect(linked.status).toBe(200);

    const coach = await (await get("/client/coach", { cookie })).json();
    expect(coach).toMatchObject({ coach: { role: "coach" } });
  });

  it("rejects an invite code that was already used", async () => {
    const { invite } = await coachWithInvite();
    const first = await signup({ role: "client" });
    await post("/client/link", { inviteCode: invite.inviteCode }, { cookie: sessionCookie(first.res) });

    const second = await signup({ role: "client" });
    const res = await post(
      "/client/link",
      { inviteCode: invite.inviteCode },
      { cookie: sessionCookie(second.res) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "INVALID_INVITE" } });
  });

  it("rejects an unknown invite code at signup", async () => {
    const res = await post("/auth/signup", {
      email: uniqueEmail("bad-invite"),
      password: "correct horse battery",
      name: "Nope",
      role: "client",
      inviteCode: "ZZZZZZZZ",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "INVALID_INVITE" } });
  });

  it("keeps coach routes away from clients and client routes away from coaches", async () => {
    const client = await signup({ role: "client" });
    const clientCookie = sessionCookie(client.res);
    const coach = await signup({ role: "coach" });
    const coachCookie = sessionCookie(coach.res);

    expect((await post("/coach/invites", {}, { cookie: clientCookie })).status).toBe(403);
    expect((await get("/coach/invites", { cookie: clientCookie })).status).toBe(403);
    expect((await get("/client/coach", { cookie: coachCookie })).status).toBe(403);
    expect(
      (await post("/client/link", { inviteCode: "ABCD1234" }, { cookie: coachCookie })).status,
    ).toBe(403);
  });

  it("needs a session for link routes", async () => {
    expect((await post("/coach/invites", {})).status).toBe(401);
    expect((await get("/client/coach")).status).toBe(401);
  });
});
