import { createRoute } from "@hono/zod-openapi";
import { healthSchema } from "@hybredmusa/shared";
import type { App } from "../types.js";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["system"],
  summary: "Liveness check",
  responses: {
    200: {
      description: "The API is up",
      content: { "application/json": { schema: healthSchema } },
    },
  },
});

export function registerHealthRoutes(app: App) {
  app.openapi(healthRoute, (c) =>
    c.json(
      {
        ok: true,
        version: c.env.API_VERSION ?? "unknown",
        commit: c.env.GIT_COMMIT ?? "unknown",
      },
      200,
    ),
  );
}
