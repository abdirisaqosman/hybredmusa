import { createRoute, z } from "@hono/zod-openapi";
import {
  batchMetricsBodySchema,
  dailyMetricSchema,
  isoDate,
  upsertMetricBodySchema,
} from "@hybredmusa/shared";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCanReadClient, assertCanWriteLogs, getClientOrThrow } from "../services/access.js";
import { upsertMetrics } from "../services/metrics.js";
import type { App } from "../types.js";

const clientParam = z.object({ clientId: z.string().min(1) });

const listMetrics = createRoute({
  method: "get",
  path: "/clients/{clientId}/metrics",
  tags: ["metrics"],
  summary: "Daily steps and bodyweight over a date range",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    params: clientParam,
    query: z.object({ from: isoDate.optional(), to: isoDate.optional() }),
  },
  responses: {
    200: jsonContent(z.object({ items: z.array(dailyMetricSchema) }), "Metrics"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const putMetric = createRoute({
  method: "put",
  path: "/clients/{clientId}/metrics/{date}",
  tags: ["metrics"],
  summary: "Set steps or bodyweight for one day",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    params: clientParam.extend({ date: isoDate }),
    ...jsonBody(upsertMetricBodySchema),
  },
  responses: {
    200: jsonContent(dailyMetricSchema, "Saved"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const batchMetrics = createRoute({
  method: "post",
  path: "/clients/{clientId}/metrics/batch",
  tags: ["metrics"],
  summary: "Upsert many days at once",
  description:
    "Built for the mobile app syncing steps from Health Connect or HealthKit. Each day is upserted on client and date.",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(batchMetricsBodySchema) },
  responses: {
    200: jsonContent(
      z.object({ saved: z.number().int(), items: z.array(dailyMetricSchema) }),
      "Saved",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export function registerMetricRoutes(app: App) {
  app.openapi(listMetrics, async (c) => {
    const { clientId } = c.req.valid("param");
    const { from, to } = c.req.valid("query");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    const rows = await db(c.env)
      .select()
      .from(schema.dailyMetrics)
      .where(
        and(
          eq(schema.dailyMetrics.clientId, clientId),
          from ? gte(schema.dailyMetrics.date, from) : undefined,
          to ? lte(schema.dailyMetrics.date, to) : undefined,
        ),
      )
      .orderBy(asc(schema.dailyMetrics.date));

    return c.json(
      {
        items: rows.map((row) => ({
          date: row.date,
          clientId: row.clientId,
          steps: row.steps,
          bodyweightKg: row.bodyweightKg,
          stepsSource: row.stepsSource,
          updatedAt: row.updatedAt,
        })),
      },
      200,
    );
  });

  app.openapi(putMetric, async (c) => {
    const { clientId, date } = c.req.valid("param");
    const body = c.req.valid("json");
    await getClientOrThrow(c.env, clientId);
    assertCanWriteLogs(currentUser(c), clientId);

    const [saved] = await upsertMetrics(c.env, clientId, [{ date, ...body }]);
    return c.json(saved!, 200);
  });

  app.openapi(batchMetrics, async (c) => {
    const { clientId } = c.req.valid("param");
    const { items } = c.req.valid("json");
    await getClientOrThrow(c.env, clientId);
    assertCanWriteLogs(currentUser(c), clientId);

    const saved = await upsertMetrics(c.env, clientId, items);
    return c.json({ saved: saved.length, items: saved }, 200);
  });
}
