import { z } from "zod";
import { clientTypeSchema, isoTimestamp, roleSchema } from "./common.js";

/** Signup can only create a coach or a client. Admin is never selectable. */
export const signupRoleSchema = z.enum(["coach", "client"]);

export const signupBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  role: signupRoleSchema,
  client: clientTypeSchema.default("web"),
  /** A client may link to a coach straight away by passing their invite code. */
  inviteCode: z.string().min(4).max(32).optional(),
});
export type SignupBody = z.infer<typeof signupBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  client: clientTypeSchema.default("web"),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  createdAt: isoTimestamp,
  lastActiveAt: isoTimestamp.nullable(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  /** Only sent when client is "mobile". The web client gets a cookie instead. */
  token: z.string().nullable(),
  expiresAt: isoTimestamp,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: publicUserSchema,
  coach: publicUserSchema.nullable(),
  clientCount: z.number().int().nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const okSchema = z.object({ ok: z.literal(true) });

export const inviteSchema = z.object({
  id: z.string(),
  inviteCode: z.string(),
  status: z.enum(["invited", "active"]),
  createdAt: isoTimestamp,
  client: publicUserSchema.nullable(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const linkBodySchema = z.object({
  inviteCode: z.string().min(4).max(32),
});
