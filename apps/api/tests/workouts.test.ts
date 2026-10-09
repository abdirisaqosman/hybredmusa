import { describe, expect, it } from "vitest";
import type {
  Exercise,
  SessionSet,
  WorkoutSession,
  WorkoutSessionSummary,
  WorkoutTemplate,
} from "@hybredmusa/shared";
import { coachAndClient, del, get, post, put, sessionCookie, signup } from "./helpers.js";

async function anyExercises(cookie: string, count = 2) {
  const res = await get("/exercises?q=press", { cookie });
  const body = (await res.json()) as { items: Exercise[] };
  return body.items.slice(0, count);
}

describe("exercise library", () => {
  it("ships with built in exercises and accepts custom ones", async () => {
    const { clientCookie } = await coachAndClient();

    const all = (await (await get("/exercises", { cookie: clientCookie })).json()) as {
      items: Exercise[];
    };
    expect(all.items.length).toBeGreaterThan(50);
    expect(all.items.every((e) => e.name.length > 0)).toBe(true);

    const created = await post(
      "/exercises",
      { name: "Sled Push", muscleGroup: "legs", equipment: "other" },
      { cookie: clientCookie },
    );
    expect(created.status).toBe(201);
    expect((await created.json()) as Exercise).toMatchObject({ isCustom: true });
  });

  it("keeps one user's custom exercises out of another user's library", async () => {
    const first = await signup({ role: "client" });
    const firstCookie = sessionCookie(first.res);
    await post(
      "/exercises",
      { name: "Secret Lift", muscleGroup: "back", equipment: "other" },
      { cookie: firstCookie },
    );

    const second = await signup({ role: "client" });
    const list = (await (
      await get("/exercises?q=Secret", { cookie: sessionCookie(second.res) })
    ).json()) as { items: Exercise[] };
    expect(list.items).toHaveLength(0);
  });
});

describe("templates", () => {
  it("lets a coach build and assign a template the client can see", async () => {
    const { clientId, coachCookie, clientCookie } = await coachAndClient();
    const [a, b] = await anyExercises(coachCookie);

    const created = await post(
      `/clients/${clientId}/templates`,
      {
        name: "Upper A",
        notes: "Leave one rep in reserve",
        exercises: [
          { exerciseId: a!.id, targetSets: 4, targetReps: 8, targetWeight: 60, restSeconds: 120 },
          { exerciseId: b!.id, targetSets: 3, targetReps: 12 },
        ],
      },
      { cookie: coachCookie },
    );
    expect(created.status).toBe(201);

    const template = (await created.json()) as WorkoutTemplate;
    expect(template.exercises).toHaveLength(2);
    expect(template.exercises[0]).toMatchObject({ position: 0, targetSets: 4 });

    const clientView = (await (
      await get(`/clients/${clientId}/templates`, { cookie: clientCookie })
    ).json()) as { items: WorkoutTemplate[] };
    expect(clientView.items.map((t) => t.id)).toContain(template.id);
  });

  it("refuses a client writing a template and a coach who is not linked", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const [a] = await anyExercises(coachCookie, 1);
    const body = { name: "Mine", exercises: [{ exerciseId: a!.id }] };

    expect((await post(`/clients/${clientId}/templates`, body, { cookie: clientCookie })).status).toBe(403);

    const stranger = await signup({ role: "coach" });
    expect(
      (await post(`/clients/${clientId}/templates`, body, { cookie: sessionCookie(stranger.res) }))
        .status,
    ).toBe(403);
  });

  it("rejects an unknown exercise id", async () => {
    const { clientId, coachCookie } = await coachAndClient();
    const res = await post(
      `/clients/${clientId}/templates`,
      { name: "Broken", exercises: [{ exerciseId: "does-not-exist" }] },
      { cookie: coachCookie },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "UNKNOWN_EXERCISE" } });
  });

  it("does not change logged sessions when the template is edited", async () => {
    const { clientId, coachCookie, clientCookie } = await coachAndClient();
    const [a, b] = await anyExercises(coachCookie);

    const template = (await (
      await post(
        `/clients/${clientId}/templates`,
        { name: "Day 1", exercises: [{ exerciseId: a!.id, targetSets: 3 }] },
        { cookie: coachCookie },
      )
    ).json()) as WorkoutTemplate;

    const session = (await (
      await post(`/clients/${clientId}/sessions`, { templateId: template.id }, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    await post(
      `/sessions/${session.id}/sets`,
      { exerciseId: a!.id, reps: 8, weight: 100 },
      { cookie: clientCookie },
    );

    const updated = await put(
      `/templates/${template.id}`,
      { name: "Day 1 revised", exercises: [{ exerciseId: b!.id, targetSets: 5 }] },
      { cookie: coachCookie },
    );
    expect(updated.status).toBe(200);

    const after = (await (await get(`/sessions/${session.id}`, { cookie: clientCookie })).json()) as WorkoutSession;
    expect(after.sets).toHaveLength(1);
    expect(after.sets[0]).toMatchObject({ exerciseId: a!.id, reps: 8, weight: 100 });
  });
});

describe("sessions", () => {
  it("runs a session from start to finish and numbers sets automatically", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const [a] = await anyExercises(coachCookie, 1);

    const session = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    expect(session.finishedAt).toBeNull();

    for (const reps of [10, 9, 8]) {
      const set = (await (
        await post(
          `/sessions/${session.id}/sets`,
          { exerciseId: a!.id, reps, weight: 80, rpe: 8 },
          { cookie: clientCookie },
        )
      ).json()) as SessionSet;
      expect(set.setNumber).toBe([10, 9, 8].indexOf(reps) + 1);
    }

    const finished = (await (
      await post(`/sessions/${session.id}/finish`, { notes: "Felt strong" }, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    expect(finished.finishedAt).toBeTruthy();
    expect(finished.notes).toBe("Felt strong");
    expect(finished.sets).toHaveLength(3);

    const history = (await (
      await get(`/clients/${clientId}/sessions`, { cookie: coachCookie })
    ).json()) as { items: WorkoutSessionSummary[] };
    expect(history.items[0]).toMatchObject({ setCount: 3, totalVolume: 2160 });
  });

  it("shows what the client did last time for an exercise", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const [a] = await anyExercises(coachCookie, 1);

    const first = (await (
      await post(`/clients/${clientId}/sessions`, { date: "2026-01-01" }, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    await post(
      `/sessions/${first.id}/sets`,
      { exerciseId: a!.id, reps: 5, weight: 90 },
      { cookie: clientCookie },
    );
    await post(`/sessions/${first.id}/finish`, {}, { cookie: clientCookie });

    const second = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;

    const previous = (await (
      await get(
        `/clients/${clientId}/exercises/${a!.id}/previous?beforeSessionId=${second.id}`,
        { cookie: clientCookie },
      )
    ).json()) as { previous: { date: string; sets: SessionSet[] } | null };

    expect(previous.previous?.date).toBe("2026-01-01");
    expect(previous.previous?.sets[0]).toMatchObject({ reps: 5, weight: 90 });
  });

  it("deletes a set", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const [a] = await anyExercises(coachCookie, 1);
    const session = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;
    const set = (await (
      await post(
        `/sessions/${session.id}/sets`,
        { exerciseId: a!.id, reps: 10, weight: 50 },
        { cookie: clientCookie },
      )
    ).json()) as SessionSet;

    expect((await del(`/sessions/${session.id}/sets/${set.id}`, { cookie: clientCookie })).status).toBe(200);
    const after = (await (await get(`/sessions/${session.id}`, { cookie: clientCookie })).json()) as WorkoutSession;
    expect(after.sets).toHaveLength(0);
  });

  it("lets the coach read sessions but never log or finish them", async () => {
    const { clientId, clientCookie, coachCookie } = await coachAndClient();
    const [a] = await anyExercises(coachCookie, 1);
    const session = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;

    expect((await get(`/sessions/${session.id}`, { cookie: coachCookie })).status).toBe(200);
    expect(
      (await post(
        `/sessions/${session.id}/sets`,
        { exerciseId: a!.id, reps: 10, weight: 50 },
        { cookie: coachCookie },
      )).status,
    ).toBe(403);
    expect((await post(`/sessions/${session.id}/finish`, {}, { cookie: coachCookie })).status).toBe(403);
    expect((await post(`/clients/${clientId}/sessions`, {}, { cookie: coachCookie })).status).toBe(403);
  });

  it("hides a session from an unrelated user", async () => {
    const { clientId, clientCookie } = await coachAndClient();
    const session = (await (
      await post(`/clients/${clientId}/sessions`, {}, { cookie: clientCookie })
    ).json()) as WorkoutSession;

    const stranger = await signup({ role: "coach" });
    expect(
      (await get(`/sessions/${session.id}`, { cookie: sessionCookie(stranger.res) })).status,
    ).toBe(403);
  });
});
