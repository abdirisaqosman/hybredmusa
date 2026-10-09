import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { ApiException, errorBody } from "./errors.js";
import { registerHealthRoutes } from "./routes/health.js";
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
    if (err instanceof ApiException) {
      return c.json(errorBody(err.code, err.message), err.status as 400);
    }
    console.error("unhandled error", { requestId: c.get("requestId"), err });
    return c.json(errorBody("INTERNAL_ERROR", "Something went wrong"), 500);
  });

  app.notFound((c) => c.json(errorBody("NOT_FOUND", "No such route"), 404));

  const v1 = new OpenAPIHono<AppBindings>();
  registerHealthRoutes(v1);

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
