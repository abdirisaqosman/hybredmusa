import { env, fetchMock } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Diary, Food, FoodLog, NutritionTarget } from "@hybredmusa/shared";
import { coachAndClient, del, get, post, sessionCookie, signup } from "./helpers.js";

const TODAY = new Date().toISOString().slice(0, 10);

async function setTarget(clientId: string, cookie: string, overrides: Record<string, unknown> = {}) {
  return post(
    `/clients/${clientId}/targets`,
    { calories: 2400, proteinG: 180, carbsG: 250, fatG: 70, ...overrides },
    { cookie },
  );
}

async function customFood(cookie: string, overrides: Record<string, unknown> = {}) {
  const res = await post(
    "/foods",
    {
      name: `Oats ${crypto.randomUUID().slice(0, 8)}`,
      caloriesPer100g: 380,
      proteinPer100g: 13,
      carbsPer100g: 60,
      fatPer100g: 7,
      ...overrides,
    },
    { cookie },
  );
  return (await res.json()) as Food;
}

describe("macro targets", () => {
  it("lets the coach set a target the client can read", async () => {
    const { clientId, coachCookie, clientCookie } = await coachAndClient();

    const created = await setTarget(clientId, coachCookie);
    expect(created.status).toBe(201);
    expect((await created.json()) as NutritionTarget).toMatchObject({ calories: 2400 });

    const read = await get(`/clients/${clientId}/targets`, { cookie: clientCookie });
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ target: { proteinG: 180 } });
  });

  it("keeps old targets instead of rewriting them", async () => {
    const { clientId, coachCookie } = await coachAndClient();
    await setTarget(clientId, coachCookie, { calories: 2000, effectiveFrom: "2026-01-01" });
    await setTarget(clientId, coachCookie, { calories: 2600, effectiveFrom: "2026-06-01" });

    const january = await (
      await get(`/clients/${clientId}/targets?date=2026-03-15`, { cookie: coachCookie })
    ).json();
    const june = await (
      await get(`/clients/${clientId}/targets?date=2026-07-01`, { cookie: coachCookie })
    ).json();
    const history = (await (
      await get(`/clients/${clientId}/targets/history`, { cookie: coachCookie })
    ).json()) as { items: NutritionTarget[] };

    expect(january).toMatchObject({ target: { calories: 2000 } });
    expect(june).toMatchObject({ target: { calories: 2600 } });
    expect(history.items).toHaveLength(2);
  });

  it("returns no target before the first one is set", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const res = await get(`/clients/${clientId}/targets`, { cookie: clientCookie });
    expect(await res.json()).toEqual({ target: null });
  });

  it("refuses a client setting their own target, and a coach they are not linked to", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    expect((await setTarget(clientId, clientCookie)).status).toBe(403);

    const stranger = await signup({ role: "coach" });
    const res = await setTarget(clientId, sessionCookie(stranger.res));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_YOUR_CLIENT" } });
  });
});

describe("food diary", () => {
  it("totals a quick add against the target", async () => {
    const { clientId, coachCookie, clientCookie } = await coachAndClient();
    await setTarget(clientId, coachCookie);

    const entry = await post(
      `/clients/${clientId}/food-logs`,
      {
        kind: "quick",
        date: TODAY,
        meal: "breakfast",
        name: "Protein shake",
        calories: 300,
        proteinG: 40,
        carbsG: 20,
        fatG: 5,
      },
      { cookie: clientCookie },
    );
    expect(entry.status).toBe(201);

    const diary = (await (
      await get(`/clients/${clientId}/diary?date=${TODAY}`, { cookie: clientCookie })
    ).json()) as Diary;

    expect(diary.totals).toEqual({ calories: 300, proteinG: 40, carbsG: 20, fatG: 5 });
    expect(diary.remaining).toEqual({ calories: 2100, proteinG: 140, carbsG: 230, fatG: 65 });
    expect(diary.meals.find((m) => m.meal === "breakfast")?.entries).toHaveLength(1);
  });

  it("scales a food by weight and snapshots the macros", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const food = await customFood(clientCookie);

    const logged = (await (
      await post(
        `/clients/${clientId}/food-logs`,
        { kind: "food", date: TODAY, meal: "lunch", foodRef: food.ref, grams: 50 },
        { cookie: clientCookie },
      )
    ).json()) as FoodLog;

    expect(logged.calories).toBe(190);
    expect(logged.proteinG).toBe(6.5);

    // Changing the food afterwards must not touch what was already logged.
    await env.DB.prepare("update foods set calories_per_100g = 999 where id = ?")
      .bind(food.ref)
      .run();

    const diary = (await (
      await get(`/clients/${clientId}/diary?date=${TODAY}`, { cookie: clientCookie })
    ).json()) as Diary;
    expect(diary.totals.calories).toBe(190);
  });

  it("deletes an entry", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const entry = (await (
      await post(
        `/clients/${clientId}/food-logs`,
        {
          kind: "quick",
          date: TODAY,
          meal: "snack",
          name: "Banana",
          calories: 105,
          proteinG: 1,
          carbsG: 27,
          fatG: 0,
        },
        { cookie: clientCookie },
      )
    ).json()) as FoodLog;

    expect((await del(`/clients/${clientId}/food-logs/${entry.id}`, { cookie: clientCookie })).status).toBe(200);

    const diary = (await (
      await get(`/clients/${clientId}/diary?date=${TODAY}`, { cookie: clientCookie })
    ).json()) as Diary;
    expect(diary.totals.calories).toBe(0);
  });
});

describe("diary permissions", () => {
  it("lets the coach read the diary but never write logs", async () => {
    const { clientId, coachCookie } = await coachAndClient();

    expect((await get(`/clients/${clientId}/diary`, { cookie: coachCookie })).status).toBe(200);

    const write = await post(
      `/clients/${clientId}/food-logs`,
      {
        kind: "quick",
        date: TODAY,
        meal: "dinner",
        name: "Coach food",
        calories: 100,
        proteinG: 1,
        carbsG: 1,
        fatG: 1,
      },
      { cookie: coachCookie },
    );
    expect(write.status).toBe(403);
    expect(await write.json()).toMatchObject({ error: { code: "LOGS_ARE_CLIENT_ONLY" } });
  });

  it("hides a client's diary from an unrelated coach and from another client", async () => {
    const { clientId } = await coachAndClient();

    const otherCoach = await signup({ role: "coach" });
    const otherClient = await signup({ role: "client" });

    expect(
      (await get(`/clients/${clientId}/diary`, { cookie: sessionCookie(otherCoach.res) })).status,
    ).toBe(403);
    expect(
      (await get(`/clients/${clientId}/diary`, { cookie: sessionCookie(otherClient.res) })).status,
    ).toBe(403);
  });

  it("needs a session", async () => {
    const { clientId } = await coachAndClient();
    expect((await get(`/clients/${clientId}/diary`)).status).toBe(401);
  });
});

describe("custom foods", () => {
  it("stores per 100 g values and finds them in search", async () => {
    const { clientCookie } = await coachAndClient();
    const food = await customFood(clientCookie, { name: "Nonna lasagne", brand: "Home" });

    const res = await get(`/foods/search?q=${encodeURIComponent("Nonna lasagne")}`, {
      cookie: clientCookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Food[]; sources: { local: boolean } };
    expect(body.sources.local).toBe(true);
    expect(body.items.some((item) => item.ref === food.ref)).toBe(true);
  });
});

describe("barcode lookup", () => {
  it("reads a product from Open Food Facts and caches it on first log", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const barcode = "5000112637922";
    const product = {
      product: {
        code: barcode,
        product_name: "Test cola",
        brands: "Testy",
        nutriments: {
          "energy-kcal_100g": 42,
          proteins_100g: 0,
          carbohydrates_100g: 10.6,
          fat_100g: 0,
        },
      },
    };

    fetchMock
      .get("https://world.openfoodfacts.org")
      .intercept({ path: (p) => p.includes(`/api/v2/product/${barcode}.json`) })
      .reply(200, product)
      .times(2);

    const found = (await (
      await get(`/foods/barcode/${barcode}`, { cookie: clientCookie })
    ).json()) as Food;
    expect(found).toMatchObject({ ref: `off:${barcode}`, caloriesPer100g: 42 });

    const logged = (await (
      await post(
        `/clients/${clientId}/food-logs`,
        { kind: "food", date: TODAY, meal: "snack", foodRef: found.ref, grams: 330 },
        { cookie: clientCookie },
      )
    ).json()) as FoodLog;
    expect(logged.calories).toBe(138.6);

    // The second lookup comes from our own cache, not from Open Food Facts.
    const cached = (await (
      await get(`/foods/barcode/${barcode}`, { cookie: clientCookie })
    ).json()) as Food;
    expect(cached.source).toBe("off");
    expect(cached.ref).not.toContain("off:");
  });

  it("returns a clear 404 when the barcode is unknown", async () => {
    const { clientCookie } = await coachAndClient();
    fetchMock
      .get("https://world.openfoodfacts.org")
      .intercept({ path: (p) => p.includes("/api/v2/product/0000000000000.json") })
      .reply(200, { status: 0 });

    const res = await get("/foods/barcode/0000000000000", { cookie: clientCookie });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "FOOD_NOT_FOUND" } });
  });
});
