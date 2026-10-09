import { useQuery } from "@tanstack/react-query";
import type { Health } from "@hybredmusa/shared";
import { apiFetch } from "./client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<Health>("/health"),
  });
}
