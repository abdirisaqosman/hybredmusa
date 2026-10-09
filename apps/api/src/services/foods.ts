import { desc, eq, like, or, sql } from "drizzle-orm";
import type { Food } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { badRequest, notFound } from "../errors.js";
import { newId } from "../lib/crypto.js";
import { nowIso } from "../lib/time.js";
import type { Env } from "../types.js";

const USER_AGENT = "Hybredmusa/0.1 (fitness tracker; contact via github.com/abdirisaqosman/hybredmusa)";
const TIMEOUT_MS = 6000;

type Row = typeof schema.foods.$inferSelect;

export function rowToFood(row: Row): Food {
  return {
    ref: row.id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    source: row.source,
    caloriesPer100g: row.caloriesPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatPer100g: row.fatPer100g,
  };
}

const num = (value: unknown): number => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
};

/** Foods already in our database, including custom ones. */
export async function searchLocal(env: Env, query: string, limit: number): Promise<Food[]> {
  const rows = await db(env)
    .select()
    .from(schema.foods)
    .where(or(like(schema.foods.name, `%${query}%`), like(schema.foods.brand, `%${query}%`)))
    .orderBy(desc(schema.foods.createdAt))
    .limit(limit);
  return rows.map(rowToFood);
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

function offToFood(product: OffProduct): Food | null {
  const name = product.product_name?.trim();
  const code = product.code?.trim();
  if (!name || !code) return null;

  const n = product.nutriments ?? {};
  const calories = num(n["energy-kcal_100g"]);
  if (!calories) return null;

  return {
    ref: `off:${code}`,
    name,
    brand: product.brands?.split(",")[0]?.trim() || null,
    barcode: code,
    source: "off",
    caloriesPer100g: calories,
    proteinPer100g: num(n["proteins_100g"]),
    carbsPer100g: num(n["carbohydrates_100g"]),
    fatPer100g: num(n["fat_100g"]),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

/**
 * Open Food Facts search lives on search.openfoodfacts.org now. It returns
 * matches without nutrition values, so we pull each hit's per 100 g numbers
 * from the product API in parallel and drop anything without calories.
 */
export async function searchOpenFoodFacts(query: string, limit: number): Promise<Food[]> {
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}` +
    `&page_size=${Math.min(limit, 10)}&fields=code,product_name,brands`;
  const data = await fetchJson<{ hits?: Array<{ code?: string; product_name?: string }> }>(url);

  const codes = (data.hits ?? [])
    .map((hit) => hit.code)
    .filter((code): code is string => Boolean(code));

  const products = await Promise.allSettled(codes.map((code) => barcodeOpenFoodFacts(code)));

  return products
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((food): food is Food => food !== null);
}

export async function barcodeOpenFoodFacts(barcode: string): Promise<Food | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    `?fields=code,product_name,brands,nutriments`;
  const data = await fetchJson<{ status?: number; product?: OffProduct }>(url);
  if (!data.product) return null;
  return offToFood({ ...data.product, code: data.product.code ?? barcode });
}

interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  foodNutrients?: Array<{ nutrientNumber?: string; number?: string; value?: number }>;
}

function usdaToFood(food: UsdaFood): Food | null {
  if (!food.fdcId || !food.description) return null;

  const byNumber = (code: string) =>
    num(
      food.foodNutrients?.find((n) => (n.nutrientNumber ?? n.number) === code)?.value ?? 0,
    );

  const calories = byNumber("1008");
  if (!calories) return null;

  return {
    ref: `usda:${food.fdcId}`,
    name: food.description,
    brand: food.brandOwner ?? null,
    barcode: null,
    source: "usda",
    caloriesPer100g: calories,
    proteinPer100g: byNumber("1003"),
    carbsPer100g: byNumber("1005"),
    fatPer100g: byNumber("1004"),
  };
}

export async function searchUsda(env: Env, query: string, limit: number): Promise<Food[]> {
  if (!env.USDA_API_KEY) return [];
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${env.USDA_API_KEY}` +
    `&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy`;
  const data = await fetchJson<{ foods?: UsdaFood[] }>(url);
  return (data.foods ?? []).map(usdaToFood).filter((f): f is Food => f !== null);
}

async function cacheFood(env: Env, food: Food, createdBy: string | null): Promise<Row> {
  const existing = await db(env)
    .select()
    .from(schema.foods)
    .where(
      food.barcode
        ? eq(schema.foods.barcode, food.barcode)
        : sql`${schema.foods.name} = ${food.name} and ${schema.foods.source} = ${food.source}`,
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const row: Row = {
    id: newId(),
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    source: food.source,
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    carbsPer100g: food.carbsPer100g,
    fatPer100g: food.fatPer100g,
    createdBy,
    createdAt: nowIso(),
  };
  await db(env).insert(schema.foods).values(row);
  return row;
}

/**
 * Turns a search result reference into a stored food row, so every logged food
 * exists in our own database and the log can snapshot it.
 */
export async function resolveFoodRef(env: Env, ref: string, userId: string): Promise<Row> {
  const [prefix, ...rest] = ref.split(":");
  const externalId = rest.join(":");

  if (prefix === "off") {
    const local = await db(env)
      .select()
      .from(schema.foods)
      .where(eq(schema.foods.barcode, externalId))
      .limit(1);
    if (local[0]) return local[0];

    const food = await barcodeOpenFoodFacts(externalId);
    if (!food) throw notFound("That food is not in Open Food Facts", "FOOD_NOT_FOUND");
    return cacheFood(env, food, userId);
  }

  if (prefix === "usda") {
    const found = await searchUsdaById(env, externalId);
    if (!found) throw notFound("That food is not in FoodData Central", "FOOD_NOT_FOUND");
    return cacheFood(env, found, userId);
  }

  const rows = await db(env).select().from(schema.foods).where(eq(schema.foods.id, ref)).limit(1);
  const row = rows[0];
  if (!row) throw badRequest("Unknown food reference", "UNKNOWN_FOOD_REF");
  return row;
}

async function searchUsdaById(env: Env, fdcId: string): Promise<Food | null> {
  if (!env.USDA_API_KEY) return null;
  const url = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}?api_key=${env.USDA_API_KEY}`;
  const data = await fetchJson<UsdaFood>(url);
  return usdaToFood(data);
}
