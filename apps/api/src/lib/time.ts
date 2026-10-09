/** Timestamps are ISO 8601 UTC. Days are YYYY-MM-DD. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoIn(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hoursSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
