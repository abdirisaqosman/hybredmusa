import { createRoute, z } from "@hono/zod-openapi";
import {
  adminCoachSchema,
  adminOverviewSchema,
  adminUserDetailSchema,
  adminUserSchema,
  auditEntrySchema,
  errorLogSchema,
  okSchema,
  paginatedSchema,
  paginationQuerySchema,
  setAdminBodySchema,
  setRoleBodySchema,
  systemStatusSchema,
} from "@hybredmusa/shared";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { badRequest, notFound } from "../errors.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso } from "../lib/time.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  audit,
  coachSummaries,
  listAudit,
  listErrors,
  listUsers,
  overview,
  userDetail,
} from "../services/admin.js";
import { revokeAllSessions } from "../services/sessions.js";
import type { App, Env } from "../types.js";

const adminOnly = [requireAuth, requireRole("admin")];
const userParam = z.object({ userId: z.string().min(1) });

const common = {
  tags: ["admin"] as string[],
  security: authSecurity,
  middleware: adminOnly,
};

const getOverview = createRoute({
  ...common,
  method: "get",
  path: "/admin/overview",
  summary: "Totals, active users, usage and error count",
  responses: {
    200: jsonContent(adminOverviewSchema, "Overview"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getUsers = createRoute({
  ...common,
  method: "get",
  path: "/admin/users",
  summary: "Search accounts",
  request: { query: paginationQuerySchema.extend({ q: z.string().max(100).optional() }) },
  responses: {
    200: jsonContent(paginatedSchema(adminUserSchema), "Users"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getUser = createRoute({
  ...common,
  method: "get",
  path: "/admin/users/{userId}",
  summary: "One account, with links and activity counts",
  description: "Counts only. No food, workout, bodyweight or comment content is returned here.",
  request: { params: userParam },
  responses: {
    200: jsonContent(adminUserDetailSchema, "User"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const disableUser = createRoute({
  ...common,
  method: "post",
  path: "/admin/users/{userId}/disable",
  summary: "Disable an account and revoke its sessions",
  request: { params: userParam },
  responses: {
    200: jsonContent(okSchema, "Disabled"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const enableUser = createRoute({
  ...common,
  method: "post",
  path: "/admin/users/{userId}/enable",
  summary: "Re-enable an account",
  request: { params: userParam },
  responses: {
    200: jsonContent(okSchema, "Enabled"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const forceLogout = createRoute({
  ...common,
  method: "post",
  path: "/admin/users/{userId}/logout",
  summary: "Revoke every session for an account",
  request: { params: userParam },
  responses: {
    200: jsonContent(okSchema, "Sessions revoked"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const setRole = createRoute({
  ...common,
  method: "post",
  path: "/admin/users/{userId}/role",
  summary: "Switch an account between coach and client",
  request: { params: userParam, ...jsonBody(setRoleBodySchema) },
  responses: {
    200: jsonContent(okSchema, "Role changed"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const setAdmin = createRoute({
  ...common,
  method: "post",
  path: "/admin/users/{userId}/admin",
  summary: "Promote to admin or demote back to client",
  description: "An admin cannot demote themselves, so the app can never be left without one.",
  request: { params: userParam, ...jsonBody(setAdminBodySchema) },
  responses: {
    200: jsonContent(okSchema, "Changed"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const unlink = createRoute({
  ...common,
  method: "delete",
  path: "/admin/links/{linkId}",
  summary: "Unlink a coach and a client",
  request: { params: z.object({ linkId: z.string().min(1) }) },
  responses: {
    200: jsonContent(okSchema, "Unlinked"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const getCoaches = createRoute({
  ...common,
  method: "get",
  path: "/admin/coaches",
  summary: "Coaches with client counts and how many logged something this week",
  responses: {
    200: jsonContent(z.object({ items: z.array(adminCoachSchema) }), "Coaches"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getErrors = createRoute({
  ...common,
  method: "get",
  path: "/admin/errors",
  summary: "Recent 5xx responses and failed calls to food sources",
  request: {
    query: paginationQuerySchema.extend({
      route: z.string().max(200).optional(),
      status: z.coerce.number().int().optional(),
    }),
  },
  responses: {
    200: jsonContent(paginatedSchema(errorLogSchema), "Errors"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getAudit = createRoute({
  ...common,
  method: "get",
  path: "/admin/audit",
  summary: "Every admin write action",
  request: { query: paginationQuerySchema },
  responses: {
    200: jsonContent(paginatedSchema(auditEntrySchema), "Audit log"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getSystem = createRoute({
  ...common,
  method: "get",
  path: "/admin/system",
  summary: "Version, commit and a live check of D1 and the food sources",
  responses: {
    200: jsonContent(systemStatusSchema, "System status"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

async function loadUser(env: Env, userId: string) {
  const rows = await db(env).select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound("No such user", "USER_NOT_FOUND");
  return user;
}

async function timedCheck(name: string, run: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await run();
    return { name, ok: true, ms: Date.now() - started, detail: null };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - started, detail: String(error).slice(0, 200) };
  }
}

export function registerAdminRoutes(app: App) {
  app.openapi(getOverview, async (c) => c.json(await overview(c.env), 200));

  app.openapi(getUsers, async (c) => {
    const { q, cursor, limit } = c.req.valid("query");
    return c.json(await listUsers(c.env, q, limit, cursor), 200);
  });

  app.openapi(getUser, async (c) => {
    const detail = await userDetail(c.env, c.req.valid("param").userId);
    if (!detail) throw notFound("No such user", "USER_NOT_FOUND");
    return c.json(detail, 200);
  });

  app.openapi(disableUser, async (c) => {
    const { userId } = c.req.valid("param");
    const admin = currentUser(c);
    if (userId === admin.id) throw badRequest("You cannot disable yourself", "CANNOT_DISABLE_SELF");
    await loadUser(c.env, userId);

    await db(c.env)
      .update(schema.users)
      .set({ disabledAt: nowIso() })
      .where(eq(schema.users.id, userId));
    await revokeAllSessions(c.env, userId);
    await audit(c.env, admin.id, "user.disable", userId);

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(enableUser, async (c) => {
    const { userId } = c.req.valid("param");
    const admin = currentUser(c);
    await loadUser(c.env, userId);

    await db(c.env)
      .update(schema.users)
      .set({ disabledAt: null })
      .where(eq(schema.users.id, userId));
    await audit(c.env, admin.id, "user.enable", userId);

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(forceLogout, async (c) => {
    const { userId } = c.req.valid("param");
    const admin = currentUser(c);
    await loadUser(c.env, userId);

    await revokeAllSessions(c.env, userId);
    await audit(c.env, admin.id, "user.force_logout", userId);

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(setRole, async (c) => {
    const { userId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const admin = currentUser(c);
    const user = await loadUser(c.env, userId);
    if (user.role === "admin") {
      throw badRequest("Demote the admin first", "USER_IS_ADMIN");
    }

    await db(c.env).update(schema.users).set({ role }).where(eq(schema.users.id, userId));
    await audit(c.env, admin.id, "user.set_role", userId, { from: user.role, to: role });

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(setAdmin, async (c) => {
    const { userId } = c.req.valid("param");
    const { isAdmin } = c.req.valid("json");
    const admin = currentUser(c);
    if (userId === admin.id && !isAdmin) {
      throw badRequest("You cannot demote yourself", "CANNOT_DEMOTE_SELF");
    }
    const user = await loadUser(c.env, userId);

    const role = isAdmin ? "admin" : "client";
    await db(c.env).update(schema.users).set({ role }).where(eq(schema.users.id, userId));
    await audit(c.env, admin.id, isAdmin ? "user.promote_admin" : "user.demote_admin", userId, {
      from: user.role,
      to: role,
    });

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(unlink, async (c) => {
    const { linkId } = c.req.valid("param");
    const admin = currentUser(c);

    const rows = await db(c.env)
      .select()
      .from(schema.coachClients)
      .where(eq(schema.coachClients.id, linkId))
      .limit(1);
    const link = rows[0];
    if (!link) throw notFound("No such link", "LINK_NOT_FOUND");

    await db(c.env).delete(schema.coachClients).where(eq(schema.coachClients.id, linkId));
    await audit(c.env, admin.id, "link.remove", link.clientId, { coachId: link.coachId });

    return c.json({ ok: true } as const, 200);
  });

  app.openapi(getCoaches, async (c) => c.json({ items: await coachSummaries(c.env) }, 200));

  app.openapi(getErrors, async (c) => {
    const { route, status, cursor, limit } = c.req.valid("query");
    return c.json(await listErrors(c.env, { route, status }, limit, cursor), 200);
  });

  app.openapi(getAudit, async (c) => {
    const { cursor, limit } = c.req.valid("query");
    return c.json(await listAudit(c.env, limit, cursor), 200);
  });

  app.openapi(getSystem, async (c) => {
    const checks = await Promise.all([
      timedCheck("D1", () => c.env.DB.prepare("select 1").first()),
      timedCheck("Open Food Facts", async () => {
        const res = await fetch("https://world.openfoodfacts.org/api/v2/product/737628064502.json?fields=code", {
          headers: { "user-agent": "Hybredmusa/0.1 status check" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
      }),
      timedCheck("USDA FoodData Central", async () => {
        if (!c.env.USDA_API_KEY) throw new Error("USDA_API_KEY is not set");
        const res = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${c.env.USDA_API_KEY}&query=apple&pageSize=1`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
      }),
    ]);

    return c.json(
      {
        apiVersion: c.env.API_VERSION ?? "unknown",
        commit: c.env.GIT_COMMIT ?? "unknown",
        checks,
      },
      200,
    );
  });
}
