import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// Read at config time (Node side) and hand to the worker as a binding.
const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

export default defineWorkersConfig({
  test: {
    setupFiles: ["./tests/apply-migrations.ts"],
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  },
});
