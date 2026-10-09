import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type { ClientAdherence, ExerciseHistory, Progress } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { notFound } from "../errors.js";
import { today } from "../lib/time.js";
import { toPublicUser } from "./sessions.js";
import { targetOn } from "./nutrition.js";
import type { Env } from "../types.js";

const round = (n: number) => Math.round(n * 10) / 10;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the current week, so "workouts this week" means something stable. */
function startOfWeek() {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  return new Date(now.getTime() - day * 86_400_000).toISOString().slice(0, 10);
}

export async function dashboardForCoach(env: Env, coachId: string): Promise<ClientAdherence[]> {
  const d = db(env);
  const todayDate = today();
  const weekStart = startOfWeek();
  const sevenDaysAgo = daysAgo(6);

  const clients = await d
    .select({ client: schema.users })
    .from(schema.coachClients)
    .innerJoin(schema.users, eq(schema.users.id, schema.coachClients.clientId))
    .where(
      and(eq(schema.coachClients.coachId, coachId), eq(schema.coachClients.status, "active")),
    );

  return Promise.all(
    clients.map(async ({ client }) => {
      const [calorieRows, workoutRows, metricRows, target] = await Promise.all([
        d
          .select({
            date: schema.foodLogs.date,
            calories: sql<number>`sum(${schema.foodLogs.calories})`,
          })
          .from(schema.foodLogs)
          .where(
            and(
              eq(schema.foodLogs.clientId, client.id),
              gte(schema.foodLogs.date, sevenDaysAgo),
              lte(schema.foodLogs.date, todayDate),
            ),
          )
          .groupBy(schema.foodLogs.date),
        d
          .select({ id: schema.workoutSessions.id })
          .from(schema.workoutSessions)
          .where(
            and(
              eq(schema.workoutSessions.clientId, client.id),
              gte(schema.workoutSessions.date, weekStart),
            ),
          ),
        d
          .select()
          .from(schema.dailyMetrics)
          .where(
            and(
              eq(schema.dailyMetrics.clientId, client.id),
              gte(schema.dailyMetrics.date, sevenDaysAgo),
            ),
          )
          .orderBy(desc(schema.dailyMetrics.date)),
        targetOn(env, client.id, todayDate),
      ]);

      const caloriesToday = round(
        Number(calorieRows.find((row) => row.date === todayDate)?.calories ?? 0),
      );
      const avgCalories7d = calorieRows.length
        ? round(calorieRows.reduce((sum, row) => sum + Number(row.calories), 0) / 7)
        : null;

      return {
        client: toPublicUser(client),
        loggedFoodToday: caloriesToday > 0,
        caloriesToday,
        targetCalories: target?.calories ?? null,
        avgCalories7d,
        adherencePct:
          target && avgCalories7d !== null
            ? Math.round((avgCalories7d / target.calories) * 100)
            : null,
        workoutsThisWeek: workoutRows.length,
        lastBodyweightKg: metricRows.find((row) => row.bodyweightKg !== null)?.bodyweightKg ?? null,
        stepsToday: metricRows.find((row) => row.date === todayDate)?.steps ?? null,
      };
    }),
  );
}

export async function progressFor(
  env: Env,
  clientId: string,
  from: string,
  to: string,
): Promise<Progress> {
  const d = db(env);

  const [nutritionRows, metricRows, targetRows] = await Promise.all([
    d
      .select({
        date: schema.foodLogs.date,
        calories: sql<number>`sum(${schema.foodLogs.calories})`,
        proteinG: sql<number>`sum(${schema.foodLogs.proteinG})`,
        carbsG: sql<number>`sum(${schema.foodLogs.carbsG})`,
        fatG: sql<number>`sum(${schema.foodLogs.fatG})`,
      })
      .from(schema.foodLogs)
      .where(
        and(
          eq(schema.foodLogs.clientId, clientId),
          gte(schema.foodLogs.date, from),
          lte(schema.foodLogs.date, to),
        ),
      )
      .groupBy(schema.foodLogs.date)
      .orderBy(asc(schema.foodLogs.date)),
    d
      .select()
      .from(schema.dailyMetrics)
      .where(
        and(
          eq(schema.dailyMetrics.clientId, clientId),
          gte(schema.dailyMetrics.date, from),
          lte(schema.dailyMetrics.date, to),
        ),
      )
      .orderBy(asc(schema.dailyMetrics.date)),
    d
      .select()
      .from(schema.nutritionTargets)
      .where(eq(schema.nutritionTargets.clientId, clientId))
      .orderBy(asc(schema.nutritionTargets.effectiveFrom)),
  ]);

  // The target in force on a day is the last one that started on or before it.
  const targetFor = (date: string) => {
    let found: number | null = null;
    for (const row of targetRows) {
      if (row.effectiveFrom <= date) found = row.calories;
      else break;
    }
    return found;
  };

  return {
    clientId,
    from,
    to,
    nutrition: nutritionRows.map((row) => ({
      date: row.date,
      calories: round(Number(row.calories)),
      proteinG: round(Number(row.proteinG)),
      carbsG: round(Number(row.carbsG)),
      fatG: round(Number(row.fatG)),
      targetCalories: targetFor(row.date),
    })),
    bodyweight: metricRows
      .filter((row) => row.bodyweightKg !== null)
      .map((row) => ({ date: row.date, value: row.bodyweightKg })),
    steps: metricRows
      .filter((row) => row.steps !== null)
      .map((row) => ({ date: row.date, value: row.steps })),
  };
}

export async function exerciseHistory(
  env: Env,
  clientId: string,
  exerciseId: string,
): Promise<ExerciseHistory> {
  const d = db(env);

  const exercise = await d
    .select({ name: schema.exercises.name })
    .from(schema.exercises)
    .where(eq(schema.exercises.id, exerciseId))
    .limit(1);
  if (!exercise[0]) throw notFound("No such exercise", "EXERCISE_NOT_FOUND");

  const rows = await d
    .select({
      sessionId: schema.workoutSessions.id,
      date: schema.workoutSessions.date,
      reps: schema.sessionSets.reps,
      weight: schema.sessionSets.weight,
    })
    .from(schema.sessionSets)
    .innerJoin(
      schema.workoutSessions,
      eq(schema.workoutSessions.id, schema.sessionSets.sessionId),
    )
    .where(
      and(
        eq(schema.workoutSessions.clientId, clientId),
        eq(schema.sessionSets.exerciseId, exerciseId),
        isNotNull(schema.sessionSets.weight),
      ),
    )
    .orderBy(asc(schema.workoutSessions.date));

  const bySession = new Map<string, { date: string; sets: Array<{ reps: number; weight: number }> }>();
  for (const row of rows) {
    const entry = bySession.get(row.sessionId) ?? { date: row.date, sets: [] };
    entry.sets.push({ reps: row.reps, weight: row.weight });
    bySession.set(row.sessionId, entry);
  }

  const points = [...bySession.entries()].map(([sessionId, entry]) => {
    const best = entry.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
    return {
      sessionId,
      date: entry.date,
      bestWeight: best.weight,
      repsAtBestWeight: best.reps,
      // Epley, the usual one rep max estimate.
      estimated1rm: round(best.weight * (1 + best.reps / 30)),
      totalVolume: round(entry.sets.reduce((sum, set) => sum + set.reps * set.weight, 0)),
    };
  });

  return { exerciseId, exerciseName: exercise[0].name, points };
}
