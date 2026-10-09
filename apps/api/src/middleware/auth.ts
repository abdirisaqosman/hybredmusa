import { createMiddleware } from "hono/factory";
import type { Role } from "@hybredmusa/shared";
import { forbidden, unauthorized } from "../errors.js";
import { readSessionCookie } from "../lib/cookies.js";
import { resolveSession, touchLastActive } from "../services/sessions.js";
import type { AppBindings } from "../types.js";

/** The token comes from the web cookie or from a mobile Bearer header. */
function readToken(header: string | undefined, cookie: string | undefined) {
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return cookie;
}

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const token = readToken(c.req.header("authorization"), readSessionCookie(c));
  if (!token) throw unauthorized();

  const found = await resolveSession(c.env, token);
  if (!found) throw unauthorized("Session is invalid or expired", "SESSION_INVALID");

  c.set("user", found.user);
  c.set("session", found.session);
  await touchLastActive(c.env, found.user);
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw unauthorized();
    if (!roles.includes(user.role)) throw forbidden(`This route needs role: ${roles.join(" or ")}`);
    await next();
  });
}
