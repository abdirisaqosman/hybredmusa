import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DailyMetric } from "@hybredmusa/shared";
import { apiFetch } from "./client";

export function useMetrics(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["metrics", clientId, from, to],
    queryFn: () =>
      apiFetch<{ items: DailyMetric[] }>(`/clients/${clientId}/metrics?from=${from}&to=${to}`),
    enabled: Boolean(clientId),
  });
}

export function useSaveMetric(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      ...body
    }: {
      date: string;
      steps?: number | null;
      bodyweightKg?: number | null;
    }) =>
      apiFetch<DailyMetric>(`/clients/${clientId}/metrics/${date}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["metrics", clientId] }),
  });
}
