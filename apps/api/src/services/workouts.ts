import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { SessionSet, WorkoutSession, WorkoutTemplate } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { notFound } from "../errors.js";
import type { Env } from "../types.js";

export async function loadTemplate(env: Env, templateId: string): Promise<WorkoutTemplate> {
  const d = db(env);
  const rows = await d
    .select()
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.id, templateId))
    .limit(1);
  const template = rows[0];
  if (!template) throw notFound("No such template", "TEMPLATE_NOT_FOUND");

  const exercises = await d
    .select({ te: schema.templateExercises, name: schema.exercises.name })
    .from(schema.templateExercises)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.templateExercises.exerciseId))
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(schema.templateExercises.position);

  return {
    id: template.id,
    coachId: template.coachId,
    clientId: template.clientId,
    name: template.name,
    notes: template.notes,
    createdAt: template.createdAt,
    exercises: exercises.map(({ te, name }) => ({
      id: te.id,
      exerciseId: te.exerciseId,
      exerciseName: name,
      position: te.position,
      targetSets: te.targetSets,
      targetReps: te.targetReps,
      targetWeight: te.targetWeight,
      restSeconds: te.restSeconds,
    })),
  };
}

export async function loadSets(env: Env, sessionId: string): Promise<SessionSet[]> {
  const rows = await db(env)
    .select({ s: schema.sessionSets, name: schema.exercises.name })
    .from(schema.sessionSets)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.sessionSets.exerciseId))
    .where(eq(schema.sessionSets.sessionId, sessionId))
    .orderBy(schema.sessionSets.exerciseId, schema.sessionSets.setNumber);

  return rows.map(({ s, name }) => ({
    id: s.id,
    exerciseId: s.exerciseId,
    exerciseName: name,
    setNumber: s.setNumber,
    reps: s.reps,
    weight: s.weight,
    rpe: s.rpe,
  }));
}

export async function loadSession(env: Env, sessionId: string): Promise<WorkoutSession> {
  const rows = await db(env)
    .select({ s: schema.workoutSessions, templateName: schema.workoutTemplates.name })
    .from(schema.workoutSessions)
    .leftJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.id, schema.workoutSessions.templateId),
    )
    .where(eq(schema.workoutSessions.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("No such session", "SESSION_NOT_FOUND");

  return {
    id: row.s.id,
    clientId: row.s.clientId,
    templateId: row.s.templateId,
    templateName: row.templateName ?? null,
    date: row.s.date,
    startedAt: row.s.startedAt,
    finishedAt: row.s.finishedAt,
    notes: row.s.notes,
    sets: await loadSets(env, sessionId),
  };
}

/** Templates assigned to this client, plus the coach's unassigned ones. */
export async function templatesForClient(env: Env, clientId: string, coachId?: string) {
  const rows = await db(env)
    .select({ id: schema.workoutTemplates.id })
    .from(schema.workoutTemplates)
    .where(
      coachId
        ? or(
            eq(schema.workoutTemplates.clientId, clientId),
            and(
              eq(schema.workoutTemplates.coachId, coachId),
              isNull(schema.workoutTemplates.clientId),
            ),
          )
        : eq(schema.workoutTemplates.clientId, clientId),
    )
    .orderBy(desc(schema.workoutTemplates.createdAt));

  return Promise.all(rows.map((row) => loadTemplate(env, row.id)));
}

/** The sets this client did for an exercise in their most recent earlier session. */
export async function previousPerformance(env: Env, clientId: string, exerciseId: string, beforeSessionId?: string) {
  const d = db(env);

  const current = beforeSessionId
    ? (
        await d
          .select({ startedAt: schema.workoutSessions.startedAt })
          .from(schema.workoutSessions)
          .where(eq(schema.workoutSessions.id, beforeSessionId))
          .limit(1)
      )[0]
    : undefined;

  const sessions = await d
    .selectDistinct({
      id: schema.workoutSessions.id,
      date: schema.workoutSessions.date,
      startedAt: schema.workoutSessions.startedAt,
    })
    .from(schema.workoutSessions)
    .innerJoin(schema.sessionSets, eq(schema.sessionSets.sessionId, schema.workoutSessions.id))
    .where(
      and(
        eq(schema.workoutSessions.clientId, clientId),
        eq(schema.sessionSets.exerciseId, exerciseId),
        current ? lt(schema.workoutSessions.startedAt, current.startedAt) : undefined,
      ),
    )
    .orderBy(desc(schema.workoutSessions.startedAt))
    .limit(1);

  const session = sessions[0];
  if (!session) return null;

  const sets = (await loadSets(env, session.id)).filter((s) => s.exerciseId === exerciseId);
  return { sessionId: session.id, date: session.date, sets };
}

export async function sessionSummaries(
  env: Env,
  clientId: string,
  limit: number,
  cursor?: string,
) {
  const d = db(env);
  const rows = await d
    .select({ s: schema.workoutSessions, templateName: schema.workoutTemplates.name })
    .from(schema.workoutSessions)
    .leftJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.id, schema.workoutSessions.templateId),
    )
    .where(
      and(
        eq(schema.workoutSessions.clientId, clientId),
        cursor ? lt(schema.workoutSessions.startedAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(schema.workoutSessions.startedAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const sessionIds = page.map((row) => row.s.id);

  const sets = sessionIds.length
    ? await d
        .select({ set: schema.sessionSets, name: schema.exercises.name })
        .from(schema.sessionSets)
        .innerJoin(schema.exercises, eq(schema.exercises.id, schema.sessionSets.exerciseId))
        .where(inArray(schema.sessionSets.sessionId, sessionIds))
    : [];

  const items = page.map((row) => {
    const mine = sets.filter((s) => s.set.sessionId === row.s.id);
    return {
      id: row.s.id,
      clientId: row.s.clientId,
      templateId: row.s.templateId,
      templateName: row.templateName ?? null,
      date: row.s.date,
      startedAt: row.s.startedAt,
      finishedAt: row.s.finishedAt,
      notes: row.s.notes,
      setCount: mine.length,
      totalVolume: Math.round(mine.reduce((sum, s) => sum + s.set.reps * s.set.weight, 0) * 10) / 10,
      exerciseNames: [...new Set(mine.map((s) => s.name))],
    };
  });

  return {
    items,
    nextCursor: rows.length > limit ? (page.at(-1)?.s.startedAt ?? null) : null,
  };
}
