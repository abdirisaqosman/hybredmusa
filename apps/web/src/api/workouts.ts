import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Exercise,
  SessionSet,
  WorkoutSession,
  WorkoutSessionSummary,
  WorkoutTemplate,
} from "@hybredmusa/shared";
import { apiFetch } from "./client";

export function useExercises(query = "") {
  return useQuery({
    queryKey: ["exercises", query],
    queryFn: () =>
      apiFetch<{ items: Exercise[] }>(`/exercises${query ? `?q=${encodeURIComponent(query)}` : ""}`),
    staleTime: 5 * 60_000,
  });
}

export function useTemplates(clientId: string) {
  return useQuery({
    queryKey: ["templates", clientId],
    queryFn: () => apiFetch<{ items: WorkoutTemplate[] }>(`/clients/${clientId}/templates`),
    enabled: Boolean(clientId),
  });
}

export interface TemplateInput {
  name: string;
  notes?: string | null;
  exercises: Array<{
    exerciseId: string;
    targetSets?: number | null;
    targetReps?: number | null;
    targetWeight?: number | null;
    restSeconds?: number | null;
  }>;
}

export function useSaveTemplate(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, ...body }: TemplateInput & { templateId?: string }) =>
      templateId
        ? apiFetch<WorkoutTemplate>(`/templates/${templateId}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : apiFetch<WorkoutTemplate>(`/clients/${clientId}/templates`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", clientId] }),
  });
}

export function useDeleteTemplate(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiFetch<{ ok: true }>(`/templates/${templateId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", clientId] }),
  });
}

export function useSessions(clientId: string, limit = 20) {
  return useQuery({
    queryKey: ["sessions", clientId, limit],
    queryFn: () =>
      apiFetch<{ items: WorkoutSessionSummary[]; nextCursor: string | null }>(
        `/clients/${clientId}/sessions?limit=${limit}`,
      ),
    enabled: Boolean(clientId),
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => apiFetch<WorkoutSession>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
}

export function useStartSession(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { templateId?: string | null }) =>
      apiFetch<WorkoutSession>(`/clients/${clientId}/sessions`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions", clientId] }),
  });
}

export function useLogSet(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { exerciseId: string; reps: number; weight: number; rpe?: number | null }) =>
      apiFetch<SessionSet>(`/sessions/${sessionId}/sets`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session", sessionId] }),
  });
}

export function useDeleteSet(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setId: string) =>
      apiFetch<{ ok: true }>(`/sessions/${sessionId}/sets/${setId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session", sessionId] }),
  });
}

export function useFinishSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string | null) =>
      apiFetch<WorkoutSession>(`/sessions/${sessionId}/finish`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function usePreviousPerformance(
  clientId: string,
  exerciseId: string,
  beforeSessionId: string,
) {
  return useQuery({
    queryKey: ["previous", clientId, exerciseId, beforeSessionId],
    queryFn: () =>
      apiFetch<{
        previous: { sessionId: string; date: string; sets: SessionSet[] } | null;
      }>(
        `/clients/${clientId}/exercises/${exerciseId}/previous?beforeSessionId=${beforeSessionId}`,
      ),
    enabled: Boolean(clientId && exerciseId && beforeSessionId),
  });
}
