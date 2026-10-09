import { z } from "zod";
import { isoDate, isoTimestamp } from "./common.js";

export const stepsSourceSchema = z.enum(["manual", "device"]);

export const dailyMetricSchema = z.object({
  date: isoDate,
  clientId: z.string(),
  steps: z.number().int().nullable(),
  bodyweightKg: z.number().nullable(),
  stepsSource: stepsSourceSchema.nullable(),
  updatedAt: isoTimestamp,
});
export type DailyMetric = z.infer<typeof dailyMetricSchema>;

export const upsertMetricBodySchema = z
  .object({
    steps: z.number().int().min(0).max(200000).nullable().optional(),
    bodyweightKg: z.number().min(20).max(500).nullable().optional(),
    stepsSource: stepsSourceSchema.optional(),
  })
  .refine((body) => body.steps !== undefined || body.bodyweightKg !== undefined, {
    message: "Send steps, bodyweightKg, or both",
  });

/** The mobile app syncs many days at once, for example from Health Connect. */
export const batchMetricsBodySchema = z.object({
  items: z
    .array(
      z.object({
        date: isoDate,
        steps: z.number().int().min(0).max(200000).nullable().optional(),
        bodyweightKg: z.number().min(20).max(500).nullable().optional(),
        stepsSource: stepsSourceSchema.optional(),
      }),
    )
    .min(1)
    .max(400),
});
