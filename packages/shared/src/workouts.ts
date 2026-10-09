import { z } from "zod";
import { isoDate, isoTimestamp } from "./common.js";

export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.string(),
  equipment: z.string(),
  /** Built in exercises have no creator and cannot be edited by users. */
  isCustom: z.boolean(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const createExerciseBodySchema = z.object({
  name: z.string().min(1).max(100),
  muscleGroup: z.string().min(1).max(50),
  equipment: z.string().min(1).max(50),
});

export const templateExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  position: z.number().int(),
  targetSets: z.number().int().nullable(),
  targetReps: z.number().int().nullable(),
  targetWeight: z.number().nullable(),
  restSeconds: z.number().int().nullable(),
});

export const workoutTemplateSchema = z.object({
  id: z.string(),
  coachId: z.string(),
  clientId: z.string().nullable(),
  name: z.string(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  exercises: z.array(templateExerciseSchema),
});
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

export const templateExerciseInputSchema = z.object({
  exerciseId: z.string().min(1),
  targetSets: z.number().int().min(1).max(20).nullable().optional(),
  targetReps: z.number().int().min(1).max(100).nullable().optional(),
  targetWeight: z.number().min(0).max(1000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
});

export const saveTemplateBodySchema = z.object({
  name: z.string().min(1).max(100),
  notes: z.string().max(2000).nullable().optional(),
  exercises: z.array(templateExerciseInputSchema).min(1).max(40),
});

export const sessionSetSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  exerciseName: z.string(),
  setNumber: z.number().int(),
  reps: z.number().int(),
  weight: z.number(),
  rpe: z.number().nullable(),
});
export type SessionSet = z.infer<typeof sessionSetSchema>;

export const workoutSessionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  templateId: z.string().nullable(),
  templateName: z.string().nullable(),
  date: isoDate,
  startedAt: isoTimestamp,
  finishedAt: isoTimestamp.nullable(),
  notes: z.string().nullable(),
  sets: z.array(sessionSetSchema),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

export const workoutSessionSummarySchema = workoutSessionSchema
  .omit({ sets: true })
  .extend({
    setCount: z.number().int(),
    totalVolume: z.number(),
    exerciseNames: z.array(z.string()),
  });
export type WorkoutSessionSummary = z.infer<typeof workoutSessionSummarySchema>;

export const startSessionBodySchema = z.object({
  templateId: z.string().nullable().optional(),
  date: isoDate.optional(),
});

export const logSetBodySchema = z.object({
  exerciseId: z.string().min(1),
  reps: z.number().int().min(0).max(1000),
  weight: z.number().min(0).max(1000),
  rpe: z.number().min(1).max(10).nullable().optional(),
  setNumber: z.number().int().min(1).max(100).optional(),
});

export const finishSessionBodySchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
});

/** What the client did for this exercise last time, shown while logging. */
export const previousPerformanceSchema = z.object({
  sessionId: z.string(),
  date: isoDate,
  sets: z.array(sessionSetSchema),
});
