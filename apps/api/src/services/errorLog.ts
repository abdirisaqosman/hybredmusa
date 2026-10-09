import { db, schema } from "../db/client.js";
import { newId } from "../lib/crypto.js";
import { nowIso } from "../lib/time.js";
import type { Env } from "../types.js";

interface ErrorRecord {
  route: string;
  method: string;
  status: number;
  errorCode: string;
  message: string;
  userId?: string | null;
  requestId: string;
}

/**
 * Never store passwords, tokens or request bodies here. Route, status and a
 * short message are enough to find a problem, and the admin panel shows this
 * to the owner.
 */
export async function recordError(env: Env, record: ErrorRecord) {
  try {
    await db(env).insert(schema.errorLogs).values({
      id: newId(),
      createdAt: nowIso(),
      route: record.route.slice(0, 200),
      method: record.method,
      status: record.status,
      errorCode: record.errorCode.slice(0, 100),
      message: record.message.slice(0, 500),
      userId: record.userId ?? null,
      requestId: record.requestId,
    });
  } catch (error) {
    // Logging must never break the response.
    console.error("could not write error_log", error);
  }
}
