import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminOverview,
  AdminUser,
  AdminUserDetail,
} from "@hybredmusa/shared";
import { apiFetch } from "./client";

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<AdminOverview>("/admin/overview"),
  });
}

export function useAdminUsers(query: string, cursor?: string) {
  return useQuery({
    queryKey: ["admin", "users", query, cursor ?? ""],
    queryFn: () =>
      apiFetch<Page<AdminUser>>(
        `/admin/users?limit=25${query ? `&q=${encodeURIComponent(query)}` : ""}${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`,
      ),
  });
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => apiFetch<AdminUserDetail>(`/admin/users/${userId}`),
    enabled: Boolean(userId),
  });
}

export function useAdminCoaches() {
  return useQuery({
    queryKey: ["admin", "coaches"],
    queryFn: () =>
      apiFetch<{
        items: Array<{
          coach: AdminUser;
          activeClients: number;
          clientsActiveLast7Days: number;
        }>;
      }>("/admin/coaches"),
  });
}

export interface ErrorLogRow {
  id: string;
  createdAt: string;
  route: string;
  method: string;
  status: number;
  errorCode: string;
  message: string;
  userId: string | null;
  requestId: string;
}

export function useAdminErrors(filters: { route: string; status: string }) {
  return useQuery({
    queryKey: ["admin", "errors", filters],
    queryFn: () =>
      apiFetch<Page<ErrorLogRow>>(
        `/admin/errors?limit=50${filters.route ? `&route=${encodeURIComponent(filters.route)}` : ""}${
          filters.status ? `&status=${filters.status}` : ""
        }`,
      ),
  });
}

export interface AuditRow {
  id: string;
  adminName: string;
  action: string;
  targetUserId: string | null;
  targetUserName: string | null;
  details: string | null;
  createdAt: string;
}

export function useAdminAudit() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => apiFetch<Page<AuditRow>>("/admin/audit?limit=50"),
  });
}

export function useAdminSystem() {
  return useQuery({
    queryKey: ["admin", "system"],
    queryFn: () =>
      apiFetch<{
        apiVersion: string;
        commit: string;
        checks: Array<{ name: string; ok: boolean; ms: number; detail: string | null }>;
      }>("/admin/system"),
    refetchOnMount: "always",
  });
}

/** Every admin write invalidates the whole admin area, including the audit log. */
export function useAdminAction(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown; method?: string }) =>
      apiFetch<{ ok: true }>(path, {
        method: body ? "POST" : "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (userId) queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
  });
}

export function useAdminUnlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiFetch<{ ok: true }>(`/admin/links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}
