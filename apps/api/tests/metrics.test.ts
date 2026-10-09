import { describe, expect, it } from "vitest";
import type { DailyMetric } from "@hybredmusa/shared";
import { coachAndClient, get, post, put, sessionCookie, signup } from "./helpers.js";

describe("steps and bodyweight", () => {
  it("saves one day and reads it back", async () => {
    const { clientId, clientCookie } = await coachAndClient();

    const saved = await put(
      `/clients/${clientId}/metrics/2026-03-01`,
      { steps: 8200, bodyweightKg: 81.4 },
      { cookie: clientCookie },
    );
    expect(saved.status).toBe(200);
    expect((await saved.json()) as DailyMetric).toMatchObject({
      steps: 8200,
      bodyweightKg: 81.4,
      stepsSource: "manual",
    });

    const list = (await (
      await get(`/clients/${clientId}/metrics?from=2026-01-01&to=2026-12-31`, {
        cookie: clientCookie,
      })
    ).json()) as { items: DailyMetric[] };
    expect(list.items).toHaveLength(1);
  });

  it("keeps fields that were not sent", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    await put(
      `/clients/${clientId}/metrics/2026-03-02`,
      { bodyweightKg: 80 },
      { cookie: clientCookie },
    );
    const updated = (await (
      await put(
        `/clients/${clientId}/metrics/2026-03-02`,
        { steps: 10000, stepsSource: "device" },
        { cookie: clientCookie },
      )
    ).json()) as DailyMetric;

    expect(updated).toMatchObject({ steps: 10000, bodyweightKg: 80, stepsSource: "device" });
  });

  it("upserts a batch the way the mobile app will", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const res = await post(
      `/clients/${clientId}/metrics/batch`,
      {
        items: [
          { date: "2026-04-01", steps: 5000, stepsSource: "device" },
          { date: "2026-04-02", steps: 7000, stepsSource: "device" },
          { date: "2026-04-03", steps: 9000, stepsSource: "device" },
        ],
      },
      { cookie: clientCookie },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ saved: 3 });

    const again = await post(
      `/clients/${clientId}/metrics/batch`,
      { items: [{ date: "2026-04-01", steps: 5500, stepsSource: "device" }] },
      { cookie: clientCookie },
    );
    expect(again.status).toBe(200);

    const list = (await (
      await get(`/clients/${clientId}/metrics?from=2026-04-01&to=2026-04-30`, {
        cookie: clientCookie,
      })
    ).json()) as { items: DailyMetric[] };
    expect(list.items).toHaveLength(3);
    expect(list.items[0]).toMatchObject({ date: "2026-04-01", steps: 5500 });
  });

  it("rejects a body with nothing in it", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const res = await put(`/clients/${clientId}/metrics/2026-03-03`, {}, { cookie: clientCookie });
    expect(res.status).toBe(400);
  });

  it("lets the coach read but not write", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    await put(
      `/clients/${clientId}/metrics/2026-03-04`,
      { steps: 1000 },
      { cookie: clientCookie },
    );

    expect((await get(`/clients/${clientId}/metrics`, { cookie: coachCookie })).status).toBe(200);
    expect(
      (await put(`/clients/${clientId}/metrics/2026-03-04`, { steps: 2 }, { cookie: coachCookie }))
        .status,
    ).toBe(403);
  });

  it("hides metrics from an unrelated coach", async () => {
    const { clientId } = await coachAndClient();
    const stranger = await signup({ role: "coach" });
    expect(
      (await get(`/clients/${clientId}/metrics`, { cookie: sessionCookie(stranger.res) })).status,
    ).toBe(403);
  });
});
