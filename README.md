# Hybredmusa

Food and macro tracking plus workout logging, with a coach view and an admin panel.

- **Clients** log food (calories and macros), workouts (sets, reps, weight), daily steps and bodyweight.
- **Coaches** see client progress, set macro targets, and build and assign workout templates.
- **Admins** see app health: users, activity, errors, audit log, account management.

The plan (coach-set targets and templates) is kept separate from the log (what the client actually did).
Editing a plan never changes a past log, because every log row carries a snapshot of what was logged.

## Architecture

```
                 +----------------------+
  Web browser -->|  web  (Cloudflare     |-- /api/* via service binding --+
                 |  Worker, React SPA)   |                               |
                 +----------------------+                               v
                                                           +----------------------+
  Mobile app (later) -- HTTPS, Bearer token -------------->|  api  (Cloudflare     |--> D1
                                                           |  Worker, Hono)        |
                                                           +----------------------+
```

- **api** owns all business logic, validation, permissions and the database.
- **web** is a pure client. It forwards `/api/*` to the api Worker over a service binding, so the
  browser sees one origin and cookies work without CORS.
- **mobile** (Flutter, later) will call the api Worker directly with a Bearer token and generate its
  client from the OpenAPI spec.

## Stack

| Part | Choice |
|---|---|
| Repo | npm workspaces monorepo |
| Backend | Cloudflare Worker, Hono, `@hono/zod-openapi` |
| Database | Cloudflare D1 (SQLite), bound only to the api Worker |
| ORM | Drizzle ORM and drizzle-kit, applied with `wrangler d1 migrations apply` |
| Frontend | React, TypeScript, Vite, `@cloudflare/vite-plugin`, deployed as its own Worker |
| UI | Tailwind CSS v4 and shadcn/ui |
| Routing and data | TanStack Router, TanStack Query, TanStack Table |
| Charts | Recharts |
| Shared | `packages/shared`: Zod schemas and types used by api and web |
| Tests | Vitest running against a local D1 |

## Layout

```
apps/api        Hono Worker (routes, middleware, Drizzle schema, migrations, tests)
apps/web        React SPA served by a Worker that forwards /api/* to the api Worker
apps/mobile     reserved for the Flutter app
packages/shared Zod schemas and TypeScript types
```

## Run locally

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # add your USDA key when you have one
npm run db:migrate:local
npm run dev
```

- Web app: http://localhost:5173
- API direct: http://localhost:8787/api/v1/health
- API docs: http://localhost:5173/api/v1/docs
- OpenAPI spec: http://localhost:5173/api/v1/openapi.json

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs the api and web Workers together |
| `npm run build` | Type-checks every workspace and builds the web app |
| `npm test` | Runs the api tests against a local D1 |
| `npm run db:generate` | Generates a migration from the Drizzle schema |
| `npm run db:migrate:local` | Applies migrations to the local D1 |
| `npm run db:migrate:remote` | Applies migrations to the production D1 |
| `npm run deploy` | Deploys the api Worker, then the web Worker |
| `npm run admin:promote -- <email> --local\|--remote` | Makes an existing account an admin |

## Deploy

```bash
npx wrangler login
npx wrangler d1 create hybredmusa-db          # put database_id in apps/api/wrangler.jsonc
npm run db:migrate:remote
cd apps/api && npx wrangler secret put USDA_API_KEY && cd ../..
npm run deploy                                 # api first, then web
```

The api Worker must exist before the web Worker is deployed, because the service binding points at it.

## API conventions

- Everything is versioned under `/api/v1/`.
- JSON in, JSON out. Errors always look like
  `{ "error": { "code": "STRING_CODE", "message": "Human text" } }`.
- Days are `YYYY-MM-DD`, timestamps are ISO 8601 UTC, weight is kg, energy is kcal.
- List endpoints paginate with `?cursor=` and `?limit=`.
- Auth accepts a session cookie (web) or `Authorization: Bearer <token>` (mobile).

## What is in the app

**Clients** log food by searching Open Food Facts and USDA, scanning a barcode, saving a custom
food or quick adding numbers. They log workouts from a coach's template or from scratch, see what
they lifted for that exercise last time, and record daily steps and bodyweight.

**Coaches** see each client's adherence, set macro targets, build and assign workout templates,
read diaries, workouts and charts, and comment on a day or a session.

**Admins** get `/admin`: totals and active users, signups per day, usage, a searchable user table
with disable, force logout, role change and unlink, a coach overview, the error log, the audit log
and a live status check of D1, Open Food Facts and USDA. Admins never see an individual client's
food, workouts, bodyweight or comments, only counts and aggregates.

## Becoming an admin

Signup can only create a coach or a client. The first admin is made from the command line:

```bash
npm run admin:promote -- you@example.com --remote
```

After that, an admin can promote others from the admin panel. Nobody can demote themselves.

## Status

Phases 0 to 6 are done: setup, auth and roles, nutrition, workouts, steps and bodyweight, the coach
dashboard, and the admin panel. 71 api tests cover permissions, snapshots, adherence maths and
every admin route.
