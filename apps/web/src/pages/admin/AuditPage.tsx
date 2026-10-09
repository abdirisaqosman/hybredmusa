import { useAdminAudit } from "@/api/admin";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminAuditPage() {
  const audit = useAdminAudit();

  if (audit.isPending) return <Skeleton className="h-48 w-full" />;
  if (audit.isError) return <p className="text-sm text-destructive">{audit.error.message}</p>;
  if (audit.data?.items.length === 0)
    return <p className="text-sm text-muted-foreground">No admin actions yet.</p>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.data?.items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap tabular-nums">
                {row.createdAt.slice(0, 16).replace("T", " ")}
              </TableCell>
              <TableCell>{row.adminName}</TableCell>
              <TableCell className="font-mono text-xs">{row.action}</TableCell>
              <TableCell>{row.targetUserName ?? "-"}</TableCell>
              <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                {row.details ?? "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
