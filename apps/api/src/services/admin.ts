import { and, count, desc, eq, gte, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
import type { AdminOverview, AdminUser } from "@hybredmusa/shared";
import { db, schema } from "../db/client.js";
import { newId } from "../lib/crypto.js";
import { nowIso, today } from "../lib/time.js";
import type { Env } from "../types.js";

const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const dateDaysAgo = (days: number) => isoDaysAgo(days).slice(0, 10);

/** One row per admin write, so every change has a trail. */
export async function audit(
  env: Env,
  adminId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {},
) {
  await db(env).insert(schema.adminAuditLog).values({
    id: newId(),
    adminId,
    action,
    targetUserId,
    details: JSON.stringify(details),
    createdAt: nowIso(),
  });
}

export async function overview(env: Env): Promise<AdminOverview> {
  const d = db(env);
  const todayDate = today();

  const [users, links, errors, signups, foodToday, foodWeek, sessionsToday, sessionsWeek, stepsToday, stepsWeek] =
    await Promise.all([
      d.select({ role: schema.users.role, disabledAt: schema.users.disabledAt, lastActiveAt: schema.users.lastActiveAt, createdAt: schema.users.createdAt }).from(schema.users),
      d.select({ status: schema.coachClients.status, clientId: schema.coachClients.clientId }).from(schema.coachClients),
      d
        .select({ n: count() })
        .from(schema.errorLogs)
        .where(gte(schema.errorLogs.createdAt, isoDaysAgo(1))),
      d
        .select({
          date: sql<string>`substr(${schema.users.createdAt}, 1, 10)`,
          n: count(),
        })
        .from(schema.users)
        .where(gte(schema.users.createdAt, isoDaysAgo(30)))
        .groupBy(sql`substr(${schema.users.createdAt}, 1, 10)`),
      d.select({ n: count() }).from(schema.foodLogs).where(eq(schema.foodLogs.date, todayDate)),
      d.select({ n: count() }).from(schema.foodLogs).where(gte(schema.foodLogs.date, dateDaysAgo(6))),
      d.select({ n: count() }).from(schema.workoutSessions).where(eq(schema.workoutSessions.date, todayDate)),
      d.select({ n: count() }).from(schema.workoutSessions).where(gte(schema.workoutSessions.date, dateDaysAgo(6))),
      d.select({ n: count() }).from(schema.dailyMetrics).where(eq(schema.dailyMetrics.date, todayDate)),
      d.select({ n: count() }).from(schema.dailyMetrics).where(gte(schema.dailyMetrics.date, dateDaysAgo(6))),
    ]);

  const activeSince = (iso: string) =>
    users.filter((user) => user.lastActiveAt && user.lastActiveAt >= iso).length;

  return {
    users: {
      total: users.length,
      coaches: users.filter((u) => u.role === "coach").length,
      clients: users.filter((u) => u.role === "client").length,
      admins: users.filter((u) => u.role === "admin").length,
      disabled: users.filter((u) => u.disabledAt !== null).length,
    },
    links: {
      active: links.filter((l) => l.status === "active").length,
      pendingInvites: links.filter((l) => l.status === "invited" && l.clientId === null).length,
    },
    activeUsers: {
      daily: activeSince(isoDaysAgo(1)),
      weekly: activeSince(isoDaysAgo(7)),
      monthly: activeSince(isoDaysAgo(30)),
    },
    signupsPerDay: signups
      .map((row) => ({ date: row.date, count: Number(row.n) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    usage: {
      today: {
        foodEntries: Number(foodToday[0]?.n ?? 0),
        workoutSessions: Number(sessionsToday[0]?.n ?? 0),
        stepEntries: Number(stepsToday[0]?.n ?? 0),
      },
      last7Days: {
        foodEntries: Number(foodWeek[0]?.n ?? 0),
        workoutSessions: Number(sessionsWeek[0]?.n ?? 0),
        stepEntries: Number(stepsWeek[0]?.n ?? 0),
      },
    },
    errorsLast24h: Number(errors[0]?.n ?? 0),
  };
}

export async function listUsers(env: Env, query: string | undefined, limit: number, cursor?: string) {
  const d = db(env);

  const rows = await d
    .select()
    .from(schema.users)
    .where(
      and(
        query
          ? or(like(schema.users.email, `%${query}%`), like(schema.users.name, `%${query}%`))
          : undefined,
        cursor ? lt(schema.users.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(schema.users.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const links = await d
    .select({ link: schema.coachClients, coachName: schema.users.name })
    .from(schema.coachClients)
    .innerJoin(schema.users, eq(schema.users.id, schema.coachClients.coachId))
    .where(eq(schema.coachClients.status, "active"));

  const items: AdminUser[] = page.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    disabledAt: user.disabledAt,
    coachName:
      user.role === "client"
        ? (links.find((l) => l.link.clientId === user.id)?.coachName ?? null)
        : null,
    clientCount:
      user.role === "coach" ? links.filter((l) => l.link.coachId === user.id).length : null,
  }));

  return { items, nextCursor: rows.length > limit ? (page.at(-1)?.createdAt ?? null) : null };
}

export async function userDetail(env: Env, userId: string) {
  const d = db(env);

  const rows = await d.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return null;

  const coachUsers = schema.users;
  const links = await d
    .select({ link: schema.coachClients, coachName: coachUsers.name })
    .from(schema.coachClients)
    .innerJoin(coachUsers, eq(coachUsers.id, schema.coachClients.coachId))
    .where(
      or(eq(schema.coachClients.coachId, userId), eq(schema.coachClients.clientId, userId)),
    );

  const clientNames = await d
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(isNotNull(schema.users.id));
  const nameById = new Map(clientNames.map((row) => [row.id, row.name]));

  const [foodEntries, workoutSessions, stepEntries, activeSessions, activeLinks] = await Promise.all([
    d.select({ n: count() }).from(schema.foodLogs).where(eq(schema.foodLogs.clientId, userId)),
    d
      .select({ n: count() })
      .from(schema.workoutSessions)
      .where(eq(schema.workoutSessions.clientId, userId)),
    d.select({ n: count() }).from(schema.dailyMetrics).where(eq(schema.dailyMetrics.clientId, userId)),
    d.select({ n: count() }).from(schema.sessions).where(eq(schema.sessions.userId, userId)),
    d
      .select({ n: count() })
      .from(schema.coachClients)
      .where(
        and(eq(schema.coachClients.coachId, userId), eq(schema.coachClients.status, "active")),
      ),
  ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    disabledAt: user.disabledAt,
    coachName:
      user.role === "client"
        ? (links.find((l) => l.link.clientId === userId && l.link.status === "active")?.coachName ??
          null)
        : null,
    clientCount: user.role === "coach" ? Number(activeLinks[0]?.n ?? 0) : null,
    links: links.map(({ link, coachName }) => ({
      id: link.id,
      status: link.status,
      inviteCode: link.inviteCode,
      coachId: link.coachId,
      coachName,
      clientId: link.clientId,
      clientName: link.clientId ? (nameById.get(link.clientId) ?? null) : null,
      createdAt: link.createdAt,
    })),
    activity: {
      // Counts only. The admin panel never shows what was eaten or lifted.
      foodEntries: Number(foodEntries[0]?.n ?? 0),
      workoutSessions: Number(workoutSessions[0]?.n ?? 0),
      stepEntries: Number(stepEntries[0]?.n ?? 0),
      sessionsActive: Number(activeSessions[0]?.n ?? 0),
    },
  };
}

export async function coachSummaries(env: Env) {
  const d = db(env);

  const coaches = await d.select().from(schema.users).where(eq(schema.users.role, "coach"));
  const links = await d
    .select()
    .from(schema.coachClients)
    .where(and(eq(schema.coachClients.status, "active"), isNotNull(schema.coachClients.clientId)));

  const weekAgo = dateDaysAgo(6);
  const recentFood = await d
    .selectDistinct({ clientId: schema.foodLogs.clientId })
    .from(schema.foodLogs)
    .where(gte(schema.foodLogs.date, weekAgo));
  const recentSessions = await d
    .selectDistinct({ clientId: schema.workoutSessions.clientId })
    .from(schema.workoutSessions)
    .where(gte(schema.workoutSessions.date, weekAgo));

  const activeClientIds = new Set([
    ...recentFood.map((r) => r.clientId),
    ...recentSessions.map((r) => r.clientId),
  ]);

  return coaches.map((coach) => {
    const mine = links.filter((link) => link.coachId === coach.id);
    return {
      coach: {
        id: coach.id,
        email: coach.email,
        name: coach.name,
        role: coach.role,
        createdAt: coach.createdAt,
        lastActiveAt: coach.lastActiveAt,
        disabledAt: coach.disabledAt,
        coachName: null,
        clientCount: mine.length,
      },
      activeClients: mine.length,
      clientsActiveLast7Days: mine.filter((link) => activeClientIds.has(link.clientId!)).length,
    };
  });
}

export async function listErrors(
  env: Env,
  filters: { route?: string; status?: number },
  limit: number,
  cursor?: string,
) {
  const d = db(env);
  const rows = await d
    .select()
    .from(schema.errorLogs)
    .where(
      and(
        filters.route ? like(schema.errorLogs.route, `%${filters.route}%`) : undefined,
        filters.status ? eq(schema.errorLogs.status, filters.status) : undefined,
        cursor ? lt(schema.errorLogs.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(schema.errorLogs.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return { items: page, nextCursor: rows.length > limit ? (page.at(-1)?.createdAt ?? null) : null };
}

export async function listAudit(env: Env, limit: number, cursor?: string) {
  const d = db(env);
  const admins = schema.users;

  const rows = await d
    .select({ entry: schema.adminAuditLog, adminName: admins.name })
    .from(schema.adminAuditLog)
    .innerJoin(admins, eq(admins.id, schema.adminAuditLog.adminId))
    .where(cursor ? lt(schema.adminAuditLog.createdAt, cursor) : undefined)
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const names = await d.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const nameById = new Map(names.map((row) => [row.id, row.name]));

  return {
    items: page.map(({ entry, adminName }) => ({
      id: entry.id,
      adminId: entry.adminId,
      adminName,
      action: entry.action,
      targetUserId: entry.targetUserId,
      targetUserName: entry.targetUserId ? (nameById.get(entry.targetUserId) ?? null) : null,
      details: entry.details,
      createdAt: entry.createdAt,
    })),
    nextCursor: rows.length > limit ? (page.at(-1)?.entry.createdAt ?? null) : null,
  };
}

/** Unassigned invites are rows with no client yet. */
export async function pendingInviteCount(env: Env) {
  const rows = await db(env)
    .select({ n: count() })
    .from(schema.coachClients)
    .where(isNull(schema.coachClients.clientId));
  return Number(rows[0]?.n ?? 0);
}
