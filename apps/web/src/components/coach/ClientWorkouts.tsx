import { useSessions } from "@/api/workouts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientWorkouts({ clientId }: { clientId: string }) {
  const sessions = useSessions(clientId, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent workouts</CardTitle>
        <CardDescription>What the client actually logged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.isPending && <Skeleton className="h-20 w-full" />}
        {sessions.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
        {sessions.data?.items.map((session) => (
          <div key={session.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-sm">{session.templateName ?? "Empty workout"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session.date} - {session.exerciseNames.join(", ") || "no sets"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{session.setCount} sets</span>
              {!session.finishedAt && <Badge variant="secondary">In progress</Badge>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
