import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFoodLogBody,
  Diary,
  Food,
  FoodLog,
  NutritionTarget,
  PublicUser,
} from "@hybredmusa/shared";
import { apiFetch } from "./client";

export const diaryKey = (clientId: string, date: string) => ["diary", clientId, date] as const;

export function useDiary(clientId: string, date: string) {
  return useQuery({
    queryKey: diaryKey(clientId, date),
    queryFn: () => apiFetch<Diary>(`/clients/${clientId}/diary?date=${date}`),
  });
}

export function useTarget(clientId: string, date?: string) {
  return useQuery({
    queryKey: ["target", clientId, date ?? "today"],
    queryFn: () =>
      apiFetch<{ target: NutritionTarget | null }>(
        `/clients/${clientId}/targets${date ? `?date=${date}` : ""}`,
      ),
  });
}

export function useSetTarget(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      effectiveFrom?: string;
    }) =>
      apiFetch<NutritionTarget>(`/clients/${clientId}/targets`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["target", clientId] });
      queryClient.invalidateQueries({ queryKey: ["diary", clientId] });
    },
  });
}

export function useAddFoodLog(clientId: string, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFoodLogBody) =>
      apiFetch<FoodLog>(`/clients/${clientId}/food-logs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKey(clientId, date) }),
  });
}

export function useDeleteFoodLog(clientId: string, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) =>
      apiFetch<{ ok: true }>(`/clients/${clientId}/food-logs/${logId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKey(clientId, date) }),
  });
}

export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ["foods", "search", query],
    queryFn: () =>
      apiFetch<{ items: Food[]; sources: { local: boolean; off: boolean; usda: boolean } }>(
        `/foods/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length >= 2,
  });
}

export function useBarcodeLookup() {
  return useMutation({
    mutationFn: (barcode: string) =>
      apiFetch<Food>(`/foods/barcode/${encodeURIComponent(barcode)}`),
  });
}

export function useCreateCustomFood() {
  return useMutation({
    mutationFn: (body: {
      name: string;
      brand?: string;
      caloriesPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
    }) => apiFetch<Food>("/foods", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useCoachClients() {
  return useQuery({
    queryKey: ["coach", "clients"],
    queryFn: () => apiFetch<{ items: PublicUser[] }>("/coach/clients"),
  });
}
