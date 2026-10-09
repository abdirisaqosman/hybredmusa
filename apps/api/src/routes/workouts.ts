import { createRoute, z } from "@hono/zod-openapi";
import {
  createExerciseBodySchema,
  exerciseSchema,
  finishSessionBodySchema,
  logSetBodySchema,
  okSchema,
  paginatedSchema,
  paginationQuerySchema,
  previousPerformanceSchema,
  saveTemplateBodySchema,
  sessionSetSchema,
  startSessionBodySchema,
  workoutSessionSchema,
  workoutSessionSummarySchema,
  workoutTemplateSchema,
} from "@hybredmusa/shared";
import { and, asc, eq, isNull, like, max, or } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { newId } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso, today } from "../lib/time.js";
import { requireAuth } from "../middleware/auth.js";
import {
  assertCanReadClient,
  assertCanWriteLogs,
  assertCanWritePlan,
  getClientOrThrow,
} from "../services/access.js";
import {
  loadSession,
  loadTemplate,
  previousPerformance,
  sessionSummaries,
  templatesForClient,
} from "../services/workouts.js";
import type { App, Env, SessionUser } from "../types.js";

const clientParam = z.object({ clientId: z.string().min(1) });
const sessionParam = z.object({ sessionId: z.string().min(1) });
const templateParam = z.object({ templateId: z.string().min(1) });

const listExercises = createRoute({
  method: "get",
  path: "/exercises",
  tags: ["workouts"],
  summary: "The exercise library, built in plus your own",
  security: authSecurity,
  middleware: [requireAuth],
  request: { query: z.object({ q: z.string().max(100).optional() }) },
  responses: {
    200: jsonContent(z.object({ items: z.array(exerciseSchema) }), "Exercises"),
    401: errorResponses[401],
  },
});

const createExercise = createRoute({
  method: "post",
  path: "/exercises",
  tags: ["workouts"],
  summary: "Add a custom exercise",
  security: authSecurity,
  middleware: [requireAuth],
  request: jsonBody(createExerciseBodySchema),
  responses: {
    201: jsonContent(exerciseSchema, "Exercise created"),
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

const listTemplates = createRoute({
  method: "get",
  path: "/clients/{clientId}/templates",
  tags: ["workouts"],
  summary: "Workout templates this client can use",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam },
  responses: {
    200: jsonContent(z.object({ items: z.array(workoutTemplateSchema) }), "Templates"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const createTemplate = createRoute({
  method: "post",
  path: "/clients/{clientId}/templates",
  tags: ["workouts"],
  summary: "Create and assign a template, as the client's coach",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(saveTemplateBodySchema) },
  responses: {
    201: jsonContent(workoutTemplateSchema, "Template created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const updateTemplate = createRoute({
  method: "put",
  path: "/templates/{templateId}",
  tags: ["workouts"],
  summary: "Replace a template, as the coach who owns it",
  description: "Editing a template never changes sessions that were already logged from it.",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: templateParam, ...jsonBody(saveTemplateBodySchema) },
  responses: {
    200: jsonContent(workoutTemplateSchema, "Template saved"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const deleteTemplate = createRoute({
  method: "delete",
  path: "/templates/{templateId}",
  tags: ["workouts"],
  summary: "Delete a template",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: templateParam },
  responses: {
    200: jsonContent(okSchema, "Deleted"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const listSessions = createRoute({
  method: "get",
  path: "/clients/{clientId}/sessions",
  tags: ["workouts"],
  summary: "Workout history, newest first",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, query: paginationQuerySchema },
  responses: {
    200: jsonContent(paginatedSchema(workoutSessionSummarySchema), "Sessions"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const startSession = createRoute({
  method: "post",
  path: "/clients/{clientId}/sessions",
  tags: ["workouts"],
  summary: "Start a session, from a template or empty",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(startSessionBodySchema) },
  responses: {
    201: jsonContent(workoutSessionSchema, "Session started"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const getSession = createRoute({
  method: "get",
  path: "/sessions/{sessionId}",
  tags: ["workouts"],
  summary: "One session with its sets",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: sessionParam },
  responses: {
    200: jsonContent(workoutSessionSchema, "The session"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const logSet = createRoute({
  method: "post",
  path: "/sessions/{sessionId}/sets",
  tags: ["workouts"],
  summary: "Log a set",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: sessionParam, ...jsonBody(logSetBodySchema) },
  responses: {
    201: jsonContent(sessionSetSchema, "Set logged"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const deleteSet = createRoute({
  method: "delete",
  path: "/sessions/{sessionId}/sets/{setId}",
  tags: ["workouts"],
  summary: "Delete a set",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: sessionParam.extend({ setId: z.string().min(1) }) },
  responses: {
    200: jsonContent(okSchema, "Deleted"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const finishSession = createRoute({
  method: "post",
  path: "/sessions/{sessionId}/finish",
  tags: ["workouts"],
  summary: "Finish a session",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: sessionParam, ...jsonBody(finishSessionBodySchema) },
  responses: {
    200: jsonContent(workoutSessionSchema, "Session finished"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const lastPerformance = createRoute({
  method: "get",
  path: "/clients/{clientId}/exercises/{exerciseId}/previous",
  tags: ["workouts"],
  summary: "What this client did for an exercise last time",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    params: clientParam.extend({ exerciseId: z.string().min(1) }),
    query: z.object({ beforeSessionId: z.string().optional() }),
  },
  responses: {
    200: jsonContent(
      z.object({ previous: previousPerformanceSchema.nullable() }),
      "The previous performance",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

/** Sessions and sets are reached by id, so each one re-checks the client. */
async function sessionOwner(env: Env, sessionId: string) {
  const rows = await db(env)
    .select({ clientId: schema.workoutSessions.clientId })
    .from(schema.workoutSessions)
    .where(eq(schema.workoutSessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("No such session", "SESSION_NOT_FOUND");
  return row.clientId;
}

async function saveTemplateExercises(
  env: Env,
  templateId: string,
  exercises: z.infer<typeof saveTemplateBodySchema>["exercises"],
) {
  const d = db(env);
  const ids = exercises.map((e) => e.exerciseId);
  const known = await d
    .select({ id: schema.exercises.id })
    .from(schema.exercises)
    .where(or(...ids.map((id) => eq(schema.exercises.id, id))));

  const knownIds = new Set(known.map((k) => k.id));
  const missing = ids.filter((id) => !knownIds.has(id));
  if (missing.length) throw badRequest(`Unknown exercise: ${missing[0]}`, "UNKNOWN_EXERCISE");

  await d.delete(schema.templateExercises).where(eq(schema.templateExercises.templateId, templateId));
  await d.insert(schema.templateExercises).values(
    exercises.map((exercise, index) => ({
      id: newId(),
      templateId,
      exerciseId: exercise.exerciseId,
      position: index,
      targetSets: exercise.targetSets ?? null,
      targetReps: exercise.targetReps ?? null,
      targetWeight: exercise.targetWeight ?? null,
      restSeconds: exercise.restSeconds ?? null,
    })),
  );
}

async function assertCanEditTemplate(env: Env, user: SessionUser, templateId: string) {
  const rows = await db(env)
    .select()
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.id, templateId))
    .limit(1);
  const template = rows[0];
  if (!template) throw notFound("No such template", "TEMPLATE_NOT_FOUND");
  if (template.coachId !== user.id) throw forbidden("This is not your template", "NOT_YOUR_TEMPLATE");
  return template;
}

export function registerWorkoutRoutes(app: App) {
  app.openapi(listExercises, async (c) => {
    const { q } = c.req.valid("query");
    const user = currentUser(c);

    const rows = await db(c.env)
      .select()
      .from(schema.exercises)
      .where(
        and(
          or(isNull(schema.exercises.createdBy), eq(schema.exercises.createdBy, user.id)),
          q ? like(schema.exercises.name, `%${q}%`) : undefined,
        ),
      )
      .orderBy(asc(schema.exercises.name));

    return c.json(
      {
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          muscleGroup: row.muscleGroup,
          equipment: row.equipment,
          isCustom: row.createdBy !== null,
        })),
      },
      200,
    );
  });

  app.openapi(createExercise, async (c) => {
    const body = c.req.valid("json");
    const user = currentUser(c);

    const row = {
      id: newId(),
      name: body.name,
      muscleGroup: body.muscleGroup,
      equipment: body.equipment,
      createdBy: user.id,
      createdAt: nowIso(),
    };
    await db(c.env).insert(schema.exercises).values(row);

    return c.json({ ...row, isCustom: true }, 201);
  });

  app.openapi(listTemplates, async (c) => {
    const { clientId } = c.req.valid("param");
    const user = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    const rel = await assertCanReadClient(c.env, user, clientId);

    const items = await templatesForClient(
      c.env,
      clientId,
      rel === "coach" ? user.id : undefined,
    );
    return c.json({ items }, 200);
  });

  app.openapi(createTemplate, async (c) => {
    const { clientId } = c.req.valid("param");
    const body = c.req.valid("json");
    const coach = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    await assertCanWritePlan(c.env, coach, clientId);

    const templateId = newId();
    await db(c.env).insert(schema.workoutTemplates).values({
      id: templateId,
      coachId: coach.id,
      clientId,
      name: body.name,
      notes: body.notes ?? null,
      createdAt: nowIso(),
    });
    await saveTemplateExercises(c.env, templateId, body.exercises);

    return c.json(await loadTemplate(c.env, templateId), 201);
  });

  app.openapi(updateTemplate, async (c) => {
    const { templateId } = c.req.valid("param");
    const body = c.req.valid("json");
    await assertCanEditTemplate(c.env, currentUser(c), templateId);

    await db(c.env)
      .update(schema.workoutTemplates)
      .set({ name: body.name, notes: body.notes ?? null })
      .where(eq(schema.workoutTemplates.id, templateId));
    await saveTemplateExercises(c.env, templateId, body.exercises);

    return c.json(await loadTemplate(c.env, templateId), 200);
  });

  app.openapi(deleteTemplate, async (c) => {
    const { templateId } = c.req.valid("param");
    await assertCanEditTemplate(c.env, currentUser(c), templateId);

    await db(c.env).delete(schema.workoutTemplates).where(eq(schema.workoutTemplates.id, templateId));
    return c.json({ ok: true } as const, 200);
  });

  app.openapi(listSessions, async (c) => {
    const { clientId } = c.req.valid("param");
    const { cursor, limit } = c.req.valid("query");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json(await sessionSummaries(c.env, clientId, limit, cursor), 200);
  });

  app.openapi(startSession, async (c) => {
    const { clientId } = c.req.valid("param");
    const body = c.req.valid("json");
    const user = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    assertCanWriteLogs(user, clientId);

    if (body.templateId) {
      const template = await loadTemplate(c.env, body.templateId);
      if (template.clientId && template.clientId !== clientId) {
        throw forbidden("That template belongs to someone else", "NOT_YOUR_TEMPLATE");
      }
    }

    const id = newId();
    await db(c.env).insert(schema.workoutSessions).values({
      id,
      clientId,
      templateId: body.templateId ?? null,
      date: body.date ?? today(),
      startedAt: nowIso(),
      finishedAt: null,
      notes: null,
    });

    return c.json(await loadSession(c.env, id), 201);
  });

  app.openapi(getSession, async (c) => {
    const { sessionId } = c.req.valid("param");
    const clientId = await sessionOwner(c.env, sessionId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json(await loadSession(c.env, sessionId), 200);
  });

  app.openapi(logSet, async (c) => {
    const { sessionId } = c.req.valid("param");
    const body = c.req.valid("json");
    const clientId = await sessionOwner(c.env, sessionId);
    assertCanWriteLogs(currentUser(c), clientId);

    const exercise = await db(c.env)
      .select({ id: schema.exercises.id, name: schema.exercises.name })
      .from(schema.exercises)
      .where(eq(schema.exercises.id, body.exerciseId))
      .limit(1);
    if (!exercise[0]) throw badRequest("Unknown exercise", "UNKNOWN_EXERCISE");

    const nextNumber =
      body.setNumber ??
      ((
        await db(c.env)
          .select({ highest: max(schema.sessionSets.setNumber) })
          .from(schema.sessionSets)
          .where(
            and(
              eq(schema.sessionSets.sessionId, sessionId),
              eq(schema.sessionSets.exerciseId, body.exerciseId),
            ),
          )
      )[0]?.highest ?? 0) + 1;

    const row = {
      id: newId(),
      sessionId,
      exerciseId: body.exerciseId,
      setNumber: nextNumber,
      reps: body.reps,
      weight: body.weight,
      rpe: body.rpe ?? null,
    };
    await db(c.env).insert(schema.sessionSets).values(row);

    return c.json({ ...row, exerciseName: exercise[0].name }, 201);
  });

  app.openapi(deleteSet, async (c) => {
    const { sessionId, setId } = c.req.valid("param");
    const clientId = await sessionOwner(c.env, sessionId);
    assertCanWriteLogs(currentUser(c), clientId);

    const rows = await db(c.env)
      .select({ id: schema.sessionSets.id })
      .from(schema.sessionSets)
      .where(and(eq(schema.sessionSets.id, setId), eq(schema.sessionSets.sessionId, sessionId)))
      .limit(1);
    if (!rows.length) throw notFound("No such set", "SET_NOT_FOUND");

    await db(c.env).delete(schema.sessionSets).where(eq(schema.sessionSets.id, setId));
    return c.json({ ok: true } as const, 200);
  });

  app.openapi(finishSession, async (c) => {
    const { sessionId } = c.req.valid("param");
    const body = c.req.valid("json");
    const clientId = await sessionOwner(c.env, sessionId);
    assertCanWriteLogs(currentUser(c), clientId);

    await db(c.env)
      .update(schema.workoutSessions)
      .set({ finishedAt: nowIso(), notes: body.notes ?? null })
      .where(eq(schema.workoutSessions.id, sessionId));

    return c.json(await loadSession(c.env, sessionId), 200);
  });

  app.openapi(lastPerformance, async (c) => {
    const { clientId, exerciseId } = c.req.valid("param");
    const { beforeSessionId } = c.req.valid("query");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json(
      { previous: await previousPerformance(c.env, clientId, exerciseId, beforeSessionId) },
      200,
    );
  });
}
