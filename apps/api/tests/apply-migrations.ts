import { applyD1Migrations, env, fetchMock } from "cloudflare:test";
import { beforeAll } from "vitest";

/**
 * Run the real migration files against the isolated test database, and keep
 * the suite off the network. Tests that need Open Food Facts or USDA set up
 * their own interceptors.
 */
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
