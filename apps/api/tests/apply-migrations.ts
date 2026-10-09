import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

/** Run the real migration files against the isolated test database. */
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
