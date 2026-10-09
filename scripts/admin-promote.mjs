#!/usr/bin/env node
/**
 * Make an existing account an admin.
 *
 *   npm run admin:promote -- someone@example.com --local
 *   npm run admin:promote -- someone@example.com --remote
 *
 * This is the only way to create the first admin. Signup can never do it.
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith("--"));
const remote = args.includes("--remote");
const local = args.includes("--local");

if (!email || (!remote && !local)) {
  console.error("Usage: npm run admin:promote -- <email> --local|--remote");
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Not an email address: ${email}`);
  process.exit(1);
}

const sql = `UPDATE users SET role = 'admin' WHERE email = '${email.toLowerCase().replace(/'/g, "''")}';`;

const result = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "hybredmusa-db",
    remote ? "--remote" : "--local",
    "--command",
    sql,
  ],
  { cwd: new URL("../apps/api", import.meta.url).pathname, stdio: "inherit" },
);

if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`\n${email} is now an admin on the ${remote ? "remote" : "local"} database.`);
console.log("They need to sign in again for the new role to show up.");
