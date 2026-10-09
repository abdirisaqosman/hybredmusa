import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientAdherence, Comment, ExerciseHistory, Progress } from "@hybredmusa/shared";
import { apiFetch } from "./client";

export function useCoachDashboard() {
  return useQuery({
    queryKey: ["coach", "dashboard"],
    queryFn: () => apiFetch<{ items: ClientAdherence[] }>("/coach/dashboard"),
  });
}

export function useProgress(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["progress", clientId, from, to],
    queryFn: () => apiFetch<Progress>(`/clients/${clientId}/progress?from=${from}&to=${to}`),
    enabled: Boolean(clientId),
  });
}

export function useExerciseHistory(clientId: string, exerciseId: string) {
  return useQuery({
    queryKey: ["exercise-history", clientId, exerciseId],
    queryFn: () =>
      apiFetch<ExerciseHistory>(`/clients/${clientId}/exercises/${exerciseId}/history`),
    enabled: Boolean(clientId && exerciseId),
  });
}

export function useComments(clientId: string, targetType: "day" | "session", targetRef: string) {
  return useQuery({
    queryKey: ["comments", clientId, targetType, targetRef],
    queryFn: () =>
      apiFetch<{ items: Comment[] }>(
        `/clients/${clientId}/comments?targetType=${targetType}&targetRef=${encodeURIComponent(targetRef)}`,
      ),
    enabled: Boolean(clientId && targetRef),
  });
}

export function useAddComment(clientId: string, targetType: "day" | "session", targetRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<Comment>(`/clients/${clientId}/comments`, {
        method: "POST",
        body: JSON.stringify({ targetType, targetRef, body }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["comments", clientId, targetType, targetRef] }),
  });
}

export function useDeleteComment(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiFetch<{ ok: true }>(`/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", clientId] }),
  });
}
