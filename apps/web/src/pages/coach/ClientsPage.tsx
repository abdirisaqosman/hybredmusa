import { Link } from "@tanstack/react-router";
import { useCoachClients } from "@/api/nutrition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CoachClientsPage() {
  const clients = useCoachClients();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Clients</h1>

      {clients.isPending && <Skeleton className="h-32 w-full" />}
      {clients.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No clients yet. Share an invite code from the dashboard.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {clients.data?.items.map((client) => (
          <Link key={client.id} to="/coach/clients/$clientId" params={{ clientId: client.id }}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-base">{client.name}</CardTitle>
                <CardDescription>{client.email}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Last active {client.lastActiveAt ? client.lastActiveAt.slice(0, 10) : "never"}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
