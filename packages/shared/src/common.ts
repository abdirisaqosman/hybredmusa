import { z } from "zod";

/** Shared primitives used by both the api and the web client. */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const isoTimestamp = z.string().datetime();

export const roleSchema = z.enum(["coach", "client", "admin"]);
export type Role = z.infer<typeof roleSchema>;

export const clientTypeSchema = z.enum(["web", "mobile"]);
export type ClientType = z.infer<typeof clientTypeSchema>;

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof errorSchema>;

export const healthSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  commit: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

/** Query shape every list endpoint accepts. */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
