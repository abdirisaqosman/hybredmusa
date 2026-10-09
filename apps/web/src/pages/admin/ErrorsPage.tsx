import { useState } from "react";
import { useAdminErrors } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminErrorsPage() {
  const [route, setRoute] = useState("");
  const [status, setStatus] = useState("");
  const errors = useAdminErrors({ route, status });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Filter by route"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Status"
          inputMode="numeric"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="max-w-28"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Full request logs live in Workers Logs. Open the Cloudflare dashboard, pick the
        hybredmusa-api Worker, then the Logs tab:{" "}
        <a
          className="underline"
          href="https://dash.cloudflare.com/?to=/:account/workers/services/view/hybredmusa-api/production/observability/logs"
          target="_blank"
          rel="noreferrer"
        >
          Workers Logs
        </a>
      </p>

      {errors.isPending && <Skeleton className="h-48 w-full" />}
      {errors.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No errors recorded.</p>
      )}

      {errors.data && errors.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.createdAt.slice(0, 16).replace("T", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.method} {row.route}
                  </TableCell>
                  <TableCell className="text-xs">{row.errorCode}</TableCell>
                  <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                    {row.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
