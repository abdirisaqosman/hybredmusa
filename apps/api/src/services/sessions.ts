import { and, eq, gt } from "drizzle-orm";
import type { PublicUser } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { generateToken, hashToken, newId } from "../lib/crypto.js";
import { hoursSince, isoIn, nowIso } from "../lib/time.js";
import type { Env } from "../types.js";

const SESSION_DAYS = { web: 30, mobile: 90 } as const;

export type DbUser = typeof schema.users.$inferSelect;

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
  };
}

export async function createSession(
  env: Env,
  userId: string,
  clientType: "web" | "mobile",
) {
  const token = generateToken();
  const expiresAt = isoIn(SESSION_DAYS[clientType]);

  await db(env).insert(schema.sessions).values({
    id: newId(),
    userId,
    tokenHash: await hashToken(token),
    clientType,
    expiresAt,
    createdAt: nowIso(),
  });

  return { token, expiresAt };
}

/** Returns the user behind a token, or null if the session is gone, expired or disabled. */
export async function resolveSession(env: Env, token: string) {
  const rows = await db(env)
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, await hashToken(token)),
        gt(schema.sessions.expiresAt, nowIso()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.user.disabledAt) return null;
  return row;
}

export async function revokeSession(env: Env, sessionId: string) {
  await db(env).delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function revokeAllSessions(env: Env, userId: string) {
  await db(env).delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

/** Write last_active_at at most once per hour per user, to limit D1 writes. */
export async function touchLastActive(env: Env, user: DbUser) {
  if (hoursSince(user.lastActiveAt) < 1) return;
  await db(env)
    .update(schema.users)
    .set({ lastActiveAt: nowIso() })
    .where(eq(schema.users.id, user.id));
}
