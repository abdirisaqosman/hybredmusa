import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { forbidden, notFound } from "../errors.js";
import type { Env, SessionUser } from "../types.js";

export type Relationship = "self" | "coach" | "none";

/**
 * Health data belongs to the client. Only the client and their active coach
 * can see it. Admins are deliberately not included, see section 7 of the memo.
 */
export async function relationshipTo(
  env: Env,
  user: SessionUser,
  clientId: string,
): Promise<Relationship> {
  if (user.id === clientId) return "self";
  if (user.role !== "coach") return "none";

  const rows = await db(env)
    .select({ id: schema.coachClients.id })
    .from(schema.coachClients)
    .where(
      and(
        eq(schema.coachClients.coachId, user.id),
        eq(schema.coachClients.clientId, clientId),
        eq(schema.coachClients.status, "active"),
      ),
    )
    .limit(1);

  return rows.length ? "coach" : "none";
}

export async function assertCanReadClient(env: Env, user: SessionUser, clientId: string) {
  const rel = await relationshipTo(env, user, clientId);
  if (rel === "none") throw forbidden("You cannot see this client's data", "NOT_YOUR_CLIENT");
  return rel;
}

/** Only the client writes their own logs. A coach never edits what a client did. */
export function assertCanWriteLogs(user: SessionUser, clientId: string) {
  if (user.id !== clientId || user.role !== "client") {
    throw forbidden("Only the client can write their own logs", "LOGS_ARE_CLIENT_ONLY");
  }
}

/** Targets and templates are the plan, so only the client's active coach writes them. */
export async function assertCanWritePlan(env: Env, user: SessionUser, clientId: string) {
  const rel = await relationshipTo(env, user, clientId);
  if (rel !== "coach") throw forbidden("Only the client's coach can change the plan", "NOT_YOUR_CLIENT");
}

export async function getClientOrThrow(env: Env, clientId: string) {
  const rows = await db(env)
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, clientId))
    .limit(1);
  const client = rows[0];
  if (!client || client.role !== "client") throw notFound("No such client", "CLIENT_NOT_FOUND");
  return client;
}
