import { useMe } from "@/api/auth";
import { CoachInvites } from "@/components/CoachInvites";
import { ClientCoachCard } from "@/components/ClientCoachCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardPage() {
  const me = useMe();
  const data = me.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hi {data.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {data.user.role}.
        </p>
      </div>

      {data.user.role === "coach" && <CoachInvites clientCount={data.clientCount ?? 0} />}
      {data.user.role === "client" && <ClientCoachCard coach={data.coach} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming next</CardTitle>
          <CardDescription>
            Nutrition, workouts, steps and bodyweight arrive in the next phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Phase 1 covers accounts, sessions and the coach to client link.
        </CardContent>
      </Card>
    </div>
  );
}
