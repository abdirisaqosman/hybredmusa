import type { OpenAPIHono } from "@hono/zod-openapi";
import type { schema } from "./db/client.js";

/**
 * Bindings come from wrangler.jsonc via `wrangler types`.
 * Secrets are added here because they live outside the config file.
 */
export type Env = Cloudflare.Env & {
  USDA_API_KEY?: string;
};

export type SessionUser = typeof schema.users.$inferSelect;
export type SessionRow = typeof schema.sessions.$inferSelect;

export interface AppBindings {
  Bindings: Env;
  Variables: {
    requestId: string;
    user?: SessionUser;
    session?: SessionRow;
  };
}

export type App = OpenAPIHono<AppBindings>;
