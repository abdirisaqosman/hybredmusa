import { createRoute, z } from "@hono/zod-openapi";
import { inviteSchema, linkBodySchema, publicUserSchema } from "@hybredmusa/shared";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { notFound } from "../errors.js";
import { generateInviteCode, newId } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso } from "../lib/time.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toPublicUser } from "../services/sessions.js";
import { linkWithInvite } from "./auth.js";
import type { App } from "../types.js";

const coachGuards = [requireAuth, requireRole("coach")];
const clientGuards = [requireAuth, requireRole("client")];

const createInvite = createRoute({
  method: "post",
  path: "/coach/invites",
  tags: ["links"],
  summary: "Create an invite code a client can use to link to this coach",
  security: authSecurity,
  middleware: coachGuards,
  responses: {
    201: jsonContent(inviteSchema, "Invite created"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const listInvites = createRoute({
  method: "get",
  path: "/coach/invites",
  tags: ["links"],
  summary: "Invites and links belonging to this coach",
  security: authSecurity,
  middleware: coachGuards,
  responses: {
    200: jsonContent(z.object({ items: z.array(inviteSchema) }), "Invites"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const linkToCoach = createRoute({
  method: "post",
  path: "/client/link",
  tags: ["links"],
  summary: "Link the signed in client to a coach with an invite code",
  security: authSecurity,
  middleware: clientGuards,
  request: jsonBody(linkBodySchema),
  responses: {
    200: jsonContent(z.object({ coach: publicUserSchema }), "Linked"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
  },
});

const getCoach = createRoute({
  method: "get",
  path: "/client/coach",
  tags: ["links"],
  summary: "The coach this client is linked to",
  security: authSecurity,
  middleware: clientGuards,
  responses: {
    200: jsonContent(z.object({ coach: publicUserSchema.nullable() }), "The linked coach"),
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

export function registerLinkRoutes(app: App) {
  app.openapi(createInvite, async (c) => {
    const coach = currentUser(c);
    const invite = {
      id: newId(),
      coachId: coach.id,
      clientId: null,
      status: "invited" as const,
      inviteCode: generateInviteCode(),
      createdAt: nowIso(),
    };
    await db(c.env).insert(schema.coachClients).values(invite);

    return c.json(
      {
        id: invite.id,
        inviteCode: invite.inviteCode,
        status: invite.status,
        createdAt: invite.createdAt,
        client: null,
      },
      201,
    );
  });

  app.openapi(listInvites, async (c) => {
    const coach = currentUser(c);
    const rows = await db(c.env)
      .select({ link: schema.coachClients, client: schema.users })
      .from(schema.coachClients)
      .leftJoin(schema.users, eq(schema.users.id, schema.coachClients.clientId))
      .where(eq(schema.coachClients.coachId, coach.id));

    return c.json(
      {
        items: rows.map(({ link, client }) => ({
          id: link.id,
          inviteCode: link.inviteCode,
          status: link.status,
          createdAt: link.createdAt,
          client: client ? toPublicUser(client) : null,
        })),
      },
      200,
    );
  });

  app.openapi(linkToCoach, async (c) => {
    const client = currentUser(c);
    const coachId = await linkWithInvite(c.env, client.id, c.req.valid("json").inviteCode);

    const rows = await db(c.env)
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, coachId))
      .limit(1);
    const coach = rows[0];
    if (!coach) throw notFound("Coach not found", "COACH_NOT_FOUND");

    return c.json({ coach: toPublicUser(coach) }, 200);
  });

  app.openapi(getCoach, async (c) => {
    const client = currentUser(c);
    const rows = await db(c.env)
      .select({ coach: schema.users })
      .from(schema.coachClients)
      .innerJoin(schema.users, eq(schema.users.id, schema.coachClients.coachId))
      .where(
        and(
          eq(schema.coachClients.clientId, client.id),
          eq(schema.coachClients.status, "active"),
        ),
      )
      .limit(1);

    return c.json({ coach: rows[0] ? toPublicUser(rows[0].coach) : null }, 200);
  });
}
