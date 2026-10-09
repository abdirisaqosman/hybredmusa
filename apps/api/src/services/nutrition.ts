import { and, desc, eq, lte } from "drizzle-orm";
import type { Diary, Macros, Meal, NutritionTarget } from "@hybredmusa/shared";
import { MEALS } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import type { Env } from "../types.js";

const round = (n: number) => Math.round(n * 10) / 10;

const zero = (): Macros => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

function add(a: Macros, b: Macros): Macros {
  return {
    calories: round(a.calories + b.calories),
    proteinG: round(a.proteinG + b.proteinG),
    carbsG: round(a.carbsG + b.carbsG),
    fatG: round(a.fatG + b.fatG),
  };
}

export function targetRowToTarget(row: typeof schema.nutritionTargets.$inferSelect): NutritionTarget {
  return {
    id: row.id,
    clientId: row.clientId,
    calories: row.calories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    effectiveFrom: row.effectiveFrom,
    setBy: row.setBy,
    createdAt: row.createdAt,
  };
}

/** The target that was in force on a given day, never a later edit. */
export async function targetOn(env: Env, clientId: string, date: string) {
  const rows = await db(env)
    .select()
    .from(schema.nutritionTargets)
    .where(
      and(
        eq(schema.nutritionTargets.clientId, clientId),
        lte(schema.nutritionTargets.effectiveFrom, date),
      ),
    )
    .orderBy(desc(schema.nutritionTargets.effectiveFrom), desc(schema.nutritionTargets.createdAt))
    .limit(1);

  return rows[0] ? targetRowToTarget(rows[0]) : null;
}

export async function buildDiary(env: Env, clientId: string, date: string): Promise<Diary> {
  const [entries, targets] = await Promise.all([
    db(env)
      .select()
      .from(schema.foodLogs)
      .where(and(eq(schema.foodLogs.clientId, clientId), eq(schema.foodLogs.date, date)))
      .orderBy(schema.foodLogs.createdAt),
    targetOn(env, clientId, date),
  ]);

  let totals = zero();
  const meals = MEALS.map((meal: Meal) => {
    const mealEntries = entries
      .filter((e) => e.meal === meal)
      .map((e) => ({
        id: e.id,
        date: e.date,
        meal: e.meal,
        foodId: e.foodId,
        name: e.name,
        grams: e.grams,
        calories: e.calories,
        proteinG: e.proteinG,
        carbsG: e.carbsG,
        fatG: e.fatG,
        createdAt: e.createdAt,
      }));

    const mealTotals = mealEntries.reduce((acc, e) => add(acc, e), zero());
    totals = add(totals, mealTotals);
    return { meal, entries: mealEntries, totals: mealTotals };
  });

  const remaining = targets
    ? {
        calories: round(targets.calories - totals.calories),
        proteinG: round(targets.proteinG - totals.proteinG),
        carbsG: round(targets.carbsG - totals.carbsG),
        fatG: round(targets.fatG - totals.fatG),
      }
    : null;

  return { date, clientId, targets, totals, remaining, meals };
}

/** Macros for a weight of a food stored per 100 g. */
export function macrosForGrams(
  food: {
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  },
  grams: number,
): Macros {
  const factor = grams / 100;
  return {
    calories: round(food.caloriesPer100g * factor),
    proteinG: round(food.proteinPer100g * factor),
    carbsG: round(food.carbsPer100g * factor),
    fatG: round(food.fatPer100g * factor),
  };
}
