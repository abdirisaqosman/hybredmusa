import { describe, expect, it } from "vitest";
import type {
  ClientAdherence,
  Comment,
  Exercise,
  ExerciseHistory,
  Progress,
  WorkoutSession,
} from "@hybredmusa/shared";
import { coachAndClient, del, get, post, put, sessionCookie, signup } from "./helpers.js";

const TODAY = new Date().toISOString().slice(0, 10);

async function logCalories(clientId: string, cookie: string, date: string, calories: number) {
  return post(
    `/clients/${clientId}/food-logs`,
    {
      kind: "quick",
      date,
      meal: "lunch",
      name: "Meal",
      calories,
      proteinG: 40,
      carbsG: 50,
      fatG: 20,
    },
    { cookie },
  );
}

describe("coach dashboard", () => {
  it("summarises each active client", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();

    await post(
      `/clients/${clientId}/targets`,
      { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
      { cookie: coachCookie },
    );
    await logCalories(clientId, clientCookie, TODAY, 1800);
    await put(
      `/clients/${clientId}/metrics/${TODAY}`,
      { steps: 9000, bodyweightKg: 79.5 },
      { cookie: clientCookie },
    );
    const session = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    await post(`/sessions/${session.id}/finish`, {}, { cookie: clientCookie });

    const res = await get("/coach/dashboard", { cookie: coachCookie });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { items: ClientAdherence[] };
    const row = body.items.find((item) => item.client.id === clientId);
    expect(row).toMatchObject({
      loggedFoodToday: true,
      caloriesToday: 1800,
      targetCalories: 2000,
      workoutsThisWeek: 1,
      stepsToday: 9000,
      lastBodyweightKg: 79.5,
    });
  });

  it("is coach only", async () => {
    const { clientCookie } = await coachAndClient();
    expect((await get("/coach/dashboard", { cookie: clientCookie })).status).toBe(403);
    expect((await get("/coach/dashboard")).status).toBe(401);
  });
});

describe("progress series", () => {
  it("returns daily nutrition with the target that applied, plus weight and steps", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();

    await post(
      `/clients/${clientId}/targets`,
      { calories: 2200, proteinG: 170, carbsG: 200, fatG: 70, effectiveFrom: "2026-05-01" },
      { cookie: coachCookie },
    );
    await logCalories(clientId, clientCookie, "2026-05-02", 2100);
    await put(
      `/clients/${clientId}/metrics/2026-05-02`,
      { steps: 12000, bodyweightKg: 78 },
      { cookie: clientCookie },
    );

    const res = await get(`/clients/${clientId}/progress?from=2026-05-01&to=2026-05-31`, {
      cookie: coachCookie,
    });
    const body = (await res.json()) as Progress;

    expect(body.nutrition[0]).toMatchObject({
      date: "2026-05-02",
      calories: 2100,
      targetCalories: 2200,
    });
    expect(body.bodyweight[0]).toMatchObject({ date: "2026-05-02", value: 78 });
    expect(body.steps[0]).toMatchObject({ value: 12000 });
  });

  it("tracks the best set per session for an exercise", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const exercises = (await (await get("/exercises?q=Squat", { cookie: clientCookie })).json()) as {
      items: Exercise[];
    };
    const squat = exercises.items[0]!;

    for (const [date, weight] of [
      ["2026-02-01", 100],
      ["2026-02-08", 105],
    ] as const) {
      const session = (await (
        await post(`/clients/${clientId}/sessions`, { date }, { cookie: clientCookie })
      ).json()) as WorkoutSession;
      await post(
        `/sessions/${session.id}/sets`,
        { exerciseId: squat.id, reps: 5, weight },
        { cookie: clientCookie },
      );
      await post(
        `/sessions/${session.id}/sets`,
        { exerciseId: squat.id, reps: 5, weight: weight - 10 },
        { cookie: clientCookie },
      );
    }

    const history = (await (
      await get(`/clients/${clientId}/exercises/${squat.id}/history`, { cookie: coachCookie })
    ).json()) as ExerciseHistory;

    expect(history.points).toHaveLength(2);
    expect(history.points[0]).toMatchObject({ bestWeight: 100, repsAtBestWeight: 5 });
    expect(history.points[1]!.bestWeight).toBe(105);
    expect(history.points[1]!.estimated1rm).toBeCloseTo(122.5, 1);
  });

  it("keeps progress away from an unrelated coach", async () => {
    const { clientId } = await coachAndClient();
    const stranger = await signup({ role: "coach" });
    expect(
      (await get(`/clients/${clientId}/progress`, { cookie: sessionCookie(stranger.res) })).status,
    ).toBe(403);
  });
});

describe("comments", () => {
  it("lets a coach comment on a day and the client read it", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();

    const created = await post(
      `/clients/${clientId}/comments`,
      { targetType: "day", targetRef: TODAY, body: "Protein was low today" },
      { cookie: coachCookie },
    );
    expect(created.status).toBe(201);

    const list = (await (
      await get(`/clients/${clientId}/comments?targetType=day&targetRef=${TODAY}`, {
        cookie: clientCookie,
      })
    ).json()) as { items: Comment[] };
    expect(list.items[0]).toMatchObject({ body: "Protein was low today" });
  });

  it("only lets the author delete a comment", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const comment = (await (
      await post(
        `/clients/${clientId}/comments`,
        { targetType: "day", targetRef: TODAY, body: "Nice work" },
        { cookie: coachCookie },
      )
    ).json()) as Comment;

    expect((await del(`/comments/${comment.id}`, { cookie: clientCookie })).status).toBe(403);
    expect((await del(`/comments/${comment.id}`, { cookie: coachCookie })).status).toBe(200);
  });

  it("blocks an unrelated coach from commenting", async () => {
    const { clientId } = await coachAndClient();
    const stranger = await signup({ role: "coach" });
    const res = await post(
      `/clients/${clientId}/comments`,
      { targetType: "day", targetRef: TODAY, body: "Hello" },
      { cookie: sessionCookie(stranger.res) },
    );
    expect(res.status).toBe(403);
  });
});
