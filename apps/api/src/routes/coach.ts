import { createRoute, z } from "@hono/zod-openapi";
import {
  clientAdherenceSchema,
  commentSchema,
  createCommentBodySchema,
  exerciseHistorySchema,
  isoDate,
  okSchema,
  progressSchema,
} from "@hybredmusa/shared";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { forbidden, notFound } from "../errors.js";
import { newId } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso, today } from "../lib/time.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { assertCanReadClient, getClientOrThrow } from "../services/access.js";
import { dashboardForCoach, exerciseHistory, progressFor } from "../services/progress.js";
import { toPublicUser } from "../services/sessions.js";
import type { App } from "../types.js";

const clientParam = z.object({ clientId: z.string().min(1) });

const dashboard = createRoute({
  method: "get",
  path: "/coach/dashboard",
  tags: ["coach"],
  summary: "Every active client with their current adherence",
  security: authSecurity,
  middleware: [requireAuth, requireRole("coach")],
  responses: {
    200: jsonContent(z.object({ items: z.array(clientAdherenceSchema) }), "Dashboard"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const progress = createRoute({
  method: "get",
  path: "/clients/{clientId}/progress",
  tags: ["coach"],
  summary: "Daily nutrition, bodyweight and steps over a range",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    params: clientParam,
    query: z.object({ from: isoDate.optional(), to: isoDate.optional() }),
  },
  responses: {
    200: jsonContent(progressSchema, "Progress"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const history = createRoute({
  method: "get",
  path: "/clients/{clientId}/exercises/{exerciseId}/history",
  tags: ["coach"],
  summary: "Best set and volume per session for one exercise",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam.extend({ exerciseId: z.string().min(1) }) },
  responses: {
    200: jsonContent(exerciseHistorySchema, "History"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const listComments = createRoute({
  method: "get",
  path: "/clients/{clientId}/comments",
  tags: ["coach"],
  summary: "Comments on a day or a session",
  security: authSecurity,
  middleware: [requireAuth],
  request: {
    params: clientParam,
    query: z.object({
      targetType: z.enum(["day", "session"]).optional(),
      targetRef: z.string().optional(),
    }),
  },
  responses: {
    200: jsonContent(z.object({ items: z.array(commentSchema) }), "Comments"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const addComment = createRoute({
  method: "post",
  path: "/clients/{clientId}/comments",
  tags: ["coach"],
  summary: "Comment on a day or a session",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: clientParam, ...jsonBody(createCommentBodySchema) },
  responses: {
    201: jsonContent(commentSchema, "Comment added"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const deleteComment = createRoute({
  method: "delete",
  path: "/comments/{commentId}",
  tags: ["coach"],
  summary: "Delete your own comment",
  security: authSecurity,
  middleware: [requireAuth],
  request: { params: z.object({ commentId: z.string().min(1) }) },
  responses: {
    200: jsonContent(okSchema, "Deleted"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export function registerCoachRoutes(app: App) {
  app.openapi(dashboard, async (c) =>
    c.json({ items: await dashboardForCoach(c.env, currentUser(c).id) }, 200),
  );

  app.openapi(progress, async (c) => {
    const { clientId } = c.req.valid("param");
    const { from, to } = c.req.valid("query");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    const end = to ?? today();
    const start = from ?? new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
    return c.json(await progressFor(c.env, clientId, start, end), 200);
  });

  app.openapi(history, async (c) => {
    const { clientId, exerciseId } = c.req.valid("param");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    return c.json(await exerciseHistory(c.env, clientId, exerciseId), 200);
  });

  app.openapi(listComments, async (c) => {
    const { clientId } = c.req.valid("param");
    const { targetType, targetRef } = c.req.valid("query");
    await getClientOrThrow(c.env, clientId);
    await assertCanReadClient(c.env, currentUser(c), clientId);

    const rows = await db(c.env)
      .select({ comment: schema.comments, author: schema.users })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
      .where(
        and(
          eq(schema.comments.clientId, clientId),
          targetType ? eq(schema.comments.targetType, targetType) : undefined,
          targetRef ? eq(schema.comments.targetRef, targetRef) : undefined,
        ),
      )
      .orderBy(desc(schema.comments.createdAt));

    return c.json(
      {
        items: rows.map(({ comment, author }) => ({
          id: comment.id,
          clientId: comment.clientId,
          author: toPublicUser(author),
          targetType: comment.targetType,
          targetRef: comment.targetRef,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
      },
      200,
    );
  });

  app.openapi(addComment, async (c) => {
    const { clientId } = c.req.valid("param");
    const body = c.req.valid("json");
    const user = currentUser(c);
    await getClientOrThrow(c.env, clientId);
    // Reading rights are enough to comment: the client and their coach.
    await assertCanReadClient(c.env, user, clientId);

    const row = {
      id: newId(),
      authorId: user.id,
      clientId,
      targetType: body.targetType,
      targetRef: body.targetRef,
      body: body.body,
      createdAt: nowIso(),
    };
    await db(c.env).insert(schema.comments).values(row);

    return c.json({ ...row, author: toPublicUser(user) }, 201);
  });

  app.openapi(deleteComment, async (c) => {
    const { commentId } = c.req.valid("param");
    const user = currentUser(c);

    const rows = await db(c.env)
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .limit(1);
    const comment = rows[0];
    if (!comment) throw notFound("No such comment", "COMMENT_NOT_FOUND");
    if (comment.authorId !== user.id) throw forbidden("That is not your comment", "NOT_YOUR_COMMENT");

    await db(c.env).delete(schema.comments).where(eq(schema.comments.id, commentId));
    return c.json({ ok: true } as const, 200);
  });
}
