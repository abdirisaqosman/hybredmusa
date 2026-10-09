import { createRoute } from "@hono/zod-openapi";
import {
  authResponseSchema,
  loginBodySchema,
  meResponseSchema,
  okSchema,
  signupBodySchema,
} from "@hybredmusa/shared";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { badRequest, conflict, forbidden, unauthorized } from "../errors.js";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies.js";
import { hashPassword, newId, verifyPassword } from "../lib/crypto.js";
import { authSecurity, currentUser, errorResponses, jsonBody, jsonContent } from "../lib/openapi.js";
import { nowIso } from "../lib/time.js";
import { requireAuth } from "../middleware/auth.js";
import { createSession, revokeSession, toPublicUser } from "../services/sessions.js";
import type { App, Env } from "../types.js";

const signup = createRoute({
  method: "post",
  path: "/auth/signup",
  tags: ["auth"],
  summary: "Create a coach or client account",
  description:
    "Admin accounts can never be created here. They are granted by the bootstrap command or by another admin.",
  request: jsonBody(signupBodySchema),
  responses: {
    201: jsonContent(authResponseSchema, "Account created and signed in"),
    400: errorResponses[400],
    409: errorResponses[409],
  },
});

const login = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["auth"],
  summary: "Sign in with email and password",
  request: jsonBody(loginBodySchema),
  responses: {
    200: jsonContent(authResponseSchema, "Signed in"),
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

const logout = createRoute({
  method: "post",
  path: "/auth/logout",
  tags: ["auth"],
  summary: "Revoke the current session",
  security: authSecurity,
  middleware: [requireAuth],
  responses: {
    200: jsonContent(okSchema, "Session revoked"),
    401: errorResponses[401],
  },
});

const me = createRoute({
  method: "get",
  path: "/auth/me",
  tags: ["auth"],
  summary: "The signed in user, plus their coach or client count",
  security: authSecurity,
  middleware: [requireAuth],
  responses: {
    200: jsonContent(meResponseSchema, "The current user"),
    401: errorResponses[401],
  },
});

export function registerAuthRoutes(app: App) {
  app.openapi(signup, async (c) => {
    const body = c.req.valid("json");
    const email = body.email.trim().toLowerCase();
    const d = db(c.env);

    const existing = await d
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing.length) throw conflict("That email is already registered", "EMAIL_TAKEN");

    if (body.inviteCode && body.role !== "client") {
      throw badRequest("Only a client can use an invite code", "INVITE_NOT_FOR_ROLE");
    }

    const user = {
      id: newId(),
      email,
      passwordHash: await hashPassword(body.password),
      name: body.name.trim(),
      role: body.role,
      createdAt: nowIso(),
      lastActiveAt: nowIso(),
      disabledAt: null,
    };
    await d.insert(schema.users).values(user);

    if (body.inviteCode) {
      await linkWithInvite(c.env, user.id, body.inviteCode);
    }

    const { token, expiresAt } = await createSession(c.env, user.id, body.client);
    if (body.client === "web") setSessionCookie(c, token, expiresAt);

    return c.json(
      {
        user: toPublicUser(user),
        token: body.client === "mobile" ? token : null,
        expiresAt,
      },
      201,
    );
  });

  app.openapi(login, async (c) => {
    const body = c.req.valid("json");
    const email = body.email.trim().toLowerCase();

    const rows = await db(c.env)
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    const user = rows[0];
    // Same message either way, so this cannot be used to probe for accounts.
    const invalid = unauthorized("Email or password is wrong", "INVALID_CREDENTIALS");
    if (!user) throw invalid;
    if (!(await verifyPassword(body.password, user.passwordHash))) throw invalid;
    if (user.disabledAt) throw forbidden("This account is disabled", "ACCOUNT_DISABLED");

    const { token, expiresAt } = await createSession(c.env, user.id, body.client);
    if (body.client === "web") setSessionCookie(c, token, expiresAt);

    return c.json(
      {
        user: toPublicUser(user),
        token: body.client === "mobile" ? token : null,
        expiresAt,
      },
      200,
    );
  });

  app.openapi(logout, async (c) => {
    const session = c.get("session");
    if (session) await revokeSession(c.env, session.id);
    clearSessionCookie(c);
    return c.json({ ok: true } as const, 200);
  });

  app.openapi(me, async (c) => {
    const user = currentUser(c);
    const d = db(c.env);

    let coach = null;
    let clientCount: number | null = null;

    if (user.role === "client") {
      const rows = await d
        .select({ coach: schema.users })
        .from(schema.coachClients)
        .innerJoin(schema.users, eq(schema.users.id, schema.coachClients.coachId))
        .where(
          and(
            eq(schema.coachClients.clientId, user.id),
            eq(schema.coachClients.status, "active"),
          ),
        )
        .limit(1);
      coach = rows[0] ? toPublicUser(rows[0].coach) : null;
    }

    if (user.role === "coach") {
      const rows = await d
        .select({ id: schema.coachClients.id })
        .from(schema.coachClients)
        .where(
          and(
            eq(schema.coachClients.coachId, user.id),
            eq(schema.coachClients.status, "active"),
          ),
        );
      clientCount = rows.length;
    }

    return c.json({ user: toPublicUser(user), coach, clientCount }, 200);
  });
}

/** Shared by signup and POST /client/link. */
export async function linkWithInvite(env: Env, clientId: string, inviteCode: string) {
  const d = db(env);
  const rows = await d
    .select()
    .from(schema.coachClients)
    .where(
      and(
        eq(schema.coachClients.inviteCode, inviteCode.trim().toUpperCase()),
        isNull(schema.coachClients.clientId),
      ),
    )
    .limit(1);

  const invite = rows[0];
  if (!invite) throw badRequest("That invite code is not valid", "INVALID_INVITE");

  const already = await d
    .select({ id: schema.coachClients.id })
    .from(schema.coachClients)
    .where(
      and(
        eq(schema.coachClients.coachId, invite.coachId),
        eq(schema.coachClients.clientId, clientId),
      ),
    )
    .limit(1);
  if (already.length) throw conflict("You are already linked to this coach", "ALREADY_LINKED");

  await d
    .update(schema.coachClients)
    .set({ clientId, status: "active" })
    .where(eq(schema.coachClients.id, invite.id));

  return invite.coachId;
}
