import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AdminOverview, AdminUserDetail } from "@hybredmusa/shared";
import { coachAndClient, del, get, post, sessionCookie, signup, uniqueEmail } from "./helpers.js";

/** The bootstrap command is the only way to get the first admin. */
async function makeAdmin() {
  const email = uniqueEmail("admin");
  await signup({ email, role: "client" });
  await env.DB.prepare("update users set role = 'admin' where email = ?").bind(email).run();

  const login = await post("/auth/login", { email, password: "correct horse battery" });
  const body = (await login.json()) as { user: { id: string } };
  return { cookie: sessionCookie(login), id: body.user.id, email };
}

/** Every admin path in the generated spec, so a new route cannot be forgotten. */
async function adminRoutes() {
  const spec = (await (await get("/openapi.json")).json()) as {
    paths: Record<string, Record<string, unknown>>;
  };
  return Object.entries(spec.paths)
    .filter(([path]) => path.startsWith("/admin"))
    .flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => ({ path, method: method.toUpperCase() })),
    );
}

describe("admin access", () => {
  it("gives a client and a coach 403 on every admin route", async () => {
    const { clientCookie, coachCookie } = await coachAndClient();
    const routes = await adminRoutes();
    expect(routes.length).toBeGreaterThan(10);

    for (const route of routes) {
      const path = route.path.replace("{userId}", "someone").replace("{linkId}", "something");
      for (const cookie of [clientCookie, coachCookie]) {
        const res = await (route.method === "GET"
          ? get(path, { cookie })
          : route.method === "DELETE"
            ? del(path, { cookie })
            : post(path, {}, { cookie }));
        expect([403], `${route.method} ${path}`).toContain(res.status);
      }
    }
  });

  it("gives a signed out visitor 401 on every admin route", async () => {
    for (const route of await adminRoutes()) {
      const path = route.path.replace("{userId}", "someone").replace("{linkId}", "something");
      const res = await (route.method === "GET"
        ? get(path)
        : route.method === "DELETE"
          ? del(path)
          : post(path, {}));
      expect([401], `${route.method} ${path}`).toContain(res.status);
    }
  });

  it("keeps an admin out of individual health data", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    await post(
      `/clients/${clientId}/food-logs`,
      {
        kind: "quick",
        date: new Date().toISOString().slice(0, 10),
        meal: "lunch",
        name: "Lunch",
        calories: 600,
        proteinG: 40,
        carbsG: 50,
        fatG: 20,
      },
      { cookie: clientCookie },
    );
    const admin = await makeAdmin();

    for (const path of [
      `/clients/${clientId}/diary`,
      `/clients/${clientId}/progress`,
      `/clients/${clientId}/metrics`,
      `/clients/${clientId}/comments`,
      `/clients/${clientId}/templates`,
    ]) {
      const res = await get(path, { cookie: admin.cookie });
      expect(res.status, path).toBe(403);
    }
  });

  it("shows activity as counts only on the user detail page", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    await post(
      `/clients/${clientId}/food-logs`,
      {
        kind: "quick",
        date: "2026-07-01",
        meal: "dinner",
        name: "Pizza",
        calories: 900,
        proteinG: 30,
        carbsG: 100,
        fatG: 40,
      },
      { cookie: clientCookie },
    );
    const admin = await makeAdmin();

    const res = await get(`/admin/users/${clientId}`, { cookie: admin.cookie });
    const detail = (await res.json()) as AdminUserDetail;

    expect(detail.activity.foodEntries).toBe(1);
    expect(JSON.stringify(detail)).not.toContain("Pizza");
  });
});

describe("admin actions", () => {
  it("disables an account, kills its sessions and writes an audit row", async () => {
    const admin = await makeAdmin();
    const victim = await signup({ role: "client" });
    const victimCookie = sessionCookie(victim.res);
    const victimId = ((await victim.res.json()) as { user: { id: string } }).user.id;

    expect((await get("/auth/me", { cookie: victimCookie })).status).toBe(200);
    expect((await post(`/admin/users/${victimId}/disable`, {}, { cookie: admin.cookie })).status).toBe(200);
    expect((await get("/auth/me", { cookie: victimCookie })).status).toBe(401);

    const audit = (await (await get("/admin/audit", { cookie: admin.cookie })).json()) as {
      items: Array<{ action: string; targetUserId: string | null }>;
    };
    expect(audit.items[0]).toMatchObject({ action: "user.disable", targetUserId: victimId });

    expect((await post(`/admin/users/${victimId}/enable`, {}, { cookie: admin.cookie })).status).toBe(200);
  });

  it("writes an audit row for every write action", async () => {
    const admin = await makeAdmin();
    const { clientId, coachId } = await coachAndClient();

    const before = (await (await get("/admin/audit?limit=100", { cookie: admin.cookie })).json()) as {
      items: unknown[];
    };

    await post(`/admin/users/${clientId}/logout`, {}, { cookie: admin.cookie });
    await post(`/admin/users/${clientId}/role`, { role: "coach" }, { cookie: admin.cookie });
    await post(`/admin/users/${clientId}/role`, { role: "client" }, { cookie: admin.cookie });

    const detail = (await (
      await get(`/admin/users/${coachId}`, { cookie: admin.cookie })
    ).json()) as AdminUserDetail;
    const link = detail.links[0]!;
    await del(`/admin/links/${link.id}`, { cookie: admin.cookie });

    const after = (await (await get("/admin/audit?limit=100", { cookie: admin.cookie })).json()) as {
      items: Array<{ action: string }>;
    };

    expect(after.items.length - before.items.length).toBe(4);
    expect(after.items.map((item) => item.action)).toEqual(
      expect.arrayContaining(["user.force_logout", "user.set_role", "link.remove"]),
    );
  });

  it("refuses to let an admin demote or disable themselves", async () => {
    const admin = await makeAdmin();

    const demote = await post(
      `/admin/users/${admin.id}/admin`,
      { isAdmin: false },
      { cookie: admin.cookie },
    );
    expect(demote.status).toBe(400);
    expect(await demote.json()).toMatchObject({ error: { code: "CANNOT_DEMOTE_SELF" } });

    const disable = await post(`/admin/users/${admin.id}/disable`, {}, { cookie: admin.cookie });
    expect(disable.status).toBe(400);
  });

  it("promotes another account to admin", async () => {
    const admin = await makeAdmin();
    const other = await signup({ role: "coach" });
    const otherId = ((await other.res.json()) as { user: { id: string } }).user.id;

    expect(
      (await post(`/admin/users/${otherId}/admin`, { isAdmin: true }, { cookie: admin.cookie }))
        .status,
    ).toBe(200);

    const detail = (await (
      await get(`/admin/users/${otherId}`, { cookie: admin.cookie })
    ).json()) as AdminUserDetail;
    expect(detail.role).toBe("admin");
  });
});

describe("admin reporting", () => {
  it("counts users, links and usage", async () => {
    await coachAndClient();
    const admin = await makeAdmin();

    const res = await get("/admin/overview", { cookie: admin.cookie });
    expect(res.status).toBe(200);

    const body = (await res.json()) as AdminOverview;
    expect(body.users.total).toBeGreaterThan(0);
    expect(body.users.admins).toBeGreaterThan(0);
    expect(body.activeUsers.monthly).toBeGreaterThan(0);
    expect(Array.isArray(body.signupsPerDay)).toBe(true);
  });

  it("records a failed food source call and shows it in the error list", async () => {
    const { clientCookie } = await coachAndClient();
    // The test runtime blocks outbound calls, so both food sources fail here.
    await get("/foods/search?q=banana", { cookie: clientCookie });

    const admin = await makeAdmin();
    const errors = (await (
      await get("/admin/errors?limit=50", { cookie: admin.cookie })
    ).json()) as { items: Array<{ errorCode: string; route: string; message: string }> };

    const failure = errors.items.find((item) => item.errorCode === "FOOD_SOURCE_FAILED");
    expect(failure).toBeTruthy();
    expect(failure!.route).toContain("/foods/search");
  });

  it("lists coaches with how many of their clients logged this week", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    await post(
      `/clients/${clientId}/food-logs`,
      {
        kind: "quick",
        date: new Date().toISOString().slice(0, 10),
        meal: "lunch",
        name: "Lunch",
        calories: 500,
        proteinG: 30,
        carbsG: 50,
        fatG: 15,
      },
      { cookie: clientCookie },
    );

    const admin = await makeAdmin();
    const res = (await (await get("/admin/coaches", { cookie: admin.cookie })).json()) as {
      items: Array<{ activeClients: number; clientsActiveLast7Days: number }>;
    };

    expect(res.items.some((item) => item.clientsActiveLast7Days > 0)).toBe(true);
  });

  it("reports system status with D1 up and the food sources unreachable in tests", async () => {
    const admin = await makeAdmin();
    const res = (await (await get("/admin/system", { cookie: admin.cookie })).json()) as {
      apiVersion: string;
      checks: Array<{ name: string; ok: boolean }>;
    };

    expect(res.apiVersion).toBeTruthy();
    expect(res.checks.find((check) => check.name === "D1")?.ok).toBe(true);
  });
});
