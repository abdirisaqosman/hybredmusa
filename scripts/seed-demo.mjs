#!/usr/bin/env node
/**
 * Fill an environment with believable demo data, through the public API only.
 *
 *   node scripts/seed-demo.mjs                        # local, http://localhost:8787
 *   node scripts/seed-demo.mjs --api https://hybredmusa-api.example.workers.dev
 *   node scripts/seed-demo.mjs --days 90 --password "something else"
 *
 * Safe to run again: accounts that already exist are reused, and each client
 * only gets days that are still empty.
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const API = `${flag("api", "http://localhost:8787").replace(/\/$/, "")}/api/v1`;
const PASSWORD = flag("password", "demo-hybredmusa-2026");
const DAYS = Number(flag("days", 75));

const day = (back) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** Keep a few requests in flight. D1 is fine with it and the seed stays quick. */
async function pool(items, worker, size = 8) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

async function ensureUser(email, name, role, inviteCode) {
  try {
    const created = await call("/auth/signup", {
      method: "POST",
      body: { email, password: PASSWORD, name, role, client: "mobile", ...(inviteCode ? { inviteCode } : {}) },
    });
    return { ...created, isNew: true };
  } catch (error) {
    if (!String(error).includes("409")) throw error;
    const session = await call("/auth/login", {
      method: "POST",
      body: { email, password: PASSWORD, client: "mobile" },
    });
    return { ...session, isNew: false };
  }
}

const MEAL_SETS = [
  [
    ["breakfast", "Oats with whey and berries", 520, 38, 70, 10],
    ["lunch", "Chicken, rice and veg", 760, 58, 85, 18],
    ["dinner", "Salmon, potatoes and salad", 820, 52, 70, 34],
    ["snack", "Greek yoghurt and almonds", 310, 24, 18, 16],
  ],
  [
    ["breakfast", "Eggs, toast and avocado", 560, 30, 45, 28],
    ["lunch", "Turkey wrap and fruit", 640, 45, 72, 18],
    ["dinner", "Beef stir fry with noodles", 880, 55, 95, 30],
    ["snack", "Protein shake and banana", 330, 32, 38, 4],
  ],
  [
    ["breakfast", "Skyr, granola and honey", 480, 34, 62, 9],
    ["lunch", "Tuna pasta salad", 700, 48, 80, 20],
    ["dinner", "Chicken curry and rice", 910, 56, 102, 28],
    ["snack", "Rice cakes and peanut butter", 290, 10, 32, 14],
  ],
];

/** Each client logs differently, so the coach dashboard has something to say. */
const PROFILES = {
  onTrack: { logChance: 0.95, scale: 1.0, trainDays: [1, 3, 5], stepsBase: 9000, weightTrend: -0.015 },
  cutting: { logChance: 0.85, scale: 0.82, trainDays: [1, 2, 4, 6], stepsBase: 12000, weightTrend: -0.05 },
  spotty: { logChance: 0.45, scale: 1.08, trainDays: [2, 5], stepsBase: 6000, weightTrend: 0.01 },
};

async function seedDiary(clientId, token, profile, fromBack, toBack) {
  const days = [];
  for (let back = fromBack; back >= toBack; back--) days.push(back);

  await pool(days, async (back) => {
    const date = day(back);
    const seed = (back * 7919) % 1000 / 1000;

    if (seed < profile.logChance) {
      const meals = MEAL_SETS[back % MEAL_SETS.length];
      const wobble = profile.scale * (0.92 + ((back % 7) / 7) * 0.16);
      for (const [meal, name, calories, proteinG, carbsG, fatG] of meals) {
        await call(`/clients/${clientId}/food-logs`, {
          method: "POST",
          token,
          body: {
            kind: "quick",
            date,
            meal,
            name,
            calories: Math.round(calories * wobble),
            proteinG: Math.round(proteinG * wobble),
            carbsG: Math.round(carbsG * wobble),
            fatG: Math.round(fatG * wobble),
          },
        });
      }
    }

    await call(`/clients/${clientId}/metrics/${date}`, {
      method: "PUT",
      token,
      body: {
        steps: Math.round(profile.stepsBase + ((back * 937) % 4800) - 1200),
        bodyweightKg:
          Math.round((profile.startWeight + (DAYS - back) * profile.weightTrend) * 10) / 10,
      },
    });
  });
}

async function seedWorkouts(clientId, token, profile, exercises, templateId, fromBack, toBack) {
  const byName = (name) => exercises.items.find((e) => e.name === name).id;

  const push = [byName("Barbell Bench Press"), byName("Seated Dumbbell Press"), byName("Triceps Pushdown")];
  const pull = [byName("Barbell Row"), byName("Lat Pulldown"), byName("Barbell Curl")];
  const legs = [byName("Barbell Back Squat"), byName("Romanian Deadlift"), byName("Leg Press")];
  const rotation = [push, pull, legs];

  let week = 0;
  for (let back = fromBack; back >= toBack; back--) {
    const date = new Date(Date.now() - back * 86_400_000);
    if (!profile.trainDays.includes(date.getUTCDay())) continue;

    const group = rotation[week % rotation.length];
    week += 1;

    const session = await call(`/clients/${clientId}/sessions`, {
      method: "POST",
      token,
      body: { templateId: group === rotation[0] ? templateId : null, date: day(back) },
    });

    // Loads creep up over the weeks, with the odd lighter day.
    const progress = (DAYS - back) / 14;
    for (const [index, exerciseId] of group.entries()) {
      const base = [80, 60, 35][index] ?? 50;
      const top = Math.round((base + progress * 2.5 - (back % 11 === 0 ? 5 : 0)) * 2) / 2;
      for (const [reps, drop] of [[8, 0], [8, 0], [7, 0], [10, 7.5]]) {
        await call(`/sessions/${session.id}/sets`, {
          method: "POST",
          token,
          body: { exerciseId, reps, weight: Math.max(20, top - drop), rpe: 8 },
        });
      }
    }

    await call(`/sessions/${session.id}/finish`, {
      method: "POST",
      token,
      body: { notes: back % 3 === 0 ? "Solid session." : null },
    });
  }
}

async function main() {
  console.log(`Seeding ${API} with ${DAYS} days of history`);

  const coach = await ensureUser("demo-coach@hybredmusa.app", "Demo Coach", "coach");
  const coachTwo = await ensureUser("demo-coach-2@hybredmusa.app", "Sara Hale", "coach");
  console.log(`coach: ${coach.isNew ? "created" : "reused"}, second coach: ${coachTwo.isNew ? "created" : "reused"}`);

  const exercises = await call("/exercises", { token: coach.token });

  const clients = [
    { email: "demo-client@hybredmusa.app", name: "Demo Client", profile: "onTrack", startWeight: 83.4, target: [2550, 190, 265, 75] },
    { email: "demo-client-2@hybredmusa.app", name: "Jonas Weber", profile: "cutting", startWeight: 94.2, target: [2200, 185, 200, 65] },
    { email: "demo-client-3@hybredmusa.app", name: "Amina Yusuf", profile: "spotty", startWeight: 68.5, target: [2000, 140, 210, 62] },
    { email: "demo-client-4@hybredmusa.app", name: "Tom Becker", profile: null, startWeight: null, target: null },
  ];

  for (const spec of clients) {
    const invite = await call("/coach/invites", { method: "POST", token: coach.token });
    const account = await ensureUser(spec.email, spec.name, "client", invite.inviteCode);
    const clientId = account.user.id;
    const token = account.token;

    // A client who just signed up and has logged nothing stays empty on purpose.
    if (!spec.profile) {
      console.log(`${spec.name}: linked, no data (new client)`);
      continue;
    }

    const profile = { ...PROFILES[spec.profile], startWeight: spec.startWeight };

    const [calories, proteinG, carbsG, fatG] = spec.target;
    await call(`/clients/${clientId}/targets`, {
      method: "POST",
      token: coach.token,
      body: {
        calories: calories - 150,
        proteinG: proteinG - 10,
        carbsG: carbsG - 20,
        fatG,
        effectiveFrom: day(DAYS),
      },
    });
    await call(`/clients/${clientId}/targets`, {
      method: "POST",
      token: coach.token,
      body: { calories, proteinG, carbsG, fatG, effectiveFrom: day(Math.round(DAYS / 3)) },
    });

    const template = await call(`/clients/${clientId}/templates`, {
      method: "POST",
      token: coach.token,
      body: {
        name: "Upper A",
        notes: "Leave one or two reps in reserve on every set.",
        exercises: [
          { exerciseId: exercises.items.find((e) => e.name === "Barbell Bench Press").id, targetSets: 4, targetReps: 8, targetWeight: 80, restSeconds: 150 },
          { exerciseId: exercises.items.find((e) => e.name === "Seated Dumbbell Press").id, targetSets: 3, targetReps: 10, targetWeight: 24, restSeconds: 90 },
          { exerciseId: exercises.items.find((e) => e.name === "Triceps Pushdown").id, targetSets: 3, targetReps: 15, targetWeight: 30, restSeconds: 60 },
        ],
      },
    });

    await call(`/clients/${clientId}/templates`, {
      method: "POST",
      token: coach.token,
      body: {
        name: "Lower A",
        notes: "Depth over load on the squat.",
        exercises: [
          { exerciseId: exercises.items.find((e) => e.name === "Barbell Back Squat").id, targetSets: 4, targetReps: 5, targetWeight: 100, restSeconds: 180 },
          { exerciseId: exercises.items.find((e) => e.name === "Romanian Deadlift").id, targetSets: 3, targetReps: 8, targetWeight: 90, restSeconds: 150 },
          { exerciseId: exercises.items.find((e) => e.name === "Lying Leg Curl").id, targetSets: 3, targetReps: 12, targetWeight: 45, restSeconds: 90 },
        ],
      },
    });

    // Only fill days this client does not already have.
    const existing = await call(`/clients/${clientId}/progress?from=${day(DAYS)}&to=${day(0)}`, {
      token: coach.token,
    });
    const earliest = existing.nutrition[0]?.date ?? null;
    const startBack = earliest
      ? Math.max(0, Math.round((Date.parse(day(0)) - Date.parse(earliest)) / 86_400_000)) + 1
      : DAYS;

    if (startBack > 0) {
      await seedDiary(clientId, token, profile, DAYS, startBack === DAYS ? 0 : startBack);
      await seedWorkouts(clientId, token, profile, exercises, template.id, DAYS, startBack === DAYS ? 0 : startBack);
    }

    await call(`/clients/${clientId}/comments`, {
      method: "POST",
      token: coach.token,
      body: {
        targetType: "day",
        targetRef: day(1),
        body:
          spec.profile === "cutting"
            ? "Calories are where we want them. Keep protein above 180 g on training days."
            : spec.profile === "spotty"
              ? "Try to log every day this week, even the messy ones. The gaps make this hard to coach."
              : "Good consistency. Add 10 g protein at breakfast and we are set.",
      },
    });

    console.log(`${spec.name}: seeded from ${day(DAYS)}`);
  }

  // One invite nobody has used yet, so the admin overview shows a pending invite.
  const pending = await call("/coach/invites", { method: "POST", token: coachTwo.token });
  console.log(`pending invite for the second coach: ${pending.inviteCode}`);

  console.log("\nSign in with:");
  console.log(`  coach   demo-coach@hybredmusa.app / ${PASSWORD}`);
  console.log(`  client  demo-client@hybredmusa.app / ${PASSWORD}`);
}

await main();
