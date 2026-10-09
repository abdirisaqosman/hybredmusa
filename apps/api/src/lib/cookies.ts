import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppBindings } from "../types.js";

export const SESSION_COOKIE = "hm_session";

type Ctx = Context<AppBindings>;

/** Secure is skipped on plain http so local development over localhost works. */
function isSecure(c: Ctx) {
  return new URL(c.req.url).protocol === "https:";
}

export function setSessionCookie(c: Ctx, token: string, expiresAt: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(c: Ctx) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isSecure(c) });
}

export function readSessionCookie(c: Ctx) {
  return getCookie(c, SESSION_COOKIE);
}
