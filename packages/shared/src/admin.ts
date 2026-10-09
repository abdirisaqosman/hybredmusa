import { z } from "zod";
import { isoDate, isoTimestamp, roleSchema } from "./common.js";

/**
 * Admin sees account level data and aggregates only. Nothing here exposes an
 * individual client's food, workouts, bodyweight or comments.
 */

export const adminOverviewSchema = z.object({
  users: z.object({
    total: z.number().int(),
    coaches: z.number().int(),
    clients: z.number().int(),
    admins: z.number().int(),
    disabled: z.number().int(),
  }),
  links: z.object({ active: z.number().int(), pendingInvites: z.number().int() }),
  activeUsers: z.object({
    daily: z.number().int(),
    weekly: z.number().int(),
    monthly: z.number().int(),
  }),
  signupsPerDay: z.array(z.object({ date: isoDate, count: z.number().int() })),
  usage: z.object({
    today: z.object({
      foodEntries: z.number().int(),
      workoutSessions: z.number().int(),
      stepEntries: z.number().int(),
    }),
    last7Days: z.object({
      foodEntries: z.number().int(),
      workoutSessions: z.number().int(),
      stepEntries: z.number().int(),
    }),
  }),
  errorsLast24h: z.number().int(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  createdAt: isoTimestamp,
  lastActiveAt: isoTimestamp.nullable(),
  disabledAt: isoTimestamp.nullable(),
  /** For a client, the coach they are linked to. For a coach, how many clients. */
  coachName: z.string().nullable(),
  clientCount: z.number().int().nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserDetailSchema = adminUserSchema.extend({
  links: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["invited", "active"]),
      inviteCode: z.string(),
      coachId: z.string(),
      coachName: z.string(),
      clientId: z.string().nullable(),
      clientName: z.string().nullable(),
      createdAt: isoTimestamp,
    }),
  ),
  activity: z.object({
    foodEntries: z.number().int(),
    workoutSessions: z.number().int(),
    stepEntries: z.number().int(),
    sessionsActive: z.number().int(),
  }),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminCoachSchema = z.object({
  coach: adminUserSchema,
  activeClients: z.number().int(),
  clientsActiveLast7Days: z.number().int(),
});

export const errorLogSchema = z.object({
  id: z.string(),
  createdAt: isoTimestamp,
  route: z.string(),
  method: z.string(),
  status: z.number().int(),
  errorCode: z.string(),
  message: z.string(),
  userId: z.string().nullable(),
  requestId: z.string(),
});

export const auditEntrySchema = z.object({
  id: z.string(),
  adminId: z.string(),
  adminName: z.string(),
  action: z.string(),
  targetUserId: z.string().nullable(),
  targetUserName: z.string().nullable(),
  details: z.string().nullable(),
  createdAt: isoTimestamp,
});

export const systemStatusSchema = z.object({
  apiVersion: z.string(),
  commit: z.string(),
  checks: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      ms: z.number().int(),
      detail: z.string().nullable(),
    }),
  ),
});

export const setRoleBodySchema = z.object({ role: z.enum(["coach", "client"]) });
export const setAdminBodySchema = z.object({ isAdmin: z.boolean() });
