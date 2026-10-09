import { z } from "zod";
import { isoDate, isoTimestamp } from "./common.js";

export const mealSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type Meal = z.infer<typeof mealSchema>;
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export const macrosSchema = z.object({
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});
export type Macros = z.infer<typeof macrosSchema>;

export const nutritionTargetSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  calories: z.number().int(),
  proteinG: z.number().int(),
  carbsG: z.number().int(),
  fatG: z.number().int(),
  effectiveFrom: isoDate,
  setBy: z.string(),
  createdAt: isoTimestamp,
});
export type NutritionTarget = z.infer<typeof nutritionTargetSchema>;

/** A new row is written on every change, so past days keep the target they had. */
export const setTargetBodySchema = z.object({
  calories: z.number().int().min(500).max(10000),
  proteinG: z.number().int().min(0).max(1000),
  carbsG: z.number().int().min(0).max(2000),
  fatG: z.number().int().min(0).max(1000),
  effectiveFrom: isoDate.optional(),
});

export const foodSourceSchema = z.enum(["off", "usda", "custom"]);

/** A food the client can log. `ref` is a local id, or "off:<barcode>" / "usda:<fdcId>". */
export const foodSchema = z.object({
  ref: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  source: foodSourceSchema,
  caloriesPer100g: z.number(),
  proteinPer100g: z.number(),
  carbsPer100g: z.number(),
  fatPer100g: z.number(),
});
export type Food = z.infer<typeof foodSchema>;

export const createFoodBodySchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(200).optional(),
  barcode: z.string().max(64).optional(),
  caloriesPer100g: z.number().min(0).max(1000),
  proteinPer100g: z.number().min(0).max(100),
  carbsPer100g: z.number().min(0).max(100),
  fatPer100g: z.number().min(0).max(100),
});

export const foodLogSchema = z.object({
  id: z.string(),
  date: isoDate,
  meal: mealSchema,
  foodId: z.string().nullable(),
  name: z.string(),
  grams: z.number(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  createdAt: isoTimestamp,
});
export type FoodLog = z.infer<typeof foodLogSchema>;

/** Either log a known food by weight, or quick add the numbers directly. */
export const createFoodLogBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("food"),
    date: isoDate,
    meal: mealSchema,
    foodRef: z.string().min(1),
    grams: z.number().min(0.1).max(10000),
  }),
  z.object({
    kind: z.literal("quick"),
    date: isoDate,
    meal: mealSchema,
    name: z.string().min(1).max(200),
    calories: z.number().min(0).max(20000),
    proteinG: z.number().min(0).max(2000),
    carbsG: z.number().min(0).max(2000),
    fatG: z.number().min(0).max(2000),
  }),
]);
export type CreateFoodLogBody = z.infer<typeof createFoodLogBodySchema>;

export const updateFoodLogBodySchema = z.object({
  meal: mealSchema.optional(),
  grams: z.number().min(0.1).max(10000).optional(),
});

export const mealGroupSchema = z.object({
  meal: mealSchema,
  entries: z.array(foodLogSchema),
  totals: macrosSchema,
});

/** Everything the diary screen needs, already totalled by the API. */
export const diarySchema = z.object({
  date: isoDate,
  clientId: z.string(),
  targets: nutritionTargetSchema.nullable(),
  totals: macrosSchema,
  remaining: macrosSchema.nullable(),
  meals: z.array(mealGroupSchema),
});
export type Diary = z.infer<typeof diarySchema>;
