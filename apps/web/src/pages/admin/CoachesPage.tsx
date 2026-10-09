import { Link } from "@tanstack/react-router";
import { useAdminCoaches } from "@/api/admin";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminCoachesPage() {
  const coaches = useAdminCoaches();

  if (coaches.isPending) return <Skeleton className="h-48 w-full" />;
  if (coaches.isError) return <p className="text-sm text-destructive">{coaches.error.message}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Coach</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Active clients</TableHead>
          <TableHead>Clients who logged in 7 days</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {coaches.data?.items.map((row) => (
          <TableRow key={row.coach.id}>
            <TableCell>
              <Link
                to="/admin/users/$userId"
                params={{ userId: row.coach.id }}
                className="underline"
              >
                {row.coach.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.coach.email}</TableCell>
            <TableCell className="tabular-nums">{row.activeClients}</TableCell>
            <TableCell className="tabular-nums">{row.clientsActiveLast7Days}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
