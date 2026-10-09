import { createRoute, z } from "@hono/zod-openapi";
import { createFoodBodySchema, foodSchema } from "@hybredmusa/shared";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { notFound } from "../errors.js";
import { newId } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso } from "../lib/time.js";
import { requireAuth } from "../middleware/auth.js";
import {
  barcodeOpenFoodFacts,
  rowToFood,
  searchLocal,
  searchOpenFoodFacts,
  searchUsda,
} from "../services/foods.js";
import type { App } from "../types.js";

const searchFoods = createRoute({
  method: "get",
  path: "/foods/search",
  tags: ["nutrition"],
  summary: "Search foods across our own database, Open Food Facts and USDA",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    query: z.object({
      q: z.string().min(2).max(100),
      limit: z.coerce.number().int().min(1).max(25).default(10),
    }),
  },
  responses: {
    200: jsonContent(
      z.object({
        items: z.array(foodSchema),
        /** Which external sources answered, so the UI can say when one is down. */
        sources: z.object({ local: z.boolean(), off: z.boolean(), usda: z.boolean() }),
      }),
      "Search results",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

const foodByBarcode = createRoute({
  method: "get",
  path: "/foods/barcode/{barcode}",
  tags: ["nutrition"],
  summary: "Look up a food by barcode",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: z.object({ barcode: z.string().min(4).max(64) }) },
  responses: {
    200: jsonContent(foodSchema, "The food"),
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

const createFood = createRoute({
  method: "post",
  path: "/foods",
  tags: ["nutrition"],
  summary: "Create a custom food, stored per 100 g",
  security: authSecurity,
  middleware: [requireAuth],
  request: jsonBody(createFoodBodySchema),
  responses: {
    201: jsonContent(foodSchema, "Food created"),
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

export function registerFoodRoutes(app: App) {
  app.openapi(searchFoods, async (c) => {
    const { q, limit } = c.req.valid("query");

    const [local, off, usda] = await Promise.allSettled([
      searchLocal(c.env, q, limit),
      searchOpenFoodFacts(q, limit),
      searchUsda(c.env, q, limit),
    ]);

    const value = (result: PromiseSettledResult<unknown[]>) =>
      result.status === "fulfilled" ? result.value : [];

    const items = [...value(local), ...value(usda), ...value(off)].slice(0, limit * 2);

    return c.json(
      {
        items: items as z.infer<typeof foodSchema>[],
        sources: {
          local: local.status === "fulfilled",
          off: off.status === "fulfilled",
          usda: usda.status === "fulfilled",
        },
      },
      200,
    );
  });

  app.openapi(foodByBarcode, async (c) => {
    const { barcode } = c.req.valid("param");

    const local = await db(c.env)
      .select()
      .from(schema.foods)
      .where(eq(schema.foods.barcode, barcode))
      .limit(1);
    if (local[0]) return c.json(rowToFood(local[0]), 200);

    const food = await barcodeOpenFoodFacts(barcode).catch(() => null);
    if (!food) throw notFound("No food with that barcode", "FOOD_NOT_FOUND");
    return c.json(food, 200);
  });

  app.openapi(createFood, async (c) => {
    const body = c.req.valid("json");
    const user = currentUser(c);

    const existing = await db(c.env)
      .select()
      .from(schema.foods)
      .where(and(eq(schema.foods.name, body.name), eq(schema.foods.createdBy, user.id)))
      .limit(1);
    if (existing[0]) return c.json(rowToFood(existing[0]), 201);

    const row = {
      id: newId(),
      name: body.name,
      brand: body.brand ?? null,
      barcode: body.barcode ?? null,
      source: "custom" as const,
      caloriesPer100g: body.caloriesPer100g,
      proteinPer100g: body.proteinPer100g,
      carbsPer100g: body.carbsPer100g,
      fatPer100g: body.fatPer100g,
      createdBy: user.id,
      createdAt: nowIso(),
    };
    await db(c.env).insert(schema.foods).values(row);

    return c.json(rowToFood(row), 201);
  });
}
