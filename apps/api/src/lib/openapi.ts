import { errorSchema } from "@hybredmusa/shared";
import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { unauthorized } from "../errors.js";
import type { AppBindings, SessionUser } from "../types.js";

export function jsonContent<T extends z.ZodTypeAny>(schema: T, description: string) {
  return { description, content: { "application/json": { schema } } };
}

export function jsonBody<T extends z.ZodTypeAny>(schema: T, description = "Request body") {
  return { body: { content: { "application/json": { schema } }, description, required: true } };
}

const err = (description: string) => jsonContent(errorSchema, description);

export const errorResponses = {
  400: err("The request body or query failed validation"),
  401: err("Missing or invalid session"),
  403: err("Authenticated, but not allowed to do this"),
  404: err("Not found"),
  409: err("Conflicts with something that already exists"),
};

/** Routes behind requireAuth accept either a cookie or a Bearer token. */
export const authSecurity: Array<Record<string, string[]>> = [
  { cookieAuth: [] },
  { bearerAuth: [] },
];

export function currentUser(c: Context<AppBindings>): SessionUser {
  const user = c.get("user");
  if (!user) throw unauthorized();
  return user;
}
