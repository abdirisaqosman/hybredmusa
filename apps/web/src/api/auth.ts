import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  AuthResponse,
  Invite,
  LoginBody,
  MeResponse,
  PublicUser,
  SignupBody,
} from "@hybredmusa/shared";
import { apiFetch, ApiRequestError } from "./client";

export const meQuery = {
  queryKey: ["me"] as const,
  queryFn: async (): Promise<MeResponse | null> => {
    try {
      return await apiFetch<MeResponse>("/auth/me");
    } catch (error) {
      // Not signed in is a normal state, not an error the UI should show.
      if (error instanceof ApiRequestError && error.status === 401) return null;
      throw error;
    }
  },
};

export function useMe() {
  return useQuery(meQuery);
}

export function ensureMe(queryClient: QueryClient) {
  return queryClient.ensureQueryData(meQuery);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<LoginBody, "client">) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...body, client: "web" }),
      }),
    onSuccess: () => queryClient.removeQueries({ queryKey: meQuery.queryKey }),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SignupBody, "client">) =>
      apiFetch<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ ...body, client: "web" }),
      }),
    onSuccess: () => queryClient.removeQueries({ queryKey: meQuery.queryKey }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(meQuery.queryKey, null);
    },
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ["coach", "invites"],
    queryFn: () => apiFetch<{ items: Invite[] }>("/coach/invites"),
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Invite>("/coach/invites", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach", "invites"] }),
  });
}

export function useLinkToCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) =>
      apiFetch<{ coach: PublicUser }>("/client/link", {
        method: "POST",
        body: JSON.stringify({ inviteCode }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
  });
}
