import { Link } from "@tanstack/react-router";
import { useCoachDashboard } from "@/api/coach";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function CoachClientsPage() {
  const dashboard = useCoachDashboard();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Adherence over the last 7 days, workouts this week, and today at a glance.
        </p>
      </div>

      {dashboard.isPending && <Skeleton className="h-40 w-full" />}
      {dashboard.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No clients yet. Share an invite code from the dashboard.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {dashboard.data?.items.map((row) => (
          <Link key={row.client.id} to="/coach/clients/$clientId" params={{ clientId: row.client.id }}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{row.client.name}</CardTitle>
                  <Badge variant={row.loggedFoodToday ? "default" : "secondary"}>
                    {row.loggedFoodToday ? "Logged today" : "No food today"}
                  </Badge>
                </div>
                <CardDescription>{row.client.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>7 day average calories</span>
                    <span className="tabular-nums">
                      {row.avgCalories7d ?? "-"}
                      {row.targetCalories ? ` / ${row.targetCalories}` : ""}
                    </span>
                  </div>
                  {row.adherencePct !== null && (
                    <Progress value={Math.min(100, row.adherencePct)} className="mt-1 h-1.5" />
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Workouts</dt>
                    <dd className="tabular-nums">{row.workoutsThisWeek} this week</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Steps today</dt>
                    <dd className="tabular-nums">{row.stepsToday ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Bodyweight</dt>
                    <dd className="tabular-nums">
                      {row.lastBodyweightKg !== null ? `${row.lastBodyweightKg} kg` : "-"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
