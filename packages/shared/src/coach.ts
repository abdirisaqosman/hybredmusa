import { z } from "zod";
import { isoDate, isoTimestamp } from "./common.js";
import { publicUserSchema } from "./auth.js";

/** One row of the coach dashboard: is this client on track right now. */
export const clientAdherenceSchema = z.object({
  client: publicUserSchema,
  loggedFoodToday: z.boolean(),
  caloriesToday: z.number(),
  targetCalories: z.number().int().nullable(),
  avgCalories7d: z.number().nullable(),
  /** Average daily calories over the last 7 days as a percent of target. */
  adherencePct: z.number().nullable(),
  workoutsThisWeek: z.number().int(),
  lastBodyweightKg: z.number().nullable(),
  stepsToday: z.number().int().nullable(),
});
export type ClientAdherence = z.infer<typeof clientAdherenceSchema>;

export const dayNutritionPointSchema = z.object({
  date: isoDate,
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  targetCalories: z.number().int().nullable(),
});

export const dayValuePointSchema = z.object({
  date: isoDate,
  value: z.number().nullable(),
});

export const progressSchema = z.object({
  clientId: z.string(),
  from: isoDate,
  to: isoDate,
  nutrition: z.array(dayNutritionPointSchema),
  bodyweight: z.array(dayValuePointSchema),
  steps: z.array(dayValuePointSchema),
});
export type Progress = z.infer<typeof progressSchema>;

/** Best set per session for one exercise, for a strength over time chart. */
export const exerciseHistoryPointSchema = z.object({
  date: isoDate,
  sessionId: z.string(),
  bestWeight: z.number(),
  repsAtBestWeight: z.number().int(),
  estimated1rm: z.number(),
  totalVolume: z.number(),
});

export const exerciseHistorySchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  points: z.array(exerciseHistoryPointSchema),
});
export type ExerciseHistory = z.infer<typeof exerciseHistorySchema>;

export const commentTargetSchema = z.enum(["day", "session"]);

export const commentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  author: publicUserSchema,
  targetType: commentTargetSchema,
  targetRef: z.string(),
  body: z.string(),
  createdAt: isoTimestamp,
});
export type Comment = z.infer<typeof commentSchema>;

export const createCommentBodySchema = z.object({
  targetType: commentTargetSchema,
  targetRef: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
});
