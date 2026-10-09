import type { OpenAPIHono } from "@hono/zod-openapi";

/**
 * Bindings come from wrangler.jsonc via `wrangler types`.
 * Secrets are added here because they live outside the config file.
 */
export type Env = Cloudflare.Env & {
  USDA_API_KEY?: string;
};

export interface AppBindings {
  Bindings: Env;
  Variables: {
    requestId: string;
  };
}

export type App = OpenAPIHono<AppBindings>;
