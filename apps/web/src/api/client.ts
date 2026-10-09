import type { ApiError } from "@hybredmusa/shared";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE = "/api/v1";

/** Thin typed wrapper over fetch. All calls go to the api Worker. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = body as ApiError | null;
    throw new ApiRequestError(
      res.status,
      err?.error?.code ?? "UNKNOWN",
      err?.error?.message ?? res.statusText,
    );
  }

  return body as T;
}
