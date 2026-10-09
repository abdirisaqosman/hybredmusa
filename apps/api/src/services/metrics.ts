import { and, eq, inArray } from "drizzle-orm";
import type { DailyMetric } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { newId } from "../lib/crypto.js";
import { nowIso } from "../lib/time.js";
import type { Env } from "../types.js";

interface Input {
  date: string;
  steps?: number | null;
  bodyweightKg?: number | null;
  stepsSource?: "manual" | "device";
}

/**
 * Upsert on (client, date). A field that is not sent keeps its old value, so a
 * steps sync never wipes a bodyweight the client typed in.
 */
export async function upsertMetrics(
  env: Env,
  clientId: string,
  items: Input[],
): Promise<DailyMetric[]> {
  const d = db(env);
  const dates = items.map((item) => item.date);

  const existing = await d
    .select()
    .from(schema.dailyMetrics)
    .where(
      and(eq(schema.dailyMetrics.clientId, clientId), inArray(schema.dailyMetrics.date, dates)),
    );

  const byDate = new Map(existing.map((row) => [row.date, row]));
  const saved: DailyMetric[] = [];

  for (const item of items) {
    const current = byDate.get(item.date);
    const steps = item.steps !== undefined ? item.steps : (current?.steps ?? null);
    const bodyweightKg =
      item.bodyweightKg !== undefined ? item.bodyweightKg : (current?.bodyweightKg ?? null);
    const stepsSource =
      item.steps !== undefined
        ? (item.stepsSource ?? "manual")
        : (current?.stepsSource ?? null);
    const updatedAt = nowIso();

    if (current) {
      await d
        .update(schema.dailyMetrics)
        .set({ steps, bodyweightKg, stepsSource, updatedAt })
        .where(eq(schema.dailyMetrics.id, current.id));
    } else {
      await d.insert(schema.dailyMetrics).values({
        id: newId(),
        clientId,
        date: item.date,
        steps,
        bodyweightKg,
        stepsSource,
        updatedAt,
      });
    }

    saved.push({ date: item.date, clientId, steps, bodyweightKg, stepsSource, updatedAt });
  }

  return saved;
}
