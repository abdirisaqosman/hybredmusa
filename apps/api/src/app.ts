import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { ApiException, errorBody } from "./errors.js";
import { recordError } from "./services/errorLog.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerCoachRoutes } from "./routes/coach.js";
import { registerFoodRoutes } from "./routes/foods.js";
import { registerLinkRoutes } from "./routes/links.js";
import { registerMetricRoutes } from "./routes/metrics.js";
import { registerNutritionRoutes } from "./routes/nutrition.js";
import { registerWorkoutRoutes } from "./routes/workouts.js";
import type { AppBindings } from "./types.js";

export function createApp() {
  const app = new OpenAPIHono<AppBindings>({
    // Zod validation failures must use the same error shape as everything else.
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody("VALIDATION_ERROR", result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")),
          400,
        );
      }
    },
  });

  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    await next();
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const status = err instanceof ApiException ? Number(err.status) : 500;
    const code = err instanceof ApiException ? err.code : "INTERNAL_ERROR";
    const message = err instanceof ApiException ? err.message : "Something went wrong";

    // Only server faults are worth storing. Client mistakes are not errors.
    if (status >= 500) {
      console.error("unhandled error", { requestId, err });
      c.executionCtx.waitUntil(
        recordError(c.env, {
          route: new URL(c.req.url).pathname,
          method: c.req.method,
          status,
          errorCode: code,
          message: err instanceof Error ? err.message : String(err),
          userId: c.get("user")?.id ?? null,
          requestId,
        }),
      );
    }

    return c.json(errorBody(code, message), status as 500);
  });

  app.notFound((c) => c.json(errorBody("NOT_FOUND", "No such route"), 404));

  const v1 = new OpenAPIHono<AppBindings>();
  registerHealthRoutes(v1);
  registerAuthRoutes(v1);
  registerLinkRoutes(v1);
  registerFoodRoutes(v1);
  registerNutritionRoutes(v1);
  registerWorkoutRoutes(v1);
  registerMetricRoutes(v1);
  registerCoachRoutes(v1);
  registerAdminRoutes(v1);

  v1.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "Used by the mobile app. Send the token returned by login.",
  });
  v1.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "hm_session",
    description: "Set automatically for the web app on login.",
  });

  v1.doc("/openapi.json", (c) => ({
    openapi: "3.0.0",
    info: {
      title: "Hybredmusa API",
      version: c.env.API_VERSION ?? "0.1.0",
      description: "Coach and client fitness tracker. Used by the web app and the Flutter app.",
    },
    servers: [{ url: "/api/v1" }],
  }));

  v1.get("/docs", swaggerUI({ url: "/api/v1/openapi.json" }));

  app.route("/api/v1", v1);

  return app;
}
