import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AuthResponse, MeResponse } from "@hybredmusa/shared";
import { get, post, sessionCookie, signup, uniqueEmail } from "./helpers.js";

describe("signup", () => {
  it("creates a web session in a cookie and not in the body", async () => {
    const { res } = await signup({ role: "coach" });
    expect(res.status).toBe(201);

    const data = (await res.json()) as AuthResponse;
    expect(data.token).toBeNull();
    expect(data.user.role).toBe("coach");

    const cookie = sessionCookie(res);
    expect(cookie).toContain("hm_session=");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");

    const me = await get("/auth/me", { cookie });
    expect(me.status).toBe(200);
    expect(((await me.json()) as MeResponse).user.id).toBe(data.user.id);
  });

  it("returns a bearer token for mobile clients", async () => {
    const { res } = await signup({ client: "mobile" });
    const data = (await res.json()) as AuthResponse;
    expect(data.token).toBeTruthy();
    expect(res.headers.get("set-cookie")).toBeNull();

    const me = await get("/auth/me", { authorization: `Bearer ${data.token}` });
    expect(me.status).toBe(200);
  });

  it("refuses to create an admin", async () => {
    const res = await post("/auth/signup", {
      email: uniqueEmail("wannabe-admin"),
      password: "correct horse battery",
      name: "Sneaky",
      role: "admin",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail("dupe");
    await signup({ email });
    const { res } = await signup({ email });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: "EMAIL_TAKEN" } });
  });
});

describe("login", () => {
  it("gives the same error for a wrong password and an unknown email", async () => {
    const email = uniqueEmail("login");
    await signup({ email, password: "correct horse battery" });

    const wrongPassword = await post("/auth/login", { email, password: "nope nope nope" });
    const unknownEmail = await post("/auth/login", {
      email: uniqueEmail("ghost"),
      password: "nope nope nope",
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  it("signs in and the session works with both cookie and bearer", async () => {
    const email = uniqueEmail("both");
    await signup({ email });

    const web = await post("/auth/login", { email, password: "correct horse battery" });
    expect((await get("/auth/me", { cookie: sessionCookie(web) })).status).toBe(200);

    const mobile = await post("/auth/login", {
      email,
      password: "correct horse battery",
      client: "mobile",
    });
    const token = ((await mobile.json()) as AuthResponse).token!;
    expect((await get("/auth/me", { authorization: `Bearer ${token}` })).status).toBe(200);
  });
});

describe("sessions", () => {
  it("rejects requests with no session", async () => {
    const res = await get("/auth/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("rejects a made up token", async () => {
    const res = await get("/auth/me", { authorization: "Bearer not-a-real-token" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "SESSION_INVALID" } });
  });

  it("stops working after logout", async () => {
    const { res } = await signup();
    const cookie = sessionCookie(res);

    expect((await post("/auth/logout", {}, { cookie })).status).toBe(200);
    expect((await get("/auth/me", { cookie })).status).toBe(401);
  });

  it("locks out a disabled user immediately, session and login", async () => {
    const email = uniqueEmail("disabled");
    const { res } = await signup({ email });
    const cookie = sessionCookie(res);
    expect((await get("/auth/me", { cookie })).status).toBe(200);

    await env.DB.prepare("update users set disabled_at = ? where email = ?")
      .bind(new Date().toISOString(), email)
      .run();

    expect((await get("/auth/me", { cookie })).status).toBe(401);

    const login = await post("/auth/login", { email, password: "correct horse battery" });
    expect(login.status).toBe(403);
    expect(await login.json()).toMatchObject({ error: { code: "ACCOUNT_DISABLED" } });
  });

  it("tracks last_active_at", async () => {
    const email = uniqueEmail("active");
    const { res } = await signup({ email });
    await get("/auth/me", { cookie: sessionCookie(res) });

    const row = await env.DB.prepare("select last_active_at from users where email = ?")
      .bind(email)
      .first<{ last_active_at: string | null }>();
    expect(row?.last_active_at).toBeTruthy();
  });
});
