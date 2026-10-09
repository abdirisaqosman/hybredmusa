import { useAdminSystem } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminSystemPage() {
  const system = useAdminSystem();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Build</CardTitle>
          <CardDescription>What is deployed right now.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {system.isPending && <Skeleton className="h-10 w-full" />}
          {system.data && (
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">API version</dt>
              <dd className="font-mono">{system.data.apiVersion}</dd>
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="font-mono">{system.data.commit}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Dependencies</CardTitle>
            <CardDescription>Checked live when this page loads.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => system.refetch()}
            disabled={system.isFetching}
          >
            {system.isFetching ? "Checking..." : "Check again"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {system.isPending && <Skeleton className="h-24 w-full" />}
          {system.data?.checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm">{check.name}</p>
                {check.detail && (
                  <p className="truncate text-xs text-muted-foreground">{check.detail}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{check.ms} ms</span>
                <Badge variant={check.ok ? "default" : "destructive"}>
                  {check.ok ? "OK" : "failing"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
