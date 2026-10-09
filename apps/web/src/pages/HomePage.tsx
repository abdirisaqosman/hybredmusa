import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth } from "@/api/health";

export function HomePage() {
  const health = useHealth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {health.isPending && <Skeleton className="h-16 w-full" />}
          {health.isError && (
            <p className="text-sm text-destructive">{health.error.message}</p>
          )}
          {health.data && (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">ok</dt>
              <dd className="font-mono">{String(health.data.ok)}</dd>
              <dt className="text-muted-foreground">version</dt>
              <dd className="font-mono">{health.data.version}</dd>
              <dt className="text-muted-foreground">commit</dt>
              <dd className="font-mono">{health.data.commit}</dd>
            </dl>
          )}
          <Button asChild variant="outline" size="sm">
            <a href="/api/v1/docs">API docs</a>
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Signup and login land here in phase 1.{" "}
        <Link to="/" className="underline">
          Home
        </Link>
      </p>
    </div>
  );
}
