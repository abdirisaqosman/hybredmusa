import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMe } from "@/api/auth";
import { useSessions, useStartSession, useTemplates } from "@/api/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkoutsPage() {
  const me = useMe();
  const navigate = useNavigate();
  const clientId = me.data?.user.id ?? "";
  const templates = useTemplates(clientId);
  const sessions = useSessions(clientId);
  const start = useStartSession(clientId);

  const begin = (templateId: string | null) =>
    start.mutate(
      { templateId },
      {
        onSuccess: (session) =>
          navigate({ to: "/workouts/$sessionId", params: { sessionId: session.id } }),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Workouts</h1>
        <Button onClick={() => begin(null)} disabled={start.isPending}>
          Start empty workout
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Your templates</h2>
        {templates.isPending && <Skeleton className="h-24 w-full" />}
        {templates.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Your coach has not assigned a template yet.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.data?.items.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription>
                  {template.exercises.map((e) => e.exerciseName).join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={() => begin(template.id)} disabled={start.isPending}>
                  Start
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">History</h2>
        {sessions.isPending && <Skeleton className="h-24 w-full" />}
        {sessions.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        )}
        <div className="space-y-2">
          {sessions.data?.items.map((session) => (
            <button
              key={session.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent"
              onClick={() =>
                navigate({ to: "/workouts/$sessionId", params: { sessionId: session.id } })
              }
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {session.templateName ?? "Empty workout"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.date} - {session.setCount} sets - {session.totalVolume} kg volume
                </p>
              </div>
              {!session.finishedAt && <Badge variant="secondary">In progress</Badge>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
