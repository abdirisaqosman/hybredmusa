import { createRoute, z } from "@hono/zod-openapi";
import {
  createFoodLogBodySchema,
  diarySchema,
  foodLogSchema,
  isoDate,
  nutritionTargetSchema,
  okSchema,
  setTargetBodySchema,
} from "@hybredmusa/shared";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { notFound } from "../errors.js";
import { newId } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso, today } from "../lib/time.js";
import { requireAuth } from "../middleware/auth.js";
import {
  assertCanReadClient,
  assertCanWriteLogs,
  assertCanWritePlan,
  getClientOrThrow,
} from "../services/access.js";
import { resolveFoodRef } from "../services/foods.js";
import { buildDiary, macrosForGrams, targetOn, targetRowToTarget } from "../services/nutrition.js";
import type { App } from "../types.js";

const clientParam = z.object({ clientId: z.string().min(1) });
const dateQuery = z.object({ date: isoDate.optional() });

const getTarget = createRoute({
  method: "get",
  path: "/clients/{clientId}/targets",
  tags: ["nutrition"],
  summary: "The macro target in force on a day",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, query: dateQuery },
  responses: {
    200: jsonContent(z.object({ target: nutritionTargetSchema.nullable() }), "The target"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const listTargets = createRoute({
  method: "get",
  path: "/clients/{clientId}/targets/history",
  tags: ["nutrition"],
  summary: "Every target ever set for this client, newest first",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam },
  responses: {
    200: jsonContent(z.object({ items: z.array(nutritionTargetSchema) }), "Targets"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const setTarget = createRoute({
  method: "post",
  path: "/clients/{clientId}/targets",
  tags: ["nutrition"],
  summary: "Set a macro target, as the client's coach",
  description: "Writes a new row. Past days keep the target they had when they were logged.",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(setTargetBodySchema) },
  responses: {
    201: jsonContent(nutritionTargetSchema, "Target set"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const getDiary = createRoute({
  method: "get",
  path: "/clients/{clientId}/diary",
  tags: ["nutrition"],
  summary: "A day of food logs with totals, targets and what is left",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, query: dateQuery },
  responses: {
    200: jsonContent(diarySchema, "The diary for that day"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const addFoodLog = createRoute({
  method: "post",
  path: "/clients/{clientId}/food-logs",
  tags: ["nutrition"],
  summary: "Log a food, by weight or as a quick add",
  description: "The entry stores a snapshot of the macros, so later food edits never change it.",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(createFoodLogBodySchema) },
  responses: {
    201: jsonContent(foodLogSchema, "Entry created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const deleteFoodLog = createRoute({
  method: "delete",
  path: "/clients/{clientId}/food-logs/{logId}",
  tags: ["nutrition"],
  summary: "Delete one of your own entries",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam.extend({ logId: z.string().min(1) }) },
  responses: {
    200: jsonContent(okSchema, "Deleted"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export function registerNutritionRoutes(app: App) {
  app.openapi(getTarget, async (c) => {
    const { clientId } = c.req.valid("param");
    const date = c.req.valid("query").date ?? today();
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json({ target: await targetOn(c.env, clientId, date) }, 200);
  });

  app.openapi(listTargets, async (c) => {
    const { clientId } = c.req.valid("param");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    const rows = await db(c.env)
      .select()
      .from(schema.nutritionTargets)
      .where(eq(schema.nutritionTargets.clientId, clientId))
      .orderBy(desc(schema.nutritionTargets.effectiveFrom), desc(schema.nutritionTargets.createdAt));

    return c.json({ items: rows.map(targetRowToTarget) }, 200);
  });

  app.openapi(setTarget, async (c) => {
    const { clientId } = c.req.valid("param");
    const body = c.req.valid("json");
    const coach = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    await assertCanWritePlan(c.env, coach, clientId);

    const row = {
      id: newId(),
      clientId,
      calories: body.calories,
      proteinG: body.proteinG,
      carbsG: body.carbsG,
      fatG: body.fatG,
      effectiveFrom: body.effectiveFrom ?? today(),
      setBy: coach.id,
      createdAt: nowIso(),
    };
    await db(c.env).insert(schema.nutritionTargets).values(row);

    return c.json(targetRowToTarget(row), 201);
  });

  app.openapi(getDiary, async (c) => {
    const { clientId } = c.req.valid("param");
    const date = c.req.valid("query").date ?? today();
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json(await buildDiary(c.env, clientId, date), 200);
  });

  app.openapi(addFoodLog, async (c) => {
    const { clientId } = c.req.valid("param");
    const body = c.req.valid("json");
    const user = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    assertCanWriteLogs(user, clientId);

    const base = { id: newId(), clientId, date: body.date, meal: body.meal, createdAt: nowIso() };

    const row =
      body.kind === "food"
        ? await (async () => {
            const food = await resolveFoodRef(c.env, body.foodRef, user.id);
            const macros = macrosForGrams(food, body.grams);
            return {
              ...base,
              foodId: food.id,
              name: food.brand ? `${food.name} (${food.brand})` : food.name,
              grams: body.grams,
              ...macros,
            };
          })()
        : {
            ...base,
            foodId: null,
            name: body.name,
            grams: 0,
            calories: body.calories,
            proteinG: body.proteinG,
            carbsG: body.carbsG,
            fatG: body.fatG,
          };

    await db(c.env).insert(schema.foodLogs).values(row);
    return c.json(row, 201);
  });

  app.openapi(deleteFoodLog, async (c) => {
    const { clientId, logId } = c.req.valid("param");
    const user = currentUser(c);
    assertCanWriteLogs(user, clientId);

    const rows = await db(c.env)
      .select({ id: schema.foodLogs.id })
      .from(schema.foodLogs)
      .where(and(eq(schema.foodLogs.id, logId), eq(schema.foodLogs.clientId, clientId)))
      .limit(1);
    if (!rows.length) throw notFound("No such entry", "LOG_NOT_FOUND");

    await db(c.env).delete(schema.foodLogs).where(eq(schema.foodLogs.id, logId));
    return c.json({ ok: true } as const, 200);
  });
}
