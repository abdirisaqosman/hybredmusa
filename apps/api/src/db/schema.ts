import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Plan tables (targets, templates) are kept separate from log tables
 * (food_logs, workout_sessions, session_sets, daily_metrics).
 * Changing a plan must never rewrite a past log, so logs carry snapshots.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["coach", "client", "admin"] }).notNull(),
    createdAt: text("created_at").notNull().default(now),
    lastActiveAt: text("last_active_at"),
    disabledAt: text("disabled_at"),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_last_active_idx").on(t.lastActiveAt),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    clientType: text("client_type", { enum: ["web", "mobile"] }).notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const coachClients = sqliteTable(
  "coach_clients",
  {
    id: text("id").primaryKey(),
    coachId: text("coach_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["invited", "active"] }).notNull(),
    inviteCode: text("invite_code").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("coach_clients_invite_code_unique").on(t.inviteCode),
    uniqueIndex("coach_clients_pair_unique").on(t.coachId, t.clientId),
    index("coach_clients_client_idx").on(t.clientId),
  ],
);

export const nutritionTargets = sqliteTable(
  "nutrition_targets",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calories: integer("calories").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    setBy: text("set_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("nutrition_targets_client_date_idx").on(t.clientId, t.effectiveFrom)],
);

export const foods = sqliteTable(
  "foods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    brand: text("brand"),
    barcode: text("barcode"),
    source: text("source", { enum: ["off", "usda", "custom"] }).notNull(),
    caloriesPer100g: real("calories_per_100g").notNull(),
    proteinPer100g: real("protein_per_100g").notNull(),
    carbsPer100g: real("carbs_per_100g").notNull(),
    fatPer100g: real("fat_per_100g").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("foods_barcode_idx").on(t.barcode),
    index("foods_name_idx").on(t.name),
  ],
);

export const foodLogs = sqliteTable(
  "food_logs",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    meal: text("meal", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
    foodId: text("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    grams: real("grams").notNull(),
    // Snapshot of the totals for this entry, frozen at the time of logging.
    calories: real("calories").notNull(),
    proteinG: real("protein_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    fatG: real("fat_g").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("food_logs_client_date_idx").on(t.clientId, t.date)],
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group").notNull(),
    equipment: text("equipment").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("exercises_name_idx").on(t.name)],
);

export const workoutTemplates = sqliteTable(
  "workout_templates",
  {
    id: text("id").primaryKey(),
    coachId: text("coach_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("workout_templates_client_idx").on(t.clientId)],
);

export const templateExercises = sqliteTable(
  "template_exercises",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    targetWeight: real("target_weight"),
    restSeconds: integer("rest_seconds"),
  },
  (t) => [index("template_exercises_template_idx").on(t.templateId, t.position)],
);

export const workoutSessions = sqliteTable(
  "workout_sessions",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    date: text("date").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    notes: text("notes"),
  },
  (t) => [index("workout_sessions_client_date_idx").on(t.clientId, t.date)],
);

export const sessionSets = sqliteTable(
  "session_sets",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps").notNull(),
    weight: real("weight").notNull(),
    rpe: real("rpe"),
  },
  (t) => [index("session_sets_session_idx").on(t.sessionId, t.exerciseId, t.setNumber)],
);

export const dailyMetrics = sqliteTable(
  "daily_metrics",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    steps: integer("steps"),
    bodyweightKg: real("bodyweight_kg"),
    stepsSource: text("steps_source", { enum: ["manual", "device"] }),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("daily_metrics_client_date_unique").on(t.clientId, t.date)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["day", "session"] }).notNull(),
    targetRef: text("target_ref").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("comments_target_idx").on(t.clientId, t.targetType, t.targetRef)],
);

export const errorLogs = sqliteTable(
  "error_logs",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull().default(now),
    route: text("route").notNull(),
    method: text("method").notNull(),
    status: integer("status").notNull(),
    errorCode: text("error_code").notNull(),
    message: text("message").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    requestId: text("request_id").notNull(),
  },
  (t) => [
    index("error_logs_created_idx").on(t.createdAt),
    index("error_logs_route_idx").on(t.route),
  ],
);

export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    details: text("details"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);
